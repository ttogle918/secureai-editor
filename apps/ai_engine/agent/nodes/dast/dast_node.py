"""DAST 핵심 실행 노드.

1. 관련 DAST 지침을 벡터/DB 검색으로 로드한다 (첫 실행 시)
2. docker_tool.run_dast_in_sandbox 를 호출하여 익스플로잇을 실행한다
3. 결과를 state 에 저장하고 log_messages 에 로그를 추가한다

target_url 및 params 는 절대 로그에 출력하지 않는다.
"""
import logging

from agent.nodes.dast.docker_tool import run_dast_in_sandbox
from agent.nodes.dast.dast_state import DastState
from infrastructure.guidelines_client import load_guidelines

logger = logging.getLogger(__name__)

# search_guidelines_by_vuln_type 는 별도 Agent 가 구현할 수 있으므로 임포트 실패 시 폴백
try:
    from infrastructure.guidelines_client import search_guidelines_by_vuln_type
except ImportError:
    search_guidelines_by_vuln_type = None


async def dast_node(state: DastState) -> DastState:
    """DAST 익스플로잇을 실행하고 결과를 state 에 저장한다.

    - dast_guidelines 가 아직 로드되지 않은 경우 vuln_type 기반으로 지침을 조회한다.
    - retry_count 를 1 증가시킨다.
    - log_messages 에 현재 시도 정보를 추가한다.
    - exploit_outcome 에 sandbox 실행 결과를 저장한다.
    """
    vuln_type = state["vuln_type"]
    endpoint = state["endpoint"]
    retry_count = state.get("retry_count", 0)
    log_messages = list(state.get("log_messages", []))

    # 지침 로드 — 첫 실행이거나 아직 빈 경우에만
    guidelines = state.get("dast_guidelines", "")
    if not guidelines:
        guidelines = await _load_dast_guidelines(vuln_type)

    new_retry_count = retry_count + 1
    log_msg = f"[DAST] {vuln_type} 시도 #{new_retry_count} endpoint={endpoint}"
    log_messages.append(log_msg)
    logger.info("[dast_node] session=%s %s", state["session_id"], log_msg)

    outcome = await run_dast_in_sandbox(state)

    return {
        **state,
        "retry_count": new_retry_count,
        "dast_guidelines": guidelines,
        "exploit_outcome": outcome,
        "log_messages": log_messages,
    }


async def _load_dast_guidelines(vuln_type: str) -> str:
    """vuln_type 에 맞는 DAST 지침을 로드한다.

    search_guidelines_by_vuln_type 가 사용 가능하면 벡터 검색을 사용하고,
    없으면 common 지침으로 폴백한다.
    """
    if search_guidelines_by_vuln_type is not None:
        try:
            return await search_guidelines_by_vuln_type(vuln_type, top_k=5)
        except Exception as exc:
            logger.warning(
                "[dast_node] search_guidelines_by_vuln_type failed vuln_type=%s error=%s",
                vuln_type,
                exc,
            )

    try:
        return await load_guidelines("common")
    except Exception as exc:
        logger.warning("[dast_node] load_guidelines failed: %s", exc)
        return ""
