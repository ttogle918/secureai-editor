package io.secureai.backend.domain.user.service;

import dev.samstevens.totp.code.CodeGenerator;
import dev.samstevens.totp.code.CodeVerifier;
import dev.samstevens.totp.code.DefaultCodeGenerator;
import dev.samstevens.totp.code.DefaultCodeVerifier;
import dev.samstevens.totp.code.HashingAlgorithm;
import dev.samstevens.totp.qr.QrData;
import dev.samstevens.totp.qr.QrGenerator;
import dev.samstevens.totp.secret.DefaultSecretGenerator;
import dev.samstevens.totp.secret.SecretGenerator;
import dev.samstevens.totp.time.SystemTimeProvider;
import dev.samstevens.totp.time.TimeProvider;
import dev.samstevens.totp.util.Utils;
import io.secureai.backend.domain.user.dto.TotpSetupResponse;
import io.secureai.backend.domain.user.dto.TotpVerifyResponse;
import io.secureai.backend.domain.user.entity.TotpRecoveryCode;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.TotpRecoveryCodeRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TotpService {

    private static final int RECOVERY_CODE_COUNT = 8;
    private static final int SECRET_LENGTH = 32;
    private static final int TOTP_DIGITS = 6;
    private static final int TOTP_PERIOD = 30;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final TotpRecoveryCodeRepository recoveryCodeRepository;
    private final PasswordEncoder passwordEncoder;
    private final QrGenerator qrGenerator;

    @Value("${secureai.totp.issuer:SecureAI}")
    private String issuer;

    /**
     * TOTP 설정을 초기화한다.
     * - 새 secret 생성 후 AES 암호화하여 DB 저장 (아직 미활성화)
     * - 8개 복구 코드를 BCrypt 해시로 저장, 원문 목록을 반환
     * - QR 코드 data URI 및 수동 입력용 secret 반환
     */
    @Transactional
    public TotpSetupResponse setupTotp(UUID userId) {
        User user = loadUser(userId);

        String secret = generateSecret();
        String qrCodeUrl = buildQrCodeDataUri(user.getEmail(), secret);
        List<String> rawCodes = generateAndSaveRecoveryCodes(user);

        // secret은 AesEncryptionConverter가 자동 암호화하여 DB에 저장
        user.setTotpSecret(secret);
        userRepository.save(user);

        log.info("TOTP setup initialized for userId={}", userId);
        return new TotpSetupResponse(qrCodeUrl, secret, rawCodes);
    }

    /**
     * TOTP 코드를 검증하고 2FA를 활성화한다.
     * setup 단계에서 저장된 secret으로 코드를 검증한 후 totp_enabled = true.
     */
    @Transactional
    public TotpVerifyResponse verifyAndEnable(UUID userId, String code) {
        User user = loadUser(userId);

        if (user.isTotpEnabled()) {
            throw new BusinessException(ErrorCode.TOTP_ALREADY_ENABLED);
        }
        if (user.getTotpSecret() == null) {
            throw new BusinessException(ErrorCode.TOTP_NOT_SETUP);
        }

        if (!verifyTotpCode(user.getTotpSecret(), code)) {
            throw new BusinessException(ErrorCode.TOTP_INVALID_CODE);
        }

        user.setTotpEnabled(true);
        userRepository.save(user);

        log.info("TOTP enabled for userId={}", userId);
        // 이미 setup 시 저장된 복구 코드의 원문은 재조회 불가 — 빈 목록 반환
        return new TotpVerifyResponse(true, List.of());
    }

    /**
     * 2FA를 비활성화한다.
     * totp_enabled = false, secret null, 복구 코드 전체 삭제.
     */
    @Transactional
    public void disable(UUID userId) {
        User user = loadUser(userId);
        user.setTotpEnabled(false);
        user.setTotpSecret(null);
        recoveryCodeRepository.deleteAllByUserId(userId);
        userRepository.save(user);
        log.info("TOTP disabled for userId={}", userId);
    }

    /**
     * 로그인 플로우에서 TOTP 코드를 검증한다.
     * totp_enabled 상태인 사용자에게만 호출해야 한다.
     */
    @Transactional(readOnly = true)
    public boolean verifyCode(UUID userId, String code) {
        User user = loadUser(userId);
        if (!user.isTotpEnabled() || user.getTotpSecret() == null) {
            throw new BusinessException(ErrorCode.TOTP_NOT_SETUP);
        }
        return verifyTotpCode(user.getTotpSecret(), code);
    }

    /**
     * 복구 코드를 사용한다.
     * 비관적 쓰기 락으로 동시 사용을 방지하고, 사용된 코드에 used_at을 기록한다.
     */
    @Transactional
    public boolean useRecoveryCode(UUID userId, String code) {
        List<TotpRecoveryCode> unusedCodes = recoveryCodeRepository.findUnusedForUpdate(userId);
        return unusedCodes.stream()
                .filter(rc -> passwordEncoder.matches(code, rc.getCodeHash()))
                .findFirst()
                .map(rc -> {
                    rc.setUsedAt(OffsetDateTime.now());
                    return true;
                })
                .orElse(false);
    }

    // ── private helpers ────────────────────────────────────────────────────

    private String generateSecret() {
        SecretGenerator secretGenerator = new DefaultSecretGenerator(SECRET_LENGTH);
        return secretGenerator.generate();
    }

    private String buildQrCodeDataUri(String email, String secret) {
        QrData qrData = new QrData.Builder()
                .label(email)
                .secret(secret)
                .issuer(issuer)
                .algorithm(HashingAlgorithm.SHA1)
                .digits(TOTP_DIGITS)
                .period(TOTP_PERIOD)
                .build();
        try {
            byte[] imageData = qrGenerator.generate(qrData);
            return Utils.getDataUriForImage(imageData, qrGenerator.getImageMimeType());
        } catch (Exception e) {
            throw new RuntimeException("QR 코드 생성 실패", e);
        }
    }

    private List<String> generateAndSaveRecoveryCodes(User user) {
        // 기존 복구 코드 초기화 후 새로 생성 (재설정 시 덮어쓰기)
        recoveryCodeRepository.deleteAllByUserId(user.getId());

        List<String> rawCodes = new ArrayList<>(RECOVERY_CODE_COUNT);
        List<TotpRecoveryCode> entities = new ArrayList<>(RECOVERY_CODE_COUNT);

        for (int i = 0; i < RECOVERY_CODE_COUNT; i++) {
            String rawCode = generateRawRecoveryCode();
            rawCodes.add(rawCode);
            entities.add(TotpRecoveryCode.builder()
                    .user(user)
                    .codeHash(passwordEncoder.encode(rawCode))
                    .build());
        }
        recoveryCodeRepository.saveAll(entities);
        // rawCode 원문은 로그에 절대 출력하지 않는다
        return rawCodes;
    }

    private String generateRawRecoveryCode() {
        // XXXX-XXXX 형태의 16진수 코드 (64비트 암호학적 엔트로피)
        long value = SECURE_RANDOM.nextLong() & Long.MAX_VALUE;
        String hex = String.format("%016X", value);
        return hex.substring(0, 8) + "-" + hex.substring(8);
    }

    private boolean verifyTotpCode(String secret, String code) {
        TimeProvider timeProvider = new SystemTimeProvider();
        CodeGenerator codeGenerator = new DefaultCodeGenerator(HashingAlgorithm.SHA1, TOTP_DIGITS);
        CodeVerifier verifier = new DefaultCodeVerifier(codeGenerator, timeProvider);
        return verifier.isValidCode(secret, code);
    }

    private User loadUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }
}
