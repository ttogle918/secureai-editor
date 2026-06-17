"""LangGraph 그래프 컴파일 & 엣지 라우팅 테스트."""
import pytest
from unittest.mock import AsyncMock, patch

from agent.agent_state import AgentState
from agent.graph_builder import get_graph
from agent.security_audit_graph import route_after_scan, route_after_cache, route_after_next


# ---------------------------------------------------------------------------
# 헬퍼
# ---------------------------------------------------------------------------

def _base_state(**kwargs) -> AgentState:
    state: AgentState = {
        "session_id": "s1",
        "project_id": "p1",
        "workspace_root": "/workspace",
        "files_to_scan": [],
        "current_file_index": 0,
        "current_file_sha256": None,
        "cache_hit": False,
        "sast_results": [],
        "status": "running",
        "error_message": None,
    }
    state.update(kwargs)
    return state


# ---------------------------------------------------------------------------
# 조건부 엣지 단위 테스트 (외부 의존 없음)
# ---------------------------------------------------------------------------

def test_route_after_scan_no_files():
    assert route_after_scan(_base_state(files_to_scan=[])) == "__end__"


def test_route_after_scan_has_files():
    assert route_after_scan(_base_state(files_to_scan=["a.java"])) == "cache_check_node"


def test_route_after_cache_hit():
    # VAL-3: 캐시 히트 시 validate_findings_node 경유 (저장 경로 일원화)
    assert route_after_cache(_base_state(cache_hit=True)) == "validate_findings_node"


def test_route_after_cache_miss():
    assert route_after_cache(_base_state(cache_hit=False)) == "sast_node"


def test_route_after_next_more_files():
    state = _base_state(files_to_scan=["a.java", "b.java"], current_file_index=1)
    assert route_after_next(state) == "cache_check_node"


def test_route_after_next_done():
    state = _base_state(files_to_scan=["a.java"], current_file_index=1)
    assert route_after_next(state) == "aggregate_node"


# ---------------------------------------------------------------------------
# 그래프 컴파일 테스트
# ---------------------------------------------------------------------------

def test_graph_compiles():
    assert get_graph() is not None


def test_graph_singleton():
    assert get_graph() is get_graph()


# ---------------------------------------------------------------------------
# 그래프 dry-run (MCP / Redis / Claude mock)
# ---------------------------------------------------------------------------

def _make_mocks():
    """모든 외부 의존성을 mock 으로 대체한다."""
    return [
        patch(
            "agent.nodes.scan_files_node.list_scannable_files",
            new_callable=lambda: lambda: AsyncMock(return_value=[]),
        ),
        patch(
            "agent.nodes.cache_check_node.read_file",
            new_callable=lambda: lambda: AsyncMock(return_value="code"),
        ),
        patch(
            "agent.nodes.cache_check_node._get_redis",
            return_value=AsyncMock(**{"get.return_value": None}),
        ),
        patch(
            "agent.nodes.sast_node.read_file",
            new_callable=lambda: lambda: AsyncMock(return_value="code"),
        ),
        patch(
            "agent.nodes.sast_node.analyze_for_sast",
            new_callable=lambda: lambda: AsyncMock(return_value='{"vulnerabilities":[]}'),
        ),
        patch(
            "agent.nodes.sast_node._get_redis",
            return_value=AsyncMock(**{"setex.return_value": True}),
        ),
    ]


def _fake_redis_no_cache():
    """캐시 미스 시나리오용 Redis mock."""
    r = AsyncMock()
    r.get = AsyncMock(return_value=None)
    r.setex = AsyncMock(return_value=True)
    return r


@pytest.mark.asyncio
async def test_graph_no_files_ends_immediately():
    """파일 없는 상태 → scan 후 바로 END."""
    async def _no_files(_session_id):
        return []

    with patch("agent.nodes.scan_files_node.list_scannable_files", side_effect=_no_files):
        graph = get_graph()
        events = [e async for e in graph.astream(_base_state())]
        node_names = [k for e in events for k in e]
        assert "scan_files_node" in node_names
        assert "sast_node" not in node_names


@pytest.mark.asyncio
async def test_graph_single_file_visits_all_nodes():
    """파일 1개 → scan → cache_check → sast → next → aggregate 순 방문."""
    async def _one_file(_sid):
        return ["src/Dao.java"]

    async def _read_file(_sid, _path):
        return "public class Dao { String q = id; }"

    async def _analyze(_path, _content):
        return '{"vulnerabilities": []}'

    async def _validate_noop(state):
        """validate_findings_node mock — 외부 I/O 없이 빈 결과 반환."""
        return {}

    with (
        patch("agent.nodes.scan_files_node.list_scannable_files", side_effect=_one_file),
        patch("agent.nodes.cache_check_node.read_file", side_effect=_read_file),
        patch("agent.nodes.cache_check_node._get_redis", return_value=_fake_redis_no_cache()),
        patch("agent.nodes.sast_node.read_file", side_effect=_read_file),
        patch("agent.nodes.sast_node.analyze_for_sast", side_effect=_analyze),
        patch("agent.nodes.sast_node._get_redis", return_value=_fake_redis_no_cache()),
        # VAL-3: validate_findings_node 외부 의존성(MCP read_file, backend save) mock
        patch("agent.nodes.validate_findings_node.read_file", side_effect=_read_file),
        patch("agent.nodes.validate_findings_node.save_vulnerabilities", new_callable=AsyncMock),
    ):
        graph = get_graph()
        events = [e async for e in graph.astream(_base_state())]
        node_names = [k for e in events for k in e]

        assert "scan_files_node" in node_names
        assert "cache_check_node" in node_names
        assert "sast_node" in node_names
        # VAL-3: validate_findings_node가 sast와 next_file 사이에 삽입됨
        assert "validate_findings_node" in node_names
        assert "next_file_node" in node_names
        assert "aggregate_node" in node_names
