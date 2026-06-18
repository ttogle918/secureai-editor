package io.secureai.backend.domain.analysis.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 트리아지 피드백 이력 — append-only 라벨 학습 자산.
 *
 * <p>이 엔티티는 update/delete를 지원하지 않는다. 재트리아지 시 새 row를 insert한다.
 * reason 필드는 민감정보를 포함할 수 있으므로 로그에 절대 출력하지 않는다.
 */
@Entity
@Table(
    name = "triage_feedback",
    indexes = {
        @Index(name = "idx_triage_feedback_vuln",    columnList = "vulnerability_id"),
        @Index(name = "idx_triage_feedback_user",    columnList = "user_id"),
        @Index(name = "idx_triage_feedback_created", columnList = "created_at")
    }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TriageFeedback {

    /** CONFIRM, DISMISS, ACCEPT_PATCH */
    public static final String ACTION_CONFIRM      = "CONFIRM";
    public static final String ACTION_DISMISS      = "DISMISS";
    public static final String ACTION_ACCEPT_PATCH = "ACCEPT_PATCH";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "vulnerability_id", nullable = false)
    private UUID vulnerabilityId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** CONFIRM | DISMISS | ACCEPT_PATCH */
    @Column(nullable = false, length = 20)
    private String action;

    /**
     * 선택적 사유 — 민감정보 가능.
     * 로그에 이 필드를 절대 포함하지 않는다.
     */
    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
    }

    @Builder
    public TriageFeedback(UUID vulnerabilityId, UUID userId, String action, String reason) {
        this.vulnerabilityId = vulnerabilityId;
        this.userId          = userId;
        this.action          = action;
        this.reason          = reason;
    }
}
