package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record StartAnalysisRequest(
        @NotNull UUID projectId,
        String workspaceRoot,           // local 전용 (nullable)
        String sourceType,              // "local" | "github", default "local"
        String githubRepoUrl,           // "https://github.com/owner/repo" (github 전용)
        String githubRef                // branch/tag/commit (nullable, default: 레포 기본 브랜치)
) {
    public String effectiveSourceType() {
        return sourceType != null ? sourceType : "local";
    }
}
