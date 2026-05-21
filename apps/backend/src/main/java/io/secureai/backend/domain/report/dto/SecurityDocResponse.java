package io.secureai.backend.domain.report.dto;

import io.secureai.backend.domain.report.entity.DocType;
import io.secureai.backend.domain.report.entity.SecurityDocRequest;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 보안 문서 생성 요청 상태 응답 DTO.
 * 보안: downloadToken은 COMPLETED 상태일 때만 포함 — PENDING/PROCESSING/FAILED 시 null 반환.
 */
public record SecurityDocResponse(
        UUID id,
        UUID projectId,
        DocType docType,
        String status,
        String downloadToken,
        OffsetDateTime tokenExpiresAt,
        OffsetDateTime createdAt,
        OffsetDateTime completedAt
) {
    public static SecurityDocResponse from(SecurityDocRequest req) {
        boolean completed = "COMPLETED".equals(req.getStatus());
        return new SecurityDocResponse(
                req.getId(),
                req.getProject().getId(),
                req.getDocType(),
                req.getStatus(),
                completed ? req.getDownloadToken() : null,
                completed ? req.getTokenExpiresAt() : null,
                req.getCreatedAt(),
                req.getCompletedAt()
        );
    }
}
