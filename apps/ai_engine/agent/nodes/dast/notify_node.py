"""DAST 결과 SSE 스트리밍 노드.

Redis PUBLISH 로 DAST 결과를 SSE 채널에 발행한다.
채널: secureai:dast:logs:{session_id}
"""
import json
import logging

import redis.asyncio as aioredis

from agent.nodes.dast.dast_state import DastState
from config.settings import settings

logger = logging.getLogger(__name__)

_DAST_CHANNEL_PREFIX = "secureai:dast:logs:"


async def notify_node(state: DastState) -> DastState:
    """Redis PUBLISH 로 DAST 실행 결과를 SSE 채널에 발행한다.

    성공 여부에 따라 status 를 갱신하고,
    log_messages 와 exploit_outcome 을 함께 발행한다.
    Redis 연결 오류 발생 시 로그를 남기고 상태만 반환한다.
    """
    outcome = state.get("exploit_outcome") or {}
    success = bool(outcome.get("success"))
    new_status = "success" if success else "failed"

    message = json.dumps({
        "type": "dast_result",
        "vulnId": state["vuln_id"],
        "success": success,
        "evidence": outcome.get("evidence", ""),
        "payload": outcome.get("payload", ""),
        "responseSnippet": outcome.get("response_snippet", ""),
        "error": outcome.get("error"),
        "logMessages": state.get("log_messages", []),
    })

    channel = f"{_DAST_CHANNEL_PREFIX}{state['session_id']}"
    try:
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            await r.publish(channel, message)
        logger.info(
            "[notify_node] session=%s vuln_id=%s success=%s published",
            state["session_id"],
            state["vuln_id"],
            success,
        )
    except Exception as exc:
        logger.error(
            "[notify_node] Redis publish failed session=%s vuln_id=%s error=%s",
            state["session_id"],
            state["vuln_id"],
            exc,
        )

    return {**state, "status": new_status}
