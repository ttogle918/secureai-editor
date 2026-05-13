package io.secureai.backend.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SaveApiKeyRequest(
        @NotBlank
        @Pattern(regexp = "sk-ant-[A-Za-z0-9\\-_]+", message = "유효한 Anthropic API 키 형식이 아닙니다 (sk-ant-...)")
        @Size(min = 20, max = 200)
        String apiKey
) {}
