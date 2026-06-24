"""DAST API 라우트 단위 테스트.

- POST /agent/dast/start: 202 반환, 백그라운드 태스크 등록
- POST /agent/dast/batch: 202 반환, 배치 백그라운드 태스크 등록
- GET  /agent/dast/logs/{session_id}: SSE 스트리밍

FastAPI / Redis / LangGraph 는 모두 mock — 외부 네트워크 호출 없음.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from fastapi import FastAPI

from api.routes.dast import (
    router,
    _run_dast_graph,
    _publish_error,
    _run_dast_batch,
    _group_targets_by_vuln_type,
    _build_initial_state,
    _is_terminal_message,
    _is_terminal_cache,
    _BATCH_MAX_TARGETS,
    DastBatchTarget,
)


# ---------------------------------------------------------------------------
# 테스트 전용 앱 (미들웨어 없이 라우터만 마운트)
# ---------------------------------------------------------------------------

def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    return app


# ---------------------------------------------------------------------------
# POST /agent/dast/start
# ---------------------------------------------------------------------------

def test_start_dast_returns_202():
    """정상 요청 시 202 와 session_id 를 반환해야 한다."""
    app = _make_app()
    client = TestClient(app, raise_server_exceptions=False)

    with patch("api.routes.dast.get_dast_graph") as mock_get_graph:
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock()
        mock_get_graph.return_value = mock_graph

        resp = client.post(
            "/agent/dast/start",
            json={
                "session_id": "sess-001",
                "vuln_id": "v-001",
                "vuln_type": "SQL_INJECTION",
                "target_url": "http://target.internal",
                "endpoint": "/api/login",
                "params": {"username": "admin"},
            },
        )

    assert resp.status_code == 202
    body = resp.json()
    assert body["session_id"] == "sess-001"
    assert body["status"] == "accepted"


def test_start_dast_missing_required_field_returns_422():
    """필수 필드 누락 시 422 를 반환해야 한다."""
    app = _make_app()
    client = TestClient(app, raise_server_exceptions=False)

    resp = client.post(
        "/agent/dast/start",
        json={
            "session_id": "sess-001",
            # vuln_id 누락
            "vuln_type": "XSS",
            "target_url": "http://target.internal",
            "endpoint": "/api/search",
            "params": {},
        },
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# _run_dast_graph 백그라운드 태스크
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_dast_graph_invokes_graph():
    """_run_dast_graph 는 get_dast_graph().ainvoke 를 호출해야 한다."""
    mock_graph = MagicMock()
    mock_graph.ainvoke = AsyncMock()

    with patch("api.routes.dast.get_dast_graph", return_value=mock_graph):
        await _run_dast_graph({
            "session_id": "sess-002",
            "vuln_id": "v-002",
            "vuln_type": "XSS",
            "target_url": "http://target.internal",
            "endpoint": "/api/search",
            "params": {"q": "test"},
            "retry_count": 0,
            "max_retries": 3,
            "exploit_outcome": None,
            "dast_guidelines": "",
            "status": "running",
            "log_messages": [],
        })

    mock_graph.ainvoke.assert_called_once()


@pytest.mark.asyncio
async def test_run_dast_graph_publishes_error_on_exception():
    """그래프 실행 중 예외 발생 시 _publish_error 가 호출되어야 한다."""
    mock_graph = MagicMock()
    mock_graph.ainvoke = AsyncMock(side_effect=RuntimeError("graph crash"))

    with (
        patch("api.routes.dast.get_dast_graph", return_value=mock_graph),
        patch("api.routes.dast._publish_error", AsyncMock()) as mock_pub,
    ):
        await _run_dast_graph({
            "session_id": "sess-err",
            "vuln_id": "v-err",
            "vuln_type": "SSRF",
            "target_url": "http://target.internal",
            "endpoint": "/api/fetch",
            "params": {},
            "retry_count": 0,
            "max_retries": 3,
            "exploit_outcome": None,
            "dast_guidelines": "",
            "status": "running",
            "log_messages": [],
        })

    mock_pub.assert_called_once_with("sess-err", "graph crash")


# ---------------------------------------------------------------------------
# _publish_error
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_publish_error_sends_correct_message():
    """_publish_error 는 type=dast_error 메시지를 발행해야 한다."""
    published_calls = []

    mock_redis_instance = AsyncMock()
    mock_redis_instance.publish = AsyncMock(
        side_effect=lambda ch, msg: published_calls.append((ch, msg)) or None
    )
    mock_redis_instance.__aenter__ = AsyncMock(return_value=mock_redis_instance)
    mock_redis_instance.__aexit__ = AsyncMock(return_value=False)
    mock_redis_instance.aclose = AsyncMock()

    with patch("api.routes.dast.aioredis.from_url", return_value=mock_redis_instance):
        await _publish_error("sess-pub", "something went wrong")

    assert len(published_calls) == 1
    channel, raw_msg = published_calls[0]
    assert channel == "secureai:dast:logs:sess-pub"
    msg = json.loads(raw_msg)
    assert msg["type"] == "dast_error"
    assert "something went wrong" in msg["error"]


@pytest.mark.asyncio
async def test_publish_error_redis_failure_does_not_raise():
    """Redis 연결 실패 시 _publish_error 는 예외를 전파하지 않아야 한다."""
    mock_redis_instance = AsyncMock()
    mock_redis_instance.publish = AsyncMock(side_effect=ConnectionError("Redis down"))
    mock_redis_instance.__aenter__ = AsyncMock(return_value=mock_redis_instance)
    mock_redis_instance.__aexit__ = AsyncMock(return_value=False)
    mock_redis_instance.aclose = AsyncMock()

    with patch("api.routes.dast.aioredis.from_url", return_value=mock_redis_instance):
        # 예외가 발생하지 않아야 한다
        await _publish_error("sess-fail", "error message")


# ---------------------------------------------------------------------------
# POST /agent/dast/batch
# ---------------------------------------------------------------------------

def _batch_target_payload(vuln_id="v-001", vuln_type="SQL_INJECTION"):
    return {
        "vuln_id": vuln_id,
        "vuln_type": vuln_type,
        "target_url": "http://target.internal",
        "endpoint": "/api/login",
        "params": {"user": "admin"},
    }


def test_start_dast_batch_returns_202():
    """정상 배치 요청 시 202 와 session_id, total 을 반환해야 한다."""
    app = _make_app()
    client = TestClient(app, raise_server_exceptions=False)

    with (
        patch("api.routes.dast.get_dast_graph") as mock_get_graph,
        patch("api.routes.dast._load_dast_guidelines", AsyncMock(return_value="guidelines")),
    ):
        mock_graph = MagicMock()
        mock_graph.ainvoke = AsyncMock()
        mock_get_graph.return_value = mock_graph

        resp = client.post(
            "/agent/dast/batch",
            json={
                "session_id": "batch-sess-001",
                "targets": [
                    _batch_target_payload("v-001", "SQL_INJECTION"),
                    _batch_target_payload("v-002", "XSS"),
                ],
            },
        )

    assert resp.status_code == 202
    body = resp.json()
    assert body["session_id"] == "batch-sess-001"
    assert body["total"] == 2
    assert body["status"] == "accepted"


def test_start_dast_batch_exceeds_max_targets_returns_422():
    """targets 개수가 상한을 초과하면 422 를 반환해야 한다."""
    app = _make_app()
    client = TestClient(app, raise_server_exceptions=False)

    too_many = [_batch_target_payload(f"v-{i}") for i in range(_BATCH_MAX_TARGETS + 1)]
    resp = client.post(
        "/agent/dast/batch",
        json={"session_id": "batch-sess-overflow", "targets": too_many},
    )

    assert resp.status_code == 422


def test_start_dast_batch_missing_targets_returns_422():
    """targets 필드 누락 시 422 를 반환해야 한다."""
    app = _make_app()
    client = TestClient(app, raise_server_exceptions=False)

    resp = client.post(
        "/agent/dast/batch",
        json={"session_id": "batch-sess-no-targets"},
    )

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# _group_targets_by_vuln_type
# ---------------------------------------------------------------------------

def test_group_targets_by_vuln_type_groups_correctly():
    """같은 vuln_type 의 타깃이 같은 그룹에 묶여야 한다."""
    targets = [
        DastBatchTarget(vuln_id="v1", vuln_type="SQL_INJECTION",
                        target_url="http://t1", endpoint="/a", params={}),
        DastBatchTarget(vuln_id="v2", vuln_type="XSS",
                        target_url="http://t2", endpoint="/b", params={}),
        DastBatchTarget(vuln_id="v3", vuln_type="SQL_INJECTION",
                        target_url="http://t3", endpoint="/c", params={}),
    ]
    grouped = _group_targets_by_vuln_type(targets)

    assert len(grouped["SQL_INJECTION"]) == 2
    assert len(grouped["XSS"]) == 1


# ---------------------------------------------------------------------------
# _build_initial_state
# ---------------------------------------------------------------------------

def test_build_initial_state_injects_guidelines():
    """미리 로드한 guidelines 가 initial_state 에 주입되어야 한다."""
    target = DastBatchTarget(
        vuln_id="v-test",
        vuln_type="IDOR",
        target_url="http://target.internal",
        endpoint="/api/users/1",
        params={},
    )
    state = _build_initial_state("sess-xyz", target, "pre-loaded-guidelines")

    assert state["dast_guidelines"] == "pre-loaded-guidelines"
    assert state["vuln_id"] == "v-test"
    assert state["retry_count"] == 0
    assert state["status"] == "running"


# ---------------------------------------------------------------------------
# _run_dast_batch — 개별 실패 skip & log
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_dast_batch_skips_failed_targets():
    """타깃 하나가 실패해도 나머지 타깃은 계속 실행되어야 한다 (skip & log)."""
    targets = [
        DastBatchTarget(vuln_id="v-ok", vuln_type="XSS",
                        target_url="http://ok", endpoint="/ok", params={}),
        DastBatchTarget(vuln_id="v-fail", vuln_type="XSS",
                        target_url="http://fail", endpoint="/fail", params={}),
    ]

    call_count = 0

    async def fake_ainvoke(state):
        nonlocal call_count
        call_count += 1
        if state["vuln_id"] == "v-fail":
            raise RuntimeError("sandbox error")

    mock_graph = MagicMock()
    mock_graph.ainvoke = fake_ainvoke

    published_messages = []

    mock_redis = AsyncMock()
    mock_redis.setex = AsyncMock()
    mock_redis.publish = AsyncMock(
        side_effect=lambda ch, msg: published_messages.append(msg) or None
    )
    mock_redis.__aenter__ = AsyncMock(return_value=mock_redis)
    mock_redis.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("api.routes.dast.get_dast_graph", return_value=mock_graph),
        patch("api.routes.dast._load_dast_guidelines", AsyncMock(return_value="")),
        patch("api.routes.dast.aioredis.from_url", return_value=mock_redis),
    ):
        await _run_dast_batch("sess-batch", targets)

    # 두 타깃 모두 ainvoke 가 호출되어야 한다
    assert call_count == 2

    # 배치 완료 메시지가 발행되어야 한다
    assert len(published_messages) == 1
    complete_msg = json.loads(published_messages[0])
    assert complete_msg["type"] == "dast_batch_complete"
    assert complete_msg["total"] == 2
    assert complete_msg["succeeded"] == 1
    assert complete_msg["skipped"] == 1


@pytest.mark.asyncio
async def test_run_dast_batch_guidelines_loaded_once_per_vuln_type():
    """같은 vuln_type 에 대해 지침은 1회만 로드해야 한다 (그룹핑 최적화)."""
    targets = [
        DastBatchTarget(vuln_id="v-a", vuln_type="SQL_INJECTION",
                        target_url="http://t1", endpoint="/a", params={}),
        DastBatchTarget(vuln_id="v-b", vuln_type="SQL_INJECTION",
                        target_url="http://t2", endpoint="/b", params={}),
        DastBatchTarget(vuln_id="v-c", vuln_type="XSS",
                        target_url="http://t3", endpoint="/c", params={}),
    ]

    guidelines_load_calls = []

    async def fake_load_guidelines(vuln_type):
        guidelines_load_calls.append(vuln_type)
        return f"guidelines-{vuln_type}"

    mock_graph = MagicMock()
    mock_graph.ainvoke = AsyncMock()

    mock_redis = AsyncMock()
    mock_redis.setex = AsyncMock()
    mock_redis.publish = AsyncMock()
    mock_redis.__aenter__ = AsyncMock(return_value=mock_redis)
    mock_redis.__aexit__ = AsyncMock(return_value=False)

    with (
        patch("api.routes.dast.get_dast_graph", return_value=mock_graph),
        patch("api.routes.dast._load_dast_guidelines", side_effect=fake_load_guidelines),
        patch("api.routes.dast.aioredis.from_url", return_value=mock_redis),
    ):
        await _run_dast_batch("sess-group", targets)

    # SQL_INJECTION 1회, XSS 1회 — 총 2회 (타깃 3개임에도 2회)
    assert len(guidelines_load_calls) == 2
    assert sorted(guidelines_load_calls) == ["SQL_INJECTION", "XSS"]


# ---------------------------------------------------------------------------
# _is_terminal_message — SSE 종료 조건 분기
# ---------------------------------------------------------------------------

def test_is_terminal_message_single_mode_terminates_on_dast_result():
    """단건 모드에서 dast_result 는 종료 이벤트여야 한다."""
    data = json.dumps({"type": "dast_result", "vulnId": "v-1"})
    assert _is_terminal_message(data, batch=False) is True


def test_is_terminal_message_single_mode_terminates_on_dast_error():
    """단건 모드에서 dast_error 는 종료 이벤트여야 한다."""
    data = json.dumps({"type": "dast_error", "error": "fail"})
    assert _is_terminal_message(data, batch=False) is True


def test_is_terminal_message_batch_mode_does_not_terminate_on_dast_result():
    """배치 모드에서 dast_result 는 중간 이벤트이므로 스트림을 종료하면 안 된다."""
    data = json.dumps({"type": "dast_result", "vulnId": "v-1"})
    assert _is_terminal_message(data, batch=True) is False


def test_is_terminal_message_batch_mode_terminates_on_batch_complete():
    """배치 모드에서 dast_batch_complete 는 종료 이벤트여야 한다."""
    data = json.dumps({"type": "dast_batch_complete", "total": 3, "succeeded": 2, "skipped": 1})
    assert _is_terminal_message(data, batch=True) is True


def test_is_terminal_message_batch_mode_terminates_on_dast_error():
    """배치 모드에서 dast_error 는 치명 오류이므로 종료 이벤트여야 한다."""
    data = json.dumps({"type": "dast_error", "error": "fatal"})
    assert _is_terminal_message(data, batch=True) is True


def test_is_terminal_message_invalid_json_returns_false():
    """JSON 파싱 실패 시 종료 이벤트로 처리하지 않아야 한다."""
    assert _is_terminal_message("not-json", batch=False) is False
    assert _is_terminal_message("not-json", batch=True) is False


# ---------------------------------------------------------------------------
# _is_terminal_cache — 캐시 즉시 반환 분기
# ---------------------------------------------------------------------------

def test_is_terminal_cache_single_mode_accepts_dast_result():
    """단건 모드에서 캐시가 dast_result 이면 즉시 반환해야 한다."""
    cached = json.dumps({"type": "dast_result"})
    assert _is_terminal_cache(cached, batch=False) is True


def test_is_terminal_cache_batch_mode_ignores_dast_result():
    """배치 모드에서 캐시가 dast_result 이면 무시해야 한다 (조기 종료 방지)."""
    cached = json.dumps({"type": "dast_result", "vulnId": "v-1"})
    assert _is_terminal_cache(cached, batch=True) is False


def test_is_terminal_cache_batch_mode_accepts_batch_complete():
    """배치 모드에서 캐시가 dast_batch_complete 이면 즉시 반환해야 한다."""
    cached = json.dumps({"type": "dast_batch_complete", "total": 2})
    assert _is_terminal_cache(cached, batch=True) is True


# ---------------------------------------------------------------------------
# SSE 배치 모드 — 여러 dast_result 를 모두 전달하고 batch_complete 에서만 종료
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sse_generator_batch_mode_streams_all_results_until_complete():
    """배치 SSE 는 여러 dast_result 를 모두 전달하고 dast_batch_complete 에서만 종료해야 한다."""
    import asyncio as _asyncio

    # 순서대로 발행될 메시지 목록
    messages_to_publish = [
        json.dumps({"type": "dast_result", "vulnId": "v-1", "success": True}),
        json.dumps({"type": "dast_result", "vulnId": "v-2", "success": False}),
        json.dumps({"type": "dast_batch_complete", "total": 2, "succeeded": 1, "skipped": 1}),
    ]
    message_queue = list(messages_to_publish)

    async def fake_get_message(ignore_subscribe_messages):
        if message_queue:
            return {"data": message_queue.pop(0)}
        return None

    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.get_message = fake_get_message
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.close = AsyncMock()

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)   # 캐시 없음 — 구독 루프 진입
    mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
    mock_redis.aclose = AsyncMock()

    from api.routes.dast import _sse_generator

    with patch("api.routes.dast.aioredis.from_url", return_value=mock_redis):
        received = []
        async for chunk in _sse_generator("sess-batch-sse", batch=True):
            received.append(chunk)

    # keepalive 를 제외한 데이터 이벤트만 추출
    data_events = [c for c in received if '"type"' in c and "keepalive" not in c]

    # 세 이벤트(dast_result x2, dast_batch_complete x1) 모두 수신해야 한다
    assert len(data_events) == 3
    types = [json.loads(e.replace("data: ", "").strip()).get("type") for e in data_events]
    assert types.count("dast_result") == 2
    assert types.count("dast_batch_complete") == 1


@pytest.mark.asyncio
async def test_sse_generator_single_mode_stops_on_first_dast_result():
    """단건 SSE 는 첫 dast_result 에서 스트림을 종료해야 한다 (회귀 방지)."""
    messages_to_publish = [
        json.dumps({"type": "dast_result", "vulnId": "v-1", "success": True}),
        # 이 메시지는 단건 모드에서 전달되면 안 된다
        json.dumps({"type": "dast_result", "vulnId": "v-2", "success": False}),
    ]
    message_queue = list(messages_to_publish)

    async def fake_get_message(ignore_subscribe_messages):
        if message_queue:
            return {"data": message_queue.pop(0)}
        return None

    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.get_message = fake_get_message
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.close = AsyncMock()

    mock_redis = AsyncMock()
    mock_redis.get = AsyncMock(return_value=None)
    mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
    mock_redis.aclose = AsyncMock()

    from api.routes.dast import _sse_generator

    with patch("api.routes.dast.aioredis.from_url", return_value=mock_redis):
        received = []
        async for chunk in _sse_generator("sess-single-sse", batch=False):
            received.append(chunk)

    data_events = [c for c in received if '"type"' in c and "keepalive" not in c]

    # 단건 모드에서는 첫 dast_result 에서 종료 — 1개만 수신해야 한다
    assert len(data_events) == 1
    msg = json.loads(data_events[0].replace("data: ", "").strip())
    assert msg["type"] == "dast_result"
    assert msg["vulnId"] == "v-1"
