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
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;

public interface AnalysisSessionRepository extends JpaRepository<AnalysisSession, UUID> {

    // N+1 방지: 세션 목록 조회 시 project와 user를 함께 로딩
    @EntityGraph(attributePaths = {"project", "user"})
    Page<AnalysisSession> findByProjectIdOrderByCreatedAtDesc(UUID projectId, Pageable pageable);

    Optional<AnalysisSession> findByIdAndUserId(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM AnalysisSession s WHERE s.id = :id")
    Optional<AnalysisSession> findByIdForUpdate(@Param("id") UUID id);

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

    /** 프로젝트의 가장 최근 분석 세션 1건을 조회한다 (야간 스캔 변경 감지에 사용). */
    Optional<AnalysisSession> findTopByProjectIdOrderByCreatedAtDesc(UUID projectId);

    /**
     * 복수 사용자별 분석 세션 수를 집계한다.
     * 팀 대시보드 MemberStat.totalSessions 계산에 사용된다.
     *
     * @param userIds 집계 대상 사용자 ID 목록
     * @return Object[]{userId(UUID), count(Long)} 목록
     */
    @Query("SELECT s.user.id, COUNT(s) FROM AnalysisSession s WHERE s.user.id IN :userIds GROUP BY s.user.id")
    List<Object[]> countByUserIdIn(@Param("userIds") List<UUID> userIds);

    /**
     * 완료된 세션의 평균 처리 시간(MTTR)을 시간 단위로 반환한다.
     * startedAt ~ completedAt 평균을 구한다.
     *
     * @param userIds 집계 대상 사용자 ID 목록
     * @return 평균 MTTR (시간 단위, 데이터 없으면 0.0)
     */
    @Query(value = """
            SELECT COALESCE(
                AVG(EXTRACT(EPOCH FROM (s.completed_at - s.started_at)) / 3600), 0
            )
            FROM analysis_sessions s
            WHERE s.user_id IN (:userIds)
              AND s.completed_at IS NOT NULL
              AND s.started_at IS NOT NULL
            """, nativeQuery = true)
    Double avgMttrHoursByUserIdIn(@Param("userIds") List<UUID> userIds);
}
