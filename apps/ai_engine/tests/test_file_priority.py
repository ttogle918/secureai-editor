"""
TASK-503: 파일 우선순위 정렬 및 필터 단위 테스트.

우선순위 기준 (PRIORITY_EXTENSIONS 딕셔너리):
0 — 시크릿/키/인증서 (.env, .key, .pem, .p12, .pfx)
1 — 설정 파일      (.yml, .yaml, .json, .xml, .conf 등)
2 — 소스 코드      (.py, .java, .ts, .js, .kt 등)
3 — 문서/기타      (.md, .txt)
99 — 알 수 없는 확장자
"""
import pytest

from agent.nodes.scan_files_node import (
    PRIORITY_EXTENSIONS,
    CONFIG_EXTENSIONS,
    SKIP_EXTENSIONS,
    _get_extension,
    _should_exclude,
    _should_skip_by_extension,
    filter_by_size,
    prioritize_files,
)


# ---------------------------------------------------------------------------
# 확장자 감지
# ---------------------------------------------------------------------------

class TestGetExtension:
    def test_returns_dotted_lowercase_extension(self):
        assert _get_extension("src/main/App.java") == ".java"

    def test_returns_empty_string_for_no_extension(self):
        assert _get_extension("Makefile") == ""

    def test_uppercase_extension_is_lowercased(self):
        assert _get_extension("main.PY") == ".py"


# ---------------------------------------------------------------------------
# 우선순위 정렬 테스트
# ---------------------------------------------------------------------------

class TestPrioritizeFiles:
    def test_secret_files_come_before_config_files(self):
        """시크릿 파일(.env, .key, .pem)은 설정 파일(.yml, .json)보다 앞에 위치해야 한다."""
        files = [
            "config/application.yml",
            "secrets/api.key",
            ".env",
            "src/config.json",
            "certs/server.pem",
        ]
        result = prioritize_files(files)

        env_idx = result.index(".env")
        key_idx = result.index("secrets/api.key")
        pem_idx = result.index("certs/server.pem")
        yml_idx = result.index("config/application.yml")
        json_idx = result.index("src/config.json")

        assert env_idx < yml_idx
        assert key_idx < yml_idx
        assert pem_idx < json_idx

    def test_config_files_come_before_source_files(self):
        """설정 파일(.yml, .json)은 소스 코드(.java, .py)보다 앞에 위치해야 한다."""
        files = [
            "src/Service.java",
            "config/application.yml",
            "src/main.py",
            "src/config.json",
        ]
        result = prioritize_files(files)

        yml_idx = result.index("config/application.yml")
        json_idx = result.index("src/config.json")
        java_idx = result.index("src/Service.java")
        py_idx = result.index("src/main.py")

        assert yml_idx < java_idx
        assert json_idx < py_idx

    def test_config_extensions_come_before_source_extensions(self):
        """CONFIG_EXTENSIONS 파일이 소스 코드 파일(.go, .ts)보다 먼저 나와야 한다."""
        files = ["server.go", "app.yml", "service.ts", "config.json"]
        result = prioritize_files(files)

        last_config_idx = max(
            result.index(f) for f in files if _get_extension(f) in CONFIG_EXTENSIONS
        )
        first_source_idx = min(
            result.index(f) for f in files if _get_extension(f) in {".go", ".ts"}
        )
        assert last_config_idx < first_source_idx

    def test_unknown_extension_files_placed_last(self):
        """알 수 없는 확장자 파일은 소스와 설정 파일 뒤에 위치해야 한다."""
        files = ["main.py", "Makefile", "app.yml"]
        result = prioritize_files(files)

        makefile_idx = result.index("Makefile")
        py_idx = result.index("main.py")
        yml_idx = result.index("app.yml")

        assert py_idx < makefile_idx
        assert yml_idx < makefile_idx

    def test_preserves_all_input_files(self):
        """정렬 후 입력 파일이 모두 포함되어야 한다."""
        files = ["a.java", "b.yml", "c.jar", "d.py"]
        result = prioritize_files(files)
        assert sorted(result) == sorted(files)

    def test_empty_list_returns_empty(self):
        assert prioritize_files([]) == []


# ---------------------------------------------------------------------------
# 바이너리 확장자 필터 테스트
# ---------------------------------------------------------------------------

class TestShouldSkipByExtension:
    @pytest.mark.parametrize("file_path", [
        "libs/spring.jar",
        "target/app.class",
        "dist/app.exe",
        "__pycache__/module.pyc",
        "poetry.lock",
    ])
    def test_binary_files_should_be_skipped(self, file_path):
        assert _should_skip_by_extension(file_path) is True

    @pytest.mark.parametrize("file_path", [
        "src/Main.java",
        "app.py",
        "service.ts",
        "main.go",
    ])
    def test_source_files_should_not_be_skipped(self, file_path):
        assert _should_skip_by_extension(file_path) is False


# ---------------------------------------------------------------------------
# 파일 크기 필터 테스트
# ---------------------------------------------------------------------------

class TestFilterBySize:
    def test_excludes_files_exceeding_10mb(self):
        files = ["small.java", "huge.java", "medium.py"]
        size_map = {
            "small.java": 1024,
            "huge.java": 11 * 1024 * 1024,  # 11MB — 초과
            "medium.py": 5 * 1024 * 1024,
        }
        result = filter_by_size(files, size_map)
        assert "huge.java" not in result
        assert "small.java" in result
        assert "medium.py" in result

    def test_file_without_size_info_is_included(self):
        """size_map 에 없는 파일은 크기를 알 수 없으므로 포함해야 한다."""
        files = ["unknown.java", "known_large.java"]
        size_map = {"known_large.java": 20 * 1024 * 1024}
        result = filter_by_size(files, size_map)
        assert "unknown.java" in result
        assert "known_large.java" not in result

    def test_empty_size_map_includes_all_files(self):
        files = ["a.java", "b.py"]
        result = filter_by_size(files, {})
        assert result == files

    def test_exact_10mb_file_is_not_excluded(self):
        """정확히 10MB인 파일은 제외하지 않는다 (초과 조건)."""
        files = ["exact.java"]
        size_map = {"exact.java": 10 * 1024 * 1024}
        result = filter_by_size(files, size_map)
        assert "exact.java" in result


# ---------------------------------------------------------------------------
# 테스트/목 파일 제외 테스트
# ---------------------------------------------------------------------------

class TestShouldExclude:
    @pytest.mark.parametrize("path", [
        "src/__tests__/service.test.ts",
        "test/mockData/users.json",
        "fixtures/setup.py",
        "src/setupTests.ts",
        "jest.config.js",
    ])
    def test_test_and_mock_files_are_excluded(self, path):
        assert _should_exclude(path) is True

    @pytest.mark.parametrize("path", [
        "src/service/UserService.java",
        "api/routes/analyze.py",
        "components/Dashboard.tsx",
    ])
    def test_source_files_are_not_excluded(self, path):
        assert _should_exclude(path) is False
