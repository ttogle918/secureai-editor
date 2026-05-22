"""
TASK-906 — sast_node.py 단위 테스트.

_ai_tokens_counter 가 sast_node() 실행 중 labels().inc() 호출되는지 검증한다.
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
        patch("agent.nodes.sast_node.save_vulnerabilities", new=AsyncMock()),
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
        patch("agent.nodes.sast_node.save_vulnerabilities", new=AsyncMock()),
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
