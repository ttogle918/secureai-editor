package io.secureai.backend.domain.analysis.repository;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.entity.SessionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnalysisSessionRepository extends JpaRepository<AnalysisSession, UUID> {

    // N+1 방지: 세션 목록 조회 시 project와 user를 함께 로딩
    @EntityGraph(attributePaths = {"project", "user"})
    Page<AnalysisSession> findByProjectIdOrderByCreatedAtDesc(UUID projectId, Pageable pageable);

    Optional<AnalysisSession> findByIdAndUserId(UUID id, UUID userId);

    boolean existsByProjectIdAndStatus(UUID projectId, SessionStatus status);

    @Modifying
    @Query("UPDATE AnalysisSession s SET s.status = :interrupted WHERE s.status = :running AND s.id = :id")
    int markInterrupted(@Param("id") UUID id,
                        @Param("interrupted") SessionStatus interrupted,
                        @Param("running") SessionStatus running);

    @Query("SELECT s FROM AnalysisSession s WHERE s.status = :status")
    List<AnalysisSession> findAllByStatus(@Param("status") SessionStatus status);

    @Modifying
    @Query("UPDATE AnalysisSession s SET s.vulnCount = s.vulnCount + :count WHERE s.id = :sessionId")
    void incrementVulnCount(@Param("sessionId") UUID sessionId, @Param("count") int count);
}
