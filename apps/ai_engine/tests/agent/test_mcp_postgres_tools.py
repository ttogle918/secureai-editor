"""
MCP PostgreSQL 툴 관련 단위 테스트.

- _fetch_prev_vuln_context(): MCP query 툴 mock으로 외부 DB 호출 없이 테스트
- _fetch_prev_patch_example(): 동일 방식
- MCP PostgreSQL 미설정 시 빈 문자열 반환 검증
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─── 헬퍼 ────────────────────────────────────────────────────────────────────

def _make_query_tool_mock(return_value) -> MagicMock:
    """ainvoke 시 지정된 값을 반환하는 MCP query 툴 mock."""
    tool = MagicMock()
    tool.name = "query"
    tool.ainvoke = AsyncMock(return_value=return_value)
    return tool


# ─── _fetch_prev_vuln_context ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_prev_vuln_context_returns_string_on_success():
    """query 툴이 문자열 결과를 반환하면 그대로 반환된다."""
    from agent.nodes.sast_node import _fetch_prev_vuln_context

    mock_tool = _make_query_tool_mock("SQL_INJECTION | 3 | HIGH\nXSS | 1 | MEDIUM")

    valid_project_id = "00000000-0000-0000-0000-000000001234"
    with patch("agent.nodes.sast_node.get_tool", return_value=mock_tool):
        result = await _fetch_prev_vuln_context("sess-001", valid_project_id)

    assert "SQL_INJECTION" in result
    assert "XSS" in result
    mock_tool.ainvoke.assert_called_once()
    call_args = mock_tool.ainvoke.call_args[0][0]
    assert valid_project_id in call_args["query"]


@pytest.mark.asyncio
async def test_fetch_prev_vuln_context_returns_empty_when_no_mcp_tool():
    """MCP PostgreSQL 미설정(get_tool이 ValueError 발생) 시 빈 문자열을 반환한다."""
    from agent.nodes.sast_node import _fetch_prev_vuln_context

    with patch("agent.nodes.sast_node.get_tool", side_effect=ValueError("MCP tool 'query' not found")):
        result = await _fetch_prev_vuln_context("sess-002", "proj-uuid-5678")

    assert result == ""


@pytest.mark.asyncio
async def test_fetch_prev_vuln_context_returns_empty_on_query_failure():
    """query 툴 호출 중 예외 발생 시 빈 문자열을 반환하고 분석을 중단하지 않는다."""
    from agent.nodes.sast_node import _fetch_prev_vuln_context

    mock_tool = _make_query_tool_mock(None)
    mock_tool.ainvoke = AsyncMock(side_effect=RuntimeError("DB connection timeout"))

    with patch("agent.nodes.sast_node.get_tool", return_value=mock_tool):
        result = await _fetch_prev_vuln_context("sess-003", "proj-uuid-9999")

    assert result == ""


@pytest.mark.asyncio
async def test_fetch_prev_vuln_context_returns_empty_on_empty_result():
    """query 툴이 빈 문자열을 반환하면 빈 문자열을 반환한다."""
    from agent.nodes.sast_node import _fetch_prev_vuln_context

    mock_tool = _make_query_tool_mock("")

    with patch("agent.nodes.sast_node.get_tool", return_value=mock_tool):
        result = await _fetch_prev_vuln_context("sess-004", "proj-uuid-0001")

    assert result == ""


@pytest.mark.asyncio
async def test_fetch_prev_vuln_context_handles_list_result():
    """query 툴이 리스트 형태로 결과를 반환해도 문자열로 변환된다."""
    from agent.nodes.sast_node import _fetch_prev_vuln_context

    rows = [
        {"vuln_type": "SQL_INJECTION", "count": 5, "max_severity": "CRITICAL"},
        {"vuln_type": "XSS", "count": 2, "max_severity": "HIGH"},
    ]
    mock_tool = _make_query_tool_mock(rows)

    with patch("agent.nodes.sast_node.get_tool", return_value=mock_tool):
        result = await _fetch_prev_vuln_context("sess-005", "00000000-0000-0000-0000-000000005678")

    assert result != ""
    assert len(result) > 0


# ─── _fetch_prev_patch_example ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_prev_patch_example_returns_empty_when_no_mcp_tool():
    """MCP PostgreSQL 미설정 시 빈 문자열을 반환한다."""
    from agent.nodes.patch_node import _fetch_prev_patch_example

    with patch("agent.nodes.patch_node.get_tool", side_effect=KeyError("query")):
        result = await _fetch_prev_patch_example("sess-010", "SQL_INJECTION", "java")

    assert result == ""


@pytest.mark.asyncio
async def test_fetch_prev_patch_example_returns_string_on_success():
    """query 툴이 결과를 반환하면 문자열로 변환해 반환한다."""
    from agent.nodes.patch_node import _fetch_prev_patch_example

    mock_tool = _make_query_tool_mock("original: String q = ...\npatched: PreparedStatement ...")

    with patch("agent.nodes.patch_node.get_tool", return_value=mock_tool):
        result = await _fetch_prev_patch_example("sess-011", "SQL_INJECTION", "java")

    assert "PreparedStatement" in result
    call_args = mock_tool.ainvoke.call_args[0][0]
    assert "SQL_INJECTION" in call_args["query"]
    assert ".java" in call_args["query"]


@pytest.mark.asyncio
async def test_fetch_prev_patch_example_returns_empty_on_exception():
    """query 툴 호출 중 예외 발생 시 빈 문자열을 반환한다."""
    from agent.nodes.patch_node import _fetch_prev_patch_example

    mock_tool = _make_query_tool_mock(None)
    mock_tool.ainvoke = AsyncMock(side_effect=ConnectionError("lost connection"))

    with patch("agent.nodes.patch_node.get_tool", return_value=mock_tool):
        result = await _fetch_prev_patch_example("sess-012", "XSS", "javascript")

    assert result == ""


# ─── mcp_client get_tool ──────────────────────────────────────────────────────

def test_get_tool_returns_correct_tool():
    """세션에 등록된 'query' 툴을 이름으로 찾을 수 있다."""
    from agent.mcp_client import _register, _cleanup, get_tool

    tool_a = MagicMock()
    tool_a.name = "read_file"
    tool_b = MagicMock()
    tool_b.name = "query"

    session_id = "sess-get-tool-001"
    _register(session_id, [tool_a, tool_b])

    try:
        found = get_tool(session_id, "query")
        assert found is tool_b
    finally:
        _cleanup(session_id)


def test_get_tool_raises_when_not_found():
    """등록되지 않은 툴 이름 요청 시 ValueError가 발생한다."""
    from agent.mcp_client import _register, _cleanup, get_tool

    tool = MagicMock()
    tool.name = "read_file"

    session_id = "sess-get-tool-002"
    _register(session_id, [tool])

    try:
        with pytest.raises(ValueError, match="query"):
            get_tool(session_id, "query")
    finally:
        _cleanup(session_id)


def test_get_tool_raises_when_session_not_registered():
    """세션이 등록되지 않은 경우 ValueError가 발생한다."""
    from agent.mcp_client import get_tool

    with pytest.raises(ValueError, match="query"):
        get_tool("nonexistent-session", "query")
