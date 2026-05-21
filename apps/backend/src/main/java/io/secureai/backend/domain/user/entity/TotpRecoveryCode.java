package io.secureai.backend.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "totp_recovery_codes")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TotpRecoveryCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /** BCrypt 해시로 저장 — 원문은 절대 로그에 출력하지 않는다 */
    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(name = "used_at")
    private OffsetDateTime usedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.createdAt == null) {
            this.createdAt = OffsetDateTime.now();
        }
    }

    public boolean isUsed() {
        return this.usedAt != null;
    }
}
