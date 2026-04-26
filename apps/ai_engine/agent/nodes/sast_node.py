import json
import logging

import redis.asyncio as aioredis

from agent.agent_state import AgentState
from agent.claude_client import analyze_for_sast
from agent.response_parser import parse_sast_response
from agent.tools.mcp_filesystem_tools import read_file
from config.settings import settings
from infrastructure.backend_api_client import save_vulnerabilities
from infrastructure.progress_log_client import log_completed, log_failed, log_started

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None
_CACHE_PREFIX = "secureai:sast:cache:"
_CACHE_TTL = 60 * 60 * 24 * 7  # 7일
_STEP_ORDER = 2


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def sast_node(state: AgentState) -> dict:
    """
    Claude + MCP 로 현재 파일을 SAST 분석한다.

    - 파일 내용을 MCP 로 다시 읽는다 (state 에 내용을 저장하지 않아 체크포인트 크기 절감)
    - 분석 결과를 Redis 에 캐시한다
    - 오류 발생 시 해당 파일 스킵하고 계속 진행 (전체 세션은 유지)
    """
    session_id = state["session_id"]
    idx = state["current_file_index"]
    file_path = state["files_to_scan"][idx]
    sha256 = state.get("current_file_sha256")

    logger.info("[sast] session=%s file=%s", session_id, file_path)
    await log_started(session_id, "sast", _STEP_ORDER, target=file_path)

    try:
        content = await read_file(session_id, file_path)
        raw = await analyze_for_sast(file_path, content)
        vulns = parse_sast_response(raw, file_path)

        if sha256:
            r = _get_redis()
            await r.setex(f"{_CACHE_PREFIX}{sha256}", _CACHE_TTL, json.dumps(vulns))

        await save_vulnerabilities(session_id, state["project_id"], file_path, vulns)
        await log_completed(
            session_id, "sast", _STEP_ORDER,
            target=file_path,
            detail={"vulnCount": len(vulns)},
        )

        logger.info("[sast] session=%s file=%s vulns=%d", session_id, file_path, len(vulns))
        result = {"file": file_path, "vulnerabilities": vulns, "cached": False}

    except Exception as exc:
        logger.error("[sast] session=%s file=%s error=%s", session_id, file_path, exc)
        await log_failed(
            session_id, "sast", _STEP_ORDER,
            target=file_path,
            detail={"error": str(exc)},
        )
        result = {"file": file_path, "vulnerabilities": [], "error": str(exc)}

    return {"sast_results": state.get("sast_results", []) + [result]}
