package io.secureai.backend.domain.report.repository;

import io.secureai.backend.domain.report.entity.Report;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReportRepository extends JpaRepository<Report, UUID> {

    Optional<Report> findByIdAndUserId(UUID id, UUID userId);

    Optional<Report> findByDownloadToken(String downloadToken);

    Page<Report> findByProjectId(UUID projectId, Pageable pageable);

    Page<Report> findByProjectIdAndSessionId(UUID projectId, UUID sessionId, Pageable pageable);

    // 만료 데이터 일괄 삭제 (ExpiredDataCleanupJob 전용)
    @Modifying
    @Query("DELETE FROM Report r WHERE r.createdAt < :cutoff")
    int deleteByCreatedAtBefore(@Param("cutoff") OffsetDateTime cutoff);

    // GDPR 계정 삭제 전 사용자 리포트 일괄 삭제
    @Modifying
    @Query("DELETE FROM Report r WHERE r.user.id = :userId")
    int deleteByUserId(@Param("userId") UUID userId);
}
