import logging
from pathlib import Path

from opentelemetry import trace

from agent.agent_state import AgentState
from agent.tools.mcp_filesystem_tools import list_scannable_files
from agent.tools.mcp_github_tools import list_github_files
from infrastructure.progress_log_client import log_completed, log_failed, log_started

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

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

# 파일 타입별 스캔 우선순위 (값이 낮을수록 먼저 스캔)
# 보안 관련 파일(시크릿, 키, 인증서)을 최우선으로 처리한다.
PRIORITY_EXTENSIONS: dict[str, int] = {
    # 우선순위 0: 시크릿 / 키 / 인증서 파일 (최우선)
    ".env": 0,
    ".key": 0,
    ".pem": 0,
    ".p12": 0,
    ".pfx": 0,
    # 우선순위 1: 설정 파일 (시크릿 포함 가능)
    ".yml": 1,
    ".yaml": 1,
    ".json": 1,
    ".xml": 1,
    ".conf": 1,
    ".config": 1,
    ".toml": 1,
    ".properties": 1,
    ".ini": 1,
    # 우선순위 2: 소스 코드
    ".py": 2,
    ".java": 2,
    ".ts": 2,
    ".js": 2,
    ".kt": 2,
    ".go": 2,
    ".rb": 2,
    ".php": 2,
    ".cs": 2,
    ".tsx": 2,
    ".jsx": 2,
    ".rs": 2,
    ".swift": 2,
    ".cpp": 2,
    ".cc": 2,
    ".c": 2,
    ".h": 2,
    ".hpp": 2,
    # 우선순위 3: 문서 / 기타 텍스트
    ".md": 3,
    ".txt": 3,
}

# 하위 호환용: 설정 파일 확장자 집합 (기존 코드 참조 호환)
CONFIG_EXTENSIONS: frozenset[str] = frozenset(
    ext for ext, pri in PRIORITY_EXTENSIONS.items() if pri == 1
)

# 스킵: 바이너리/컴파일 결과물 (분석 불필요)
# 주의: .pfx, .p12는 바이너리 인증서이지만 시크릿 스캔 대상이므로 포함하지 않는다.
BINARY_EXTENSIONS: frozenset[str] = frozenset({
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".ico",
    ".pdf", ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
    ".jar", ".class", ".exe", ".bin", ".dll", ".so", ".dylib", ".a", ".o",
    ".pyc", ".lock",
    ".mp3", ".mp4", ".wav", ".avi", ".mov",
    ".woff", ".woff2", ".ttf", ".eot",
    ".map",
})

# 하위 호환용 별칭 (기존 테스트가 SKIP_EXTENSIONS를 참조)
SKIP_EXTENSIONS: frozenset[str] = BINARY_EXTENSIONS

_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
_DEFAULT_PRIORITY = 99  # PRIORITY_EXTENSIONS에 없는 확장자의 기본 우선순위


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


def _is_binary(filename: str) -> bool:
    """바이너리 파일 확장자이면 True를 반환한다."""
    return Path(filename).suffix.lower() in BINARY_EXTENSIONS


def _should_skip_by_extension(file_path: str) -> bool:
    """바이너리/컴파일 결과물 확장자이면 True를 반환한다.

    _is_binary()의 하위 호환 래퍼.
    """
    return _is_binary(file_path)


def _get_scan_priority(file_path: str) -> int:
    """파일의 스캔 우선순위를 반환한다. 값이 낮을수록 먼저 스캔된다."""
    ext = _get_extension(file_path)
    return PRIORITY_EXTENSIONS.get(ext, _DEFAULT_PRIORITY)


def prioritize_files(files: list[str]) -> list[str]:
    """파일 목록을 스캔 우선순위에 따라 정렬하여 반환한다.

    정렬 기준 (PRIORITY_EXTENSIONS 딕셔너리):
    0 — 시크릿/키/인증서 (.env, .key, .pem, .p12, .pfx)
    1 — 설정 파일 (.yml, .yaml, .json, .xml, .conf 등)
    2 — 소스 코드 (.py, .java, .ts, .js, .kt 등)
    3 — 문서/기타 (.md, .txt)
    99 — 그 외 (알 수 없는 확장자)
    """
    return sorted(files, key=_get_scan_priority)


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


def get_scannable_files(files: list[str]) -> list[str]:
    """바이너리 파일을 제외한 스캔 가능한 파일 목록을 반환한다.

    SSE 진행률 계산 시 이 함수로 얻은 목록 수를 기준으로 사용한다.
    """
    return [f for f in files if not _is_binary(f)]


async def scan_files_node(state: AgentState) -> dict:
    """MCP list_directory 또는 GitHub API 로 스캔 대상 파일 목록을 수집한다.

    source_type="github" 이면 MCP GitHub 툴을 사용하고,
    그 외(default "local")는 MCP filesystem 툴을 사용한다.

    파일 목록 후처리:
    1. 바이너리/컴파일 확장자 제거 (BINARY_EXTENSIONS)
    2. 10MB 초과 파일 제거 (github 모드에서 size_map 활용)
    3. 테스트/목 패턴 파일 제거
    4. 우선순위 정렬 — 시크릿/키 파일(0) → 설정(1) → 소스(2) → 기타(99)

    SSE 진행률 정확도:
    바이너리 필터 후 실제 스캔할 파일 수(total)를 기준으로 progress를 계산해야 한다.
    이 노드는 files_to_scan을 반환하므로 호출 측에서 len(files_to_scan)을 total로 사용한다.
    """
    session_id = state["session_id"]
    source_type = state.get("source_type", "local")
    logger.info("[scan_files] session=%s source_type=%s", session_id, source_type)

    with tracer.start_as_current_span("scan_files_node") as span:
        span.set_attribute("session_id", session_id)
        span.set_attribute("source_type", source_type)

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

            # 1. 바이너리 확장자 필터 (get_scannable_files 사용)
            before_ext = len(files)
            files = get_scannable_files(files)
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

            # 4. 우선순위 정렬 — 시크릿/키(0) → 설정(1) → 소스(2) → 기타(99)
            files = prioritize_files(files)

            # 5. 선택 분석(fileFilter) — 지정된 파일만 스캔 (None/빈 값 = 전체, 하위 호환)
            file_filter = state.get("file_filter")
            if file_filter:
                filter_set = set(file_filter)
                before_filter = len(files)
                files = [f for f in files if f in filter_set]
                logger.info(
                    "[scan_files] session=%s file_filter applied: %d/%d files",
                    session_id, len(files), before_filter,
                )

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
