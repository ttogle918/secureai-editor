package io.secureai.backend.domain.analysis.dto;

import io.secureai.backend.domain.analysis.entity.PrReviewHistory;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * PR 리뷰 이력 응답 DTO.
 * 프론트엔드 설정 페이지에서 이력 테이블 렌더링에 사용한다.
 */
public record PrReviewHistoryResponse(
        UUID id,
        String repoOwner,
        String repoName,
        int prNumber,
        String headSha,
        String status,
        int vulnCount,
        Long checkRunId,
        OffsetDateTime createdAt,
        OffsetDateTime completedAt
) {
    public static PrReviewHistoryResponse from(PrReviewHistory h) {
        return new PrReviewHistoryResponse(
                h.getId(),
                h.getRepoOwner(),
                h.getRepoName(),
                h.getPrNumber(),
                h.getHeadSha(),
                h.getStatus(),
                h.getVulnCount(),
                h.getCheckRunId(),
                h.getCreatedAt(),
                h.getCompletedAt()
        );
    }
}
