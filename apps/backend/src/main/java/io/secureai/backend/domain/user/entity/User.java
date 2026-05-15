package io.secureai.backend.domain.user.entity;

import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.global.crypto.AesEncryptionConverter;
import io.secureai.backend.global.entity.BaseTimeEntity;
import io.secureai.backend.global.model.ModelConstants;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class User extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(length = 255)
    private String passwordHash;

    @Column(nullable = false, unique = true, length = 100)
    private String username;

    @Column(length = 100)
    private String displayName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "plan_id", nullable = false)
    private Plan plan;

    @Column(unique = true)
    private Long githubId;

    @Column(length = 100)
    private String githubLogin;

    @Convert(converter = AesEncryptionConverter.class)
    @Column(columnDefinition = "bytea")
    private String githubToken;

    private OffsetDateTime githubTokenExpiresAt;

    @Column(nullable = false)
    @Builder.Default
    private Integer sastUsageThisMonth = 0;

    @Column(nullable = false)
    private OffsetDateTime sastUsageResetAt;

    @Column(nullable = false)
    @Builder.Default
    private Boolean emailVerified = false;

    @Column(length = 64)
    private String emailVerifyToken;

    private OffsetDateTime emailVerifyExpiresAt;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    private OffsetDateTime lastLoginAt;

    @Column(nullable = false)
    @Builder.Default
    private Short loginFailCount = 0;

    private OffsetDateTime lockedUntil;

    @Column(nullable = false, length = 50)
    @Builder.Default
    private String timezone = "Asia/Seoul";

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String locale = "ko";

    private OffsetDateTime deletedAt;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isAdmin = false;

    @Column(length = 500)
    private String avatarUrl;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Column(nullable = false)
    @Builder.Default
    private Boolean publicProfile = false;

    @Column(nullable = false)
    @Builder.Default
    private Integer creditBalance = 100;

    @Convert(converter = AesEncryptionConverter.class)
    @Column(columnDefinition = "bytea")
    private String anthropicApiKey;

    @Column(length = 60, nullable = false)
    @Builder.Default
    private String preferredModel = ModelConstants.HAIKU;

    /** Critical 취약점 발견 시 GitHub PR 머지 차단 여부 */
    @Column(nullable = false)
    @Builder.Default
    private Boolean githubBlockMergeOnCritical = false;

    @Override
    @PrePersist
    protected void onCreate() {
        super.onCreate();
        if (this.sastUsageResetAt == null) {
            initSastUsageResetAt();
        }
    }

    private void initSastUsageResetAt() {
        this.sastUsageResetAt = OffsetDateTime.now()
                .withDayOfMonth(1).plusMonths(1)
                .withHour(0).withMinute(0).withSecond(0).withNano(0);
    }
}
