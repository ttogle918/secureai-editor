package io.secureai.backend.domain.analysis.repository;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnalysisSessionRepository extends JpaRepository<AnalysisSession, UUID> {

    Page<AnalysisSession> findByProjectIdOrderByCreatedAtDesc(UUID projectId, Pageable pageable);

    Optional<AnalysisSession> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByProjectIdAndStatus(UUID projectId, String status);

    @Modifying
    @Query("UPDATE AnalysisSession s SET s.status = 'interrupted' WHERE s.status = 'running' AND s.id = :id")
    int markInterrupted(UUID id);

    @Query("SELECT s FROM AnalysisSession s WHERE s.status = 'running'")
    List<AnalysisSession> findAllRunning();
}
