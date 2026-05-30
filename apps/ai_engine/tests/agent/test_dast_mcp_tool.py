"""DAST MCP 툴 전환 관련 단위 테스트.

검증 범위:
- _execute_dast: MCP 툴 사용 경로 (세션 등록된 경우)
- _execute_dast: 직접 httpx 폴백 경로 (MCP 미등록 시)
- _execute_dast: MCP 툴 호출 실패 시 폴백
- mcp_client.py: filesystem 서버 env에 BACKEND_INTERNAL_URL 포함 여부
- docker_tool.py: 타임아웃/HTTP오류 분기 반환 형식

외부 네트워크 호출 없음 — httpx, MCP 툴 모두 mock 사용.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

def _make_dast_state(**overrides):
    base = {
        "session_id": "sess-dast-mcp-001",
        "vuln_id": "vuln-sql-1",
        "vuln_type": "SQL_INJECTION",
        "target_url": "http://target.internal",
        "endpoint": "/api/users",
        "params": {"id": "1"},
        "retry_count": 0,
        "max_retries": 3,
        "exploit_outcome": None,
        "dast_guidelines": "",
        "status": "running",
        "log_messages": [],
    }
    return {**base, **overrides}


def _make_mcp_tool_mock(response_dict: dict) -> MagicMock:
    """MCP 툴 응답을 흉내내는 mock — ainvoke 가 content 래핑된 JSON 문자열을 반환."""
    tool = MagicMock()
    tool.name = "run_dast_in_sandbox"
    tool.ainvoke = AsyncMock(
        return_value={"content": [{"type": "text", "text": json.dumps(response_dict)}]}
    )
    return tool


# ─── _execute_dast: MCP 경로 ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_dast_uses_mcp_tool_when_available():
    """세션에 MCP 툴이 등록된 경우 MCP 경로로 실행되어야 한다."""
    from agent.nodes.dast.dast_node import _execute_dast

    expected = {"success": True, "payload": "' OR 1=1", "evidence": "DB err", "response_snippet": "", "error": None}
    mock_tool = _make_mcp_tool_mock(expected)

    with patch("agent.nodes.dast.dast_node._get_mcp_tool", return_value=mock_tool):
        result = await _execute_dast(_make_dast_state())

    assert result["success"] is True
    assert result["payload"] == "' OR 1=1"
    mock_tool.ainvoke.assert_called_once()


@pytest.mark.asyncio
async def test_execute_dast_mcp_args_do_not_include_log_unsafe_in_assertion():
    """MCP 툴 호출 시 sessionId, vulnId 등 필수 인자가 전달되어야 한다."""
    from agent.nodes.dast.dast_node import _execute_dast

    fake_result = {"success": False, "payload": "", "evidence": "", "response_snippet": "", "error": None}
    mock_tool = _make_mcp_tool_mock(fake_result)

    state = _make_dast_state(session_id="sess-arg-check", vuln_id="vuln-999", vuln_type="XSS")

    with patch("agent.nodes.dast.dast_node._get_mcp_tool", return_value=mock_tool):
        await _execute_dast(state)

    call_args = mock_tool.ainvoke.call_args[0][0]
    assert call_args["sessionId"] == "sess-arg-check"
    assert call_args["vulnId"] == "vuln-999"
    assert call_args["vulnType"] == "XSS"
    assert "targetUrl" in call_args
    assert "params" in call_args


# ─── _execute_dast: 폴백 경로 ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_dast_falls_back_when_mcp_not_registered():
    """MCP 툴이 등록되지 않아 ValueError 발생 시 직접 httpx 호출로 폴백해야 한다."""
    from agent.nodes.dast.dast_node import _execute_dast

    fallback_result = {"success": True, "payload": "direct", "evidence": "ok", "response_snippet": "", "error": None}
    mock_direct = AsyncMock(return_value=fallback_result)

    with (
        patch("agent.nodes.dast.dast_node._get_mcp_tool", side_effect=ValueError("not found")),
        patch("agent.nodes.dast.dast_node.run_dast_in_sandbox", mock_direct),
    ):
        result = await _execute_dast(_make_dast_state())

    assert result["payload"] == "direct"
    mock_direct.assert_called_once()


@pytest.mark.asyncio
async def test_execute_dast_falls_back_when_mcp_tool_raises():
    """MCP 툴 호출 중 예외가 발생해도 폴백하여 분석을 계속해야 한다."""
    from agent.nodes.dast.dast_node import _execute_dast

    fallback_result = {"success": False, "payload": "", "evidence": "", "response_snippet": "", "error": "timeout"}
    mock_tool = MagicMock()
    mock_tool.name = "run_dast_in_sandbox"
    mock_tool.ainvoke = AsyncMock(side_effect=RuntimeError("MCP process died"))
    mock_direct = AsyncMock(return_value=fallback_result)

    with (
        patch("agent.nodes.dast.dast_node._get_mcp_tool", return_value=mock_tool),
        patch("agent.nodes.dast.dast_node.run_dast_in_sandbox", mock_direct),
    ):
        result = await _execute_dast(_make_dast_state())

    assert result["success"] is False
    mock_direct.assert_called_once()


@pytest.mark.asyncio
async def test_execute_dast_falls_back_when_get_mcp_tool_is_none():
    """_get_mcp_tool 자체가 None 이면 직접 httpx 호출을 사용해야 한다."""
    from agent.nodes.dast.dast_node import _execute_dast

    fallback_result = {"success": True, "payload": "x", "evidence": "y", "response_snippet": "", "error": None}
    mock_direct = AsyncMock(return_value=fallback_result)

    with (
        patch("agent.nodes.dast.dast_node._get_mcp_tool", None),
        patch("agent.nodes.dast.dast_node.run_dast_in_sandbox", mock_direct),
    ):
        result = await _execute_dast(_make_dast_state())

    assert result["success"] is True
    mock_direct.assert_called_once()


# ─── _execute_dast: MCP 응답 역직렬화 ────────────────────────────────────────

@pytest.mark.asyncio
async def test_execute_dast_parses_mcp_text_content_response():
    """MCP 응답이 content[0].text JSON 형식일 때 올바르게 파싱되어야 한다."""
    from agent.nodes.dast.dast_node import _execute_dast

    payload_data = {"success": True, "payload": "parsed", "evidence": "e", "response_snippet": "r", "error": None}
    mock_tool = MagicMock()
    mock_tool.name = "run_dast_in_sandbox"
    mock_tool.ainvoke = AsyncMock(
        return_value={"content": [{"type": "text", "text": json.dumps(payload_data)}]}
    )

    with patch("agent.nodes.dast.dast_node._get_mcp_tool", return_value=mock_tool):
        result = await _execute_dast(_make_dast_state())

    assert result["payload"] == "parsed"


@pytest.mark.asyncio
async def test_execute_dast_handles_dict_mcp_response():
    """MCP 툴이 이미 dict 형태로 응답해도 올바르게 처리해야 한다."""
    from agent.nodes.dast.dast_node import _execute_dast

    payload_data = {"success": True, "payload": "dict_resp", "evidence": "e", "response_snippet": "", "error": None}
    mock_tool = MagicMock()
    mock_tool.name = "run_dast_in_sandbox"
    mock_tool.ainvoke = AsyncMock(return_value=payload_data)  # content 래핑 없음

    with patch("agent.nodes.dast.dast_node._get_mcp_tool", return_value=mock_tool):
        result = await _execute_dast(_make_dast_state())

    assert result["payload"] == "dict_resp"


# ─── docker_tool: 타임아웃/HTTP 오류 분기 ────────────────────────────────────

@pytest.mark.asyncio
async def test_docker_tool_returns_error_on_timeout():
    """httpx.TimeoutException 발생 시 success=False 를 반환하고 예외를 전파하지 않는다."""
    import httpx
    from agent.nodes.dast.docker_tool import run_dast_in_sandbox

    with patch("agent.nodes.dast.docker_tool.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
        mock_client_cls.return_value = mock_client

        result = await run_dast_in_sandbox(_make_dast_state())

    assert result["success"] is False
    assert "timed out" in result["error"].lower() or "timeout" in result["error"].lower()


@pytest.mark.asyncio
async def test_docker_tool_returns_error_on_http_status_error():
    """백엔드가 5xx 응답 시 success=False 와 HTTP 상태코드를 반환해야 한다."""
    import httpx
    from agent.nodes.dast.docker_tool import run_dast_in_sandbox

    mock_response = MagicMock()
    mock_response.status_code = 503
    http_err = httpx.HTTPStatusError("503", request=MagicMock(), response=mock_response)

    with patch("agent.nodes.dast.docker_tool.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=http_err)
        mock_client_cls.return_value = mock_client

        result = await run_dast_in_sandbox(_make_dast_state())

    assert result["success"] is False
    assert "503" in result["error"]


# ─── mcp_client: filesystem env에 BACKEND_INTERNAL_URL 포함 여부 ───────────────

def test_mcp_client_filesystem_env_includes_dast_vars():
    """mcp_session 이 filesystem 서버 env에 BACKEND_INTERNAL_URL 을 전달해야 한다."""
    import pathlib

    # 테스트 파일 위치 기준 상대 경로로 해석한다 (이전엔 개발자 머신의
    # 절대 Windows 경로가 하드코딩되어 CI/다른 환경에서 항상 실패했다).
    src = (
        pathlib.Path(__file__).resolve().parents[2] / "agent" / "mcp_client.py"
    ).read_text(encoding="utf-8")

    # BACKEND_INTERNAL_URL 이 filesystem env 딕셔너리에 포함되어 있는지 텍스트 기반 확인
    assert "BACKEND_INTERNAL_URL" in src, "filesystem 서버 env에 BACKEND_INTERNAL_URL이 없다"
    assert "INTERNAL_API_KEY" in src, "filesystem 서버 env에 INTERNAL_API_KEY가 없다"
