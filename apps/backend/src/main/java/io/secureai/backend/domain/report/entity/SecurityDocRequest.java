package io.secureai.backend.domain.report.entity;

import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "security_doc_requests",
    indexes = {
        @Index(name = "idx_security_doc_requests_project", columnList = "project_id"),
        @Index(name = "idx_security_doc_requests_token",   columnList = "download_token")
    }
)
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SecurityDocRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by", nullable = false)
    private User requestedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "doc_type", nullable = false, length = 20)
    private DocType docType;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    /** SecureRandom 32바이트 → HEX 64자. 로그 출력 금지. */
    @Column(length = 64, unique = true)
    private String downloadToken;

    private OffsetDateTime tokenExpiresAt;

    @Column(columnDefinition = "TEXT")
    private String filePath;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    private OffsetDateTime completedAt;

    // ── 상태 전이 메서드 ────────────────────────────────────────────────────

    public void markProcessing() {
        this.status = "PROCESSING";
    }

    public void markCompleted(String filePath, String downloadToken, OffsetDateTime tokenExpiresAt) {
        this.status = "COMPLETED";
        this.filePath = filePath;
        this.downloadToken = downloadToken;
        this.tokenExpiresAt = tokenExpiresAt;
        this.completedAt = OffsetDateTime.now();
    }

    public void markFailed(String errorMessage) {
        this.status = "FAILED";
        this.errorMessage = errorMessage;
        this.completedAt = OffsetDateTime.now();
    }

    public boolean isTokenExpired() {
        return tokenExpiresAt == null || OffsetDateTime.now().isAfter(tokenExpiresAt);
    }
}
