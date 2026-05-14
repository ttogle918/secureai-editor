package io.secureai.backend.domain.cve.dto;

import java.math.BigDecimal;

public record CveSearchResponse(
        String cveId,
        String description,
        BigDecimal cvssScore,
        String cvssVector,
        String severity
) {}
