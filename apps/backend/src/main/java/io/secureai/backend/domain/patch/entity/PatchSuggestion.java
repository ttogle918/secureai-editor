package io.secureai.backend.domain.patch.entity;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.entity.Vulnerability;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "patch_suggestions",
    indexes = {
        @Index(name = "idx_patch_session",   columnList = "session_id"),
        @Index(name = "idx_patch_vuln",      columnList = "vuln_id"),
        @Index(name = "idx_patch_cache_key", columnList = "cache_key")
    }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class PatchSuggestion extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private AnalysisSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vuln_id")
    private Vulnerability vulnerability;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String filePath;

    @Column(nullable = false, length = 50)
    private String vulnType;

    @Column(columnDefinition = "TEXT")
    private String originalSnippet;

    @Column(columnDefinition = "TEXT")
    private String patchedSnippet;

    @Column(columnDefinition = "TEXT")
    private String unifiedDiff;

    @Column(columnDefinition = "TEXT")
    private String explanation;

    @Column(length = 200)
    private String cacheKey;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isApplied = false;

    private OffsetDateTime appliedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "applied_by")
    private User appliedBy;

    public void apply(User user) {
        this.isApplied = true;
        this.appliedAt = OffsetDateTime.now();
        this.appliedBy = user;
    }
}
