package io.secureai.backend.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, unique = true, length = 64)
    private String tokenHash;

    @Column(length = 255)
    private String deviceInfo;

    private String ipAddress;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime issuedAt;

    @Column(nullable = false)
    private OffsetDateTime expiresAt;

    private OffsetDateTime revokedAt;

    @Column(length = 50)
    private String revokedReason;

    @PrePersist
    protected void onCreate() {
        this.issuedAt = OffsetDateTime.now();
    }

    public boolean isRevoked() {
        return this.revokedAt != null;
    }

    public boolean isExpired() {
        return OffsetDateTime.now().isAfter(this.expiresAt);
    }

    public void revoke(String reason) {
        this.revokedAt = OffsetDateTime.now();
        this.revokedReason = reason;
    }
}
