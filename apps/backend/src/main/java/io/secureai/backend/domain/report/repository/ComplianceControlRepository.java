package io.secureai.backend.domain.report.repository;

import io.secureai.backend.domain.report.entity.ComplianceControl;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ComplianceControlRepository extends JpaRepository<ComplianceControl, UUID> {
    List<ComplianceControl> findByFrameworkIdOrderByControlIdAsc(UUID frameworkId);
}
