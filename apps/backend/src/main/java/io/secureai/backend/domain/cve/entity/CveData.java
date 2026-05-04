package io.secureai.backend.domain.cve.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(
    name = "cve_data",
    indexes = {
        @Index(name = "idx_cve_severity",     columnList = "severity"),
        @Index(name = "idx_cve_published_at", columnList = "publishedAt DESC")
    }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CveData {

    @Id
    @Column(name = "cve_id", length = 30)
    private String cveId;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(precision = 4, scale = 1)
    private BigDecimal cvssScore;

    @Column(length = 100)
    private String cvssVector;

    /** LOW / MEDIUM / HIGH / CRITICAL */
    @Column(length = 10)
    private String severity;

    private OffsetDateTime publishedAt;
    private OffsetDateTime modifiedAt;

    /** JSON 배열 — 영향받는 패키지 목록 */
    @Column(columnDefinition = "JSONB", nullable = false)
    @Builder.Default
    private String affectedProducts = "[]";

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @Column(nullable = false)
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
}
