package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record StartAnalysisRequest(
        @NotNull UUID projectId,
        String workspaceRoot
) {}
