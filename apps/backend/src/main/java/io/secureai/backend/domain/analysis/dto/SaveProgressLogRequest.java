package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;
import java.util.UUID;

public record SaveProgressLogRequest(
        @NotNull  UUID sessionId,
        @NotBlank String stepName,
        @NotNull  Integer stepOrder,
        String target,               // null 허용 — 서비스에서 "" 로 정규화
        @NotBlank String status,     // started / completed / failed
        Map<String, Object> detail   // 선택적 상세 정보
) {}
