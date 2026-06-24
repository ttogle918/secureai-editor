package io.secureai.backend.domain.dast.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;
import java.util.UUID;

/**
 * 배치 DAST 요청 내 단일 타깃 항목.
 * target_url, params 는 로그 출력 금지.
 */
public record DastBatchTarget(
        @NotNull UUID vulnId,
        @NotBlank String vulnType,
        @NotBlank String targetUrl,
        String endpoint,
        Map<String, Object> params
) {}
