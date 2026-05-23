"""
POST /agent/chat — 보안 전문가 채팅 (SSE 스트리밍)

Request:
    {
        "session_id": "...",
        "message": "...",
        "history": [{"role": "user"|"assistant", "content": "..."}]
    }

Response: text/event-stream
    event: delta\ndata: {"text": "..."}\n\n
    event: done\ndata: {"full_text": "..."}\n\n
    event: error\ndata: {"message": "..."}\n\n   (오류 시)

X-Internal-Key 인증은 InternalKeyAuthMiddleware 에서 처리된다.
"""
import json
import logging

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agent.chat_client import stream_chat

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["chat"])

_MAX_HISTORY_ITEMS = 20  # 이력 10턴 제한 (메시지 오브젝트 수)


class ChatHistoryItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: list[ChatHistoryItem] = Field(default_factory=list)
    preferred_model: str | None = None
    user_api_key: str | None = None  # BYOK (로그 출력 금지)


def _sse_event(event: str, data: dict) -> str:
    """SSE 이벤트 포맷 문자열을 반환한다."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _generate(req: ChatRequest):
    """AI 스트림을 SSE 형식으로 변환하는 async generator."""
    history = [item.model_dump() for item in req.history]
    # 이력 최대 20개 (10턴) 제한 — chat_client 내부에서도 동일하게 처리됨
    history = history[-_MAX_HISTORY_ITEMS:]

    full_text = ""
    try:
        async for chunk in stream_chat(req.session_id, history, req.message, req.preferred_model, req.user_api_key):
            full_text += chunk
            yield _sse_event("delta", {"text": chunk})
        yield _sse_event("done", {"full_text": full_text})
    except Exception as exc:
        logger.exception("[chat] session=%s stream error", req.session_id)
        yield _sse_event("error", {"message": str(exc)})


@router.post("/chat")
async def chat_endpoint(req: ChatRequest):
    return StreamingResponse(
        _generate(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
