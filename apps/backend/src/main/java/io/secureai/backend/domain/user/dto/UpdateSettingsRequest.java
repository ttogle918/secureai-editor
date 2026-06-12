package io.secureai.backend.domain.user.dto;

import io.secureai.backend.global.model.ModelConstants;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UpdateSettingsRequest(
        @NotBlank String preferredModel,

        /** 선호 프로바이더 (null 허용 — 미설정 시 플랫폼 기본 anthropic 사용). */
        @Pattern(regexp = "anthropic|gemini|openai",
                message = "지원하는 provider: anthropic, gemini, openai")
        String preferredProvider
) {
    public void validate() {
        if (!ModelConstants.VALID_MODELS.contains(preferredModel)) {
            throw new IllegalArgumentException("지원하지 않는 모델: " + preferredModel);
        }
    }
}
