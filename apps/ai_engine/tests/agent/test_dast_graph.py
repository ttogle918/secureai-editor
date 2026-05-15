"""DAST 그래프 노드 단위 테스트.

- dast_state: TypedDict 필드 존재 검증
- after_dast: 라우팅 함수 분기 검증
- dast_graph_builder: 싱글턴 캐싱 검증
- dast_node: sandbox 호출 + state 갱신 검증
- notify_node: Redis publish 호출 + status 갱신 검증

LLM / Redis / httpx 는 모두 mock — 외부 네트워크 호출 없음.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from agent.nodes.dast.dast_state import DastState
from agent.nodes.dast.after_dast import route_after_dast
from agent.nodes.dast.dast_node import dast_node
from agent.nodes.dast.notify_node import notify_node


# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------

def _make_state(**overrides) -> DastState:
    base: DastState = {
        "session_id": "sess-dast-001",
        "vuln_id": "vuln-1",
        "vuln_type": "SQL_INJECTION",
        "target_url": "http://target.internal",
        "endpoint": "/api/login",
        "params": {"username": "admin"},
        "retry_count": 0,
        "max_retries": 3,
        "exploit_outcome": None,
        "dast_guidelines": "",
        "status": "running",
        "log_messages": [],
    }
    return {**base, **overrides}


# ---------------------------------------------------------------------------
# DastState TypedDict 필드 검증
# ---------------------------------------------------------------------------

def test_dast_state_required_keys():
    """DastState 에 필수 키가 모두 존재해야 한다."""
    state = _make_state()
    required = {
        "session_id", "vuln_id", "vuln_type", "target_url",
        "endpoint", "params", "retry_count", "max_retries",
        "exploit_outcome", "dast_guidelines", "status", "log_messages",
    }
    assert required.issubset(state.keys())


def test_dast_state_default_max_retries():
    """max_retries 기본값은 3 이어야 한다."""
    state = _make_state()
    assert state["max_retries"] == 3


# ---------------------------------------------------------------------------
# route_after_dast 라우팅 분기
# ---------------------------------------------------------------------------

def test_route_after_dast_success_goes_to_notify():
    """exploit_outcome.success == True 이면 notify_node 로 라우팅."""
    state = _make_state(
        exploit_outcome={"success": True, "payload": "' OR 1=1", "evidence": "DB error", "response_snippet": "", "error": None},
        retry_count=1,
    )
    assert route_after_dast(state) == "notify_node"


def test_route_after_dast_retry_when_below_max():
    """실패 + retry_count < max_retries 이면 dast_node 로 라우팅."""
    state = _make_state(
        exploit_outcome={"success": False, "payload": "", "evidence": "", "response_snippet": "", "error": None},
        retry_count=1,
        max_retries=3,
    )
    assert route_after_dast(state) == "dast_node"


def test_route_after_dast_give_up_when_max_reached():
    """실패 + retry_count >= max_retries 이면 notify_node 로 라우팅."""
    state = _make_state(
        exploit_outcome={"success": False, "payload": "", "evidence": "", "response_snippet": "", "error": "timeout"},
        retry_count=3,
        max_retries=3,
    )
    assert route_after_dast(state) == "notify_node"


def test_route_after_dast_none_outcome_retries():
    """exploit_outcome 이 None 이면 실패로 간주하여 재시도한다."""
    state = _make_state(exploit_outcome=None, retry_count=0, max_retries=3)
    assert route_after_dast(state) == "dast_node"


# ---------------------------------------------------------------------------
# dast_graph_builder 싱글턴 캐싱
# ---------------------------------------------------------------------------

def test_get_dast_graph_returns_singleton():
    """get_dast_graph() 를 두 번 호출하면 동일한 객체를 반환해야 한다."""
    from agent.dast_graph_builder import get_dast_graph
    g1 = get_dast_graph()
    g2 = get_dast_graph()
    assert g1 is g2


# ---------------------------------------------------------------------------
# dast_node — sandbox 호출 + state 갱신
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_dast_node_increments_retry_count():
    """dast_node 호출 시 retry_count 가 1 증가해야 한다."""
    state = _make_state(retry_count=0)
    fake_outcome = {"success": False, "payload": "", "evidence": "", "response_snippet": "", "error": None}

    with (
        patch("agent.nodes.dast.dast_node.run_dast_in_sandbox", AsyncMock(return_value=fake_outcome)),
        patch("agent.nodes.dast.dast_node.load_guidelines", AsyncMock(return_value="guideline text")),
    ):
        result = await dast_node(state)

    assert result["retry_count"] == 1


@pytest.mark.asyncio
async def test_dast_node_stores_exploit_outcome():
    """dast_node 호출 결과가 exploit_outcome 에 저장되어야 한다."""
    state = _make_state()
    fake_outcome = {"success": True, "payload": "' OR 1=1", "evidence": "DB error found", "response_snippet": "error", "error": None}

    with (
        patch("agent.nodes.dast.dast_node.run_dast_in_sandbox", AsyncMock(return_value=fake_outcome)),
        patch("agent.nodes.dast.dast_node.load_guidelines", AsyncMock(return_value="")),
    ):
        result = await dast_node(state)

    assert result["exploit_outcome"] == fake_outcome


@pytest.mark.asyncio
async def test_dast_node_appends_log_message():
    """dast_node 호출 시 log_messages 에 로그가 추가되어야 한다."""
    state = _make_state(retry_count=0)
    fake_outcome = {"success": False, "payload": "", "evidence": "", "response_snippet": "", "error": None}

    with (
        patch("agent.nodes.dast.dast_node.run_dast_in_sandbox", AsyncMock(return_value=fake_outcome)),
        patch("agent.nodes.dast.dast_node.load_guidelines", AsyncMock(return_value="")),
    ):
        result = await dast_node(state)

    assert len(result["log_messages"]) == 1
    assert "SQL_INJECTION" in result["log_messages"][0]
    assert "#1" in result["log_messages"][0]


@pytest.mark.asyncio
async def test_dast_node_loads_guidelines_only_when_empty():
    """dast_guidelines 가 이미 있으면 load_guidelines 를 호출하지 않는다."""
    state = _make_state(dast_guidelines="existing guidelines")
    fake_outcome = {"success": False, "payload": "", "evidence": "", "response_snippet": "", "error": None}

    mock_load = AsyncMock(return_value="new guidelines")
    with (
        patch("agent.nodes.dast.dast_node.run_dast_in_sandbox", AsyncMock(return_value=fake_outcome)),
        patch("agent.nodes.dast.dast_node.load_guidelines", mock_load),
    ):
        result = await dast_node(state)

    mock_load.assert_not_called()
    assert result["dast_guidelines"] == "existing guidelines"


# ---------------------------------------------------------------------------
# notify_node — Redis publish + status 갱신
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_notify_node_sets_success_status():
    """exploit_outcome.success == True 이면 status 가 success 여야 한다."""
    state = _make_state(
        exploit_outcome={"success": True, "payload": "x", "evidence": "found", "response_snippet": "", "error": None},
        log_messages=["[DAST] SQL_INJECTION 시도 #1 endpoint=/api/login"],
    )

    mock_redis_instance = AsyncMock()
    mock_redis_instance.publish = AsyncMock()
    mock_redis_instance.__aenter__ = AsyncMock(return_value=mock_redis_instance)
    mock_redis_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("agent.nodes.dast.notify_node.aioredis.from_url", return_value=mock_redis_instance):
        result = await notify_node(state)

    assert result["status"] == "success"


@pytest.mark.asyncio
async def test_notify_node_sets_failed_status():
    """exploit_outcome.success == False 이면 status 가 failed 여야 한다."""
    state = _make_state(
        exploit_outcome={"success": False, "payload": "", "evidence": "", "response_snippet": "", "error": "timeout"},
        log_messages=[],
    )

    mock_redis_instance = AsyncMock()
    mock_redis_instance.publish = AsyncMock()
    mock_redis_instance.__aenter__ = AsyncMock(return_value=mock_redis_instance)
    mock_redis_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("agent.nodes.dast.notify_node.aioredis.from_url", return_value=mock_redis_instance):
        result = await notify_node(state)

    assert result["status"] == "failed"


@pytest.mark.asyncio
async def test_notify_node_publishes_correct_channel():
    """publish 호출 시 올바른 채널 이름을 사용해야 한다."""
    state = _make_state(
        session_id="sess-abc",
        exploit_outcome={"success": True, "payload": "p", "evidence": "e", "response_snippet": "r", "error": None},
    )

    published_calls = []
    mock_redis_instance = AsyncMock()
    mock_redis_instance.publish = AsyncMock(
        side_effect=lambda ch, msg: published_calls.append((ch, msg)) or None
    )
    mock_redis_instance.__aenter__ = AsyncMock(return_value=mock_redis_instance)
    mock_redis_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("agent.nodes.dast.notify_node.aioredis.from_url", return_value=mock_redis_instance):
        await notify_node(state)

    assert len(published_calls) == 1
    channel, raw_msg = published_calls[0]
    assert channel == "secureai:dast:logs:sess-abc"
    msg = json.loads(raw_msg)
    assert msg["type"] == "dast_result"
    assert msg["vulnId"] == "vuln-1"
    assert msg["success"] is True


@pytest.mark.asyncio
async def test_notify_node_redis_error_does_not_raise():
    """Redis 연결 실패 시 예외를 전파하지 않고 상태만 반환해야 한다."""
    state = _make_state(
        exploit_outcome={"success": False, "payload": "", "evidence": "", "response_snippet": "", "error": None},
    )

    mock_redis_instance = AsyncMock()
    mock_redis_instance.publish = AsyncMock(side_effect=ConnectionError("Redis down"))
    mock_redis_instance.__aenter__ = AsyncMock(return_value=mock_redis_instance)
    mock_redis_instance.__aexit__ = AsyncMock(return_value=False)

    with patch("agent.nodes.dast.notify_node.aioredis.from_url", return_value=mock_redis_instance):
        result = await notify_node(state)

    # 예외 없이 반환되어야 한다
    assert result["status"] == "failed"
