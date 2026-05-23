package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.user.dto.GdprExportResponse;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.RefreshTokenRepository;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.aop.AuditLogEntry;
import io.secureai.backend.global.aop.AuditLogRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * GDPR 데이터 이동권(export) 및 삭제권(delete) 서비스.
 *
 * <p>삭제 흐름:
 * <ol>
 *   <li>deleteAccount() 호출 시 소프트 삭제 — user.markAsDeleted() 로 deletedAt 기록</li>
 *   <li>refresh_tokens 즉시 revoke (세션 무효화)</li>
 *   <li>30일 후 GdprHardDeleteJob이 실제 데이터를 완전 삭제</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GdprService {

    private static final String GDPR_DELETE_ACTION = "GDPR_DELETE";
    private static final String RESOURCE_USER = "user";
    private static final String OUTCOME_SUCCESS = "SUCCESS";

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuditLogRepository auditLogRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * 현재 인증된 사용자의 개인 데이터를 JSON 형식으로 내보낸다.
     * 민감 자격증명(토큰, API 키)은 포함하지 않는다.
     *
     * @param userId JWT에서 추출된 인증 사용자 ID
     * @return 개인 데이터 내보내기 응답
     */
    @Transactional(readOnly = true)
    public GdprExportResponse exportData(UUID userId) {
        User user = loadUser(userId);
        return GdprExportResponse.from(user);
    }

    /**
     * 현재 인증된 사용자의 계정을 소프트 삭제한다.
     *
     * <p>deletedAt을 현재 시각으로 기록하고 계정을 비활성화한다.
     * 실제 데이터 삭제(하드 삭제)는 30일 후 GdprHardDeleteJob이 수행한다.
     * 비밀번호가 설정된 사용자는 confirmPassword로 본인 확인을 수행한다.
     *
     * @param userId          JWT에서 추출된 인증 사용자 ID
     * @param confirmPassword 본인 확인용 현재 비밀번호 (OAuth 전용 계정은 null 허용)
     */
    @Transactional
    public void deleteAccount(UUID userId, String confirmPassword) {
        User user = loadUser(userId);
        verifyPassword(user, confirmPassword);

        recordGdprDeleteAudit(userId);
        user.markAsDeleted();
        refreshTokenRepository.revokeAllByUserId(userId, OffsetDateTime.now(), "gdpr_soft_delete");

        log.info("GDPR 계정 소프트 삭제 완료. actor={} deletedAt={}", userId, user.getDeletedAt());
    }

    // ── private helpers ────────────────────────────────────────────────────────

    private User loadUser(UUID userId) {
        return userRepository.findByIdWithPlan(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    /**
     * 비밀번호 설정 계정은 confirmPassword가 일치해야 한다.
     * OAuth 전용 계정(passwordHash == null)은 비밀번호 검증을 건너뛴다.
     */
    private void verifyPassword(User user, String confirmPassword) {
        if (user.getPasswordHash() == null) {
            return;
        }
        if (!passwordEncoder.matches(confirmPassword, user.getPasswordHash())) {
            throw new BusinessException(ErrorCode.USER_INVALID_PASSWORD);
        }
    }

    /**
     * 삭제 전 audit_log에 GDPR_DELETE 이벤트를 기록한다.
     * 로그 저장 실패는 삭제 플로우를 중단시키지 않는다.
     */
    private void recordGdprDeleteAudit(UUID userId) {
        try {
            AuditLogEntry entry = AuditLogEntry.builder()
                    .actorId(userId)
                    .action(GDPR_DELETE_ACTION)
                    .resource(RESOURCE_USER)
                    .outcome(OUTCOME_SUCCESS)
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("GDPR_DELETE audit log 저장 실패. actor={} error={}", userId, e.getMessage());
        }
    }

    // cascadeDelete 는 GdprHardDeleteService 로 이관 — 소프트 삭제 후 30일 후 실행
}
