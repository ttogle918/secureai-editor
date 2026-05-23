package io.secureai.backend.domain.project.entity;

import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.SQLRestriction;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "projects")
@SQLRestriction("deleted_at IS NULL")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class Project extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // N+1 방지: 프로젝트 목록 조회 시 팀멤버를 IN 쿼리로 일괄 로딩 (한 번에 최대 30건)
    @BatchSize(size = 30)
    @OneToMany(mappedBy = "project", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TeamMember> teamMembers = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 50)
    private String language;

    @Column(length = 50)
    private String framework;

    @Column(nullable = false, length = 20)
    private String sourceType;

    @Column(length = 200)
    private String githubRepoFullName;

    @Column(length = 100)
    private String githubDefaultBranch;

    private Long githubWebhookId;

    @Column(length = 64)
    private String githubWebhookSecret;

    private Short latestSecurityScore;

    private UUID latestSessionId;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    private OffsetDateTime deletedAt;

    public void softDelete() {
        this.deletedAt = OffsetDateTime.now();
    }
}
