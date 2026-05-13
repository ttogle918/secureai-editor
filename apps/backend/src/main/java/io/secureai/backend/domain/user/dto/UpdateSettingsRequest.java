package io.secureai.backend.domain.user.dto;

import io.secureai.backend.global.model.ModelConstants;
import jakarta.validation.constraints.NotBlank;

public record UpdateSettingsRequest(
        @NotBlank String preferredModel
) {
    public void validate() {
        if (!ModelConstants.VALID_MODELS.contains(preferredModel)) {
            throw new IllegalArgumentException("지원하지 않는 모델: " + preferredModel);
        }
    }
}
