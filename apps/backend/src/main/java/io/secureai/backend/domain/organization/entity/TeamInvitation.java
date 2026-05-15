package io.secureai.backend.domain.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "team_invitations")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamInvitation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** org 초대 시 non-null, project 초대 시 null */
    private UUID orgId;

    /** project 초대 시 non-null, org 초대 시 null */
    private UUID projectId;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "member";

    /** URL-safe 무작위 토큰 (64자) — 로그 출력 금지 */
    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @Column(nullable = false)
    private UUID invitedBy;

    @Column(nullable = false)
    private OffsetDateTime expiresAt;

    private OffsetDateTime acceptedAt;

    @Column(nullable = false, updatable = false)
    @Builder.Default
    private OffsetDateTime createdAt = OffsetDateTime.now();

    /** 초대 토큰이 만료되었는지 확인 */
    public boolean isExpired() {
        return OffsetDateTime.now().isAfter(this.expiresAt);
    }

    /** 초대가 이미 수락되었는지 확인 */
    public boolean isAccepted() {
        return this.acceptedAt != null;
    }

    /** 초대를 수락하고 acceptedAt 을 현재 시각으로 설정한다. */
    public void accept() {
        this.acceptedAt = OffsetDateTime.now();
    }
}
