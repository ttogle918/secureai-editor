package io.secureai.backend.domain.project.entity;

import io.secureai.backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "team_members")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "viewer";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invited_by")
    private User invitedBy;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime invitedAt;

    private OffsetDateTime acceptedAt;

    @PrePersist
    protected void onCreate() {
        this.invitedAt = OffsetDateTime.now();
    }

    public boolean isOwner() {
        return "owner".equals(this.role);
    }

    public boolean isAdmin() {
        return "admin".equals(this.role) || isOwner();
    }
}
