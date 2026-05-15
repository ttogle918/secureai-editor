package io.secureai.backend.domain.organization.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CreateOrgRequest(
        @NotBlank
        String name,

        @NotBlank
        @Pattern(regexp = "^[a-z0-9-]{3,50}$",
                message = "슬러그는 소문자, 숫자, 하이픈만 사용 가능하며 3~50자여야 합니다.")
        String slug,

        String description
) {
}
