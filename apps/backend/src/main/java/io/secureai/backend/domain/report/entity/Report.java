package io.secureai.backend.domain.report.entity;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "reports",
    indexes = {
        @Index(name = "idx_reports_project_id", columnList = "project_id"),
        @Index(name = "idx_reports_download_token", columnList = "download_token")
    }
)
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id")
    private AnalysisSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 10)
    private String format;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @Column(columnDefinition = "TEXT")
    private String filePath;

    @Column(length = 64, unique = true)
    private String downloadToken;

    private OffsetDateTime downloadTokenExpiresAt;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    private OffsetDateTime completedAt;

    @Column(nullable = false)
    @Builder.Default
    private OffsetDateTime expiresAt = OffsetDateTime.now().plusDays(90);

    /** 리포트 생성 시작 — PENDING → GENERATING */
    public void markGenerating() {
        this.status = "GENERATING";
    }

    /** 리포트 생성 완료 — GENERATING → COMPLETED */
    public void markCompleted(String filePath, String downloadToken, OffsetDateTime tokenExpiresAt) {
        this.status = "COMPLETED";
        this.filePath = filePath;
        this.downloadToken = downloadToken;
        this.downloadTokenExpiresAt = tokenExpiresAt;
        this.completedAt = OffsetDateTime.now();
    }

    /** 리포트 생성 실패 — GENERATING → FAILED */
    public void markFailed() {
        this.status = "FAILED";
        this.completedAt = OffsetDateTime.now();
    }
}
