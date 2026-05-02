package io.secureai.backend.domain.patch.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record SavePatchResultsRequest(
        @NotNull UUID sessionId,
        @NotNull UUID projectId,
        List<PatchItem> patches
) {
    public record PatchItem(
            String filePath,
            String vulnType,
            String originalSnippet,
            String patchedSnippet,
            String unifiedDiff,
            String explanation,
            String cacheKey
    ) {}
}
