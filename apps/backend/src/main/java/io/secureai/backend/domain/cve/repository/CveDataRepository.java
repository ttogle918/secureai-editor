package io.secureai.backend.domain.cve.repository;

import io.secureai.backend.domain.cve.entity.CveData;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CveDataRepository extends JpaRepository<CveData, String> {

    Optional<CveData> findByCveId(String cveId);

    Page<CveData> findBySeverityOrderByPublishedAtDesc(String severity, Pageable pageable);
}
