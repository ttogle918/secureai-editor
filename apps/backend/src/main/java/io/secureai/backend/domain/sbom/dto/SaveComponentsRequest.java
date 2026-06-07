package io.secureai.backend.domain.sbom.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/**
 * AI Engine → Backend SBOM 컴포넌트 저장 요청 DTO.
 *
 * POST /api/v1/internal/sbom/components
 */
public record SaveComponentsRequest(

        @NotNull
        UUID sessionId,

        @NotNull
        UUID projectId,

        @NotNull
        List<ComponentItem> components

) {
    public record ComponentItem(
            @NotBlank String name,
            String version,
            @NotBlank String ecosystem,
            List<String> cveIds
    ) {}
}
