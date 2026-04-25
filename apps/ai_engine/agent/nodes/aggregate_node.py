import logging

from agent.agent_state import AgentState

logger = logging.getLogger(__name__)


async def aggregate_node(state: AgentState) -> dict:
    """모든 파일 분석이 끝난 후 최종 집계를 수행한다."""
    results = state.get("sast_results", [])
    total_vulns = sum(len(r.get("vulnerabilities", [])) for r in results)
    cached_count = sum(1 for r in results if r.get("cached"))

    logger.info(
        "[aggregate] session=%s files=%d vulns=%d cached=%d",
        state["session_id"],
        len(state.get("files_to_scan", [])),
        total_vulns,
        cached_count,
    )
    return {"status": "completed"}
