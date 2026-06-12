package io.secureai.backend.domain.usage.service;

import io.secureai.backend.domain.usage.dto.ReportTokenUsageRequest;
import io.secureai.backend.domain.usage.dto.TokenUsageSummaryResponse;
import io.secureai.backend.domain.usage.entity.TokenUsage;
import io.secureai.backend.domain.usage.repository.TokenUsageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

/**
 * 토큰 원가 계측 서비스 (COST-3).
 *
 * 책임:
 * - 세션 종료 시 집계된 토큰 사용량 적재 + 비용 계산
 * - 사용자 일별/월별 집계 조회
 * - 월 한도 판단 (80% 경고, 100% 한도 초과)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TokenUsageService {

    /** 월 비용 한도 (USD). 초과 시 비BYOK 세션 분석 403. */
    static final BigDecimal MONTHLY_LIMIT_USD = new BigDecimal("50.00");

    /** 80% 경고 임계치 */
    private static final BigDecimal WARNING_THRESHOLD = new BigDecimal("0.80");

    private final TokenUsageRepository tokenUsageRepository;
    private final PricingTable pricingTable;

    /**
     * 세션 종료 콜백을 처리한다.
     *
     * 비용 계산 후 DB에 저장. 80% 경고 로그.
     * 토큰 값 자체는 로그에 출력하지 않는다 (수치만 허용).
     */
    @Transactional
    public void record(UUID sessionId, ReportTokenUsageRequest req) {
        BigDecimal cost = pricingTable.calculate(
                req.model(),
                req.inputTokens(),
                req.outputTokens(),
                req.cacheCreation(),
                req.cacheRead()
        );

        TokenUsage usage = TokenUsage.builder()
                .sessionId(sessionId)
                .userId(req.userId())
                .projectId(req.projectId())
                .provider(req.provider())
                .model(req.model())
                .inputTokens(req.inputTokens())
                .outputTokens(req.outputTokens())
                .cacheCreationTokens(req.cacheCreation())
                .cacheReadTokens(req.cacheRead())
                .costUsd(cost)
                .occurredAt(OffsetDateTime.now())
                .build();

        tokenUsageRepository.save(usage);

        // 수치만 로그 (키/토큰 값 금지)
        log.info("[token-usage] recorded session={} provider={} model={} cost={}",
                sessionId, req.provider(), req.model(), cost);

        checkMonthlyWarning(req.userId());
    }

    /**
     * 사용자의 토큰 사용량 일별 집계를 반환한다.
     *
     * userId는 Controller에서 principal로 강제 설정 — 타 사용자 조회 불가.
     */
    @Transactional(readOnly = true)
    public TokenUsageSummaryResponse getSummary(UUID userId, OffsetDateTime from, OffsetDateTime to) {
        List<Object[]> rows = tokenUsageRepository.findDailyAggregation(userId, from, to);

        List<TokenUsageSummaryResponse.DailyEntry> daily = rows.stream().map(row -> {
            String date              = row[0].toString();
            String provider          = (String) row[1];
            String model             = (String) row[2];
            long inputTokens         = ((Number) row[3]).longValue();
            long outputTokens        = ((Number) row[4]).longValue();
            long cacheCreationTokens = ((Number) row[5]).longValue();
            long cacheReadTokens     = ((Number) row[6]).longValue();
            BigDecimal costUsd       = (BigDecimal) row[7];
            return new TokenUsageSummaryResponse.DailyEntry(
                    date, provider, model,
                    inputTokens, outputTokens,
                    cacheCreationTokens, cacheReadTokens,
                    costUsd
            );
        }).toList();

        BigDecimal totalCost = daily.stream()
                .map(TokenUsageSummaryResponse.DailyEntry::costUsd)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double cacheHitRate = computeCacheHitRate(daily);

        return new TokenUsageSummaryResponse(daily, totalCost, cacheHitRate);
    }

    /**
     * 비BYOK 분석 시작 전 월 한도 초과 여부를 확인한다.
     *
     * @return true = 한도 초과 (분석 차단 필요)
     */
    @Transactional(readOnly = true)
    public boolean isMonthlyLimitExceeded(UUID userId) {
        BigDecimal monthCost = getMonthCost(userId);
        return monthCost.compareTo(MONTHLY_LIMIT_USD) >= 0;
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private void checkMonthlyWarning(UUID userId) {
        BigDecimal monthCost = getMonthCost(userId);
        BigDecimal warningLevel = MONTHLY_LIMIT_USD.multiply(WARNING_THRESHOLD);

        if (monthCost.compareTo(MONTHLY_LIMIT_USD) >= 0) {
            log.warn("[token-usage] monthly limit reached userId={} cost={}/{} USD",
                    userId, monthCost, MONTHLY_LIMIT_USD);
        } else if (monthCost.compareTo(warningLevel) >= 0) {
            log.warn("[token-usage] monthly usage 80%+ userId={} cost={}/{} USD",
                    userId, monthCost, MONTHLY_LIMIT_USD);
        }
    }

    private BigDecimal getMonthCost(UUID userId) {
        OffsetDateTime monthStart = LocalDate.now(ZoneOffset.UTC)
                .withDayOfMonth(1)
                .atStartOfDay()
                .atOffset(ZoneOffset.UTC);
        return tokenUsageRepository.sumCostByUserSince(userId, monthStart);
    }

    private double computeCacheHitRate(List<TokenUsageSummaryResponse.DailyEntry> daily) {
        long totalInput        = daily.stream().mapToLong(TokenUsageSummaryResponse.DailyEntry::inputTokens).sum();
        long totalCacheRead    = daily.stream().mapToLong(TokenUsageSummaryResponse.DailyEntry::cacheReadTokens).sum();
        long denominator       = totalInput + totalCacheRead;
        if (denominator == 0) return 0.0;
        return (double) totalCacheRead / denominator;
    }
}
