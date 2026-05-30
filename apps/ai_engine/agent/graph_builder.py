"""
LangGraph 보안 감사 그래프 컴파일 & 싱글턴 캐싱.

TASK-206에서 checkpointer 인자를 추가하면 중단·재개가 활성화된다.
"""
import logging
from typing import Any

from langgraph.graph import END, StateGraph

from agent.agent_state import AgentState
from agent.nodes.aggregate_node import aggregate_node
from agent.nodes.api_discovery_node import api_discovery_node
from agent.nodes.cache_check_node import cache_check_node
from agent.nodes.next_file_node import next_file_node
from agent.nodes.patch_node import patch_node
from agent.nodes.sast_node import sast_node
from agent.nodes.scan_files_node import scan_files_node
from agent.security_audit_graph import route_after_cache, route_after_next, route_after_scan

logger = logging.getLogger(__name__)

_graph_cache: dict[str, Any] = {}


def _build_graph(checkpointer=None):
    builder = StateGraph(AgentState)

    builder.add_node("scan_files_node", scan_files_node)
    builder.add_node("api_discovery_node", api_discovery_node)
    builder.add_node("cache_check_node", cache_check_node)
    builder.add_node("sast_node", sast_node)
    builder.add_node("next_file_node", next_file_node)
    builder.add_node("aggregate_node", aggregate_node)
    builder.add_node("patch_node", patch_node)

    builder.set_entry_point("scan_files_node")

    # scan_files → (파일 있으면) api_discovery → cache_check 루프. api_discovery는 1회만 실행.
    builder.add_conditional_edges(
        "scan_files_node",
        route_after_scan,
        {"cache_check_node": "api_discovery_node", "__end__": END},
    )
    builder.add_edge("api_discovery_node", "cache_check_node")
    builder.add_conditional_edges(
        "cache_check_node",
        route_after_cache,
        {"sast_node": "sast_node", "next_file_node": "next_file_node"},
    )
    builder.add_edge("sast_node", "next_file_node")
    builder.add_conditional_edges(
        "next_file_node",
        route_after_next,
        {"cache_check_node": "cache_check_node", "aggregate_node": "aggregate_node"},
    )
    builder.add_edge("aggregate_node", "patch_node")
    builder.add_edge("patch_node", END)

    return builder.compile(checkpointer=checkpointer)


def get_graph(checkpointer=None):
    """컴파일된 그래프를 반환한다. checkpointer 없이 호출하면 싱글턴을 재사용한다."""
    cache_key = "default" if checkpointer is None else id(checkpointer)
    if cache_key not in _graph_cache:
        logger.info("LangGraph 컴파일 중 (checkpointer=%s)", type(checkpointer).__name__ if checkpointer else "None")
        _graph_cache[cache_key] = _build_graph(checkpointer)
    return _graph_cache[cache_key]
