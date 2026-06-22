"""
LangGraph 보안 감사 그래프 컴파일 & 싱글턴 캐싱.

TASK-206에서 checkpointer 인자를 추가하면 중단·재개가 활성화된다.
STAGE-2: interrupt=True 컴파일본은 planning_node 실행 후 GraphInterrupt를 발생시켜
사용자 컨펌 게이트를 구현한다. 캐시 키에 interrupt 모드를 포함하여 두 컴파일본을 분리한다.
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
from agent.nodes.patch_verify_node import patch_verify_node
from agent.nodes.planning_node import planning_node
from agent.nodes.sast_node import sast_node
from agent.nodes.scan_files_node import scan_files_node
from agent.nodes.validate_findings_node import validate_findings_node
from agent.security_audit_graph import route_after_cache, route_after_next, route_after_scan

logger = logging.getLogger(__name__)

_graph_cache: dict[str, Any] = {}


def _build_graph(checkpointer=None, interrupt: bool = False):
    builder = StateGraph(AgentState)

    builder.add_node("scan_files_node", scan_files_node)
    builder.add_node("api_discovery_node", api_discovery_node)
    builder.add_node("planning_node", planning_node)
    builder.add_node("cache_check_node", cache_check_node)
    builder.add_node("sast_node", sast_node)
    # VAL-3: 결정론적 AST 할루시네이션 가드 — sast_node와 next_file_node 사이에 삽입
    builder.add_node("validate_findings_node", validate_findings_node)
    builder.add_node("next_file_node", next_file_node)
    builder.add_node("aggregate_node", aggregate_node)
    builder.add_node("patch_node", patch_node)
    # TASK-1402: 패치 검증 노드 (Python+pytest 격리 컨테이너)
    builder.add_node("patch_verify_node", patch_verify_node)

    builder.set_entry_point("scan_files_node")

    # scan_files → (파일 있으면) api_discovery → planning → cache_check 루프.
    builder.add_conditional_edges(
        "scan_files_node",
        route_after_scan,
        {"cache_check_node": "api_discovery_node", "__end__": END},
    )
    builder.add_edge("api_discovery_node", "planning_node")
    builder.add_edge("planning_node", "cache_check_node")
    # VAL-3: 캐시 히트 시도 validate_findings_node 경유 (저장 경로 일원화)
    builder.add_conditional_edges(
        "cache_check_node",
        route_after_cache,
        {"sast_node": "sast_node", "validate_findings_node": "validate_findings_node"},
    )
    # VAL-3: sast_node 완료 후 validate_findings_node 경유
    builder.add_edge("sast_node", "validate_findings_node")
    builder.add_edge("validate_findings_node", "next_file_node")
    builder.add_conditional_edges(
        "next_file_node",
        route_after_next,
        {"cache_check_node": "cache_check_node", "aggregate_node": "aggregate_node"},
    )
    builder.add_edge("aggregate_node", "patch_node")
    # TASK-1402: patch_node 완료 후 patch_verify_node 실행 (Python+pytest 검증)
    builder.add_edge("patch_node", "patch_verify_node")
    builder.add_edge("patch_verify_node", END)

    # STAGE-2: interrupt=True 시 planning_node 실행 후 자동 중단.
    # LangGraph가 planning_node 완료 직후 GraphInterrupt를 발생시킨다.
    # 사용자 컨펌 후 /agent/confirm 이 graph.aupdate_state + astream(None) 으로 재개한다.
    interrupt_after = ["planning_node"] if interrupt else []
    return builder.compile(checkpointer=checkpointer, interrupt_after=interrupt_after)


def get_graph(checkpointer=None, interrupt: bool = False):
    """컴파일된 그래프를 반환한다.

    캐시 키에 checkpointer identity와 interrupt 모드를 모두 포함하여
    일반 그래프와 interrupt 컴파일본이 섞이지 않도록 한다(STAGE-2 Dev 보완 #3).
    """
    if checkpointer is None:
        cache_key = f"default_interrupt={interrupt}"
    else:
        cache_key = f"{id(checkpointer)}_interrupt={interrupt}"

    if cache_key not in _graph_cache:
        logger.info(
            "LangGraph 컴파일 중 (checkpointer=%s interrupt=%s)",
            type(checkpointer).__name__ if checkpointer else "None",
            interrupt,
        )
        _graph_cache[cache_key] = _build_graph(checkpointer, interrupt=interrupt)
    return _graph_cache[cache_key]
