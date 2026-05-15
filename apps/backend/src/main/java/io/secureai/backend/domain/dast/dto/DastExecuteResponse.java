package io.secureai.backend.domain.dast.dto;

/**
 * DAST 내부 실행 결과 DTO.
 * error 필드는 실행 실패 시에만 채워지며, 사용자에게 직접 노출되지 않는다.
 */
public record DastExecuteResponse(
        boolean success,
        String payload,
        String evidence,
        String responseSnippet,
        String error,
        String containerId
) {}
