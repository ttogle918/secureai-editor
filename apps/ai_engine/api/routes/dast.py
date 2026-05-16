"""
POST /agent/dast/start              — DAST 분석 시작 (BackgroundTask)
GET  /agent/dast/logs/{session_id}  — SSE 로그 스트리밍

target_url 과 params 는 절대 로그에 출력하지 않는다.
"""
import asyncio
import json
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, BackgroundTasks, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent.dast_graph_builder import get_dast_graph
from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["dast"])

_DAST_CHANNEL_PREFIX = "secureai:dast:logs:"
_SSE_KEEPALIVE_SECONDS = 30
_SSE_POLL_INTERVAL = 0.5


class DastStartRequest(BaseModel):
    session_id: str
    vuln_id: str
    vuln_type: str
    target_url: str    # 로그 출력 금지
    endpoint: str
    params: dict


@router.post("/dast/start", status_code=status.HTTP_202_ACCEPTED)
async def start_dast(req: DastStartRequest, background_tasks: BackgroundTasks):
    """DAST 분석을 백그라운드로 시작하고 202 를 반환한다."""
    logger.info(
        "[dast/start] session=%s vuln_id=%s vuln_type=%s endpoint=%s",
        req.session_id,
        req.vuln_id,
        req.vuln_type,
        req.endpoint,
        # target_url 과 params 는 의도적으로 로그 제외
    )
    initial_state = {
        "session_id": req.session_id,
        "vuln_id": req.vuln_id,
        "vuln_type": req.vuln_type,
        "target_url": req.target_url,
        "endpoint": req.endpoint,
        "params": req.params,
        "retry_count": 0,
        "max_retries": 3,
        "exploit_outcome": None,
        "dast_guidelines": "",
        "status": "running",
        "log_messages": [],
    }
    background_tasks.add_task(_run_dast_graph, initial_state)
    return {"session_id": req.session_id, "status": "accepted"}


@router.get("/dast/logs/{session_id}")
async def stream_dast_logs(session_id: str) -> StreamingResponse:
    """Redis SUBSCRIBE 를 통해 DAST 로그를 SSE 로 스트리밍한다.

    30 초 동안 메시지가 없으면 keep-alive 이벤트를 발행한다.
    """
    return StreamingResponse(
        _sse_generator(session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _run_dast_graph(initial_state: dict) -> None:
    """백그라운드 태스크: DAST 그래프를 실행한다.

    그래프 내부의 notify_node 가 Redis PUBLISH 를 담당하므로
    여기서는 ainvoke 만 호출한다.
    """
    session_id = initial_state["session_id"]
    try:
        graph = get_dast_graph()
        await graph.ainvoke(initial_state)
        logger.info("[dast] session=%s graph completed", session_id)
    except Exception as exc:
        logger.error("[dast] session=%s graph error: %s", session_id, exc)
        await _publish_error(session_id, str(exc))


async def _publish_error(session_id: str, error_message: str) -> None:
    """그래프 실행 중 예외가 발생하면 SSE 채널에 오류 이벤트를 발행한다."""
    message = json.dumps({"type": "dast_error", "error": error_message})
    channel = f"{_DAST_CHANNEL_PREFIX}{session_id}"
    try:
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            await r.publish(channel, message)
    except Exception as exc:
        logger.error("[dast] failed to publish error event session=%s: %s", session_id, exc)


async def _sse_generator(session_id: str):
    """Redis SUBSCRIBE 를 통해 SSE 이벤트를 생성하는 제너레이터."""
    channel = f"{_DAST_CHANNEL_PREFIX}{session_id}"
    result_key = f"secureai:dast:result:{session_id}"
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()

    try:
        await pubsub.subscribe(channel)

        # 구독 전에 DAST가 이미 완료된 경우를 처리 (race condition 방어)
        cached = await r.get(result_key)
        if cached:
            yield f"data: {cached}\n\n"
            return

        idle_seconds = 0.0

        while True:
            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True),
                    timeout=_SSE_POLL_INTERVAL,
                )
            except asyncio.TimeoutError:
                message = None

            if message and message.get("data"):
                data = message["data"]
                yield f"data: {data}\n\n"
                idle_seconds = 0.0

                # dast_result 수신 시 스트림 종료
                try:
                    parsed = json.loads(data)
                    if parsed.get("type") in ("dast_result", "dast_error"):
                        break
                except json.JSONDecodeError:
                    pass
            else:
                idle_seconds += _SSE_POLL_INTERVAL
                if idle_seconds >= _SSE_KEEPALIVE_SECONDS:
                    yield 'data: {"type":"keepalive"}\n\n'
                    idle_seconds = 0.0

    except Exception as exc:
        logger.error("[dast/sse] session=%s error: %s", session_id, exc)
        yield f'data: {json.dumps({"type": "dast_error", "error": str(exc)})}\n\n'
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            await r.aclose()
        except Exception as exc:
            logger.warning("[dast/sse] cleanup failed session=%s: %s", session_id, exc)
