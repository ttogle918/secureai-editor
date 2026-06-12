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

    /**
     * 웹훅 수신 시 projects 테이블에 매핑되는 프로젝트가 없을 경우 null이 될 수 있다.
     * null이면 해당 레포지토리는 SecureAI에 등록되지 않은 상태이며 분석은 skip된다.
     */
    @Column(name = "project_id")
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

    /**
     * AI Engine 분석 세션 ID — Redis 완료 콜백에서 PrReviewHistory를 역조회하는 키.
     * 분석 시작 전에는 null이며, startAnalysis 호출 후 세팅된다.
     */
    @Column(name = "session_id")
    private UUID sessionId;

    /**
     * GitHub App Installation ID — 분석 완료 시 설치 토큰을 재발급하기 위해 보관.
     * 원 토큰은 ~1시간 후 만료되므로 완료 콜백 시점에 재발급이 필요할 수 있다.
     */
    @Column(name = "installation_id")
    private Long installationId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Builder
    public PrReviewHistory(UUID projectId, String repoOwner, String repoName,
                           int prNumber, String headSha, UUID sessionId, Long installationId) {
        this.projectId = projectId;
        this.repoOwner = repoOwner;
        this.repoName = repoName;
        this.prNumber = prNumber;
        this.headSha = headSha;
        this.status = STATUS_PENDING;
        this.vulnCount = 0;
        this.sessionId = sessionId;
        this.installationId = installationId;
    }

    /**
     * AI Engine 분석 시작 후 sessionId를 기록한다.
     * 생성자에서 세팅할 수 없는 경우(sessionId가 startAnalysis 호출 후 확정되는 경우)에만 사용한다.
     */
    public void assignSession(UUID sessionId, Long installationId) {
        this.sessionId = sessionId;
        this.installationId = installationId;
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
