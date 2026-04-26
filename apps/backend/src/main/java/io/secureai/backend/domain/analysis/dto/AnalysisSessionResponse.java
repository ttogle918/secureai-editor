package io.secureai.backend.domain.analysis.dto;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AnalysisSessionResponse(
        UUID id,
        UUID projectId,
        String status,
        int totalFiles,
        int scannedFiles,
        int vulnCount,
        OffsetDateTime startedAt,
        OffsetDateTime completedAt,
        OffsetDateTime createdAt
) {
    public static AnalysisSessionResponse from(AnalysisSession s) {
        return new AnalysisSessionResponse(
                s.getId(),
                s.getProject().getId(),
                s.getStatus(),
                s.getTotalFiles(),
                s.getScannedFiles(),
                s.getVulnCount(),
                s.getStartedAt(),
                s.getCompletedAt(),
                s.getCreatedAt()
        );
    }
}
