package io.secureai.backend.domain.report.entity;

import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "compliance_frameworks", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"doc_type", "version"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ComplianceFramework extends BaseTimeEntity {

    @Id
    @GeneratedValue
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(name = "doc_type", nullable = false)
    private DocType docType;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 20)
    private String version;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "official_link", length = 500)
    private String officialLink;

    @Column(name = "form_link", length = 500)
    private String formLink;

    @OneToMany(mappedBy = "framework", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ComplianceControl> controls = new ArrayList<>();

    @Builder
    public ComplianceFramework(DocType docType, String name, String version, String status, String description, String officialLink, String formLink) {
        this.docType = docType;
        this.name = name;
        this.version = version;
        this.status = status;
        this.description = description;
        this.officialLink = officialLink;
        this.formLink = formLink;
    }
}
