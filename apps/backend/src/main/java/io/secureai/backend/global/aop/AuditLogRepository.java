package io.secureai.backend.global.aop;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, UUID> {
}
