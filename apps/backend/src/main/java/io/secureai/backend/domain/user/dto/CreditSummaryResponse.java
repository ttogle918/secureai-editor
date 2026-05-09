package io.secureai.backend.domain.user.dto;

import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.model.ModelConstants;

import java.util.Map;

public record CreditSummaryResponse(
        int balance,
        boolean hasByok,
        String preferredModel,
        Map<String, Integer> modelCosts
) {
    public static CreditSummaryResponse from(User user) {
        return new CreditSummaryResponse(
                user.getCreditBalance(),
                user.getAnthropicApiKey() != null,
                user.getPreferredModel(),
                ModelConstants.CREDIT_COST_PER_FILE
        );
    }
}
