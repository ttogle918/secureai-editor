"""
MCP 서버(Node.js stdio)와의 세션을 관리한다.

- 분석 1회 = MCP 서브프로세스 1개 유지 (효율)
- session_id 키로 tools 목록을 모듈 딕셔너리에 보관
- analyze.py 라우트에서 `async with mcp_session(...)` 으로 감싸 사용
"""
import logging
from contextlib import asynccontextmanager

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools

logger = logging.getLogger(__name__)

_session_tools: dict[str, list] = {}


def _register(session_id: str, tools: list) -> None:
    _session_tools[session_id] = tools


def _cleanup(session_id: str) -> None:
    _session_tools.pop(session_id, None)


def get_tool(session_id: str, name: str):
    """세션에 등록된 MCP 툴 객체를 반환한다."""
    tools = _session_tools.get(session_id, [])
    for t in tools:
        if t.name == name:
            return t
    raise ValueError(f"MCP tool '{name}' not found (session={session_id})")


@asynccontextmanager
async def mcp_session(session_id: str, workspace_root: str, mcp_script: str):
    """
    분석 세션 전체에서 MCP 서브프로세스를 유지하는 컨텍스트 매니저.

    사용 예::

        async with mcp_session(session_id, workspace_root, mcp_script):
            await run_graph(state)
    """
    client = MultiServerMCPClient(
        {
            "filesystem": {
                "transport": "stdio",
                "command": "node",
                "args": [mcp_script],
                "env": {"MCP_WORKSPACE_ROOT": workspace_root},
            }
        }
    )
    logger.info("[mcp] session=%s starting (root=%s)", session_id, workspace_root)
    async with client.session("filesystem") as session:
        tools = await load_mcp_tools(session)
        _register(session_id, tools)
        logger.info("[mcp] session=%s tools=%s", session_id, [t.name for t in tools])
        try:
            yield tools
        finally:
            _cleanup(session_id)
            logger.info("[mcp] session=%s closed", session_id)
