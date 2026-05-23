"""
MCP 서버(Node.js stdio)와의 세션을 관리한다.

- 분석 1회 = MCP 서브프로세스 유지 (효율)
- session_id 키로 tools 목록을 모듈 딕셔너리에 보관
- analyze.py 라우트에서 `async with mcp_session(...)` 으로 감싸 사용
- POSTGRES_MCP_URL 설정 시 postgres_ro 서버도 함께 시작 (선택적)
"""
import logging
from contextlib import asynccontextmanager, AsyncExitStack

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools

from config.settings import settings

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

    - filesystem 서버는 항상 시작한다.
    - POSTGRES_MCP_URL이 설정된 경우 postgres_ro 서버도 함께 시작한다.
      postgres_ro 서버 시작 실패 시 경고 로그만 남기고 filesystem만 사용한다.

    사용 예::

        async with mcp_session(session_id, workspace_root, mcp_script):
            await run_graph(state)
    """
    # filesystem 서버에 DAST 관련 env도 함께 전달한다.
    # 단일 MCP 프로세스에서 파일 툴과 DAST 툴을 모두 제공하므로 별도 프로세스 불필요.
    # INTERNAL_API_KEY 는 로그에 출력하지 않는다.
    servers: dict = {
        "filesystem": {
            "transport": "stdio",
            "command": "node",
            "args": [mcp_script],
            "env": {
                "MCP_WORKSPACE_ROOT": workspace_root,
                "BACKEND_INTERNAL_URL": settings.backend_internal_url or "",
                "INTERNAL_API_KEY": settings.internal_api_key or "",
            },
        }
    }

    use_postgres_mcp = bool(settings.postgres_mcp_url)
    if use_postgres_mcp:
        servers["postgres_ro"] = {
            "transport": "stdio",
            "command": "npx",
            # -y: 확인 없이 설치, connection string을 위치 인자로 전달
            "args": ["-y", "@modelcontextprotocol/server-postgres", settings.postgres_mcp_url],
        }

    client = MultiServerMCPClient(servers)
    logger.info("[mcp] session=%s starting (root=%s, postgres_mcp=%s)", session_id, workspace_root, use_postgres_mcp)

    all_tools: list = []

    async with AsyncExitStack() as stack:
        # filesystem 세션은 항상 시작
        fs_session = await stack.enter_async_context(client.session("filesystem"))
        fs_tools = await load_mcp_tools(fs_session)
        all_tools.extend(fs_tools)
        logger.info("[mcp] session=%s filesystem tools=%s", session_id, [t.name for t in fs_tools])

        # postgres_ro 세션은 선택적으로 시작 — 실패해도 분석을 중단하지 않는다
        if use_postgres_mcp:
            try:
                pg_session = await stack.enter_async_context(client.session("postgres_ro"))
                pg_tools = await load_mcp_tools(pg_session)
                all_tools.extend(pg_tools)
                logger.info("[mcp] session=%s postgres_ro tools=%s", session_id, [t.name for t in pg_tools])
            except Exception as exc:
                logger.warning("[mcp] session=%s postgres_ro start failed — DB context disabled: %s", session_id, exc)

        _register(session_id, all_tools)
        logger.info("[mcp] session=%s total tools=%d", session_id, len(all_tools))
        try:
            yield all_tools
        finally:
            _cleanup(session_id)
            logger.info("[mcp] session=%s closed", session_id)
