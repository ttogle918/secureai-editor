package io.secureai.backend.domain.sbom.parser;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Go go.mod 파서.
 *
 * require 블록과 인라인 require 구문을 모두 처리한다.
 * // indirect 주석이 있는 간접 의존성도 포함한다.
 */
@Slf4j
@Component
public class GoModParser implements SbomParserStrategy {

    private static final Pattern INLINE_REQUIRE = Pattern.compile(
            "^\\s*require\\s+(\\S+)\\s+(\\S+)"
    );
    private static final Pattern BLOCK_START = Pattern.compile(
            "^\\s*require\\s*\\("
    );
    private static final Pattern BLOCK_ENTRY = Pattern.compile(
            "^\\s*(\\S+)\\s+(\\S+)"
    );
    private static final Pattern BLOCK_END = Pattern.compile(
            "^\\s*\\)"
    );

    @Override
    public boolean supports(String fileName) {
        return "go.mod".equalsIgnoreCase(fileName);
    }

    @Override
    public List<DependencyInfo> parse(String content) {
        List<DependencyInfo> result = new ArrayList<>();
        boolean inRequireBlock = false;

        try {
            for (String rawLine : content.split("\\r?\\n")) {
                String line = rawLine.trim();

                if (line.startsWith("//") || line.isBlank()) continue;

                if (!inRequireBlock) {
                    Matcher inlineMatcher = INLINE_REQUIRE.matcher(rawLine);
                    if (inlineMatcher.find()) {
                        result.add(new DependencyInfo(null, inlineMatcher.group(1), inlineMatcher.group(2), null, true));
                        continue;
                    }
                    if (BLOCK_START.matcher(rawLine).find()) {
                        inRequireBlock = true;
                    }
                } else {
                    if (BLOCK_END.matcher(rawLine).find()) {
                        inRequireBlock = false;
                        continue;
                    }
                    // 주석 제거 (// indirect 등)
                    String clean = stripLineComment(rawLine).trim();
                    if (clean.isBlank()) continue;

                    Matcher entryMatcher = BLOCK_ENTRY.matcher(clean);
                    if (entryMatcher.find()) {
                        result.add(new DependencyInfo(null, entryMatcher.group(1), entryMatcher.group(2), null, true));
                    }
                }
            }
        } catch (Exception e) {
            log.warn("[go-mod-parser] go.mod 파싱 실패: {}", e.getMessage());
        }

        return result;
    }

    private String stripLineComment(String line) {
        int idx = line.indexOf("//");
        return idx >= 0 ? line.substring(0, idx) : line;
    }
}
