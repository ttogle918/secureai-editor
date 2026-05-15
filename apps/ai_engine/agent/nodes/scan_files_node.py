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

# 우선순위 1: 소스 코드 (먼저 스캔)
PRIORITY_EXTENSIONS = frozenset({
    ".java", ".py", ".js", ".ts", ".go", ".rb", ".php", ".cs", ".kt",
    ".tsx", ".jsx", ".rs", ".swift", ".cpp", ".cc", ".c", ".h", ".hpp",
})

# 우선순위 2: 설정 파일 (나중에 스캔)
CONFIG_EXTENSIONS = frozenset({
    ".yml", ".yaml", ".json", ".xml", ".toml", ".env", ".properties", ".ini", ".conf",
})

# 스킵: 바이너리/컴파일 결과물 (분석 불필요)
SKIP_EXTENSIONS = frozenset({
    ".jar", ".exe", ".bin", ".class", ".pyc", ".lock",
    ".so", ".dll", ".dylib", ".a", ".o",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg",
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".mp3", ".mp4", ".wav", ".avi", ".mov",
    ".woff", ".woff2", ".ttf", ".eot",
    ".map",
})

_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


def _should_exclude(file_path: str) -> bool:
    """경로 내에 제외 패턴이 포함된 파일이면 True를 반환한다."""
    for pattern in _EXCLUDE_PATTERNS:
        if pattern in file_path:
            return True
    return False


def _get_extension(file_path: str) -> str:
    """파일 경로에서 소문자 확장자를 반환한다."""
    dot_idx = file_path.rfind(".")
    if dot_idx == -1:
        return ""
    return file_path[dot_idx:].lower()


def _should_skip_by_extension(file_path: str) -> bool:
    """바이너리/컴파일 결과물 확장자이면 True를 반환한다."""
    return _get_extension(file_path) in SKIP_EXTENSIONS


def prioritize_files(files: list[str]) -> list[str]:
    """파일 목록을 스캔 우선순위에 따라 정렬하여 반환한다.

    정렬 순서:
    1. PRIORITY_EXTENSIONS — 소스 코드 (먼저 스캔)
    2. CONFIG_EXTENSIONS  — 설정 파일 (나중에 스캔)
    3. 그 외              — 마지막에 처리
    """
    priority: list[str] = []
    config: list[str] = []
    others: list[str] = []

    for f in files:
        ext = _get_extension(f)
        if ext in PRIORITY_EXTENSIONS:
            priority.append(f)
        elif ext in CONFIG_EXTENSIONS:
            config.append(f)
        else:
            others.append(f)

    return priority + config + others


def filter_by_size(files: list[str], size_map: dict[str, int]) -> list[str]:
    """size_map에 기록된 파일 크기가 10MB 초과인 파일을 제외한다.

    size_map에 없는 파일은 크기를 알 수 없으므로 포함한다.
    """
    result: list[str] = []
    for f in files:
        size = size_map.get(f)
        if size is not None and size > _MAX_FILE_SIZE_BYTES:
            logger.info("[scan_files] skip large file=%s size=%d", f, size)
            continue
        result.append(f)
    return result


async def scan_files_node(state: AgentState) -> dict:
    """MCP list_directory 또는 GitHub API 로 스캔 대상 파일 목록을 수집한다.

    source_type="github" 이면 MCP GitHub 툴을 사용하고,
    그 외(default "local")는 MCP filesystem 툴을 사용한다.

    파일 목록 후처리:
    1. 바이너리/컴파일 확장자 제거 (SKIP_EXTENSIONS)
    2. 10MB 초과 파일 제거 (github 모드에서 size_map 활용)
    3. 테스트/목 패턴 파일 제거
    4. 우선순위 정렬 (PRIORITY_EXTENSIONS 먼저)
    """
    session_id = state["session_id"]
    source_type = state.get("source_type", "local")
    logger.info("[scan_files] session=%s source_type=%s", session_id, source_type)

    await log_started(session_id, "scan_files", _STEP_ORDER)

    try:
        size_map: dict[str, int] = {}

        if source_type == "github":
            # github_token은 로그에 절대 출력 금지
            files, size_map = await list_github_files(
                session_id,
                state["github_owner"],
                state["github_repo"],
                state.get("github_ref"),
                state.get("github_token"),
            )
        else:
            files = await list_scannable_files(session_id)

        # 1. 바이너리 확장자 필터
        before_ext = len(files)
        files = [f for f in files if not _should_skip_by_extension(f)]
        skipped_ext = before_ext - len(files)
        if skipped_ext:
            logger.info("[scan_files] session=%s skipped_binary=%d", session_id, skipped_ext)

        # 2. 파일 크기 필터 (GitHub 모드에서 size_map 활용)
        if size_map:
            files = filter_by_size(files, size_map)

        # 3. 테스트/목 패턴 필터
        before_excl = len(files)
        files = [f for f in files if not _should_exclude(f)]
        excluded = before_excl - len(files)
        if excluded:
            logger.info("[scan_files] session=%s excluded=%d test/mock files", session_id, excluded)

        # 4. 우선순위 정렬
        files = prioritize_files(files)

        await log_completed(
            session_id, "scan_files", _STEP_ORDER,
            detail={
                "fileCount": len(files),
                "excluded": excluded,
                "skippedBinary": skipped_ext,
            },
        )
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
