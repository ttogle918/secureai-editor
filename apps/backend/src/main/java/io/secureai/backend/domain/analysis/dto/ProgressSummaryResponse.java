package io.secureai.backend.domain.analysis.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProgressSummaryResponse(
        int total,
        int completed,
        int percentage,
        List<ProgressStepDto> steps
) {
    public record ProgressStepDto(
            String stepName,
            int stepOrder,
            String target,
            String status,
            Integer durationMs
    ) {}
}
