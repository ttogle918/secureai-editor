"""
POST /agent/chat 라우트 단위 테스트.

실제 Anthropic API 호출 없이 unittest.mock 으로 대체한다.
"""
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# 헬퍼 — 스트리밍 mock
# ---------------------------------------------------------------------------

def _make_stream_chunks(texts: list[str]):
    """stream_chat 이 각 texts 요소를 순서대로 yield 하는 async generator 를 반환한다."""
    async def _gen(session_id, history, user_message):
        for t in texts:
            yield t

    return _gen


def _parse_sse(body: bytes) -> list[dict]:
    """SSE 바이트 응답을 이벤트 dict 목록으로 파싱한다."""
    events = []
    current: dict = {}
    for line in body.decode("utf-8").splitlines():
        if line.startswith("event: "):
            current["event"] = line[len("event: "):]
        elif line.startswith("data: "):
            current["data"] = json.loads(line[len("data: "):])
        elif line == "" and current:
            events.append(current)
            current = {}
    if current:
        events.append(current)
    return events


# ---------------------------------------------------------------------------
# TC-1: 정상 메시지 → SSE 스트림 반환 (delta + done)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_endpoint_returns_sse_stream():
    chunks = ["안녕", "하세요", "!"]

    with patch("api.routes.chat.stream_chat", _make_stream_chunks(chunks)):
        # TestClient 는 동기 ASGI 테스트 클라이언트; StreamingResponse 는 직접 읽는다
        from main import app
        client = TestClient(app, raise_server_exceptions=True)

        response = client.post(
            "/agent/chat",
            json={"session_id": "test-session", "message": "안녕?", "history": []},
            headers={"X-Internal-Key": "test-internal-key"},
        )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]

    events = _parse_sse(response.content)

    delta_events = [e for e in events if e.get("event") == "delta"]
    done_events = [e for e in events if e.get("event") == "done"]
    error_events = [e for e in events if e.get("event") == "error"]

    assert len(delta_events) == len(chunks)
    assert len(done_events) == 1
    assert len(error_events) == 0

    # delta 텍스트 합치면 원문과 동일해야 함
    combined = "".join(e["data"]["text"] for e in delta_events)
    assert combined == "".join(chunks)

    # done 의 full_text 도 동일해야 함
    assert done_events[0]["data"]["full_text"] == "".join(chunks)


# ---------------------------------------------------------------------------
# TC-2: 이력 10턴 초과 시 오래된 것 드롭 확인
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_history_trimming():
    """이력이 20개(10턴)를 초과하면 route 레벨에서 최신 20개만 전달되는지 확인."""
    captured_history: list = []

    async def _spy_stream(session_id, history, user_message):
        captured_history.extend(history)
        yield "ok"

    # 22개 이력 (11턴) 생성 — role 이 교대로 user/assistant
    history_22 = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"msg-{i}"}
        for i in range(22)
    ]

    with patch("api.routes.chat.stream_chat", _spy_stream):
        from main import app
        client = TestClient(app, raise_server_exceptions=True)

        client.post(
            "/agent/chat",
            json={
                "session_id": "trim-test",
                "message": "신규 질문",
                "history": history_22,
            },
            headers={"X-Internal-Key": "test-internal-key"},
        )

    # route 레벨에서 최신 20개만 넘겨야 한다
    assert len(captured_history) == 20
    # 가장 오래된 2개(msg-0, msg-1)는 드롭되고 msg-2 부터 시작해야 함
    assert captured_history[0]["content"] == "msg-2"
    assert captured_history[-1]["content"] == "msg-21"


# ---------------------------------------------------------------------------
# TC-3: stream_chat 예외 발생 시 error 이벤트 방출
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_endpoint_error_event_on_exception():
    async def _error_stream(session_id, history, user_message):
        yield "부분 텍스트"
        raise RuntimeError("Claude API 오류")

    with patch("api.routes.chat.stream_chat", _error_stream):
        from main import app
        client = TestClient(app, raise_server_exceptions=False)

        response = client.post(
            "/agent/chat",
            json={"session_id": "err-session", "message": "질문", "history": []},
            headers={"X-Internal-Key": "test-internal-key"},
        )

    events = _parse_sse(response.content)
    error_events = [e for e in events if e.get("event") == "error"]
    assert len(error_events) == 1
    assert "Claude API 오류" in error_events[0]["data"]["message"]
