package io.secureai.backend.domain.user.dto;

import io.secureai.backend.domain.user.entity.User;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * GDPR 데이터 내보내기 응답 DTO.
 * 개인 식별 정보(PII)를 포함하므로 GitHub 토큰·API 키 등 민감 자격증명은 제외한다.
 */
@Getter
@Builder
public class GdprExportResponse {

    private UUID id;
    private String email;
    private String username;
    private String displayName;
    private String githubLogin;
    private String timezone;
    private String locale;
    private String avatarUrl;
    private String bio;
    private boolean publicProfile;
    private boolean emailVerified;
    private boolean isActive;
    private boolean hasGithubLinked;
    private boolean hasByok;
    private OffsetDateTime lastLoginAt;
    private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime exportedAt;

    public static GdprExportResponse from(User user) {
        return GdprExportResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .githubLogin(user.getGithubLogin())
                .timezone(user.getTimezone())
                .locale(user.getLocale())
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .publicProfile(Boolean.TRUE.equals(user.getPublicProfile()))
                .emailVerified(Boolean.TRUE.equals(user.getEmailVerified()))
                .isActive(Boolean.TRUE.equals(user.getIsActive()))
                .hasGithubLinked(user.getGithubId() != null)
                .hasByok(user.getAnthropicApiKey() != null)
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .exportedAt(OffsetDateTime.now())
                .build();
    }
}
