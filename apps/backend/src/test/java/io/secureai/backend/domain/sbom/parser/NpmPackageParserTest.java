package io.secureai.backend.domain.sbom.parser;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

class NpmPackageParserTest {

    private NpmPackageParser parser;

    @BeforeEach
    void setUp() {
        parser = new NpmPackageParser(new ObjectMapper());
    }

    @Test
    @DisplayName("parse — dependencies 항목은 isDirect=true")
    void parse_dependencies_are_direct() {
        String json = """
                {
                  "name": "my-app",
                  "dependencies": {
                    "express": "^4.18.2",
                    "lodash": "4.17.21"
                  }
                }
                """;

        List<DependencyInfo> result = parser.parse(json);

        assertThat(result).hasSize(2);
        assertThat(result).allMatch(DependencyInfo::isDirect);
        assertThat(result).extracting(DependencyInfo::artifactId)
                .containsExactlyInAnyOrder("express", "lodash");
    }

    @Test
    @DisplayName("parse — devDependencies 항목은 isDirect=false")
    void parse_devDependencies_are_not_direct() {
        String json = """
                {
                  "name": "my-app",
                  "devDependencies": {
                    "jest": "^29.0.0",
                    "typescript": "5.3.0"
                  }
                }
                """;

        List<DependencyInfo> result = parser.parse(json);

        assertThat(result).hasSize(2);
        assertThat(result).noneMatch(DependencyInfo::isDirect);
    }

    @Test
    @DisplayName("parse — dependencies/devDependencies 모두 없으면 빈 리스트")
    void parse_returns_empty_list_when_no_dependency_sections() {
        String json = """
                {
                  "name": "empty-app",
                  "version": "1.0.0"
                }
                """;

        List<DependencyInfo> result = parser.parse(json);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("parse — 버전 문자열 원본 유지 (^ ~ 제거 없음)")
    void parse_preserves_version_string_as_is() {
        String json = """
                {
                  "dependencies": {
                    "react": "^18.2.0",
                    "axios": "~1.6.0",
                    "next": "14.0.0"
                  }
                }
                """;

        List<DependencyInfo> result = parser.parse(json);

        assertThat(result).extracting(DependencyInfo::version)
                .contains("^18.2.0", "~1.6.0", "14.0.0");
    }
}
