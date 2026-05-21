package io.secureai.backend.domain.report.dto;

import io.secureai.backend.domain.report.entity.Report;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ReportResponse(
        UUID id,
        UUID projectId,
        UUID sessionId,
        String format,
        String status,
        String downloadToken,
        OffsetDateTime downloadTokenExpiresAt,
        OffsetDateTime createdAt,
        OffsetDateTime completedAt
) {
    public static ReportResponse from(Report report) {
        return new ReportResponse(
                report.getId(),
                report.getProject().getId(),
                report.getSession() != null ? report.getSession().getId() : null,
                report.getFormat(),
                report.getStatus(),
                report.getDownloadToken(),
                report.getDownloadTokenExpiresAt(),
                report.getCreatedAt(),
                report.getCompletedAt()
        );
    }
}
