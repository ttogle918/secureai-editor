package io.secureai.backend.domain.dast.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * DAST 실행 전 면책 동의 수령 요청 DTO.
 * {@code consentGiven}은 반드시 {@code true}여야 하며, 컨트롤러에서 검증한다.
 */
public record DastConsentRequest(
        @NotBlank String domain,
        @NotNull Boolean consentGiven
) {}
