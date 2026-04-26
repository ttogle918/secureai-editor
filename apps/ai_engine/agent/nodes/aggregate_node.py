import logging

from agent.agent_state import AgentState
from infrastructure.progress_log_client import log_completed, log_started

logger = logging.getLogger(__name__)

_STEP_ORDER = 3


async def aggregate_node(state: AgentState) -> dict:
    """모든 파일 분석이 끝난 후 최종 집계를 수행한다."""
    session_id = state["session_id"]
    results = state.get("sast_results", [])
    total_vulns = sum(len(r.get("vulnerabilities", [])) for r in results)
    cached_count = sum(1 for r in results if r.get("cached"))

    await log_started(session_id, "aggregate", _STEP_ORDER)

    logger.info(
        "[aggregate] session=%s files=%d vulns=%d cached=%d",
        session_id,
        len(state.get("files_to_scan", [])),
        total_vulns,
        cached_count,
    )

    await log_completed(
        session_id, "aggregate", _STEP_ORDER,
        detail={"totalVulns": total_vulns, "cachedCount": cached_count},
    )

    return {"status": "completed"}
