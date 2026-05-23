package io.secureai.backend.domain.report.repository;

import io.secureai.backend.domain.report.entity.Report;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID> {

    Optional<Report> findByIdAndUserId(UUID id, UUID userId);

    Optional<Report> findByDownloadToken(String downloadToken);

    Page<Report> findByProjectId(UUID projectId, Pageable pageable);

    Page<Report> findByProjectIdAndSessionId(UUID projectId, UUID sessionId, Pageable pageable);
}
