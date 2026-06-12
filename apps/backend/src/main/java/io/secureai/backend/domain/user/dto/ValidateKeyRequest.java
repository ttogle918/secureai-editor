package io.secureai.backend.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * POST /api/v1/users/me/provider-keys/{provider}/validate 요청.
 * ai_engine에 1회 ping 요청을 위임 — boolean 결과만 반환.
 */
public record ValidateKeyRequest(
        @NotBlank
        @Pattern(regexp = "anthropic|gemini|openai",
                message = "지원하는 provider: anthropic, gemini, openai")
        String provider,

        @NotBlank
        String apiKey
) {}
