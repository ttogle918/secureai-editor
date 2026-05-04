package io.secureai.backend.domain.sbom.parser;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class PipRequirementsParser implements SbomParserStrategy {

    private static final Pattern DEP_PATTERN =
            Pattern.compile("^([A-Za-z0-9_\\-\\.]+)\\s*(==|>=|<=|~=|!=)?\\s*([^\\s#]*)");

    @Override
    public boolean supports(String fileName) {
        return "requirements.txt".equalsIgnoreCase(fileName);
    }

    @Override
    public List<DependencyInfo> parse(String content) {
        List<DependencyInfo> result = new ArrayList<>();
        for (String rawLine : content.split("\\r?\\n")) {
            String line = stripComment(rawLine).trim();
            if (line.isBlank()) continue;

            Matcher matcher = DEP_PATTERN.matcher(line);
            if (!matcher.find()) continue;

            String name    = matcher.group(1);
            String version = matcher.groupCount() >= 3 ? toNullIfBlank(matcher.group(3)) : null;
            result.add(new DependencyInfo(null, name, version, null, true));
        }
        return result;
    }

    private String stripComment(String line) {
        int idx = line.indexOf('#');
        return idx >= 0 ? line.substring(0, idx) : line;
    }

    private String toNullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
