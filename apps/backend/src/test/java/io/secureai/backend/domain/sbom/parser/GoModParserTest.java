package io.secureai.backend.domain.sbom.parser;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.*;

class GoModParserTest {

    private GoModParser parser;

    @BeforeEach
    void setUp() {
        parser = new GoModParser();
    }

    @Test
    @DisplayName("supports — go.mod 파일명이면 true 반환")
    void supports_returns_true_for_go_mod() {
        assertThat(parser.supports("go.mod")).isTrue();
        assertThat(parser.supports("go.sum")).isFalse();
    }

    @Test
    @DisplayName("parse — require 블록 의존성 파싱")
    void parse_extracts_dependencies_from_require_block() {
        String content = """
                module example.com/myapp

                go 1.21

                require (
                    github.com/gin-gonic/gin v1.9.1
                    github.com/go-redis/redis/v9 v9.0.0
                )
                """;

        List<DependencyInfo> result = parser.parse(content);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(DependencyInfo::artifactId)
                .containsExactlyInAnyOrder("github.com/gin-gonic/gin", "github.com/go-redis/redis/v9");
    }

    @Test
    @DisplayName("parse — 인라인 require 구문 파싱")
    void parse_extracts_inline_require() {
        String content = """
                module example.com/app

                require github.com/stretchr/testify v1.8.4
                """;

        List<DependencyInfo> result = parser.parse(content);

        assertThat(result).hasSize(1);
        DependencyInfo dep = result.get(0);
        assertThat(dep.artifactId()).isEqualTo("github.com/stretchr/testify");
        assertThat(dep.version()).isEqualTo("v1.8.4");
    }

    @Test
    @DisplayName("parse — // indirect 간접 의존성도 포함")
    void parse_includes_indirect_dependencies() {
        String content = """
                module example.com/app

                require (
                    github.com/direct/dep v1.0.0
                    github.com/indirect/dep v2.0.0 // indirect
                )
                """;

        List<DependencyInfo> result = parser.parse(content);

        assertThat(result).hasSize(2);
        assertThat(result).extracting(DependencyInfo::artifactId)
                .containsExactlyInAnyOrder("github.com/direct/dep", "github.com/indirect/dep");
    }

    @Test
    @DisplayName("parse — require 없는 go.mod → 빈 리스트")
    void parse_returns_empty_when_no_require() {
        String content = """
                module example.com/app

                go 1.21
                """;

        List<DependencyInfo> result = parser.parse(content);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("parse — 버전이 포함된 의존성의 version 정확히 추출")
    void parse_extracts_correct_version() {
        String content = """
                module example.com/app

                require (
                    github.com/labstack/echo/v4 v4.11.3
                )
                """;

        List<DependencyInfo> result = parser.parse(content);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).version()).isEqualTo("v4.11.3");
    }
}
