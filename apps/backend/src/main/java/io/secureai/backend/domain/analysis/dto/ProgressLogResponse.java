package io.secureai.backend.domain.analysis.dto;

import io.secureai.backend.domain.analysis.entity.AnalysisProgressLog;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ProgressLogResponse(
        UUID id,
        UUID sessionId,
        String stepName,
        int stepOrder,
        String target,
        String status,
        OffsetDateTime startedAt,
        OffsetDateTime completedAt,
        Integer durationMs,
        String detail
) {
    public static ProgressLogResponse from(AnalysisProgressLog log) {
        return new ProgressLogResponse(
                log.getId(),
                log.getSession().getId(),
                log.getStepName(),
                log.getStepOrder(),
                log.getTarget(),
                log.getStatus(),
                log.getStartedAt(),
                log.getCompletedAt(),
                log.getDurationMs(),
                log.getDetail()
        );
    }
}
