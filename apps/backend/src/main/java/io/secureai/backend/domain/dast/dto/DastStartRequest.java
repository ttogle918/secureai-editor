package io.secureai.backend.domain.dast.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Frontend → Backend DAST 시작 요청 DTO.
 * consentGiven 은 반드시 true 여야 하며, 컨트롤러에서 검증한다.
 */
public record DastStartRequest(
        @NotNull UUID sessionId,
        @NotNull UUID vulnId,
        @NotBlank String domain,
        boolean consentGiven
) {}
