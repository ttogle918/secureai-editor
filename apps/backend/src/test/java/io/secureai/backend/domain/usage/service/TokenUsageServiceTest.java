package io.secureai.backend.domain.usage.service;

import io.secureai.backend.domain.usage.dto.ReportTokenUsageRequest;
import io.secureai.backend.domain.usage.dto.TokenUsageSummaryResponse;
import io.secureai.backend.domain.usage.entity.TokenUsage;
import io.secureai.backend.domain.usage.repository.TokenUsageRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * TokenUsageService 단위 테스트 (COST-3).
 */
@ExtendWith(MockitoExtension.class)
class TokenUsageServiceTest {

    @Mock
    TokenUsageRepository tokenUsageRepository;

    @Mock
    PricingTable pricingTable;

    @InjectMocks
    TokenUsageService tokenUsageService;

    private UUID userId;
    private UUID sessionId;
    private UUID projectId;

    @BeforeEach
    void setUp() {
        userId    = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        projectId = UUID.randomUUID();
    }

    // ── record ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("record — PricingTable 비용이 TokenUsage 엔티티에 저장된다")
    void record_savesTokenUsageWithCost() {
        // given
        BigDecimal expectedCost = new BigDecimal("0.012345");
        when(pricingTable.calculate(anyString(), anyLong(), anyLong(), anyLong(), anyLong()))
                .thenReturn(expectedCost);
        when(tokenUsageRepository.sumCostByUserSince(any(), any()))
                .thenReturn(new BigDecimal("5.00"));

        ReportTokenUsageRequest req = new ReportTokenUsageRequest(
                userId, projectId, "anthropic", "claude-haiku-4-5",
                1000L, 500L, 200L, 100L
        );

        // when
        tokenUsageService.record(sessionId, req);

        // then: save 호출 및 비용 필드 검증
        ArgumentCaptor<TokenUsage> captor = ArgumentCaptor.forClass(TokenUsage.class);
        verify(tokenUsageRepository).save(captor.capture());

        TokenUsage saved = captor.getValue();
        assertThat(saved.getSessionId()).isEqualTo(sessionId);
        assertThat(saved.getUserId()).isEqualTo(userId);
        assertThat(saved.getProjectId()).isEqualTo(projectId);
        assertThat(saved.getProvider()).isEqualTo("anthropic");
        assertThat(saved.getModel()).isEqualTo("claude-haiku-4-5");
        assertThat(saved.getInputTokens()).isEqualTo(1000L);
        assertThat(saved.getOutputTokens()).isEqualTo(500L);
        assertThat(saved.getCacheCreationTokens()).isEqualTo(200L);
        assertThat(saved.getCacheReadTokens()).isEqualTo(100L);
        assertThat(saved.getCostUsd()).isEqualByComparingTo(expectedCost);
    }

    @Test
    @DisplayName("record — PricingTable에 정확한 파라미터가 전달된다(캐시 포함)")
    void record_passesCorrectParamsToPricingTable() {
        // given
        when(pricingTable.calculate(anyString(), anyLong(), anyLong(), anyLong(), anyLong()))
                .thenReturn(BigDecimal.ZERO);
        when(tokenUsageRepository.sumCostByUserSince(any(), any()))
                .thenReturn(BigDecimal.ZERO);

        ReportTokenUsageRequest req = new ReportTokenUsageRequest(
                userId, projectId, "gemini", "gemini-2.5-flash",
                2000L, 800L, 0L, 400L
        );

        // when
        tokenUsageService.record(sessionId, req);

        // then
        verify(pricingTable).calculate("gemini-2.5-flash", 2000L, 800L, 0L, 400L);
    }

    // ── isMonthlyLimitExceeded ────────────────────────────────────────────────

    @Test
    @DisplayName("isMonthlyLimitExceeded — 당월 비용이 한도 미만이면 false를 반환한다")
    void isMonthlyLimitExceeded_belowLimit_returnsFalse() {
        when(tokenUsageRepository.sumCostByUserSince(eq(userId), any()))
                .thenReturn(new BigDecimal("30.00"));

        assertThat(tokenUsageService.isMonthlyLimitExceeded(userId)).isFalse();
    }

    @Test
    @DisplayName("isMonthlyLimitExceeded — 당월 비용이 한도 이상이면 true를 반환한다")
    void isMonthlyLimitExceeded_atLimit_returnsTrue() {
        when(tokenUsageRepository.sumCostByUserSince(eq(userId), any()))
                .thenReturn(new BigDecimal("50.00"));

        assertThat(tokenUsageService.isMonthlyLimitExceeded(userId)).isTrue();
    }

    @Test
    @DisplayName("isMonthlyLimitExceeded — 당월 비용이 한도 초과이면 true를 반환한다")
    void isMonthlyLimitExceeded_overLimit_returnsTrue() {
        when(tokenUsageRepository.sumCostByUserSince(eq(userId), any()))
                .thenReturn(new BigDecimal("75.00"));

        assertThat(tokenUsageService.isMonthlyLimitExceeded(userId)).isTrue();
    }

    // ── getSummary ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getSummary — 빈 결과이면 totalCost=0, cacheHitRate=0.0을 반환한다")
    void getSummary_emptyResult_returnsZeroCostAndRate() {
        when(tokenUsageRepository.findDailyAggregation(any(), any(), any()))
                .thenReturn(Collections.emptyList());

        OffsetDateTime from = OffsetDateTime.now().minusDays(7);
        OffsetDateTime to   = OffsetDateTime.now();

        TokenUsageSummaryResponse result = tokenUsageService.getSummary(userId, from, to);

        assertThat(result.daily()).isEmpty();
        assertThat(result.totalCostUsd()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(result.cacheHitRate()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("getSummary — 캐시적중률이 올바르게 계산된다")
    void getSummary_cacheHitRate_calculatedCorrectly() {
        // input=900, cache_read=100 → hit rate = 100/(900+100) = 0.1
        Object[] row = new Object[]{
                "2026-06-01", "anthropic", "claude-haiku-4-5",
                900L, 200L, 0L, 100L, new BigDecimal("0.01")
        };
        List<Object[]> rows = new java.util.ArrayList<>();
        rows.add(row);
        when(tokenUsageRepository.findDailyAggregation(any(), any(), any()))
                .thenReturn(rows);

        OffsetDateTime from = OffsetDateTime.now().minusDays(7);
        OffsetDateTime to   = OffsetDateTime.now();

        TokenUsageSummaryResponse result = tokenUsageService.getSummary(userId, from, to);

        assertThat(result.cacheHitRate()).isEqualTo(100.0 / 1000.0);
        assertThat(result.totalCostUsd()).isEqualByComparingTo(new BigDecimal("0.01"));
    }
}
