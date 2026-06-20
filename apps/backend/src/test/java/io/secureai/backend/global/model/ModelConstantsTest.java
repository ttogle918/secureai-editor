package io.secureai.backend.global.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class ModelConstantsTest {

    // ── VALID_MODELS — 7종 포함 여부 ──────────────────────────────────────────

    @Test
    @DisplayName("VALID_MODELS에 7개 모델이 모두 등록되어 있다")
    void validModels_containsAllSevenModels() {
        assertThat(ModelConstants.VALID_MODELS).containsExactlyInAnyOrder(
                ModelConstants.HAIKU,
                ModelConstants.SONNET,
                ModelConstants.OPUS,
                ModelConstants.GEMINI_FLASH,
                ModelConstants.GEMINI_PRO,
                ModelConstants.GPT4O_MINI,
                ModelConstants.GPT4O
        );
    }

    @Test
    @DisplayName("OPUS 상수가 claude-opus-4-8 로 갱신되어 있다")
    void opus_constant_isUpdatedToV48() {
        assertThat(ModelConstants.OPUS).isEqualTo("claude-opus-4-8");
    }

    // ── CREDIT_COST_PER_FILE — 7종 크레딧 ────────────────────────────────────

    @ParameterizedTest(name = "모델 {0} 의 크레딧이 {1} 이다")
    @CsvSource({
            "claude-haiku-4-5-20251001, 1",
            "claude-sonnet-4-6,         5",
            "claude-opus-4-8,           20",
            "gemini-2.5-flash,          1",
            "gemini-2.5-pro,            5",
            "gpt-4o-mini,               1",
            "gpt-4o,                    5",
    })
    void creditCostPerFile_returnsCorrectCost(String model, int expectedCost) {
        assertThat(ModelConstants.creditCostPerFile(model)).isEqualTo(expectedCost);
    }

    @Test
    @DisplayName("미지원 모델의 크레딧 기본값은 1이다")
    void creditCostPerFile_unknownModel_returnsDefault() {
        assertThat(ModelConstants.creditCostPerFile("unknown-model-xyz")).isEqualTo(1);
    }

    // ── providerForModel — prefix 기반 유도 ───────────────────────────────────

    @ParameterizedTest(name = "모델 {0} 의 프로바이더는 {1} 이다")
    @CsvSource({
            "claude-haiku-4-5-20251001, anthropic",
            "claude-sonnet-4-6,         anthropic",
            "claude-opus-4-8,           anthropic",
            "gemini-2.5-flash,          gemini",
            "gemini-2.5-pro,            gemini",
            "gpt-4o-mini,               openai",
            "gpt-4o,                    openai",
    })
    void providerForModel_returnsCorrectProvider(String model, String expectedProvider) {
        assertThat(ModelConstants.providerForModel(model)).isEqualTo(expectedProvider);
    }

    @Test
    @DisplayName("미지원 prefix 모델은 anthropic으로 폴백한다")
    void providerForModel_unknownPrefix_fallsBackToAnthropic() {
        assertThat(ModelConstants.providerForModel("llama-3-70b")).isEqualTo("anthropic");
    }

    @Test
    @DisplayName("null 모델은 anthropic으로 폴백한다")
    void providerForModel_null_fallsBackToAnthropic() {
        assertThat(ModelConstants.providerForModel(null)).isEqualTo("anthropic");
    }
}
