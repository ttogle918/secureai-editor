package io.secureai.backend.domain.sbom.parser;

public record DependencyInfo(
        String groupId,
        String artifactId,
        String version,
        String scope,
        boolean isDirect
) {}
