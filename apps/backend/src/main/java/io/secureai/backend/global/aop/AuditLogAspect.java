package io.secureai.backend.global.aop;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * @AuditLog 어노테이션이 붙은 메서드의 성공/실패를 audit_logs 테이블에 저장한다.
 * 저장 실패는 원래 요청 처리에 영향을 주지 않는다 — try-catch로 격리.
 * 저장은 AuditLogChainAppender를 통해 해시 체인으로 직렬화된다.
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private static final String OUTCOME_SUCCESS = "SUCCESS";
    private static final String OUTCOME_FAILURE = "FAILURE";

    private final AuditLogChainAppender chainAppender;

    @AfterReturning("@annotation(io.secureai.backend.global.aop.AuditLog)")
    public void logAuditSuccess(JoinPoint joinPoint) {
        saveAuditLog(joinPoint, OUTCOME_SUCCESS);
    }

    @AfterThrowing("@annotation(io.secureai.backend.global.aop.AuditLog)")
    public void logAuditFailure(JoinPoint joinPoint) {
        saveAuditLog(joinPoint, OUTCOME_FAILURE);
    }

    private void saveAuditLog(JoinPoint joinPoint, String outcome) {
        MethodSignature sig = (MethodSignature) joinPoint.getSignature();
        AuditLog annotation = sig.getMethod().getAnnotation(AuditLog.class);

        String actorId = resolveActorId();
        String action = annotation.action().isEmpty() ? sig.getMethod().getName() : annotation.action();
        String resource = annotation.resource().isEmpty() ? null : annotation.resource();

        // createdAt을 여기서 고정 — chain appender로 전달되는 시점과 무관하게 기록 시각 보존
        AuditLogEntry draft = AuditLogEntry.builder()
                .actorId(actorId != null ? UUID.fromString(actorId) : null)
                .action(action)
                .resource(resource)
                .outcome(outcome)
                .build();

        // @PrePersist가 createdAt을 채우도록 직접 호출 (draft는 아직 영속화 전)
        draft.onCreate();

        try {
            chainAppender.append(draft);
            // 민감 정보(payload 내용)는 로그에 출력하지 않는다
            log.info("AUDIT actor={} action={} resource={} outcome={}", actorId, action, resource, outcome);
        } catch (Exception e) {
            log.warn("audit log save failed action={} outcome={} error={}", action, outcome, e.getMessage());
        }
    }

    private String resolveActorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UUID id) {
            return id.toString();
        }
        return null;
    }
}
