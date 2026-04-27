"""
MCP Filesystem 툴 3개를 Python 함수로 래핑한다.

- read_file       : 파일 내용 반환
- list_directory  : 재귀 디렉토리 목록 반환
- search_files    : 패턴 매칭 파일 검색

list_scannable_files() 는 분석 대상 확장자만 필터링해 반환하는 헬퍼.
"""
from agent.mcp_client import get_tool

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


async def read_file(session_id: str, relative_path: str) -> str:
    tool = get_tool(session_id, "read_file")
    result = await tool.ainvoke({"path": relative_path})
    return _extract_text(result)


async def list_directory(session_id: str, path: str = ".", recursive: bool = True) -> list[str]:
    tool = get_tool(session_id, "list_directory")
    result = await tool.ainvoke({"path": path, "recursive": recursive})
    raw = _extract_text(result)
    return [line.strip() for line in raw.splitlines() if line.strip()]


async def search_files(session_id: str, pattern: str, directory: str = ".") -> list[str]:
    tool = get_tool(session_id, "search_files")
    result = await tool.ainvoke({"pattern": pattern, "directory": directory})
    raw = _extract_text(result)
    return [line.strip() for line in raw.splitlines() if line.strip()]


async def list_scannable_files(session_id: str) -> list[str]:
    """재귀 탐색으로 분석 가능한 소스 파일 목록을 반환한다."""
    all_entries = await list_directory(session_id, ".", recursive=True)
    return [
        e for e in all_entries
        if not e.endswith("/")
        and any(e.endswith(ext) for ext in SCANNABLE_EXTENSIONS)
    ]
