package io.secureai.backend.domain.organization.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "org_members")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrgMember {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID orgId;

    @Column(nullable = false)
    private UUID userId;

    /** "owner", "admin", "member" 중 하나 */
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String role = "member";

    private UUID invitedBy;

    @Column(nullable = false)
    @Builder.Default
    private OffsetDateTime invitedAt = OffsetDateTime.now();

    private OffsetDateTime acceptedAt;

    /** 초대 수락 대기 중 여부 */
    public boolean isPending() {
        return this.acceptedAt == null;
    }

    /** 초대가 수락된 멤버인지 확인 */
    public boolean isAccepted() {
        return this.acceptedAt != null;
    }

    /** 초대를 수락하고 acceptedAt 을 현재 시각으로 설정한다. */
    public void accept() {
        this.acceptedAt = OffsetDateTime.now();
    }
}
