package io.secureai.backend.domain.usage.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

import java.util.UUID;

/**
 * AI Engine → Backend 내부 토큰 사용량 적재 요청 (COST-3).
 *
 * POST /internal/v1/sessions/{sessionId}/token-usage
 */
public record ReportTokenUsageRequest(

        @NotNull
        UUID userId,

        @NotNull
        UUID projectId,

        @NotBlank
        @Pattern(regexp = "anthropic|gemini|openai",
                 message = "provider must be anthropic, gemini, or openai")
        String provider,

        @NotBlank
        String model,

        @PositiveOrZero
        long inputTokens,

        @PositiveOrZero
        long outputTokens,

        @PositiveOrZero
        long cacheCreation,

        @PositiveOrZero
        long cacheRead
) {}
