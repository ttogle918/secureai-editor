package io.secureai.backend.global.aop;

import lombok.extern.slf4j.Slf4j;
// import org.aspectj.lang.JoinPoint;
// import org.aspectj.lang.annotation.AfterReturning;
// import org.aspectj.lang.annotation.Aspect;
// import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Slf4j
// @Aspect
// @Component
public class AuditLogAspect {

    // @AfterReturning("@annotation(io.secureai.backend.global.aop.AuditLog)")
    public void logAudit(Object joinPoint) {
        /*
        MethodSignature sig = (MethodSignature) joinPoint.getSignature();
        AuditLog annotation = sig.getMethod().getAnnotation(AuditLog.class);

        String actorId = resolveActorId();
        String action = annotation.action().isEmpty() ? sig.getMethod().getName() : annotation.action();
        String resource = annotation.resource();

        // TODO Sprint 3: audit_logs 테이블에 저장
        log.info("AUDIT actor={} action={} resource={}", actorId, action, resource);
        */
    }

    private String resolveActorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UUID id) {
            return id.toString();
        }
        return "anonymous";
    }
}
