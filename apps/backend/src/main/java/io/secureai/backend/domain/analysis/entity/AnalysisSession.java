package io.secureai.backend.domain.analysis.entity;

import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "analysis_sessions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** pending / running / completed / error / interrupted / cancelled */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "pending";

    @Column(nullable = false)
    @Builder.Default
    private Integer totalFiles = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer scannedFiles = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer vulnCount = 0;

    private OffsetDateTime startedAt;
    private OffsetDateTime completedAt;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
        this.updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public void markRunning() {
        this.status = "running";
        this.startedAt = OffsetDateTime.now();
    }

    public void markCompleted() {
        this.status = "completed";
        this.completedAt = OffsetDateTime.now();
    }

    public void markError() {
        this.status = "error";
        this.completedAt = OffsetDateTime.now();
    }

    public void markInterrupted() {
        this.status = "interrupted";
    }
}
