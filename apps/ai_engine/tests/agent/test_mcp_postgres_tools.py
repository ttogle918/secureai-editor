"""
MCP 클라이언트 get_tool 단위 테스트.

ADR-016 전환(2026-05-23)으로 _fetch_prev_vuln_context() / _fetch_prev_patch_example()의
MCP PostgreSQL 호출 테스트는 삭제되고 tests/test_adr016_backend_api.py 로 이전됐다.
이 파일은 agent.mcp_client.get_tool() 자체 동작만 검증한다.
"""
from unittest.mock import MagicMock

import pytest

from agent.mcp_client import _register, _cleanup, get_tool


def test_get_tool_returns_correct_tool():
    """세션에 등록된 'query' 툴을 이름으로 찾을 수 있다."""
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
    with pytest.raises(ValueError, match="query"):
        get_tool("nonexistent-session", "query")
