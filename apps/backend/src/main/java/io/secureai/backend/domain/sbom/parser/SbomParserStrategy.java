package io.secureai.backend.domain.sbom.parser;

import java.util.List;

public interface SbomParserStrategy {

    boolean supports(String fileName);

    List<DependencyInfo> parse(String content);
}
