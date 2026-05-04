package io.secureai.backend.domain.sbom.parser;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class CargoTomlParser implements SbomParserStrategy {

    private static final Pattern SIMPLE_DEP   = Pattern.compile("^([A-Za-z0-9_\\-\\.]+)\\s*=\\s*\"([^\"]+)\"");
    private static final Pattern TABLE_DEP    = Pattern.compile("^([A-Za-z0-9_\\-\\.]+)\\s*=\\s*\\{[^}]*version\\s*=\\s*\"([^\"]+)\"");
    private static final Pattern SECTION_HEAD = Pattern.compile("^\\[([^]]+)]");

    @Override
    public boolean supports(String fileName) {
        return "Cargo.toml".equals(fileName);
    }

    @Override
    public List<DependencyInfo> parse(String content) {
        List<DependencyInfo> result = new ArrayList<>();
        boolean inDepsSection = false;

        for (String rawLine : content.split("\\r?\\n")) {
            String line = rawLine.trim();
            if (line.startsWith("#") || line.isBlank()) continue;

            Matcher sectionMatcher = SECTION_HEAD.matcher(line);
            if (sectionMatcher.matches()) {
                String section = sectionMatcher.group(1).trim();
                inDepsSection = "dependencies".equals(section) || "dev-dependencies".equals(section);
                continue;
            }

            if (!inDepsSection) continue;

            String name    = null;
            String version = null;

            Matcher tableMatcher = TABLE_DEP.matcher(line);
            if (tableMatcher.find()) {
                name    = tableMatcher.group(1);
                version = tableMatcher.group(2);
            } else {
                Matcher simpleMatcher = SIMPLE_DEP.matcher(line);
                if (simpleMatcher.find()) {
                    name    = simpleMatcher.group(1);
                    version = simpleMatcher.group(2);
                }
            }

            if (name != null) {
                result.add(new DependencyInfo(null, name, version, null, true));
            }
        }
        return result;
    }
}
