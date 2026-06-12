package io.secureai.backend.domain.usage.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;

/**
 * provider/model 별 1K 토큰 단가 테이블 (COST-3).
 *
 * 단가 출처:
 *   - Anthropic: https://www.anthropic.com/pricing (2026-06 기준)
 *   - Gemini:    https://ai.google.dev/pricing     (2026-06 기준)
 *
 * 단가 단위: USD per 1,000 tokens.
 * cache_read 는 input 단가의 10% (Anthropic 할인 정책).
 * cache_creation 은 input 단가의 125% (Anthropic 캐시 생성 비용).
 *
 * 미등록 모델 → 0 비용 + 경고 로그.
 * 운영 단가 변경 시 이 파일만 수정한다 (하드코딩 운영부채 회피).
 */
@Slf4j
@Component
public class PricingTable {

    /** 1K 토큰 input 단가 (USD) */
    private static final Map<String, BigDecimal> INPUT_PRICE_PER_1K = Map.ofEntries(
            // Anthropic Claude (날짜 접미사 포함 모델명 지원)
            Map.entry("claude-opus-4-5",                    new BigDecimal("0.015000")),
            Map.entry("claude-opus-4-8",                    new BigDecimal("0.015000")),
            Map.entry("claude-sonnet-4-5",                  new BigDecimal("0.003000")),
            Map.entry("claude-sonnet-4-6",                  new BigDecimal("0.003000")),
            Map.entry("claude-haiku-4-5",                   new BigDecimal("0.000800")),
            Map.entry("claude-haiku-4-5-20251001",          new BigDecimal("0.000800")),
            Map.entry("claude-3-5-sonnet-20241022",         new BigDecimal("0.003000")),
            Map.entry("claude-3-5-haiku-20241022",          new BigDecimal("0.000800")),
            Map.entry("claude-3-haiku-20240307",            new BigDecimal("0.000250")),
            Map.entry("claude-3-opus-20240229",             new BigDecimal("0.015000")),
            // Google Gemini
            Map.entry("gemini-2.5-flash",                   new BigDecimal("0.000150")),
            Map.entry("gemini-2.5-pro",                     new BigDecimal("0.001250")),
            Map.entry("gemini-2.0-flash",                   new BigDecimal("0.000100")),
            // OpenAI
            Map.entry("gpt-4o",                             new BigDecimal("0.002500")),
            Map.entry("gpt-4o-mini",                        new BigDecimal("0.000150")),
            Map.entry("gpt-4-turbo",                        new BigDecimal("0.010000"))
    );

    /** 1K 토큰 output 단가 (USD) */
    private static final Map<String, BigDecimal> OUTPUT_PRICE_PER_1K = Map.ofEntries(
            // Anthropic Claude (날짜 접미사 포함 모델명 지원)
            Map.entry("claude-opus-4-5",                    new BigDecimal("0.075000")),
            Map.entry("claude-opus-4-8",                    new BigDecimal("0.075000")),
            Map.entry("claude-sonnet-4-5",                  new BigDecimal("0.015000")),
            Map.entry("claude-sonnet-4-6",                  new BigDecimal("0.015000")),
            Map.entry("claude-haiku-4-5",                   new BigDecimal("0.004000")),
            Map.entry("claude-haiku-4-5-20251001",          new BigDecimal("0.004000")),
            Map.entry("claude-3-5-sonnet-20241022",         new BigDecimal("0.015000")),
            Map.entry("claude-3-5-haiku-20241022",          new BigDecimal("0.004000")),
            Map.entry("claude-3-haiku-20240307",            new BigDecimal("0.001250")),
            Map.entry("claude-3-opus-20240229",             new BigDecimal("0.075000")),
            // Google Gemini
            Map.entry("gemini-2.5-flash",                   new BigDecimal("0.000600")),
            Map.entry("gemini-2.5-pro",                     new BigDecimal("0.005000")),
            Map.entry("gemini-2.0-flash",                   new BigDecimal("0.000400")),
            // OpenAI
            Map.entry("gpt-4o",                             new BigDecimal("0.010000")),
            Map.entry("gpt-4o-mini",                        new BigDecimal("0.000600")),
            Map.entry("gpt-4-turbo",                        new BigDecimal("0.030000"))
    );

    /**
     * 토큰 사용량으로 총 비용(USD)을 계산한다.
     *
     * - cache_creation 은 input 단가의 125%
     * - cache_read 는 input 단가의 10% (Anthropic 캐시 읽기 할인)
     * - 미등록 모델은 0 비용, WARN 로그
     */
    public BigDecimal calculate(
            String model,
            long inputTokens,
            long outputTokens,
            long cacheCreationTokens,
            long cacheReadTokens
    ) {
        BigDecimal inputPrice = INPUT_PRICE_PER_1K.get(model);
        BigDecimal outputPrice = OUTPUT_PRICE_PER_1K.get(model);

        if (inputPrice == null || outputPrice == null) {
            log.warn("[pricing] unknown model={} — cost set to 0", model);
            return BigDecimal.ZERO;
        }

        // cost = input * inputPrice/1000 + output * outputPrice/1000
        //      + cacheCreation * inputPrice * 1.25/1000
        //      + cacheRead * inputPrice * 0.10/1000
        BigDecimal inputCost          = toUsd(inputTokens,          inputPrice);
        BigDecimal outputCost         = toUsd(outputTokens,         outputPrice);
        BigDecimal cacheCreationCost  = toUsd(cacheCreationTokens,  inputPrice.multiply(new BigDecimal("1.25")));
        BigDecimal cacheReadCost      = toUsd(cacheReadTokens,      inputPrice.multiply(new BigDecimal("0.10")));

        return inputCost.add(outputCost).add(cacheCreationCost).add(cacheReadCost);
    }

    private BigDecimal toUsd(long tokens, BigDecimal pricePerThousand) {
        return new BigDecimal(tokens)
                .multiply(pricePerThousand)
                .divide(new BigDecimal("1000"), 6, RoundingMode.HALF_UP);
    }

    /** 테스트용 — 등록된 모델인지 확인 */
    public boolean isKnownModel(String model) {
        return INPUT_PRICE_PER_1K.containsKey(model);
    }
}
