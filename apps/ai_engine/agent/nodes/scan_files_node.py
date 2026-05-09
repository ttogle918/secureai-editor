import logging

from agent.agent_state import AgentState
from agent.tools.mcp_filesystem_tools import list_scannable_files
from agent.tools.mcp_github_tools import list_github_files
from infrastructure.progress_log_client import log_completed, log_failed, log_started

logger = logging.getLogger(__name__)

_STEP_ORDER = 1

# 테스트/목 데이터/픽스처 파일 — false positive 유발, 분석 제외
_EXCLUDE_PATTERNS = (
    "mockData", "mock_data",
    "fixtures", "seeds",
    "__tests__", "__mocks__",
    ".test.", ".spec.",
    ".stories.",
    "setupTests", "jest.config", "vitest.config",
)


def _should_exclude(file_path: str) -> bool:
    """경로 내에 제외 패턴이 포함된 파일이면 True를 반환한다."""
    for pattern in _EXCLUDE_PATTERNS:
        if pattern in file_path:
            return True
    return False


async def scan_files_node(state: AgentState) -> dict:
    """MCP list_directory 또는 GitHub API 로 스캔 대상 파일 목록을 수집한다.

    source_type="github" 이면 MCP GitHub 툴을 사용하고,
    그 외(default "local")는 MCP filesystem 툴을 사용한다.
    """
    session_id = state["session_id"]
    source_type = state.get("source_type", "local")
    logger.info("[scan_files] session=%s source_type=%s", session_id, source_type)

    await log_started(session_id, "scan_files", _STEP_ORDER)

    try:
        if source_type == "github":
            # github_token은 로그에 절대 출력 금지
            files = await list_github_files(
                session_id,
                state["github_owner"],
                state["github_repo"],
                state.get("github_ref"),
                state.get("github_token"),
            )
        else:
            files = await list_scannable_files(session_id)

        before = len(files)
        files = [f for f in files if not _should_exclude(f)]
        excluded = before - len(files)
        if excluded:
            logger.info("[scan_files] session=%s excluded=%d test/mock files", session_id, excluded)

        await log_completed(session_id, "scan_files", _STEP_ORDER, detail={"fileCount": len(files), "excluded": excluded})
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
