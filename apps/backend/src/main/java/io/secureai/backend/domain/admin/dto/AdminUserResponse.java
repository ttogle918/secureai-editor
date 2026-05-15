package io.secureai.backend.domain.admin.dto;

import io.secureai.backend.domain.user.entity.User;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminUserResponse(
        UUID id,
        String email,
        String username,
        String displayName,
        short planId,
        String planName,
        int creditBalance,
        boolean hasByok,
        boolean isAdmin,
        boolean isActive,
        OffsetDateTime lastLoginAt,
        OffsetDateTime createdAt
) {
    public static AdminUserResponse from(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getEmail(),
                user.getUsername(),
                user.getDisplayName(),
                user.getPlan().getId(),
                user.getPlan().getDisplayName(),
                user.getCreditBalance(),
                user.getAnthropicApiKey() != null,
                Boolean.TRUE.equals(user.getIsAdmin()),
                Boolean.TRUE.equals(user.getIsActive()),
                user.getLastLoginAt(),
                user.getCreatedAt()
        );
    }
}
