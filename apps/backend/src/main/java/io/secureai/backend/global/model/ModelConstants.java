package io.secureai.backend.global.model;

import java.util.Map;
import java.util.Set;

public final class ModelConstants {

    // ── Anthropic ──────────────────────────────────────────────────────────────
    public static final String HAIKU  = "claude-haiku-4-5-20251001";
    public static final String SONNET = "claude-sonnet-4-6";
    public static final String OPUS   = "claude-opus-4-8";

    // ── Google Gemini ──────────────────────────────────────────────────────────
    public static final String GEMINI_FLASH = "gemini-2.5-flash";
    public static final String GEMINI_PRO   = "gemini-2.5-pro";

    // ── OpenAI ─────────────────────────────────────────────────────────────────
    public static final String GPT4O_MINI = "gpt-4o-mini";
    public static final String GPT4O      = "gpt-4o";

    // ── Provider 상수 ──────────────────────────────────────────────────────────
    public static final String PROVIDER_ANTHROPIC = "anthropic";
    public static final String PROVIDER_GEMINI    = "gemini";
    public static final String PROVIDER_OPENAI    = "openai";

    public static final Set<String> VALID_MODELS = Set.of(
            HAIKU, SONNET, OPUS,
            GEMINI_FLASH, GEMINI_PRO,
            GPT4O_MINI, GPT4O
    );

    /** 파일 1개 분석 시 소비 크레딧 */
    public static final Map<String, Integer> CREDIT_COST_PER_FILE = Map.of(
            HAIKU,       1,
            SONNET,      5,
            OPUS,        20,
            GEMINI_FLASH, 1,
            GEMINI_PRO,   5,
            GPT4O_MINI,  1,
            GPT4O,       5
    );

    public static int creditCostPerFile(String model) {
        return CREDIT_COST_PER_FILE.getOrDefault(model, 1);
    }

    /**
     * 모델 ID의 prefix로 프로바이더를 유도한다.
     * claude-* → anthropic, gemini-* → gemini, gpt-* → openai.
     * 미지원 prefix는 anthropic으로 폴백한다.
     */
    public static String providerForModel(String model) {
        if (model == null) {
            return PROVIDER_ANTHROPIC;
        }
        if (model.startsWith("claude-")) {
            return PROVIDER_ANTHROPIC;
        }
        if (model.startsWith("gemini-")) {
            return PROVIDER_GEMINI;
        }
        if (model.startsWith("gpt-")) {
            return PROVIDER_OPENAI;
        }
        // 미지원 prefix — 안전 폴백
        return PROVIDER_ANTHROPIC;
    }

    private ModelConstants() {}
}
