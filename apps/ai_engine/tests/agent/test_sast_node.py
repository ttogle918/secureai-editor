"""
TASK-906 — sast_node.py 단위 테스트.

_ai_tokens_counter 가 sast_node() 실행 중 labels().inc() 호출되는지 검증한다.
_detect_stacks 다중 스택 반환 및 프레임워크 감지를 검증한다.
모든 외부 의존성(MCP, Claude API, Redis, Backend API, 진행 로그)은 mock으로 대체한다.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# 모듈 사전 임포트 — patch() 가 동작하려면 sys.modules에 등록돼야 함
import agent.nodes.sast_node  # noqa: F401


def _make_state(**overrides):
    """sast_node 에 필요한 최소 AgentState 딕셔너리를 반환한다."""
    base = {
        "session_id": "test-session-001",
        "project_id": "00000000-0000-0000-0000-000000000001",
        "files_to_scan": ["/app/src/main.py"],
        "current_file_index": 0,
        "current_file_sha256": None,
        "source_type": "local",
        "scan_mode": None,      # None 이면 sast_node 내부에서 "PIPELINE" 기본값 적용
        "preferred_model": None,
        "user_api_key": None,
        "sast_results": [],
        "token_usage": None,
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_sast_node_increments_token_counter():
    """sast_node 실행 후 _ai_tokens_counter.labels().inc 가 1회 호출된다."""
    fake_usage = {
        "input_tokens": 50, "output_tokens": 50,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }

    mock_counter = MagicMock()
    mock_labels = MagicMock()
    mock_counter.labels.return_value = mock_labels

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="")),
        # _analyze_chunks 전체를 mock — (vulns_list, usage_dict) 반환
        patch("agent.nodes.sast_node._analyze_chunks", new=AsyncMock(return_value=([], fake_usage))),
        # VAL-3: save_vulnerabilities는 validate_findings_node로 이관 — sast_node에서 제거됨
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=MagicMock()),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._ai_tokens_counter", mock_counter),
    ):
        from agent.nodes.sast_node import sast_node
        state = _make_state()
        await sast_node(state)

    # token_count = 50 + 50 = 100 > 0 이므로 inc 가 호출돼야 한다
    mock_counter.labels.assert_called_once_with(service="sast")
    mock_labels.inc.assert_called_once_with(100)


@pytest.mark.asyncio
async def test_sast_node_does_not_increment_counter_when_zero_tokens():
    """token_count 가 0 이면 _ai_tokens_counter.labels().inc 가 호출되지 않는다."""
    fake_usage = {
        "input_tokens": 0, "output_tokens": 0,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }

    mock_counter = MagicMock()

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._analyze_chunks", new=AsyncMock(return_value=([], fake_usage))),
        # VAL-3: save_vulnerabilities는 validate_findings_node로 이관
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=MagicMock()),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._ai_tokens_counter", mock_counter),
    ):
        from agent.nodes.sast_node import sast_node
        state = _make_state()
        await sast_node(state)

    mock_counter.labels.assert_not_called()


# ── TASK-1004: 스캔 모드 분기 테스트 ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_sast_node_audit_mode_uses_haiku_model():
    """Audit 모드 시 settings.audit_model(haiku)이 _analyze_chunks 에 전달된다.

    FakeChatModel을 사용하며 실제 LLM 호출은 발생하지 않는다.
    """
    fake_usage = {
        "input_tokens": 10, "output_tokens": 5,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }
    captured_model: list[str | None] = []

    async def fake_analyze_chunks(
        file_path, content, guidelines="", model=None, api_key=None, provider="anthropic"
    ):
        # preferred_model 로 전달된 모델명을 캡처한다
        captured_model.append(model)
        return ([], fake_usage)

    mock_settings = MagicMock()
    mock_settings.audit_model = "claude-haiku-4-5-20251001"
    mock_settings.pipeline_model = "claude-sonnet-4-6"
    mock_settings.audit_provider = "anthropic"
    mock_settings.pipeline_provider = "anthropic"
    mock_settings.gemini_api_key = ""
    mock_settings.gemini_model = "gemini-2.5-flash"
    mock_settings.openai_model = "gpt-4o-mini"

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._analyze_chunks", side_effect=fake_analyze_chunks),
        # VAL-3: save_vulnerabilities는 validate_findings_node로 이관 — sast_node에 없음
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=MagicMock()),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._ai_tokens_counter", MagicMock()),
        patch("agent.nodes.sast_node.settings", mock_settings),
    ):
        from agent.nodes.sast_node import sast_node
        # preferred_model=None, scan_mode="AUDIT" → audit_model 사용
        state = _make_state(scan_mode="AUDIT")
        await sast_node(state)

    assert len(captured_model) == 1
    assert captured_model[0] == "claude-haiku-4-5-20251001", (
        f"Audit 모드에서 haiku 모델을 사용해야 하지만 '{captured_model[0]}' 가 전달됐다"
    )


@pytest.mark.asyncio
async def test_sast_node_pipeline_mode_uses_sonnet_model():
    """Pipeline 모드 시 settings.pipeline_model(sonnet)이 _analyze_chunks 에 전달된다.

    FakeChatModel을 사용하며 실제 LLM 호출은 발생하지 않는다.
    """
    fake_usage = {
        "input_tokens": 10, "output_tokens": 5,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }
    captured_model: list[str | None] = []

    async def fake_analyze_chunks(
        file_path, content, guidelines="", model=None, api_key=None, provider="anthropic"
    ):
        captured_model.append(model)
        return ([], fake_usage)

    mock_settings = MagicMock()
    mock_settings.audit_model = "claude-haiku-4-5-20251001"
    mock_settings.pipeline_model = "claude-sonnet-4-6"
    mock_settings.audit_provider = "anthropic"
    mock_settings.pipeline_provider = "anthropic"
    mock_settings.gemini_api_key = ""
    mock_settings.gemini_model = "gemini-2.5-flash"
    mock_settings.openai_model = "gpt-4o-mini"

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._analyze_chunks", side_effect=fake_analyze_chunks),
        # VAL-3: save_vulnerabilities는 validate_findings_node로 이관 — sast_node에 없음
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=MagicMock()),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._ai_tokens_counter", MagicMock()),
        patch("agent.nodes.sast_node.settings", mock_settings),
    ):
        from agent.nodes.sast_node import sast_node
        # preferred_model=None, scan_mode="PIPELINE" → pipeline_model 사용
        state = _make_state(scan_mode="PIPELINE")
        await sast_node(state)

    assert len(captured_model) == 1
    assert captured_model[0] == "claude-sonnet-4-6", (
        f"Pipeline 모드에서 sonnet 모델을 사용해야 하지만 '{captured_model[0]}' 가 전달됐다"
    )


@pytest.mark.asyncio
async def test_sast_node_preferred_model_overrides_scan_mode():
    """preferred_model(BYOK)이 명시되면 scan_mode 설정보다 우선한다.

    Audit 모드여도 사용자가 지정한 모델이 전달돼야 한다.
    """
    fake_usage = {
        "input_tokens": 10, "output_tokens": 5,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }
    captured_model: list[str | None] = []

    async def fake_analyze_chunks(
        file_path, content, guidelines="", model=None, api_key=None, provider="anthropic"
    ):
        captured_model.append(model)
        return ([], fake_usage)

    mock_settings = MagicMock()
    mock_settings.audit_model = "claude-haiku-4-5-20251001"
    mock_settings.pipeline_model = "claude-sonnet-4-6"
    mock_settings.audit_provider = "anthropic"
    mock_settings.pipeline_provider = "anthropic"
    mock_settings.gemini_api_key = ""
    mock_settings.gemini_model = "gemini-2.5-flash"
    mock_settings.openai_model = "gpt-4o-mini"

    with (
        patch("agent.nodes.sast_node.read_file", new=AsyncMock(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._analyze_chunks", side_effect=fake_analyze_chunks),
        # VAL-3: save_vulnerabilities는 validate_findings_node로 이관 — sast_node에 없음
        patch("agent.nodes.sast_node.log_started", new=AsyncMock()),
        patch("agent.nodes.sast_node.log_completed", new=AsyncMock()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=MagicMock()),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AsyncMock(return_value="")),
        patch("agent.nodes.sast_node._ai_tokens_counter", MagicMock()),
        patch("agent.nodes.sast_node.settings", mock_settings),
    ):
        from agent.nodes.sast_node import sast_node
        # BYOK: preferred_model="claude-opus-4-5" 가 scan_mode="AUDIT" 보다 우선
        state = _make_state(scan_mode="AUDIT", preferred_model="claude-opus-4-5")
        await sast_node(state)

    assert len(captured_model) == 1
    assert captured_model[0] == "claude-opus-4-5", (
        f"BYOK preferred_model이 scan_mode보다 우선해야 하지만 '{captured_model[0]}' 가 전달됐다"
    )


# ── _detect_stacks 단위 테스트 ──────────────────────────────────────────────

def test_detect_stacks_java_returns_java_spring():
    """.java 파일은 content 무관하게 ["java_spring"] 을 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    result = _detect_stacks("/app/src/UserService.java", "public class UserService {}")
    assert result == ["java_spring"]


def test_detect_stacks_kotlin_returns_java_spring():
    """.kt 파일은 ["java_spring"] 을 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    result = _detect_stacks("/app/src/User.kt", "class User")
    assert result == ["java_spring"]


def test_detect_stacks_js_returns_node_and_common_js():
    """.js 파일은 ["node_express_nestjs", "common_js"] 를 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    result = _detect_stacks("/app/index.js", "const express = require('express')")
    assert result == ["node_express_nestjs", "common_js"]


def test_detect_stacks_ts_returns_react_and_common_js():
    """.ts 파일은 ["frontend_react_nextjs", "common_js"] 를 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    result = _detect_stacks("/app/page.ts", "export const handler = () => {}")
    assert result == ["frontend_react_nextjs", "common_js"]


def test_detect_stacks_tsx_returns_react_and_common_js():
    """.tsx 파일은 ["frontend_react_nextjs", "common_js"] 를 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    result = _detect_stacks("/app/App.tsx", "export default function App() {}")
    assert result == ["frontend_react_nextjs", "common_js"]


def test_detect_stacks_jsx_returns_react_and_common_js():
    """.jsx 파일은 ["frontend_react_nextjs", "common_js"] 를 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    result = _detect_stacks("/app/Button.jsx", "export default function Button() {}")
    assert result == ["frontend_react_nextjs", "common_js"]


def test_detect_stacks_py_django_import():
    """.py 파일에 'import django' 가 있으면 python_django 프레임워크를 선택한다."""
    from agent.nodes.sast_node import _detect_stacks
    content = "import django\nfrom django.db import models"
    result = _detect_stacks("/app/models.py", content)
    assert "common_python" in result
    assert "python_django" in result
    assert len(result) == 2


def test_detect_stacks_py_django_from_import():
    """.py 파일에 'from django.' 가 있으면 python_django 를 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    content = "from django.contrib.auth import User"
    result = _detect_stacks("/app/views.py", content)
    assert "python_django" in result


def test_detect_stacks_py_flask():
    """.py 파일에 'from flask' 가 있으면 python_flask 를 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    content = "from flask import Flask, request"
    result = _detect_stacks("/app/app.py", content)
    assert "common_python" in result
    assert "python_flask" in result


def test_detect_stacks_py_fastapi_default():
    """.py 파일에 django/flask 패턴이 없으면 python_fastapi 기본값을 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    content = "from fastapi import FastAPI\napp = FastAPI()"
    result = _detect_stacks("/app/main.py", content)
    assert "common_python" in result
    assert "python_fastapi" in result


def test_detect_stacks_py_plain_no_framework():
    """.py 파일에 프레임워크 import가 전혀 없어도 python_fastapi 를 기본으로 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    result = _detect_stacks("/app/utils.py", "def helper(): pass")
    assert "common_python" in result
    assert "python_fastapi" in result


def test_detect_stacks_unknown_extension_returns_common():
    """알 수 없는 확장자는 ["common"] 을 반환한다."""
    from agent.nodes.sast_node import _detect_stacks
    result = _detect_stacks("/app/Makefile", "all: build")
    assert result == ["common"]


def test_detect_stacks_does_not_include_common_explicitly():
    """_detect_stacks 반환값에 "common" 이 명시 포함되지 않는다(load_guidelines 가 추가)."""
    from agent.nodes.sast_node import _detect_stacks
    # Python 파일: common_python은 포함되지만 "common" 문자열 자체는 없어야 한다
    result = _detect_stacks("/app/views.py", "from django.db import models\nimport django")
    assert "common" not in result  # "common_python"과 구분
