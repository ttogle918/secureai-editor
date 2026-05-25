package io.secureai.backend.domain.scheduling.dto;

import io.secureai.backend.domain.scheduling.entity.ProjectSchedule;

import java.time.Instant;
import java.util.UUID;

public record ProjectScheduleResponse(
        UUID id,
        UUID projectId,
        boolean isActive,
        Instant lastScanAt,
        int scanHour
) {
    public static ProjectScheduleResponse from(ProjectSchedule schedule) {
        return new ProjectScheduleResponse(
                schedule.getId(),
                schedule.getProjectId(),
                schedule.isActive(),
                schedule.getLastScanAt(),
                schedule.getScanHour()
        );
    }
}
