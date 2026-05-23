"""DAST 전용 LangGraph 그래프 컴파일 & 싱글턴 캐싱."""
import logging

from langgraph.graph import END, StateGraph

from agent.nodes.dast.after_dast import route_after_dast
from agent.nodes.dast.dast_node import dast_node
from agent.nodes.dast.dast_state import DastState
from agent.nodes.dast.notify_node import notify_node

logger = logging.getLogger(__name__)

_dast_graph = None


def build_dast_graph():
    """DastState 기반 LangGraph 그래프를 빌드하고 컴파일한다."""
    builder = StateGraph(DastState)

    builder.add_node("dast_node", dast_node)
    builder.add_node("notify_node", notify_node)

    builder.set_entry_point("dast_node")

    builder.add_conditional_edges(
        "dast_node",
        route_after_dast,
        {"dast_node": "dast_node", "notify_node": "notify_node"},
    )
    builder.add_edge("notify_node", END)

    return builder.compile()


def get_dast_graph():
    """컴파일된 DAST 그래프 싱글턴을 반환한다."""
    global _dast_graph
    if _dast_graph is None:
        logger.info("DAST LangGraph 컴파일 중")
        _dast_graph = build_dast_graph()
    return _dast_graph
