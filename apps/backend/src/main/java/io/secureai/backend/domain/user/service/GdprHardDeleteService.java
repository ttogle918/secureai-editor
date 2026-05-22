package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.auth.service.EmailService;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.aop.AuditLogEntry;
import io.secureai.backend.global.aop.AuditLogRepository;
import io.secureai.backend.global.event.GdprUserHardDeleteEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import io.secureai.backend.domain.user.dto.GdprPendingDeletionResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * GDPR 하드 삭제 서비스.
 *
 * <p>소프트 삭제(deletedAt 기록) 후 30일이 경과한 사용자 계정과 연관 데이터를 완전 삭제한다.
 *
 * <p>처리 순서 (순서 엄격히 준수):
 * <ol>
 *   <li>audit_logs에 GDPR_HARD_DELETE 이벤트 기록</li>
 *   <li>GdprUserHardDeleteEvent 발행 → 각 도메인 리스너가 연관 데이터 삭제</li>
 *   <li>users 테이블에서 사용자 삭제</li>
 *   <li>삭제 완료 알림 이메일 발송 (삭제 전에 이메일 저장)</li>
 * </ol>
 *
 * <p>개별 사용자 처리 실패 시 skip & log — 전체 배치 중단 금지.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GdprHardDeleteService {

    private static final String GDPR_HARD_DELETE_ACTION = "GDPR_HARD_DELETE";
    private static final String RESOURCE_USER = "user";
    private static final String OUTCOME_SUCCESS = "SUCCESS";
    private static final int BATCH_SIZE = 50;
    private static final int HARD_DELETE_DAYS = 30;

    private final UserRepository userRepository;
    private final AuditLogRepository auditLogRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final EmailService emailService;

    /**
     * 소프트 삭제 후 30일이 경과한 계정을 배치 단위로 완전 삭제한다.
     * 배치당 최대 {@code BATCH_SIZE}(50)건 처리.
     */
    public void processExpiredAccounts() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(HARD_DELETE_DAYS);
        PageRequest pageRequest = PageRequest.of(0, BATCH_SIZE);

        Page<User> batch = userRepository.findExpiredSoftDeletedUsers(cutoff, pageRequest);
        int totalProcessed = 0;
        int totalFailed = 0;

        while (batch.hasContent()) {
            for (User user : batch.getContent()) {
                boolean success = processOneUser(user);
                if (success) {
                    totalProcessed++;
                } else {
                    totalFailed++;
                }
            }
            // 삭제 후 다시 첫 페이지를 조회 (offset 방식은 삭제 후 결과가 밀림)
            batch = userRepository.findExpiredSoftDeletedUsers(cutoff, pageRequest);
        }

        log.info("[gdpr-hard-delete] 배치 완료. processed={} failed={}", totalProcessed, totalFailed);
    }

    /**
     * 단일 사용자에 대한 하드 삭제를 수행한다.
     * 실패 시 false를 반환하고 로그를 남기며, 예외를 전파하지 않는다.
     */
    @Transactional
    public boolean processOneUser(User user) {
        try {
            String email = user.getEmail();

            // 1. audit_logs 기록 먼저 (삭제 전 감사 추적 보장)
            recordHardDeleteAudit(user.getId());

            // 2. 연관 도메인 데이터 삭제 이벤트 발행 (cross-domain Repository 직접 주입 금지)
            eventPublisher.publishEvent(new GdprUserHardDeleteEvent(user.getId()));

            // 3. users 테이블에서 삭제
            userRepository.deleteById(user.getId());

            // 4. 삭제 완료 알림 이메일 (이메일은 삭제 전 저장된 값 사용)
            emailService.sendAccountHardDeletedEmail(email);

            log.info("[gdpr-hard-delete] 사용자 하드 삭제 완료. userId={}", user.getId());
            return true;
        } catch (Exception e) {
            log.error("[gdpr-hard-delete] 사용자 하드 삭제 실패. userId={} error={}",
                    user.getId(), e.getMessage(), e);
            return false;
        }
    }

    /**
     * audit_logs에 GDPR_HARD_DELETE 이벤트를 기록한다.
     * 로그 저장 실패는 하드 삭제 플로우를 중단시키지 않는다.
     */
    private void recordHardDeleteAudit(UUID userId) {
        try {
            AuditLogEntry entry = AuditLogEntry.builder()
                    .actorId(userId)
                    .action(GDPR_HARD_DELETE_ACTION)
                    .resource(RESOURCE_USER)
                    .outcome(OUTCOME_SUCCESS)
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("[gdpr-hard-delete] audit log 저장 실패. userId={} error={}", userId, e.getMessage());
        }
    }

    /**
     * 소프트 삭제 후 30일 미만 대기 중인 사용자 목록을 반환한다 (관리자용).
     */
    public Page<GdprPendingDeletionResponse> getPendingDeletions(Pageable pageable) {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(HARD_DELETE_DAYS);
        return userRepository.findPendingHardDeleteUsers(cutoff, pageable)
                .map(GdprPendingDeletionResponse::from);
    }
}
