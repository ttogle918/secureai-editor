"""
streaming_helpers.py 단위 테스트.

patch_node 이벤트에 resolved_model/resolved_provider가 포함되는지 검증한다.
기존 token_usage 4키 소비 경로(patch_node._report_session_token_usage)가
새 키 추가로 깨지지 않는지 회귀 검증도 수행한다.
"""
import pytest
from unittest.mock import AsyncMock


async def _collect_publish_calls(node_name: str, state: dict) -> list[tuple]:
    """_handle_node_event를 실행하고 publish에 넘어간 (args, kwargs) 목록을 반환한다."""
    from api.routes.streaming_helpers import _handle_node_event

    calls: list[tuple] = []

    async def fake_publish(event_type: str, **kwargs):
        calls.append((event_type, kwargs))

    await _handle_node_event(
        publish=fake_publish,
        node_name=node_name,
        state=state,
        last_stage_no=None,
        session_id="test-session",
        cancel_flags={},
    )
    return calls


# ── patch_node: completed 이벤트에 resolved 필드 포함 ─────────────────────────

@pytest.mark.asyncio
async def test_patch_node_completed_includes_resolved_model_and_provider():
    """patch_node 이벤트 시 completed 페이로드에 model·provider 키가 포함된다."""
    state = {
        "sast_results": [{"file": "a.py", "vulnerabilities": [{"id": "v1"}]}],
        "token_usage": {
            "input_tokens": 100,
            "output_tokens": 200,
            "cache_creation_input_tokens": 10,
            "cache_read_input_tokens": 5,
        },
        "resolved_model": "claude-sonnet-4-6",
        "resolved_provider": "anthropic",
    }

    calls = await _collect_publish_calls("patch_node", state)

    assert len(calls) == 1
    event_type, kwargs = calls[0]
    assert event_type == "completed"
    assert kwargs["model"] == "claude-sonnet-4-6"
    assert kwargs["provider"] == "anthropic"
    assert kwargs["vuln_count"] == 1


@pytest.mark.asyncio
async def test_patch_node_completed_without_resolved_model_passes_none():
    """resolved_model/provider가 없으면 None으로 전달되어도 이벤트는 정상 발행된다."""
    state = {
        "sast_results": [],
        "token_usage": {
            "input_tokens": 0, "output_tokens": 0,
            "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
        },
        # resolved_model / resolved_provider 미설정
    }

    calls = await _collect_publish_calls("patch_node", state)

    assert len(calls) == 1
    event_type, kwargs = calls[0]
    assert event_type == "completed"
    assert kwargs["model"] is None
    assert kwargs["provider"] is None


@pytest.mark.asyncio
async def test_patch_node_token_usage_four_keys_preserved():
    """
    기존 token_usage 4키(input/output/cache_creation/cache_read)가
    새 model/provider 키 추가 이후에도 그대로 전달된다 — 회귀 검증.
    """
    token_usage = {
        "input_tokens": 300,
        "output_tokens": 150,
        "cache_creation_input_tokens": 20,
        "cache_read_input_tokens": 8,
    }
    state = {
        "sast_results": [],
        "token_usage": token_usage,
        "resolved_model": "gemini-2.5-flash",
        "resolved_provider": "gemini",
    }

    calls = await _collect_publish_calls("patch_node", state)

    assert len(calls) == 1
    _, kwargs = calls[0]
    received_usage = kwargs["token_usage"]
    assert received_usage["input_tokens"] == 300
    assert received_usage["output_tokens"] == 150
    assert received_usage["cache_creation_input_tokens"] == 20
    assert received_usage["cache_read_input_tokens"] == 8


# ── sast_node: state에 resolved 필드 기록 ─────────────────────────────────────

@pytest.mark.asyncio
async def test_sast_node_records_resolved_model_in_state():
    """sast_node 성공 시 반환 dict에 resolved_model·resolved_provider가 포함된다."""
    fake_usage = {
        "input_tokens": 50, "output_tokens": 50,
        "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
    }

    from unittest.mock import patch, MagicMock, AsyncMock as AM

    with (
        patch("agent.nodes.sast_node.read_file", new=AM(return_value="x = 1")),
        patch("agent.nodes.sast_node.load_guidelines", new=AM(return_value="")),
        patch("agent.nodes.sast_node._analyze_chunks", new=AM(return_value=([], fake_usage))),
        patch("agent.nodes.sast_node.log_started", new=AM()),
        patch("agent.nodes.sast_node.log_completed", new=AM()),
        patch("agent.nodes.sast_node.classify_and_enrich", return_value=[]),
        patch("agent.nodes.sast_node._get_redis", return_value=MagicMock()),
        patch("agent.nodes.sast_node._fetch_prev_vuln_context", new=AM(return_value="")),
        patch("agent.nodes.sast_node._ai_tokens_counter", MagicMock()),
        patch("agent.nodes.sast_node._publish_scanning", new=AM()),
    ):
        from agent.nodes.sast_node import sast_node

        state = {
            "session_id": "test-session",
            "project_id": "00000000-0000-0000-0000-000000000001",
            "files_to_scan": ["/app/src/main.py"],
            "current_file_index": 0,
            "current_file_sha256": None,
            "source_type": "local",
            "scan_mode": "PIPELINE",
            "preferred_model": "claude-haiku-4-5-20251001",
            "preferred_provider": "anthropic",
            "user_api_key": None,
            "sast_results": [],
            "token_usage": None,
        }

        result = await sast_node(state)

        assert result.get("resolved_model") == "claude-haiku-4-5-20251001"
        assert result.get("resolved_provider") == "anthropic"
