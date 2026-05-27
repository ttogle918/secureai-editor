"""
TASK-503: scan_files_node 단위 테스트.

테스트 케이스 구성:
- TC-1: 우선순위 정렬 — .env 파일이 .md보다 먼저
- TC-2: 우선순위 정렬 — 시크릿(.key, .pem) → 설정(.yml) → 소스(.py) → 문서(.md)
- TC-3: 바이너리 필터 — .png, .jar, .class, .gif 제외
- TC-4: _is_binary() 함수로 바이너리 판별
- TC-5: get_scannable_files() — SSE 진행률 기준 파일 수
- TC-6: 개별 파일 실패 시 skip & log (전체 중단 금지) — scan_files_node 레벨
- TC-7: PRIORITY_EXTENSIONS가 딕셔너리이고 .env 우선순위가 0인지 확인
- TC-8: 빈 파일 목록이면 빈 결과 반환
- TC-9: CONFIG_EXTENSIONS가 frozenset이고 설정 확장자를 포함하는지 확인
- TC-10: _get_scan_priority() 반환값이 낮을수록 먼저 정렬되는지 확인
"""
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agent.nodes.scan_files_node import (
    BINARY_EXTENSIONS,
    CONFIG_EXTENSIONS,
    PRIORITY_EXTENSIONS,
    SKIP_EXTENSIONS,
    _get_extension,
    _get_scan_priority,
    _is_binary,
    _should_skip_by_extension,
    filter_by_size,
    get_scannable_files,
    prioritize_files,
)


# ─── TC-1: .env가 .md보다 먼저 스캔 ─────────────────────────────────────────

class TestEnvFileScannedBeforeMd:
    def test_env_file_comes_before_md(self):
        """.env 파일은 .md 파일보다 먼저 스캔되어야 한다."""
        files = [
            "README.md",
            "docs/guide.md",
            ".env",
            "src/app.env",
        ]
        result = prioritize_files(files)

        env_indices = [result.index(f) for f in files if _get_extension(f) == ".env"]
        md_indices = [result.index(f) for f in files if _get_extension(f) == ".md"]

        assert max(env_indices) < min(md_indices), (
            ".env 파일 중 가장 늦게 나오는 것도 .md 파일 중 가장 먼저 나오는 것보다 앞에 있어야 한다."
        )


# ─── TC-2: 전체 우선순위 순서 ────────────────────────────────────────────────

class TestFullPriorityOrder:
    def test_secret_then_config_then_source_then_doc(self):
        """시크릿(.key, .pem) → 설정(.yml) → 소스(.py) → 문서(.md) 순서로 정렬된다."""
        files = [
            "docs/README.md",
            "src/main.py",
            "config/app.yml",
            "certs/server.pem",
            "secrets/api.key",
            ".env",
        ]
        result = prioritize_files(files)

        secret_files = ["certs/server.pem", "secrets/api.key", ".env"]
        config_files = ["config/app.yml"]
        source_files = ["src/main.py"]
        doc_files = ["docs/README.md"]

        last_secret = max(result.index(f) for f in secret_files)
        first_config = min(result.index(f) for f in config_files)
        last_config = max(result.index(f) for f in config_files)
        first_source = min(result.index(f) for f in source_files)
        last_source = max(result.index(f) for f in source_files)
        first_doc = min(result.index(f) for f in doc_files)

        assert last_secret < first_config, "시크릿 파일이 설정 파일보다 먼저여야 한다."
        assert last_config < first_source, "설정 파일이 소스 파일보다 먼저여야 한다."
        assert last_source < first_doc, "소스 파일이 문서 파일보다 먼저여야 한다."

    def test_pfx_and_p12_are_priority_zero(self):
        """.pfx, .p12는 우선순위 0 (최우선)이어야 한다."""
        assert PRIORITY_EXTENSIONS.get(".pfx") == 0
        assert PRIORITY_EXTENSIONS.get(".p12") == 0

    def test_yml_and_json_are_priority_one(self):
        """.yml, .json은 우선순위 1이어야 한다."""
        assert PRIORITY_EXTENSIONS.get(".yml") == 1
        assert PRIORITY_EXTENSIONS.get(".json") == 1

    def test_py_and_java_are_priority_two(self):
        """.py, .java는 우선순위 2이어야 한다."""
        assert PRIORITY_EXTENSIONS.get(".py") == 2
        assert PRIORITY_EXTENSIONS.get(".java") == 2


# ─── TC-3: 바이너리 파일 필터 ────────────────────────────────────────────────

class TestBinaryFilter:
    @pytest.mark.parametrize("file_path", [
        "assets/logo.png",
        "assets/icon.jpg",
        "images/banner.jpeg",
        "icons/favicon.ico",
        "assets/animation.gif",
        "libs/app.jar",
        "build/App.class",
        "dist/app.exe",
        "target/libapp.so",
        "lib/libapp.dylib",
        "fonts/arial.woff",
        "fonts/arial.ttf",
        "assets/video.mp4",
        "archive/backup.zip",
        "archive/source.tar",
    ])
    def test_binary_files_excluded(self, file_path):
        """바이너리/미디어 파일은 스캔 대상에서 제외된다."""
        files = [file_path, "src/main.py"]
        result = get_scannable_files(files)
        assert file_path not in result
        assert "src/main.py" in result

    @pytest.mark.parametrize("file_path", [
        "src/Main.java",
        "app.py",
        "service.ts",
        ".env",
        "config/app.yml",
        "secrets/api.key",
        "certs/server.pem",
    ])
    def test_text_files_included(self, file_path):
        """텍스트/소스 파일은 스캔 대상에 포함된다."""
        files = [file_path]
        result = get_scannable_files(files)
        assert file_path in result


# ─── TC-4: _is_binary() 함수 ─────────────────────────────────────────────────

class TestIsBinary:
    @pytest.mark.parametrize("filename,expected", [
        ("photo.png", True),
        ("archive.zip", True),
        ("library.jar", True),
        ("compiled.class", True),
        ("font.ttf", True),
        ("module.pyc", True),
        ("lockfile.lock", True),
        ("source.py", False),
        ("config.yml", False),
        (".env", False),
        ("key.pem", False),
        ("script.js", False),
    ])
    def test_is_binary_detection(self, filename, expected):
        assert _is_binary(filename) == expected, (
            f"_is_binary('{filename}') 의 반환값이 {expected}여야 합니다."
        )

    def test_should_skip_by_extension_is_alias_of_is_binary(self):
        """_should_skip_by_extension은 _is_binary와 동일하게 동작한다."""
        test_files = ["app.jar", "main.py", ".env", "font.woff"]
        for f in test_files:
            assert _should_skip_by_extension(f) == _is_binary(f), (
                f"'{f}': _should_skip_by_extension과 _is_binary 결과가 달라서는 안 된다."
            )


# ─── TC-5: get_scannable_files() — SSE 진행률 기준 ──────────────────────────

class TestGetScannableFiles:
    def test_returns_only_non_binary_files(self):
        """바이너리 파일을 제외한 파일만 반환한다."""
        files = ["app.py", "logo.png", "config.yml", "lib.jar", ".env"]
        result = get_scannable_files(files)
        assert "logo.png" not in result
        assert "lib.jar" not in result
        assert "app.py" in result
        assert "config.yml" in result
        assert ".env" in result

    def test_count_used_as_sse_progress_total(self):
        """get_scannable_files 결과 수가 SSE 진행률 total로 사용되어야 한다.

        progress = (완료 수 / total) * 100
        total = len(get_scannable_files(files))
        """
        files = ["a.py", "b.png", "c.yml", "d.jar", "e.ts"]
        scannable = get_scannable_files(files)
        total = len(scannable)

        assert total == 3  # a.py, c.yml, e.ts — b.png, d.jar 제외

        # progress 계산 예시 검증
        completed = 1
        progress = (completed / total) * 100
        assert abs(progress - 33.33) < 0.1

    def test_empty_input_returns_empty(self):
        assert get_scannable_files([]) == []

    def test_all_binary_returns_empty(self):
        files = ["a.png", "b.jar", "c.class"]
        assert get_scannable_files(files) == []


# ─── TC-6: scan_files_node — 개별 실패 시 skip (전체 중단 금지) ───────────────

class TestScanFilesNodeResiliency:
    @pytest.mark.asyncio
    async def test_node_returns_result_even_on_list_error(self):
        """파일 목록 조회 실패 시 빈 목록을 반환하고 세션을 계속 진행한다."""
        state = {
            "session_id": "test-session-503",
            "source_type": "local",
        }

        mock_span = MagicMock()
        mock_span.__enter__ = MagicMock(return_value=mock_span)
        mock_span.__exit__ = MagicMock(return_value=False)
        mock_tracer = MagicMock()
        mock_tracer.start_as_current_span.return_value = mock_span

        with (
            patch("agent.nodes.scan_files_node.tracer", mock_tracer),
            patch(
                "agent.nodes.scan_files_node.list_scannable_files",
                side_effect=RuntimeError("MCP connection failed"),
            ),
            patch("agent.nodes.scan_files_node.log_started", new_callable=AsyncMock),
            patch("agent.nodes.scan_files_node.log_failed", new_callable=AsyncMock),
            patch("agent.nodes.scan_files_node.log_completed", new_callable=AsyncMock),
        ):
            from agent.nodes.scan_files_node import scan_files_node
            result = await scan_files_node(state)

        # 전체 세션이 실패하지 않고 결과를 반환해야 한다
        assert "files_to_scan" in result
        assert result["files_to_scan"] == []
        assert result["status"] == "running"

    @pytest.mark.asyncio
    async def test_node_returns_sorted_files_on_success(self):
        """정상 조회 시 우선순위 정렬된 파일 목록을 반환한다."""
        state = {
            "session_id": "test-session-503-ok",
            "source_type": "local",
        }

        mock_files = [
            "docs/README.md",
            "src/main.py",
            "config/app.yml",
            ".env",
        ]

        mock_span = MagicMock()
        mock_span.__enter__ = MagicMock(return_value=mock_span)
        mock_span.__exit__ = MagicMock(return_value=False)
        mock_tracer = MagicMock()
        mock_tracer.start_as_current_span.return_value = mock_span

        with (
            patch("agent.nodes.scan_files_node.tracer", mock_tracer),
            patch(
                "agent.nodes.scan_files_node.list_scannable_files",
                new_callable=AsyncMock,
                return_value=mock_files,
            ),
            patch("agent.nodes.scan_files_node.log_started", new_callable=AsyncMock),
            patch("agent.nodes.scan_files_node.log_completed", new_callable=AsyncMock),
            patch("agent.nodes.scan_files_node.log_failed", new_callable=AsyncMock),
        ):
            from agent.nodes.scan_files_node import scan_files_node
            result = await scan_files_node(state)

        files = result["files_to_scan"]
        assert ".env" in files
        assert "docs/README.md" in files

        env_idx = files.index(".env")
        md_idx = files.index("docs/README.md")
        assert env_idx < md_idx, ".env는 README.md보다 먼저여야 한다."


# ─── TC-7: PRIORITY_EXTENSIONS 딕셔너리 구조 확인 ────────────────────────────

class TestPriorityExtensionsStructure:
    def test_priority_extensions_is_dict(self):
        """PRIORITY_EXTENSIONS는 dict[str, int]여야 한다."""
        assert isinstance(PRIORITY_EXTENSIONS, dict)

    def test_env_priority_is_zero(self):
        """.env 확장자의 우선순위는 0이어야 한다."""
        assert PRIORITY_EXTENSIONS[".env"] == 0

    def test_key_and_pem_priority_are_zero(self):
        """.key, .pem 확장자의 우선순위는 0이어야 한다."""
        assert PRIORITY_EXTENSIONS[".key"] == 0
        assert PRIORITY_EXTENSIONS[".pem"] == 0

    def test_all_values_are_integers(self):
        """모든 우선순위 값은 정수여야 한다."""
        for ext, priority in PRIORITY_EXTENSIONS.items():
            assert isinstance(priority, int), f"확장자 '{ext}'의 우선순위가 int가 아닙니다: {priority!r}"

    def test_all_keys_start_with_dot(self):
        """모든 확장자 키는 '.'으로 시작해야 한다."""
        for ext in PRIORITY_EXTENSIONS:
            assert ext.startswith("."), f"확장자 키 '{ext}'가 '.'으로 시작하지 않습니다."


# ─── TC-8: 빈 파일 목록 처리 ─────────────────────────────────────────────────

class TestEmptyFileList:
    def test_prioritize_files_empty(self):
        assert prioritize_files([]) == []

    def test_get_scannable_files_empty(self):
        assert get_scannable_files([]) == []

    def test_filter_by_size_empty(self):
        assert filter_by_size([], {}) == []


# ─── TC-9: CONFIG_EXTENSIONS 구조 확인 ───────────────────────────────────────

class TestConfigExtensionsStructure:
    def test_config_extensions_is_frozenset(self):
        """CONFIG_EXTENSIONS는 frozenset이어야 한다."""
        assert isinstance(CONFIG_EXTENSIONS, frozenset)

    @pytest.mark.parametrize("ext", [".yml", ".yaml", ".json", ".xml", ".conf", ".toml"])
    def test_config_extensions_contains_common_config_types(self, ext):
        """일반적인 설정 파일 확장자가 포함되어야 한다."""
        assert ext in CONFIG_EXTENSIONS, f"CONFIG_EXTENSIONS에 '{ext}'가 없습니다."

    def test_skip_extensions_equals_binary_extensions(self):
        """SKIP_EXTENSIONS는 BINARY_EXTENSIONS와 동일해야 한다 (하위 호환 별칭)."""
        assert SKIP_EXTENSIONS == BINARY_EXTENSIONS


# ─── TC-10: _get_scan_priority() 반환값 ──────────────────────────────────────

class TestGetScanPriority:
    def test_env_has_lower_priority_value_than_py(self):
        """.env 우선순위 값이 .py보다 낮아 먼저 스캔된다."""
        assert _get_scan_priority(".env") < _get_scan_priority("main.py")

    def test_yml_has_lower_priority_value_than_java(self):
        """.yml 우선순위 값이 .java보다 낮아 먼저 스캔된다."""
        assert _get_scan_priority("config.yml") < _get_scan_priority("Service.java")

    def test_py_has_lower_priority_value_than_md(self):
        """.py 우선순위 값이 .md보다 낮아 먼저 스캔된다."""
        assert _get_scan_priority("main.py") < _get_scan_priority("README.md")

    def test_unknown_extension_has_default_high_priority_value(self):
        """알 수 없는 확장자는 높은 우선순위 값(99)을 가져 마지막에 처리된다."""
        unknown_priority = _get_scan_priority("Makefile")
        known_priority = _get_scan_priority("main.py")
        assert unknown_priority > known_priority

    def test_prioritize_files_uses_scan_priority(self):
        """prioritize_files 결과가 _get_scan_priority 순서와 일치한다."""
        files = ["README.md", "main.py", "config.yml", ".env", "Makefile"]
        result = prioritize_files(files)

        for i in range(len(result) - 1):
            assert _get_scan_priority(result[i]) <= _get_scan_priority(result[i + 1]), (
                f"'{result[i]}' (priority={_get_scan_priority(result[i])})가 "
                f"'{result[i + 1]}' (priority={_get_scan_priority(result[i + 1])})보다 "
                f"뒤에 있어서는 안 됩니다."
            )
