package io.secureai.backend.domain.admin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AdminCreditRequest(
        @NotNull @Min(-10000) @Max(100000) Integer delta,
        @NotBlank String reason
) {}
