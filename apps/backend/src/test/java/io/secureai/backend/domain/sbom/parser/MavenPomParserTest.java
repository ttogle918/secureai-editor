package io.secureai.backend.domain.sbom.parser;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

class MavenPomParserTest {

    private MavenPomParser parser;

    @BeforeEach
    void setUp() {
        parser = new MavenPomParser();
    }

    @Test
    @DisplayName("supports — pom.xml 파일명이면 true 반환")
    void supports_returns_true_for_pom_xml() {
        assertThat(parser.supports("pom.xml")).isTrue();
        assertThat(parser.supports("build.gradle")).isFalse();
    }

    @Test
    @DisplayName("parse — 유효한 pom.xml에서 3개 의존성 추출")
    void parse_extracts_three_dependencies_from_valid_pom() {
        String pomXml = """
                <project>
                  <dependencies>
                    <dependency>
                      <groupId>org.springframework</groupId>
                      <artifactId>spring-core</artifactId>
                      <version>6.1.0</version>
                    </dependency>
                    <dependency>
                      <groupId>com.fasterxml.jackson.core</groupId>
                      <artifactId>jackson-databind</artifactId>
                      <version>2.16.0</version>
                      <scope>compile</scope>
                    </dependency>
                    <dependency>
                      <groupId>org.junit.jupiter</groupId>
                      <artifactId>junit-jupiter</artifactId>
                      <version>5.10.0</version>
                      <scope>test</scope>
                    </dependency>
                  </dependencies>
                </project>
                """;

        List<DependencyInfo> result = parser.parse(pomXml);

        assertThat(result).hasSize(3);
        assertThat(result).extracting(DependencyInfo::artifactId)
                .containsExactlyInAnyOrder("spring-core", "jackson-databind", "junit-jupiter");
    }

    @Test
    @DisplayName("parse — groupId, artifactId, version 정확히 추출")
    void parse_extracts_correct_groupId_artifactId_version() {
        String pomXml = """
                <project>
                  <dependencies>
                    <dependency>
                      <groupId>io.secureai</groupId>
                      <artifactId>secureai-core</artifactId>
                      <version>1.2.3</version>
                      <scope>compile</scope>
                    </dependency>
                  </dependencies>
                </project>
                """;

        List<DependencyInfo> result = parser.parse(pomXml);

        assertThat(result).hasSize(1);
        DependencyInfo dep = result.get(0);
        assertThat(dep.groupId()).isEqualTo("io.secureai");
        assertThat(dep.artifactId()).isEqualTo("secureai-core");
        assertThat(dep.version()).isEqualTo("1.2.3");
        assertThat(dep.scope()).isEqualTo("compile");
    }

    @Test
    @DisplayName("parse — scope 없는 의존성은 scope가 null")
    void parse_returns_null_scope_when_absent() {
        String pomXml = """
                <project>
                  <dependencies>
                    <dependency>
                      <groupId>org.example</groupId>
                      <artifactId>example-lib</artifactId>
                      <version>1.0.0</version>
                    </dependency>
                  </dependencies>
                </project>
                """;

        List<DependencyInfo> result = parser.parse(pomXml);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).scope()).isNull();
    }

    @Test
    @DisplayName("parse — dependencies 없는 pom.xml → 빈 리스트")
    void parse_returns_empty_list_when_no_dependencies() {
        String pomXml = """
                <project>
                  <groupId>org.example</groupId>
                  <artifactId>my-app</artifactId>
                </project>
                """;

        List<DependencyInfo> result = parser.parse(pomXml);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("parse — XXE DOCTYPE 공격 시도 → 예외 없이 빈 리스트 반환")
    void parse_returns_empty_list_on_xxe_attack_attempt() {
        String maliciousXml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <!DOCTYPE foo [
                  <!ELEMENT foo ANY >
                  <!ENTITY xxe SYSTEM "file:///etc/passwd" >
                ]>
                <project>
                  <dependencies>
                    <dependency>
                      <groupId>&xxe;</groupId>
                      <artifactId>evil</artifactId>
                    </dependency>
                  </dependencies>
                </project>
                """;

        assertThatCode(() -> {
            List<DependencyInfo> result = parser.parse(maliciousXml);
            assertThat(result).isEmpty();
        }).doesNotThrowAnyException();
    }
}
