package io.secureai.backend.domain.sbom.parser;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

class PipRequirementsParserTest {

    private PipRequirementsParser parser;

    @BeforeEach
    void setUp() {
        parser = new PipRequirementsParser();
    }

    @Test
    @DisplayName("parse — == 정확 버전 파싱")
    void parse_exact_version_with_double_equals() {
        String content = "Django==4.2.0";

        List<DependencyInfo> result = parser.parse(content);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).artifactId()).isEqualTo("Django");
        assertThat(result.get(0).version()).isEqualTo("4.2.0");
    }

    @Test
    @DisplayName("parse — >= 버전 이상 스펙 파싱")
    void parse_version_greater_than_or_equal() {
        String content = "requests>=2.28.0";

        List<DependencyInfo> result = parser.parse(content);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).artifactId()).isEqualTo("requests");
        assertThat(result.get(0).version()).isEqualTo("2.28.0");
    }

    @Test
    @DisplayName("parse — # 주석 라인 무시")
    void parse_ignores_comment_lines() {
        String content = """
                # 프로덕션 의존성
                Flask==3.0.0
                # 테스트 용도
                """;

        List<DependencyInfo> result = parser.parse(content);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).artifactId()).isEqualTo("Flask");
    }

    @Test
    @DisplayName("parse — 빈 줄 무시")
    void parse_ignores_blank_lines() {
        String content = """
                numpy==1.26.0

                pandas>=2.0.0

                """;

        List<DependencyInfo> result = parser.parse(content);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(DependencyInfo::artifactId)
                .containsExactlyInAnyOrder("numpy", "pandas");
    }
}
