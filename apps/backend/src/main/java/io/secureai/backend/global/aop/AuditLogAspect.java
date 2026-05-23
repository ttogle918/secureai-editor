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
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private static final String OUTCOME_SUCCESS = "SUCCESS";
    private static final String OUTCOME_FAILURE = "FAILURE";

    private final AuditLogRepository auditLogRepository;

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

        AuditLogEntry entry = AuditLogEntry.builder()
                .actorId(actorId != null ? UUID.fromString(actorId) : null)
                .action(action)
                .resource(resource)
                .outcome(outcome)
                .build();

        try {
            auditLogRepository.save(entry);
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
