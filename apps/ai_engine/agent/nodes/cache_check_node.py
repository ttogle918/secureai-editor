import hashlib
import json
import logging

import redis.asyncio as aioredis

from agent.agent_state import AgentState
from agent.tools.mcp_filesystem_tools import read_file
from agent.tools.mcp_github_tools import get_github_file_content
from config.settings import settings

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None
_CACHE_PREFIX = "secureai:sast:cache:"
_CACHE_TTL = 60 * 60 * 24 * 7  # 7일


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def cache_check_node(state: AgentState) -> dict:
    """
    현재 파일의 SHA-256 을 계산하고 Redis 캐시를 조회한다.

    캐시 히트 시: cache_hit=True, sast_results 에 결과 추가
    캐시 미스 시: cache_hit=False, current_file_sha256 저장
    """
    session_id = state["session_id"]
    idx = state["current_file_index"]
    file_path = state["files_to_scan"][idx]

    logger.info("[cache_check] session=%s file=%s", session_id, file_path)

    try:
        source_type = state.get("source_type", "local")
        if source_type == "github":
            content = await get_github_file_content(
                session_id,
                state["github_owner"],
                state["github_repo"],
                file_path,
                state.get("github_ref"),
                state.get("github_token"),
            )
        else:
            content = await read_file(session_id, file_path)

        sha256 = hashlib.sha256(content.encode()).hexdigest()

        r = _get_redis()
        cached_raw = await r.get(f"{_CACHE_PREFIX}{sha256}")

        if cached_raw:
            vulns = json.loads(cached_raw)
            logger.info("[cache_check] HIT session=%s file=%s vulns=%d", session_id, file_path, len(vulns))
            cached_result = {"file": file_path, "vulnerabilities": vulns, "cached": True}
            return {
                "current_file_sha256": sha256,
                "cache_hit": True,
                "sast_results": state.get("sast_results", []) + [cached_result],
                "current_file_content": content,
            }

        logger.info("[cache_check] MISS session=%s file=%s", session_id, file_path)
        return {
            "current_file_sha256": sha256,
            "cache_hit": False,
            "current_file_content": content,
        }

    except Exception as exc:
        logger.error("[cache_check] session=%s file=%s error=%s", session_id, file_path, exc)
        return {"current_file_sha256": None, "cache_hit": False}
