package io.secureai.backend.domain.admin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AdminPlanChangeRequest(
        @NotNull Short planId,
        @NotBlank String reason
) {}
