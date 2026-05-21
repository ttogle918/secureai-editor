"""DAST 노드 실행 후 라우팅 함수."""
from typing import Literal

from agent.nodes.dast.dast_state import DastState


def route_after_dast(state: DastState) -> Literal["dast_node", "notify_node"]:
    """익스플로잇 결과에 따라 재시도 여부를 결정한다.

    - exploit_outcome["success"] == True  → notify_node (성공)
    - retry_count < max_retries           → dast_node   (재시도)
    - retry_count >= max_retries          → notify_node (포기)
    """
    outcome = state.get("exploit_outcome") or {}
    if outcome.get("success"):
        return "notify_node"

    retry_count = state.get("retry_count", 0)
    max_retries = state.get("max_retries", 3)
    if retry_count < max_retries:
        return "dast_node"

    return "notify_node"
