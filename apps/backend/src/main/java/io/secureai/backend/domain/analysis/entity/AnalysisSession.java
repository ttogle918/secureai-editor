package io.secureai.backend.domain.analysis.entity;

import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "analysis_sessions")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisSession extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Convert(converter = SessionStatusConverter.class)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SessionStatus status = SessionStatus.PENDING;

    @Column(nullable = false)
    @Builder.Default
    private Integer totalFiles = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer scannedFiles = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer vulnCount = 0;

    @Column(name = "scan_mode", nullable = false)
    @Builder.Default
    private String scanMode = "PIPELINE";

    private OffsetDateTime startedAt;
    private OffsetDateTime completedAt;

    public void markRunning() {
        this.status = SessionStatus.RUNNING;
        this.startedAt = OffsetDateTime.now();
    }

    public void markCompleted() {
        this.status = SessionStatus.COMPLETED;
        this.completedAt = OffsetDateTime.now();
    }

    public void markError() {
        this.status = SessionStatus.ERROR;
        this.completedAt = OffsetDateTime.now();
    }

    public void markInterrupted() {
        this.status = SessionStatus.INTERRUPTED;
    }

    /** STAGE-2: planning_node interrupt 후 사용자 컨펌 대기 상태로 전환. */
    public void markAwaitingConfirmation() {
        this.status = SessionStatus.AWAITING_CONFIRMATION;
    }
}
