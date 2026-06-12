package io.secureai.backend.domain.usage.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.*;

/**
 * PricingTable 단가 계산 단위 테스트 (COST-3).
 */
class PricingTableTest {

    private PricingTable pricingTable;

    @BeforeEach
    void setUp() {
        pricingTable = new PricingTable();
    }

    @Test
    @DisplayName("Claude Haiku 4.5 — input/output 기본 비용이 정확하게 계산된다")
    void calculate_claudeHaiku_basicCost() {
        // given: claude-haiku-4-5, input=1000, output=500, cache=0
        // input  = 1000 * 0.0008 / 1000 = 0.0008
        // output = 500  * 0.004  / 1000 = 0.002
        // total  = 0.0028
        BigDecimal cost = pricingTable.calculate("claude-haiku-4-5", 1000, 500, 0, 0);

        assertThat(cost).isEqualByComparingTo(new BigDecimal("0.002800"));
    }

    @Test
    @DisplayName("Anthropic 캐시 할인 — cache_read 는 input 단가의 10%로 계산된다")
    void calculate_cacheRead_discountedPrice() {
        // given: claude-sonnet-4-6, input=0, output=0, cache_creation=0, cache_read=10000
        // cache_read = 10000 * (0.003 * 0.10) / 1000
        //           = 10000 * 0.0003  / 1000
        //           = 3.0 / 1000 = 0.003000
        BigDecimal cost = pricingTable.calculate("claude-sonnet-4-6", 0, 0, 0, 10_000);

        assertThat(cost).isEqualByComparingTo(new BigDecimal("0.003000"));
    }

    @Test
    @DisplayName("Anthropic 캐시 생성 — cache_creation 은 input 단가의 125%로 계산된다")
    void calculate_cacheCreation_surcharge() {
        // given: claude-sonnet-4-6, cache_creation=1000, others=0
        // cache_creation = 1000 * (0.003 * 1.25) / 1000
        //               = 1000 * 0.00375 / 1000
        //               = 3.75 / 1000 = 0.003750
        BigDecimal cost = pricingTable.calculate("claude-sonnet-4-6", 0, 0, 1_000, 0);

        assertThat(cost).isEqualByComparingTo(new BigDecimal("0.003750"));
    }

    @Test
    @DisplayName("Gemini 2.5 Flash — input 단가가 anthropic보다 낮다")
    void calculate_geminiFlash_lowCost() {
        // given: gemini-2.5-flash, input=10000, output=2000
        // input  = 10000 * 0.00015 / 1000 = 0.0015
        // output = 2000  * 0.0006  / 1000 = 0.0012
        // total  = 0.0027
        BigDecimal cost = pricingTable.calculate("gemini-2.5-flash", 10_000, 2_000, 0, 0);

        assertThat(cost).isEqualByComparingTo(new BigDecimal("0.002700"));
    }

    @Test
    @DisplayName("미등록 모델 — 비용 0을 반환하고 예외가 발생하지 않는다")
    void calculate_unknownModel_returnsZero() {
        BigDecimal cost = pricingTable.calculate("gpt-99-turbo-ultra", 5000, 1000, 0, 0);

        assertThat(cost).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("isKnownModel — 등록된 모델은 true를 반환한다")
    void isKnownModel_registeredModel_returnsTrue() {
        assertThat(pricingTable.isKnownModel("claude-haiku-4-5")).isTrue();
        assertThat(pricingTable.isKnownModel("gemini-2.5-flash")).isTrue();
        assertThat(pricingTable.isKnownModel("gpt-4o")).isTrue();
    }

    @Test
    @DisplayName("isKnownModel — 미등록 모델은 false를 반환한다")
    void isKnownModel_unknownModel_returnsFalse() {
        assertThat(pricingTable.isKnownModel("model-does-not-exist")).isFalse();
    }

    @Test
    @DisplayName("날짜 접미사 모델명 — claude-haiku-4-5-20251001 이 정상 계산된다")
    void calculate_datedModelName_resolvesPricing() {
        // given: claude-haiku-4-5-20251001 (런타임 API가 반환하는 versioned name)
        // input=1000 * 0.0008 / 1000 = 0.0008
        assertThat(pricingTable.isKnownModel("claude-haiku-4-5-20251001")).isTrue();

        BigDecimal cost = pricingTable.calculate("claude-haiku-4-5-20251001", 1000, 0, 0, 0);
        assertThat(cost).isEqualByComparingTo(new BigDecimal("0.000800"));
    }

    @Test
    @DisplayName("토큰 0 — 모든 토큰이 0이면 비용도 0이다")
    void calculate_zeroTokens_zerosCost() {
        BigDecimal cost = pricingTable.calculate("claude-sonnet-4-6", 0, 0, 0, 0);

        assertThat(cost).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("대용량 토큰 — 수치 정밀도가 유지된다")
    void calculate_largeTokenCount_precisionMaintained() {
        // 1M input tokens on claude-haiku-4-5
        // 1_000_000 * 0.0008 / 1000 = 0.8
        BigDecimal cost = pricingTable.calculate("claude-haiku-4-5", 1_000_000, 0, 0, 0);

        assertThat(cost).isEqualByComparingTo(new BigDecimal("0.800000"));
    }
}
