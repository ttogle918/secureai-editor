package io.secureai.backend.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SaveProviderKeyRequest(

        /** 프로바이더 화이트리스트 — Controller 레이어 검증. */
        @NotBlank
        @Pattern(regexp = "anthropic|gemini|openai",
                message = "지원하는 provider: anthropic, gemini, openai")
        String provider,

        /** BYOK API 키 (복호화 평문). 서비스 레이어에서 암호화하여 저장. */
        @NotBlank
        @Size(min = 10, max = 300)
        String apiKey,

        /** 이 provider 사용 시 기본 모델 (null 허용 — 플랫폼 기본값 사용). */
        String defaultModel
) {}
