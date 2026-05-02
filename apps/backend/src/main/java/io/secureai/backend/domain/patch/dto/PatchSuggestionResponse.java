package io.secureai.backend.domain.patch.dto;

import io.secureai.backend.domain.patch.entity.PatchSuggestion;

import java.time.OffsetDateTime;
import java.util.UUID;

public record PatchSuggestionResponse(
        UUID id,
        UUID sessionId,
        UUID vulnId,
        String filePath,
        String vulnType,
        String originalSnippet,
        String patchedSnippet,
        String unifiedDiff,
        String explanation,
        boolean isApplied,
        OffsetDateTime appliedAt,
        UUID appliedBy,
        OffsetDateTime createdAt
) {
    public static PatchSuggestionResponse from(PatchSuggestion patch) {
        return new PatchSuggestionResponse(
                patch.getId(),
                patch.getSession().getId(),
                patch.getVulnerability() != null ? patch.getVulnerability().getId() : null,
                patch.getFilePath(),
                patch.getVulnType(),
                patch.getOriginalSnippet(),
                patch.getPatchedSnippet(),
                patch.getUnifiedDiff(),
                patch.getExplanation(),
                patch.getIsApplied(),
                patch.getAppliedAt(),
                patch.getAppliedBy() != null ? patch.getAppliedBy().getId() : null,
                patch.getCreatedAt()
        );
    }
}
