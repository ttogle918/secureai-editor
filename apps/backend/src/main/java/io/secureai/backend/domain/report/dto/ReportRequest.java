package io.secureai.backend.domain.report.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ReportRequest(
        @NotNull UUID projectId,
        UUID sessionId,
        @NotNull String format
) {}
