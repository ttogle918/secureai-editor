"""
ADR-016 전환 검증 — Backend 내부 API 경유 컨텍스트 조회 단위 테스트.

외부 HTTP 호출은 httpx.AsyncClient를 mock하여 실제 네트워크를 사용하지 않는다.
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from infrastructure.backend_api_client import get_vuln_context, get_patch_examples


# ─── get_vuln_context ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_vuln_context_returns_items_on_success():
    """정상 응답 시 취약점 집계 목록을 반환한다."""
    payload = {
        "data": [
            {"vulnType": "SQL_INJECTION", "count": 3, "maxSeverity": "HIGH"},
            {"vulnType": "XSS", "count": 1, "maxSeverity": "MEDIUM"},
        ]
    }
    mock_resp = MagicMock()
    mock_resp.json.return_value = payload
    mock_resp.raise_for_status = MagicMock()

    with patch("infrastructure.backend_api_client._client") as mock_client:
        mock_client.get = AsyncMock(return_value=mock_resp)
        result = await get_vuln_context("00000000-0000-0000-0000-000000000001")

    assert len(result) == 2
    assert result[0]["vulnType"] == "SQL_INJECTION"
    assert result[1]["count"] == 1


@pytest.mark.asyncio
async def test_get_vuln_context_returns_empty_on_http_error():
    """HTTP 오류 발생 시 빈 리스트를 반환하고 예외를 전파하지 않는다."""
    with patch("infrastructure.backend_api_client._client") as mock_client:
        mock_client.get = AsyncMock(side_effect=Exception("connection refused"))
        result = await get_vuln_context("00000000-0000-0000-0000-000000000002")

    assert result == []


@pytest.mark.asyncio
async def test_get_vuln_context_returns_empty_when_data_is_none():
    """data 필드가 null인 응답을 처리한다."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"data": None}
    mock_resp.raise_for_status = MagicMock()

    with patch("infrastructure.backend_api_client._client") as mock_client:
        mock_client.get = AsyncMock(return_value=mock_resp)
        result = await get_vuln_context("00000000-0000-0000-0000-000000000003")

    assert result == []


# ─── get_patch_examples ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_patch_examples_returns_items_on_success():
    """정상 응답 시 패치 예시 목록을 반환한다."""
    payload = {
        "data": [
            {
                "originalSnippet": "query = f\"SELECT * FROM users WHERE id = {user_id}\"",
                "patchedSnippet":  "query = \"SELECT * FROM users WHERE id = %s\"\ncursor.execute(query, (user_id,))",
                "explanation": "Use parameterized queries to prevent SQL injection.",
            }
        ]
    }
    mock_resp = MagicMock()
    mock_resp.json.return_value = payload
    mock_resp.raise_for_status = MagicMock()

    with patch("infrastructure.backend_api_client._client") as mock_client:
        mock_client.get = AsyncMock(return_value=mock_resp)
        result = await get_patch_examples("SQL_INJECTION", "python")

    assert len(result) == 1
    assert "originalSnippet" in result[0]
    assert "patchedSnippet" in result[0]


@pytest.mark.asyncio
async def test_get_patch_examples_passes_correct_query_params():
    """vuln_type, language 파라미터가 올바르게 전달된다."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"data": []}
    mock_resp.raise_for_status = MagicMock()

    with patch("infrastructure.backend_api_client._client") as mock_client:
        mock_client.get = AsyncMock(return_value=mock_resp)
        await get_patch_examples("XSS", "javascript")

    call_kwargs = mock_client.get.call_args
    assert call_kwargs.kwargs["params"]["vulnType"] == "XSS"
    assert call_kwargs.kwargs["params"]["language"] == "javascript"


@pytest.mark.asyncio
async def test_get_patch_examples_returns_empty_on_error():
    """네트워크 오류 시 빈 리스트를 반환하고 예외를 전파하지 않는다."""
    with patch("infrastructure.backend_api_client._client") as mock_client:
        mock_client.get = AsyncMock(side_effect=Exception("timeout"))
        result = await get_patch_examples("SQL_INJECTION", "java")

    assert result == []


# ─── _fetch_prev_vuln_context (sast_node) ────────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_prev_vuln_context_formats_items():
    """Backend API 결과가 컨텍스트 문자열로 올바르게 포맷된다."""
    from agent.nodes.sast_node import _fetch_prev_vuln_context

    mock_items = [
        {"vulnType": "SQL_INJECTION", "count": 5, "maxSeverity": "HIGH"},
        {"vulnType": "XSS", "count": 2, "maxSeverity": "MEDIUM"},
    ]
    with patch("agent.nodes.sast_node.get_vuln_context", AsyncMock(return_value=mock_items)):
        result = await _fetch_prev_vuln_context("proj-uuid-001")

    assert "SQL_INJECTION" in result
    assert "count: 5" in result
    assert "max_severity: HIGH" in result
    assert "XSS" in result
    # 두 항목이 개행으로 구분된다
    assert result.count("\n") == 1


@pytest.mark.asyncio
async def test_fetch_prev_vuln_context_returns_empty_when_no_items():
    """Backend API가 빈 목록을 반환하면 빈 문자열을 반환한다."""
    from agent.nodes.sast_node import _fetch_prev_vuln_context

    with patch("agent.nodes.sast_node.get_vuln_context", AsyncMock(return_value=[])):
        result = await _fetch_prev_vuln_context("proj-uuid-002")

    assert result == ""


@pytest.mark.asyncio
async def test_fetch_prev_vuln_context_returns_empty_on_exception():
    """Backend API 호출 예외 발생 시 빈 문자열을 반환한다."""
    from agent.nodes.sast_node import _fetch_prev_vuln_context

    with patch("agent.nodes.sast_node.get_vuln_context", AsyncMock(side_effect=Exception("api down"))):
        result = await _fetch_prev_vuln_context("proj-uuid-003")

    assert result == ""


# ─── _fetch_prev_patch_example (patch_node) ──────────────────────────────────

@pytest.mark.asyncio
async def test_fetch_prev_patch_example_formats_items():
    """Backend API 결과가 프롬프트용 문자열로 올바르게 포맷된다."""
    from agent.nodes.patch_node import _fetch_prev_patch_example

    mock_items = [
        {
            "originalSnippet": "bad code here",
            "patchedSnippet": "good code here",
            "explanation": "Use parameterized query.",
        }
    ]
    with patch("agent.nodes.patch_node.get_patch_examples", AsyncMock(return_value=mock_items)):
        result = await _fetch_prev_patch_example("SQL_INJECTION", "python")

    assert "Before:" in result
    assert "bad code here" in result
    assert "After:" in result
    assert "good code here" in result
    assert "Use parameterized query." in result


@pytest.mark.asyncio
async def test_fetch_prev_patch_example_separates_multiple_items():
    """여러 패치 예시는 '---' 구분자로 연결된다."""
    from agent.nodes.patch_node import _fetch_prev_patch_example

    mock_items = [
        {"originalSnippet": "a", "patchedSnippet": "b", "explanation": "e1"},
        {"originalSnippet": "c", "patchedSnippet": "d", "explanation": "e2"},
    ]
    with patch("agent.nodes.patch_node.get_patch_examples", AsyncMock(return_value=mock_items)):
        result = await _fetch_prev_patch_example("XSS", "javascript")

    assert "---" in result


@pytest.mark.asyncio
async def test_fetch_prev_patch_example_returns_empty_when_no_items():
    """Backend API가 빈 목록을 반환하면 빈 문자열을 반환한다."""
    from agent.nodes.patch_node import _fetch_prev_patch_example

    with patch("agent.nodes.patch_node.get_patch_examples", AsyncMock(return_value=[])):
        result = await _fetch_prev_patch_example("XSS", "go")

    assert result == ""


@pytest.mark.asyncio
async def test_fetch_prev_patch_example_skips_incomplete_items():
    """originalSnippet 또는 patchedSnippet이 없는 항목은 포맷에서 제외된다."""
    from agent.nodes.patch_node import _fetch_prev_patch_example

    mock_items = [
        {"originalSnippet": "", "patchedSnippet": "good", "explanation": "e"},  # original 없음
        {"originalSnippet": "bad", "patchedSnippet": "good", "explanation": "e2"},
    ]
    with patch("agent.nodes.patch_node.get_patch_examples", AsyncMock(return_value=mock_items)):
        result = await _fetch_prev_patch_example("SQL_INJECTION", "java")

    # 두 번째 항목만 포맷된다
    assert "bad" in result
    assert "---" not in result  # 구분자 없음 (1개만 포맷됨)
