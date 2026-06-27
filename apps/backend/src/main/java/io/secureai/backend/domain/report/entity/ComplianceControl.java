package io.secureai.backend.domain.report.entity;

import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "compliance_controls", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"framework_id", "control_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ComplianceControl extends BaseTimeEntity {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "framework_id", nullable = false)
    private ComplianceFramework framework;

    @Column(name = "control_id", nullable = false, length = 50)
    private String controlId;

    @Column(length = 100)
    private String category;

    @Column(nullable = false, length = 255)
    private String name;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "related_vuln_types", columnDefinition = "jsonb")
    private List<String> relatedVulnTypes;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Builder
    public ComplianceControl(ComplianceFramework framework, String controlId, String category, String name, List<String> relatedVulnTypes, String description) {
        this.framework = framework;
        this.controlId = controlId;
        this.category = category;
        this.name = name;
        this.relatedVulnTypes = relatedVulnTypes;
        this.description = description;
    }
}
