"""
보안 감사 그래프의 조건부 엣지 함수 모음.

노드 구현은 agent/nodes/ 패키지에 있다.
"""
from typing import Literal

from agent.agent_state import AgentState


def route_after_scan(state: AgentState) -> Literal["cache_check_node", "__end__"]:
    """스캔 대상 파일이 없으면 바로 종료한다."""
    if not state.get("files_to_scan"):
        return "__end__"
    return "cache_check_node"


def route_after_cache(state: AgentState) -> Literal["validate_findings_node", "sast_node"]:
    """캐시 히트 시 SAST 를 건너뛰고 검증 노드로 바로 이동한다.

    VAL-3: 캐시 히트 결과도 validate_findings_node를 경유해 할루시네이션 가드를 통과한다.
    일관성 보장: 저장 경로가 항상 validate_findings_node → save_vulnerabilities.
    """
    if state.get("cache_hit"):
        return "validate_findings_node"
    return "sast_node"


def route_after_next(state: AgentState) -> Literal["cache_check_node", "aggregate_node"]:
    """처리할 파일이 남아 있으면 루프, 없으면 집계로 이동한다."""
    idx = state["current_file_index"]
    if idx < len(state.get("files_to_scan", [])):
        return "cache_check_node"
    return "aggregate_node"
