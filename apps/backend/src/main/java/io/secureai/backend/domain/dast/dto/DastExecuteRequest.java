package io.secureai.backend.domain.dast.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

/**
 * AI Engine → Backend 내부 DAST 실행 요청 DTO.
 * targetUrl, params 는 민감 정보이므로 절대 로그에 출력하지 않는다.
 */
public record DastExecuteRequest(
        @NotBlank String sessionId,
        @NotBlank String vulnId,
        @NotBlank String vulnType,
        @NotBlank String targetUrl,
        @NotBlank String endpoint,
        Map<String, String> params
) {}
