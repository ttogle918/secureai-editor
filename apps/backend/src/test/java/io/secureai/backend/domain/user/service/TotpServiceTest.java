package io.secureai.backend.domain.user.service;

import dev.samstevens.totp.qr.QrGenerator;
import io.secureai.backend.domain.user.entity.TotpRecoveryCode;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.TotpRecoveryCodeRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TotpServiceTest {

    @Mock UserRepository userRepository;
    @Mock TotpRecoveryCodeRepository recoveryCodeRepository;
    @Mock PasswordEncoder passwordEncoder;
    @Mock QrGenerator qrGenerator;

    @InjectMocks TotpService totpService;

    private UUID userId;
    private User user;

    @BeforeEach
    void setUp() throws Exception {
        userId = UUID.randomUUID();
        user = User.builder()
                .email("test@example.com")
                .username("testuser")
                .sastUsageResetAt(OffsetDateTime.now().plusMonths(1))
                .build();
        ReflectionTestUtils.setField(user, "id", userId);
        ReflectionTestUtils.setField(totpService, "issuer", "SecureAI");

        // QrGenerator 기본 stub — setupTotp 호출 테스트에서만 사용됨
        lenient().when(qrGenerator.generate(any())).thenReturn(new byte[]{0x01, 0x02});
        lenient().when(qrGenerator.getImageMimeType()).thenReturn("image/png");
    }

    // ── setupTotp ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("setupTotp — 복구 코드 8개와 QR URL, secret을 반환한다")
    void setupTotp_generatesQrUrlAndRecoveryCodes() throws Exception {
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(anyString())).thenReturn("$2a$hashed");
        when(recoveryCodeRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        when(userRepository.save(any(User.class))).thenReturn(user);

        var response = totpService.setupTotp(userId);

        assertThat(response.recoveryCodes()).hasSize(8);
        assertThat(response.secret()).isNotBlank();
        assertThat(response.qrCodeUrl()).startsWith("data:image/png;base64,");

        // 복구 코드가 BCrypt 해시로 저장됐는지 확인
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<TotpRecoveryCode>> captor = ArgumentCaptor.forClass(List.class);
        verify(recoveryCodeRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(8);
    }

    @Test
    @DisplayName("setupTotp — 사용자가 없으면 USER_NOT_FOUND 예외가 발생한다")
    void setupTotp_userNotFound_throwsException() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> totpService.setupTotp(userId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    // ── verifyAndEnable ───────────────────────────────────────────────────────

    @Test
    @DisplayName("verifyAndEnable — 유효한 TOTP 코드로 2FA가 활성화된다")
    void verifyAndEnable_validCode_enablesTotp() throws Exception {
        // 실제 TOTP 라이브러리를 이용해 현재 시각 기준 유효 코드를 생성하여 검증
        dev.samstevens.totp.secret.SecretGenerator secretGen =
                new dev.samstevens.totp.secret.DefaultSecretGenerator(32);
        String secret = secretGen.generate();
        user.setTotpSecret(secret);

        dev.samstevens.totp.time.TimeProvider timeProvider =
                new dev.samstevens.totp.time.SystemTimeProvider();
        dev.samstevens.totp.code.CodeGenerator codeGen =
                new dev.samstevens.totp.code.DefaultCodeGenerator(
                        dev.samstevens.totp.code.HashingAlgorithm.SHA1, 6);
        long bucket = Math.floorDiv(timeProvider.getTime(), 30);
        String validCode = codeGen.generate(secret, bucket);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        var response = totpService.verifyAndEnable(userId, validCode);

        assertThat(response.success()).isTrue();
        assertThat(user.isTotpEnabled()).isTrue();
    }

    @Test
    @DisplayName("verifyAndEnable — TOTP 미설정 상태에서 호출하면 TOTP_NOT_SETUP 예외가 발생한다")
    void verifyAndEnable_notSetup_throwsException() {
        // totpSecret이 null인 사용자
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> totpService.verifyAndEnable(userId, "123456"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.TOTP_NOT_SETUP);
    }

    @Test
    @DisplayName("verifyAndEnable — 이미 활성화된 상태에서 호출하면 TOTP_ALREADY_ENABLED 예외가 발생한다")
    void verifyAndEnable_alreadyEnabled_throwsException() {
        user.setTotpEnabled(true);
        user.setTotpSecret("JBSWY3DPEHPK3PXP");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> totpService.verifyAndEnable(userId, "123456"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.TOTP_ALREADY_ENABLED);
    }

    @Test
    @DisplayName("verifyAndEnable — 잘못된 TOTP 코드는 TOTP_INVALID_CODE 예외를 발생시킨다")
    void verifyAndEnable_invalidCode_throwsException() {
        user.setTotpSecret("JBSWY3DPEHPK3PXP");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        // 자리수 불일치(7자리)는 TOTP 규격상 항상 실패
        assertThatThrownBy(() -> totpService.verifyAndEnable(userId, "0000000"))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.TOTP_INVALID_CODE);
    }

    // ── useRecoveryCode ───────────────────────────────────────────────────────

    @Test
    @DisplayName("useRecoveryCode — 유효한 복구 코드를 사용하면 used_at이 설정된다")
    void useRecoveryCode_validCode_marksUsed() {
        String rawCode = "ABCD1234-EFGH5678";
        TotpRecoveryCode rc = TotpRecoveryCode.builder()
                .user(user)
                .codeHash("$2a$hashed_code")
                .build();

        when(recoveryCodeRepository.findUnusedForUpdate(userId)).thenReturn(List.of(rc));
        when(passwordEncoder.matches(rawCode, "$2a$hashed_code")).thenReturn(true);

        boolean result = totpService.useRecoveryCode(userId, rawCode);

        assertThat(result).isTrue();
        assertThat(rc.getUsedAt()).isNotNull();
        assertThat(rc.isUsed()).isTrue();
    }

    @Test
    @DisplayName("useRecoveryCode — 이미 사용된 복구 코드는 false를 반환한다")
    void useRecoveryCode_alreadyUsed_returnsFalse() {
        // findUnusedForUpdate는 used_at IS NULL 조건이므로 이미 사용된 코드는 반환되지 않음
        when(recoveryCodeRepository.findUnusedForUpdate(userId)).thenReturn(List.of());

        boolean result = totpService.useRecoveryCode(userId, "ABCD1234-EFGH5678");

        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("useRecoveryCode — 존재하지 않는 복구 코드는 false를 반환한다")
    void useRecoveryCode_invalidCode_returnsFalse() {
        TotpRecoveryCode rc = TotpRecoveryCode.builder()
                .user(user)
                .codeHash("$2a$hashed_code")
                .build();

        when(recoveryCodeRepository.findUnusedForUpdate(userId)).thenReturn(List.of(rc));
        when(passwordEncoder.matches(anyString(), eq("$2a$hashed_code"))).thenReturn(false);

        boolean result = totpService.useRecoveryCode(userId, "WRONG-CODE");

        assertThat(result).isFalse();
        assertThat(rc.getUsedAt()).isNull();
    }

    // ── disable ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("disable — 2FA 비활성화 시 secret null, totp_enabled false, 복구 코드 전체 삭제")
    void disable_clearsAllTotpData() {
        user.setTotpEnabled(true);
        user.setTotpSecret("JBSWY3DPEHPK3PXP");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenReturn(user);

        totpService.disable(userId);

        assertThat(user.isTotpEnabled()).isFalse();
        assertThat(user.getTotpSecret()).isNull();
        verify(recoveryCodeRepository).deleteAllByUserId(userId);
    }
}
