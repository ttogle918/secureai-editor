"""
TASK-504: SBOM 파서 단위 테스트.
"""
import pytest

from agent.tools.sbom_parser import (
    parse_cargo_toml,
    parse_go_mod,
    parse_package_json,
    parse_pom_xml,
    parse_requirements_txt,
    to_cyclonedx,
    parse_file,
)


# ---------------------------------------------------------------------------
# pom.xml 파서
# ---------------------------------------------------------------------------

class TestParsePomXml:
    def test_parses_basic_dependency(self):
        """기본 Maven 의존성을 파싱해야 한다."""
        content = """
        <project>
          <dependencies>
            <dependency>
              <groupId>org.springframework</groupId>
              <artifactId>spring-core</artifactId>
              <version>5.3.10</version>
            </dependency>
          </dependencies>
        </project>
        """
        result = parse_pom_xml(content)
        assert len(result) == 1
        assert result[0]["name"] == "org.springframework:spring-core"
        assert result[0]["version"] == "5.3.10"
        assert result[0]["ecosystem"] == "maven"

    def test_parses_multiple_dependencies(self):
        """여러 의존성을 모두 파싱해야 한다."""
        content = """
        <project>
          <dependencies>
            <dependency>
              <groupId>com.example</groupId>
              <artifactId>lib-a</artifactId>
              <version>1.0</version>
            </dependency>
            <dependency>
              <groupId>com.example</groupId>
              <artifactId>lib-b</artifactId>
              <version>2.0</version>
            </dependency>
          </dependencies>
        </project>
        """
        result = parse_pom_xml(content)
        assert len(result) == 2
        names = [r["name"] for r in result]
        assert "com.example:lib-a" in names
        assert "com.example:lib-b" in names

    def test_returns_empty_on_invalid_xml(self):
        """잘못된 XML이면 빈 목록을 반환해야 한다."""
        result = parse_pom_xml("not valid xml <<<<<")
        assert result == []

    def test_dependency_without_version_is_included(self):
        """버전이 없는 의존성도 포함되어야 한다."""
        content = """
        <project>
          <dependencies>
            <dependency>
              <groupId>io.test</groupId>
              <artifactId>no-version-lib</artifactId>
            </dependency>
          </dependencies>
        </project>
        """
        result = parse_pom_xml(content)
        assert len(result) == 1
        assert result[0]["version"] is None


# ---------------------------------------------------------------------------
# package.json 파서
# ---------------------------------------------------------------------------

class TestParsePackageJson:
    def test_parses_dependencies_section(self):
        """dependencies 섹션의 패키지를 파싱해야 한다."""
        content = """{
            "name": "my-app",
            "dependencies": {
                "react": "^18.0.0",
                "axios": "1.2.3"
            }
        }"""
        result = parse_package_json(content)
        names = [r["name"] for r in result]
        assert "react" in names
        assert "axios" in names

    def test_parses_dev_dependencies_section(self):
        """devDependencies 섹션도 파싱해야 한다."""
        content = """{
            "devDependencies": {
                "jest": "^29.0.0"
            }
        }"""
        result = parse_package_json(content)
        assert len(result) == 1
        assert result[0]["name"] == "jest"
        assert result[0]["ecosystem"] == "npm"

    def test_cleans_caret_prefix_from_version(self):
        """^, ~ 접두사가 제거된 순수 버전 문자열을 반환해야 한다."""
        content = """{
            "dependencies": {
                "lodash": "^4.17.21"
            }
        }"""
        result = parse_package_json(content)
        assert result[0]["version"] == "4.17.21"

    def test_returns_empty_on_invalid_json(self):
        """잘못된 JSON이면 빈 목록을 반환해야 한다."""
        result = parse_package_json("{invalid json}")
        assert result == []

    def test_empty_dependencies_returns_empty(self):
        """의존성이 없는 package.json 은 빈 목록을 반환해야 한다."""
        content = '{"name": "empty-app"}'
        result = parse_package_json(content)
        assert result == []


# ---------------------------------------------------------------------------
# requirements.txt 파서
# ---------------------------------------------------------------------------

class TestParseRequirementsTxt:
    def test_parses_pinned_version(self):
        """== 으로 고정된 버전을 파싱해야 한다."""
        content = "requests==2.28.0\nflask>=2.0.0\n"
        result = parse_requirements_txt(content)
        req = next(r for r in result if r["name"] == "requests")
        assert req["version"] == "2.28.0"
        assert req["ecosystem"] == "pypi"

    def test_parses_package_without_version(self):
        """버전 없는 패키지도 포함해야 한다."""
        content = "boto3\n"
        result = parse_requirements_txt(content)
        assert len(result) == 1
        assert result[0]["name"] == "boto3"
        assert result[0]["version"] is None

    def test_ignores_comment_lines(self):
        """# 주석 라인은 무시해야 한다."""
        content = "# this is a comment\nfastapi==0.100.0\n"
        result = parse_requirements_txt(content)
        assert len(result) == 1
        assert result[0]["name"] == "fastapi"

    def test_ignores_option_flags(self):
        """-r, -c 등 옵션 플래그는 무시해야 한다."""
        content = "-r other-requirements.txt\ndjango==4.2.0\n"
        result = parse_requirements_txt(content)
        assert len(result) == 1
        assert result[0]["name"] == "django"

    def test_parses_multiple_packages(self):
        """여러 패키지를 모두 파싱해야 한다."""
        content = "numpy==1.24.0\npandas>=1.5.0\nscipy\n"
        result = parse_requirements_txt(content)
        names = [r["name"] for r in result]
        assert "numpy" in names
        assert "pandas" in names
        assert "scipy" in names


# ---------------------------------------------------------------------------
# go.mod 파서
# ---------------------------------------------------------------------------

class TestParseGoMod:
    def test_parses_require_block(self):
        """require 블록 내 의존성을 파싱해야 한다."""
        content = """module example.com/myapp

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/go-redis/redis/v9 v9.0.0
)
"""
        result = parse_go_mod(content)
        names = [r["name"] for r in result]
        assert "github.com/gin-gonic/gin" in names
        assert "github.com/go-redis/redis/v9" in names

    def test_parses_inline_require(self):
        """인라인 require 구문을 파싱해야 한다."""
        content = """module example.com/app

require github.com/stretchr/testify v1.8.4
"""
        result = parse_go_mod(content)
        assert len(result) == 1
        assert result[0]["name"] == "github.com/stretchr/testify"
        assert result[0]["version"] == "v1.8.4"
        assert result[0]["ecosystem"] == "go"

    def test_parses_indirect_dependencies(self):
        """// indirect 주석이 있는 간접 의존성도 포함해야 한다."""
        content = """module example.com/app

require (
    github.com/direct/dep v1.0.0
    github.com/indirect/dep v2.0.0 // indirect
)
"""
        result = parse_go_mod(content)
        assert len(result) == 2

    def test_returns_empty_on_no_requires(self):
        """require 구문이 없으면 빈 목록을 반환해야 한다."""
        content = """module example.com/app

go 1.21
"""
        result = parse_go_mod(content)
        assert result == []


# ---------------------------------------------------------------------------
# Cargo.toml 파서
# ---------------------------------------------------------------------------

class TestParseCargoToml:
    def test_parses_inline_version(self):
        """인라인 버전(name = "1.0") 형식을 파싱해야 한다."""
        content = """
[dependencies]
serde = "1.0"
tokio = "1.28"
"""
        result = parse_cargo_toml(content)
        names = [r["name"] for r in result]
        assert "serde" in names
        assert "tokio" in names
        serde = next(r for r in result if r["name"] == "serde")
        assert serde["version"] == "1.0"
        assert serde["ecosystem"] == "cargo"

    def test_parses_table_version(self):
        """상세 테이블(name = { version = "1.0", ... }) 형식의 버전을 파싱해야 한다."""
        content = """
[dependencies]
serde = { version = "1.0.163", features = ["derive"] }
tokio = { version = "1.28", default-features = false }
"""
        result = parse_cargo_toml(content)
        serde = next((r for r in result if r["name"] == "serde"), None)
        assert serde is not None
        assert serde["version"] == "1.0.163"
        assert serde["ecosystem"] == "cargo"

        tokio = next((r for r in result if r["name"] == "tokio"), None)
        assert tokio is not None
        assert tokio["version"] == "1.28"

    def test_parses_dev_dependencies(self):
        """[dev-dependencies] 섹션도 파싱해야 한다."""
        content = """
[dependencies]
serde = "1.0"

[dev-dependencies]
mockall = "0.11"
tempfile = "3.8"
"""
        result = parse_cargo_toml(content)
        names = [r["name"] for r in result]
        assert "serde" in names
        assert "mockall" in names
        assert "tempfile" in names

    def test_path_dependency_has_none_version(self):
        """path/git 의존성처럼 version 없는 테이블은 version=None 으로 포함되어야 한다."""
        content = """
[dependencies]
my-local-crate = { path = "../local-crate" }
"""
        result = parse_cargo_toml(content)
        assert len(result) == 1
        assert result[0]["name"] == "my-local-crate"
        assert result[0]["version"] is None
        assert result[0]["ecosystem"] == "cargo"

    def test_ignores_comment_lines(self):
        """# 주석 라인은 무시해야 한다."""
        content = """
[dependencies]
# this is a comment
serde = "1.0"
"""
        result = parse_cargo_toml(content)
        assert len(result) == 1
        assert result[0]["name"] == "serde"

    def test_returns_empty_for_no_dependencies_section(self):
        """[dependencies] 섹션이 없으면 빈 목록을 반환해야 한다."""
        content = """
[package]
name = "my-app"
version = "0.1.0"
"""
        result = parse_cargo_toml(content)
        assert result == []

    def test_stops_at_next_section(self):
        """[dependencies] 다음 섹션 시작 시 파싱을 종료해야 한다."""
        content = """
[dependencies]
serde = "1.0"

[profile.release]
opt-level = 3
"""
        result = parse_cargo_toml(content)
        # serde 만 포함되어야 한다 (opt-level 은 의존성이 아님)
        assert all(r["name"] == "serde" for r in result)


# ---------------------------------------------------------------------------
# parse_file 자동 감지
# ---------------------------------------------------------------------------

class TestParseFile:
    def test_dispatches_to_correct_parser_by_filename(self):
        """파일명에 따라 올바른 파서를 선택해야 한다."""
        pom_content = """<project><dependencies>
            <dependency><groupId>g</groupId><artifactId>a</artifactId><version>1</version></dependency>
        </dependencies></project>"""
        result = parse_file("pom.xml", pom_content)
        assert len(result) > 0
        assert result[0]["ecosystem"] == "maven"

    def test_returns_empty_for_unsupported_file(self):
        """지원하지 않는 파일명이면 빈 목록을 반환해야 한다."""
        result = parse_file("Gemfile", "gem 'rails', '~> 7.0'")
        assert result == []

    def test_path_with_directory_is_handled(self):
        """경로에 디렉토리가 포함된 경우 파일명만 추출해야 한다."""
        content = "requests==2.28.0\n"
        result = parse_file("backend/requirements.txt", content)
        assert len(result) == 1

    def test_dispatches_cargo_toml_to_cargo_parser(self):
        """Cargo.toml 파일명이면 parse_cargo_toml 로 라우팅해야 한다."""
        content = '[dependencies]\nserde = "1.0"\n'
        result = parse_file("Cargo.toml", content)
        assert len(result) == 1
        assert result[0]["name"] == "serde"
        assert result[0]["ecosystem"] == "cargo"

    def test_dispatches_cargo_toml_lowercase(self):
        """cargo.toml (소문자) 파일명도 올바르게 라우팅되어야 한다."""
        content = '[dependencies]\ntokio = "1.28"\n'
        result = parse_file("cargo.toml", content)
        assert len(result) == 1
        assert result[0]["name"] == "tokio"

    def test_dispatches_cargo_toml_with_path(self):
        """경로에 Cargo.toml 이 포함된 경우에도 올바르게 라우팅되어야 한다."""
        content = '[dependencies]\nanyhow = "1.0"\n'
        result = parse_file("my-app/Cargo.toml", content)
        assert len(result) == 1
        assert result[0]["name"] == "anyhow"


# ---------------------------------------------------------------------------
# CycloneDX JSON 변환
# ---------------------------------------------------------------------------

class TestToCyclonedx:
    def test_cyclonedx_required_fields_present(self):
        """CycloneDX BOM에 필수 필드가 모두 있어야 한다."""
        components = [{"name": "log4j", "version": "2.14.1", "ecosystem": "maven"}]
        cve_matches: list[dict] = []
        bom = to_cyclonedx(components, cve_matches)

        assert bom["bomFormat"] == "CycloneDX"
        assert bom["specVersion"] == "1.4"
        assert "serialNumber" in bom
        assert "version" in bom
        assert "components" in bom
        assert "vulnerabilities" in bom

    def test_components_mapped_correctly(self):
        """컴포넌트가 올바른 형태로 변환되어야 한다."""
        components = [{"name": "spring-core", "version": "5.3.10", "ecosystem": "maven"}]
        bom = to_cyclonedx(components, [])

        assert len(bom["components"]) == 1
        comp = bom["components"][0]
        assert comp["name"] == "spring-core"
        assert comp["version"] == "5.3.10"
        assert comp["type"] == "library"

    def test_vulnerabilities_mapped_from_cve_matches(self):
        """CVE 매칭 결과가 vulnerabilities 배열에 포함되어야 한다."""
        import decimal
        components = [{"name": "log4j", "version": "2.14.1", "ecosystem": "maven"}]
        cve_matches = [
            {
                "component": {"name": "log4j", "version": "2.14.1"},
                "cves": [
                    {
                        "cveId": "CVE-2021-44228",
                        "description": "Log4Shell RCE",
                        "cvssScore": decimal.Decimal("10.0"),
                        "cvssVector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
                        "severity": "CRITICAL",
                    }
                ],
            }
        ]
        bom = to_cyclonedx(components, cve_matches)

        assert len(bom["vulnerabilities"]) == 1
        vuln = bom["vulnerabilities"][0]
        assert vuln["id"] == "CVE-2021-44228"

    def test_serial_number_is_unique(self):
        """직렬 번호는 호출마다 고유해야 한다."""
        bom1 = to_cyclonedx([], [])
        bom2 = to_cyclonedx([], [])
        assert bom1["serialNumber"] != bom2["serialNumber"]

    def test_empty_inputs_produce_valid_bom(self):
        """입력이 비어있어도 유효한 CycloneDX BOM을 반환해야 한다."""
        bom = to_cyclonedx([], [])
        assert bom["components"] == []
        assert bom["vulnerabilities"] == []
        assert bom["bomFormat"] == "CycloneDX"
