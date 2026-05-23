package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record SaveVulnerabilitiesRequest(
        @NotNull UUID sessionId,
        @NotNull UUID projectId,
        @NotBlank String filePath,
        @NotEmpty @Valid List<VulnerabilityItem> vulnerabilities
) {
    public record VulnerabilityItem(
            Integer lineNumber,
            @NotBlank String vulnType,
            @NotBlank String severity,
            String category,
            String cwe,
            String owasp,
            String description,
            String codeSnippet,
            List<String> callChain,
            @NotBlank String fingerprint
    ) {}
}
