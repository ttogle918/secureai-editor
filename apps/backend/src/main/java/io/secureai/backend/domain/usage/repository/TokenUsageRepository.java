package io.secureai.backend.domain.usage.repository;

import io.secureai.backend.domain.usage.entity.TokenUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface TokenUsageRepository extends JpaRepository<TokenUsage, UUID> {

    /**
     * 사용자의 특정 기간 내 일별 집계를 반환한다.
     *
     * 반환 형태: [날짜(LocalDate), provider, 입력토큰합, 출력토큰합, 캐시생성토큰합, 캐시읽기토큰합, 비용합]
     */
    @Query("""
            SELECT DATE(t.occurredAt), t.provider, t.model,
                   SUM(t.inputTokens), SUM(t.outputTokens),
                   SUM(t.cacheCreationTokens), SUM(t.cacheReadTokens),
                   SUM(t.costUsd)
            FROM TokenUsage t
            WHERE t.userId = :userId
              AND t.occurredAt >= :from
              AND t.occurredAt < :to
            GROUP BY DATE(t.occurredAt), t.provider, t.model
            ORDER BY DATE(t.occurredAt) ASC, t.provider ASC
            """)
    List<Object[]> findDailyAggregation(
            @Param("userId") UUID userId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to
    );

    /**
     * 사용자의 당월 총 비용을 반환한다 (한도 판단용).
     */
    @Query("""
            SELECT COALESCE(SUM(t.costUsd), 0)
            FROM TokenUsage t
            WHERE t.userId = :userId
              AND t.occurredAt >= :monthStart
            """)
    BigDecimal sumCostByUserSince(
            @Param("userId") UUID userId,
            @Param("monthStart") OffsetDateTime monthStart
    );
}
