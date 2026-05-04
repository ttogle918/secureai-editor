package io.secureai.backend.domain.sbom.entity;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.project.entity.Project;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "dependency_components",
    indexes = {
        @Index(name = "idx_dep_session",  columnList = "session_id"),
        @Index(name = "idx_dep_project",  columnList = "project_id"),
        @Index(name = "idx_dep_artifact", columnList = "artifact_id")
    }
)
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DependencyComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private AnalysisSession session;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    /** maven / npm / pip / cargo */
    @Column(nullable = false, length = 20)
    private String packageManager;

    @Column(length = 200)
    private String groupId;

    @Column(nullable = false, length = 200)
    private String artifactId;

    @Column(length = 100)
    private String version;

    /** compile / test / provided 등 */
    @Column(length = 50)
    private String scope;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isDirect = true;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now();
    }
}
