"""LangGraph 그래프 컴파일 & dry-run 테스트."""
import pytest

from agent.agent_state import AgentState
from agent.graph_builder import get_graph
from agent.security_audit_graph import route_after_scan, route_after_cache, route_after_next


# ---------------------------------------------------------------------------
# 조건부 엣지 단위 테스트
# ---------------------------------------------------------------------------

def _base_state(**kwargs) -> AgentState:
    state: AgentState = {
        "session_id": "s1",
        "project_id": "p1",
        "workspace_root": "/workspace",
        "files_to_scan": [],
        "current_file_index": 0,
        "cache_hit": False,
        "sast_results": [],
        "status": "running",
        "error_message": None,
    }
    state.update(kwargs)
    return state


def test_route_after_scan_no_files():
    state = _base_state(files_to_scan=[])
    assert route_after_scan(state) == "__end__"


def test_route_after_scan_has_files():
    state = _base_state(files_to_scan=["a.java"])
    assert route_after_scan(state) == "cache_check_node"


def test_route_after_cache_hit():
    state = _base_state(cache_hit=True)
    assert route_after_cache(state) == "next_file_node"


def test_route_after_cache_miss():
    state = _base_state(cache_hit=False)
    assert route_after_cache(state) == "sast_node"


def test_route_after_next_more_files():
    state = _base_state(files_to_scan=["a.java", "b.java"], current_file_index=1)
    assert route_after_next(state) == "cache_check_node"


def test_route_after_next_done():
    state = _base_state(files_to_scan=["a.java"], current_file_index=1)
    assert route_after_next(state) == "aggregate_node"


# ---------------------------------------------------------------------------
# 그래프 컴파일 & dry-run 통합 테스트
# ---------------------------------------------------------------------------

def test_graph_compiles():
    graph = get_graph()
    assert graph is not None


def test_graph_singleton():
    g1 = get_graph()
    g2 = get_graph()
    assert g1 is g2


@pytest.mark.asyncio
async def test_graph_empty_files_dry_run():
    """파일 없는 상태로 그래프 실행 → completed 상태로 종료."""
    graph = get_graph()
    initial: AgentState = {
        "session_id": "dry-run-001",
        "project_id": "proj-001",
        "workspace_root": "/workspace",
        "files_to_scan": [],
        "current_file_index": 0,
        "cache_hit": False,
        "sast_results": [],
        "status": "running",
        "error_message": None,
    }
    final_state = None
    async for event in graph.astream(initial):
        final_state = event

    assert final_state is not None


@pytest.mark.asyncio
async def test_graph_single_file_dry_run():
    """파일 1개로 그래프 실행 → 노드 순서대로 흐름."""
    graph = get_graph()
    initial: AgentState = {
        "session_id": "dry-run-002",
        "project_id": "proj-001",
        "workspace_root": "/workspace",
        "files_to_scan": ["src/Dao.java"],
        "current_file_index": 0,
        "cache_hit": False,
        "sast_results": [],
        "status": "running",
        "error_message": None,
    }
    visited_nodes: list[str] = []
    async for event in graph.astream(initial):
        visited_nodes.extend(event.keys())

    assert "scan_files_node" in visited_nodes
    assert "cache_check_node" in visited_nodes
    assert "sast_node" in visited_nodes
    assert "aggregate_node" in visited_nodes
