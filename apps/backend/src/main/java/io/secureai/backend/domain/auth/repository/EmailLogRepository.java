package io.secureai.backend.domain.auth.repository;

import io.secureai.backend.domain.auth.entity.EmailLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface EmailLogRepository extends JpaRepository<EmailLog, UUID> {
}
