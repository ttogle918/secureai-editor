"""
MCP GitHub 툴 래퍼.

GitHub 레포지토리 파일 목록 조회 및 내용 읽기.
local source_type에서는 mcp_filesystem_tools.py 를 사용한다.

MCP 서버에 등록된 툴:
- github_list_directory : {owner, repo, path?, ref?, token?, recursive?} → 파일 목록
- github_get_file_content: {owner, repo, path, ref?, token?} → 파일 내용
- github_list_commits    : {owner, repo, ref?, per_page?, token?} → 커밋 요약 목록
- github_get_commit_diff : {owner, repo, sha, token?} → 커밋 diff (files[].patch)
"""
import json
import logging

from agent.mcp_client import get_tool

logger = logging.getLogger(__name__)

SCANNABLE_EXTENSIONS: frozenset[str] = frozenset({
    ".java", ".kt",                          # JVM
    ".py",                                   # Python
    ".ts", ".tsx", ".js", ".jsx",            # JS/TS
    ".go",                                   # Go
    ".rb",                                   # Ruby
    ".php",                                  # PHP
    ".cs",                                   # C#
    ".cpp", ".cc", ".c", ".h", ".hpp",       # C/C++
    ".swift",                                # Swift
    ".rs",                                   # Rust
})

_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB


def _extract_text(result) -> str:
    """langchain_mcp_adapters 툴이 반환하는 content list 또는 str을 텍스트로 변환한다."""
    if isinstance(result, str):
        return result
    if isinstance(result, list):
        return "\n".join(
            item["text"] for item in result
            if isinstance(item, dict) and item.get("type") == "text"
        )
    return str(result)


def _parse_file_entry(line: str) -> tuple[str, int | None]:
    """파일 목록 한 줄을 (경로, 크기) 형태로 파싱한다.

    MCP 서버가 반환하는 형식은 단순 경로이거나 "경로 크기" 형태일 수 있다.
    크기를 파싱할 수 없으면 None을 반환한다.
    """
    parts = line.rsplit(" ", 1)
    if len(parts) == 2:
        try:
            size = int(parts[1])
            return parts[0], size
        except ValueError:
            pass
    return line, None


def _get_extension(file_path: str) -> str:
    dot_idx = file_path.rfind(".")
    if dot_idx == -1:
        return ""
    return file_path[dot_idx:].lower()


async def list_github_files(
    session_id: str,
    owner: str,
    repo: str,
    ref: str | None = None,
    token: str | None = None,  # 로그에 token 출력 금지
) -> tuple[list[str], dict[str, int]]:
    """GitHub 레포지토리에서 스캔 가능한 소스 파일 목록과 크기 맵을 반환한다.

    반환값:
        - files: 디렉토리·스킵 항목을 제외한 파일 경로 목록
        - size_map: {파일경로: 바이트 크기} — 크기를 알 수 없는 항목은 포함하지 않음

    필터 규칙:
    - 디렉토리 항목("/" 로 끝나는 항목) 제외
    - 스캔 가능한 확장자 파일만 포함
    - 10MB 초과 파일 제외 (MCP 응답에 크기가 포함된 경우)
    """
    tool = get_tool(session_id, "github_list_directory")
    args: dict = {"owner": owner, "repo": repo, "recursive": True}
    if ref:
        args["ref"] = ref
    if token:
        args["token"] = token

    result = await tool.ainvoke(args)
    raw = _extract_text(result)
    all_entries = [line.strip() for line in raw.splitlines() if line.strip()]

    files: list[str] = []
    size_map: dict[str, int] = {}
    skipped_large = 0

    for entry in all_entries:
        if entry.endswith("/"):
            continue

        path, size = _parse_file_entry(entry)
        ext = _get_extension(path)
        if ext not in SCANNABLE_EXTENSIONS:
            continue

        if size is not None:
            if size > _MAX_FILE_SIZE_BYTES:
                logger.info(
                    "[github-tools] session=%s skip large file=%s size=%d",
                    session_id, path, size,
                )
                skipped_large += 1
                continue
            size_map[path] = size

        files.append(path)

    if skipped_large:
        logger.info(
            "[github-tools] session=%s skipped_large=%d (>10MB)",
            session_id, skipped_large,
        )

    return files, size_map


async def get_github_file_content(
    session_id: str,
    owner: str,
    repo: str,
    path: str,
    ref: str | None = None,
    token: str | None = None,  # 로그에 token 출력 금지
) -> str:
    """GitHub 레포지토리에서 파일 내용을 반환한다."""
    tool = get_tool(session_id, "github_get_file_content")
    args: dict = {"owner": owner, "repo": repo, "path": path}
    if ref:
        args["ref"] = ref
    if token:
        args["token"] = token

    result = await tool.ainvoke(args)
    return _extract_text(result)


async def list_commits_via_mcp(
    session_id: str,
    owner: str,
    repo: str,
    page: int = 1,
    per_page: int = 30,
    ref: str | None = None,
    token: str | None = None,  # 로그에 token 출력 금지
) -> list[dict]:
    """MCP github_list_commits 툴을 호출해 커밋 요약 목록을 반환한다.

    결과는 캐싱하지 않는다 — 커밋은 항상 최신 상태를 조회해야 한다.

    반환 형식 (MCP 서버 CommitSummary 기준):
        [{"sha": "...", "message": "...", "date": "...", "author": "..."}, ...]
    """
    tool = get_tool(session_id, "github_list_commits")
    safe_per_page = min(max(1, per_page), 100)
    args: dict = {"owner": owner, "repo": repo, "per_page": safe_per_page}
    if ref:
        args["ref"] = ref
    if token:
        args["token"] = token

    result = await tool.ainvoke(args)
    raw = _extract_text(result)

    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return parsed
        logger.warning("[github-tools] session=%s list_commits unexpected format", session_id)
        return []
    except json.JSONDecodeError as exc:
        logger.warning("[github-tools] session=%s list_commits JSON parse error: %s", session_id, exc)
        return []


async def get_commit_diff_via_mcp(
    session_id: str,
    owner: str,
    repo: str,
    sha: str,
    token: str | None = None,  # 로그에 token 출력 금지
) -> dict:
    """MCP github_get_commit_diff 툴을 호출해 특정 커밋의 diff를 반환한다.

    반환 형식 (MCP 서버 CommitDiff 기준):
        {"sha": "...", "message": "...", "date": "...", "files": [{"filename": "...", "patch": "...", "status": "..."}]}
    """
    tool = get_tool(session_id, "github_get_commit_diff")
    args: dict = {"owner": owner, "repo": repo, "sha": sha}
    if token:
        args["token"] = token

    result = await tool.ainvoke(args)
    raw = _extract_text(result)

    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
        logger.warning("[github-tools] session=%s get_commit_diff unexpected format sha=%s", session_id, sha[:8])
        return {"sha": sha, "files": []}
    except json.JSONDecodeError as exc:
        logger.warning("[github-tools] session=%s get_commit_diff JSON parse error sha=%s: %s", session_id, sha[:8], exc)
        return {"sha": sha, "files": []}
