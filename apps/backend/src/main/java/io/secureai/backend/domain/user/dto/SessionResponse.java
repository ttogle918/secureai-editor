package io.secureai.backend.domain.user.dto;

import io.secureai.backend.domain.user.entity.UserSession;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SessionResponse(
        UUID id,
        String deviceInfo,
        String ip,
        String userAgent,
        OffsetDateTime createdAt,
        OffsetDateTime expiresAt
) {
    public static SessionResponse from(UserSession session) {
        return new SessionResponse(
                session.getId(),
                session.getDeviceInfo(),
                session.getIp(),
                session.getUserAgent(),
                session.getCreatedAt(),
                session.getExpiresAt()
        );
    }
}
