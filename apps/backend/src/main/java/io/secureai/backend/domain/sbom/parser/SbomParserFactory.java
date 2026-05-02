package io.secureai.backend.domain.sbom.parser;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class SbomParserFactory {

    private final List<SbomParserStrategy> parsers;

    public Optional<SbomParserStrategy> getParser(String fileName) {
        return parsers.stream()
                .filter(p -> p.supports(fileName))
                .findFirst();
    }
}
