import logging

from agent.agent_state import AgentState
from agent.tools.mcp_filesystem_tools import list_scannable_files
from infrastructure.progress_log_client import log_completed, log_failed, log_started

logger = logging.getLogger(__name__)

_STEP_ORDER = 1


async def scan_files_node(state: AgentState) -> dict:
    """MCP list_directory 로 스캔 대상 파일 목록을 수집한다."""
    session_id = state["session_id"]
    logger.info("[scan_files] session=%s", session_id)

    await log_started(session_id, "scan_files", _STEP_ORDER)

    try:
        files = await list_scannable_files(session_id)
        await log_completed(session_id, "scan_files", _STEP_ORDER, detail={"fileCount": len(files)})
    except Exception as exc:
        logger.error("[scan_files] session=%s error=%s", session_id, exc)
        await log_failed(session_id, "scan_files", _STEP_ORDER, detail={"error": str(exc)})
        files = []

    logger.info("[scan_files] session=%s found=%d files", session_id, len(files))
    return {
        "files_to_scan": files,
        "current_file_index": 0,
        "status": "running",
    }
