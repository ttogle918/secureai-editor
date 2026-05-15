package io.secureai.backend.domain.organization.dto;

public record UpdateOrgRequest(
        String name,
        String description
) {
}
