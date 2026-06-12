package io.secureai.backend.domain.usage.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * GET /api/v1/users/me/token-usage 응답 (COST-3).
 *
 * 일별 집계 목록 + 조회 기간 총 비용 + 캐시적중률.
 */
public record TokenUsageSummaryResponse(
        List<DailyEntry> daily,
        BigDecimal totalCostUsd,
        double cacheHitRate
) {
    /**
     * 일별·provider별 집계 행.
     */
    public record DailyEntry(
            String date,      // "2026-06-01"
            String provider,
            String model,
            long inputTokens,
            long outputTokens,
            long cacheCreationTokens,
            long cacheReadTokens,
            BigDecimal costUsd
    ) {}
}
