package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ChatRequest(
        @NotBlank String message,
        @NotNull List<ChatHistoryItem> history
) {
    public record ChatHistoryItem(
            @NotBlank String role,
            @NotBlank String content
    ) {}
}
