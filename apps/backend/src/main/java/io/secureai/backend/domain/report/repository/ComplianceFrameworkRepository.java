package io.secureai.backend.domain.report.repository;

import io.secureai.backend.domain.report.entity.ComplianceFramework;
import io.secureai.backend.domain.report.entity.DocType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ComplianceFrameworkRepository extends JpaRepository<ComplianceFramework, UUID> {
    List<ComplianceFramework> findByDocTypeAndStatusOrderByCreatedAtDesc(DocType docType, String status);
    Optional<ComplianceFramework> findByDocTypeAndVersion(DocType docType, String version);
}
