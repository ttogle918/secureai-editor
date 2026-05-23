package io.secureai.backend.domain.dast.dto;

import io.secureai.backend.domain.dast.entity.ExploitResult;
import io.secureai.backend.domain.dast.entity.ScanStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * DAST 결과 조회 API 응답 DTO.
 * ExploitResult 엔티티를 직접 노출하지 않고 필요한 필드만 구조화해 반환한다.
 */
public record DastResultDto(
        UUID id,
        UUID vulnId,
        String vulnType,
        ScanStatus status,
        boolean success,
        String evidence,
        String payload,
        String responseSnippet,
        Long durationMs,
        int retryCount,
        OffsetDateTime executedAt
) {
    public static DastResultDto from(ExploitResult e) {
        return new DastResultDto(
                e.getId(),
                e.getVulnId(),
                e.getVulnType(),
                e.getStatus(),
                e.isSuccess(),
                e.getEvidence(),
                e.getPayload(),
                e.getResponseSnippet(),
                e.getDurationMs(),
                e.getRetryCount(),
                e.getExecutedAt()
        );
    }
}
