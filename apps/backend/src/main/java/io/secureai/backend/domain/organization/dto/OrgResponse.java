package io.secureai.backend.domain.organization.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record OrgResponse(
        UUID id,
        String name,
        String slug,
        String description,
        String ownerUsername,
        long memberCount,
        String planName,
        String avatarUrl,
        OffsetDateTime createdAt
) {
}
