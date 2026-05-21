package io.secureai.backend.domain.dast.repository;

import io.secureai.backend.domain.dast.entity.ScanTarget;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ScanTargetRepository extends JpaRepository<ScanTarget, UUID> {

    Optional<ScanTarget> findByProjectIdAndDomain(UUID projectId, String domain);

    boolean existsByProjectIdAndDomainAndVerifiedTrue(UUID projectId, String domain);
}
