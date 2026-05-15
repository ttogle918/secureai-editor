package io.secureai.backend.domain.analysis.entity;

import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * GitHub PR 보안 리뷰 이력.
 *
 * Webhook 수신 시 pending 상태로 생성되고, AI Engine 분석 완료 후
 * completed 또는 error로 전이된다(상태 전이 메서드로 불변식 보호).
 */
@Entity
@Table(name = "pr_review_history")
@Getter
@NoArgsConstructor
public class PrReviewHistory {

    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_COMPLETED = "completed";
    private static final String STATUS_ERROR = "error";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "repo_owner", nullable = false)
    private String repoOwner;

    @Column(name = "repo_name", nullable = false)
    private String repoName;

    @Column(name = "pr_number", nullable = false)
    private int prNumber;

    @Column(name = "head_sha", nullable = false, length = 40)
    private String headSha;

    @Column(nullable = false, length = 20)
    private String status = STATUS_PENDING;

    @Column(name = "vuln_count", nullable = false)
    private int vulnCount = 0;

    @Column(name = "check_run_id")
    private Long checkRunId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Builder
    public PrReviewHistory(UUID projectId, String repoOwner, String repoName,
                           int prNumber, String headSha) {
        this.projectId = projectId;
        this.repoOwner = repoOwner;
        this.repoName = repoName;
        this.prNumber = prNumber;
        this.headSha = headSha;
        this.status = STATUS_PENDING;
        this.vulnCount = 0;
    }

    /**
     * 분석 완료 시 상태를 completed로 전이하고 취약점 수와 Check Run ID를 기록한다.
     */
    public void markCompleted(int vulnCount, Long checkRunId) {
        this.status = STATUS_COMPLETED;
        this.vulnCount = vulnCount;
        this.checkRunId = checkRunId;
        this.completedAt = OffsetDateTime.now();
    }

    /**
     * 분석 실패 시 상태를 error로 전이한다.
     */
    public void markError() {
        this.status = STATUS_ERROR;
        this.completedAt = OffsetDateTime.now();
    }
}
