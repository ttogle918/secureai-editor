package io.secureai.backend.global.model;

import java.util.Map;
import java.util.Set;

public final class ModelConstants {

    public static final String HAIKU  = "claude-haiku-4-5-20251001";
    public static final String SONNET = "claude-sonnet-4-6";
    public static final String OPUS   = "claude-opus-4-7";

    public static final Set<String> VALID_MODELS = Set.of(HAIKU, SONNET, OPUS);

    /** 파일 1개 분석 시 소비 크레딧 */
    public static final Map<String, Integer> CREDIT_COST_PER_FILE = Map.of(
            HAIKU,  1,
            SONNET, 5,
            OPUS,   20
    );

    public static int creditCostPerFile(String model) {
        return CREDIT_COST_PER_FILE.getOrDefault(model, 1);
    }

    private ModelConstants() {}
}
