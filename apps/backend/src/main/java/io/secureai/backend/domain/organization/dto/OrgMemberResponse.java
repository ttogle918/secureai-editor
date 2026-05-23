package io.secureai.backend.domain.organization.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record OrgMemberResponse(
        UUID userId,
        String username,
        String displayName,
        String avatarUrl,
        String role,
        /** null이면 pending 상태를 의미한다 */
        OffsetDateTime acceptedAt
) {
}
