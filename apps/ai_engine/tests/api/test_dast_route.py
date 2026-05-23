"""DAST API 라우트 단위 테스트.

- POST /agent/dast/start: 202 반환, 백그라운드 태스크 등록
- GET  /agent/dast/logs/{session_id}: SSE 스트리밍

FastAPI / Redis / LangGraph 는 모두 mock — 외부 네트워크 호출 없음.
"""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from fastapi import FastAPI

from api.routes.dast import router, _run_dast_graph, _publish_error


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
