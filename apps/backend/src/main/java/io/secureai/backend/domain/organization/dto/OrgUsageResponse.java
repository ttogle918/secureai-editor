package io.secureai.backend.domain.organization.dto;

import java.util.UUID;

public record OrgUsageResponse(
        UUID orgId,
        String orgName,
        long totalScans,
        long totalVulns,
        long totalCreditsUsed,
        int memberCount,
        int projectCount
) {
}
