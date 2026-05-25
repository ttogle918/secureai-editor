package io.secureai.backend.domain.scheduling.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * 프로젝트별 야간 자동 스캔 스케줄 설정.
 *
 * <p>project_id는 UNIQUE — 프로젝트당 스케줄 1건만 허용한다.
 * scanHour는 KST 기준이며, NightlyScanJob 크론 표현식은 UTC 16:00(=KST 01:00)으로 고정된다.
 * 향후 시간대별 스캔을 지원하려면 scanHour 필드를 UTC로 전환해야 한다.
 */
@Entity
@Table(
    name = "project_schedules",
    indexes = {
        @Index(name = "idx_project_schedules_project_id", columnList = "project_id"),
        @Index(name = "idx_project_schedules_active",    columnList = "is_active")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProjectSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false, unique = true)
    private UUID projectId;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    /** GitHub 스캔 기준 — 마지막으로 스캔한 커밋 SHA. null이면 전체 스캔 수행. */
    @Column(name = "last_scan_sha", length = 255)
    private String lastScanSha;

    /** 마지막 스캔 완료 시각 (UTC). */
    @Column(name = "last_scan_at")
    private Instant lastScanAt;

    /** 야간 스캔 희망 시각 (KST 기준 0~23). MVP에서는 표시용이며 실제 실행은 KST 01:00 고정. */
    @Column(name = "scan_hour", nullable = false)
    @Builder.Default
    private int scanHour = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }
}
