"""DAST 핵심 실행 노드.

1. 관련 DAST 지침을 벡터/DB 검색으로 로드한다 (첫 실행 시)
2. MCP run_dast_in_sandbox 툴 호출을 시도하고, 미사용 시 docker_tool 직접 호출로 폴백한다
3. 결과를 state 에 저장하고 log_messages 에 로그를 추가한다

target_url 및 params 는 절대 로그에 출력하지 않는다.

실행 경로:
  - DAST 그래프는 mcp_session() 컨텍스트 없이 별도 실행되므로 기본적으로 폴백 경로를 사용한다.
  - session_id 가 mcp_client._session_tools 에 등록된 경우(예: SAST 그래프 내 인라인 호출)
    MCP 경로로 실행된다.
"""
import json
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

# search_compliance_feed_by_topic — best-effort, 임포트 실패 시 통합 비활성화
try:
    from infrastructure.guidelines_client import search_compliance_feed_by_topic as _search_compliance
except ImportError:
    _search_compliance = None  # type: ignore[assignment]

# MCP 클라이언트는 선택적 의존성 — DAST 단독 실행 시 없을 수 있다
try:
    from agent.mcp_client import get_tool as _get_mcp_tool
except ImportError:
    _get_mcp_tool = None  # type: ignore[assignment]

_MCP_DAST_TOOL = "run_dast_in_sandbox"


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

    outcome = await _execute_dast(state)

    return {
        **state,
        "retry_count": new_retry_count,
        "dast_guidelines": guidelines,
        "exploit_outcome": outcome,
        "log_messages": log_messages,
    }


async def _execute_dast(state: DastState) -> dict:
    """MCP run_dast_in_sandbox 툴 사용을 시도하고, 미등록 시 직접 httpx 호출로 폴백한다.

    DAST 그래프는 mcp_session() 없이 실행되므로 일반적으로 폴백 경로를 사용한다.
    MCP 경로는 미래 확장(SAST 그래프 내 인라인 DAST 호출 등)을 위해 준비되어 있다.
    """
    session_id = state["session_id"]

    if _get_mcp_tool is not None:
        try:
            tool = _get_mcp_tool(session_id, _MCP_DAST_TOOL)
            mcp_args = {
                "sessionId": state["session_id"],
                "vulnId": state["vuln_id"],
                "vulnType": state["vuln_type"],
                "targetUrl": state["target_url"],
                "endpoint": state["endpoint"],
                "params": state["params"],
            }
            raw = await tool.ainvoke(mcp_args)
            # MCP 툴 응답: {"content": [{"type": "text", "text": "...json..."}]}
            if isinstance(raw, dict) and "content" in raw:
                text = raw["content"][0]["text"]
                return json.loads(text)
            # 이미 dict 형태로 역직렬화된 경우
            if isinstance(raw, dict):
                return raw
            return json.loads(str(raw))
        except ValueError:
            # get_tool 이 ValueError 를 발생시키면 MCP 세션 미등록 — 폴백
            logger.debug("[dast_node] session=%s MCP tool not available, using direct call", session_id)
        except Exception as exc:
            logger.warning("[dast_node] session=%s MCP tool call failed, falling back: %s", session_id, exc)

    return await run_dast_in_sandbox(state)


async def _load_dast_guidelines(vuln_type: str) -> str:
    """vuln_type 에 맞는 DAST 지침을 로드한다.

    1. search_guidelines_by_vuln_type 벡터 검색 (사용 가능 시)
    2. 없으면 common 지침으로 폴백
    3. KISA 컴플라이언스 피드 검색 결과를 best-effort 로 병합
    """
    guidelines = await _load_base_guidelines(vuln_type)
    compliance_context = await _fetch_dast_compliance_context(vuln_type)
    if compliance_context:
        guidelines = (
            guidelines
            + "\n\n### 관련 KISA 컴플라이언스 가이드\n"
            + compliance_context
        )
    return guidelines


async def _load_base_guidelines(vuln_type: str) -> str:
    """security_guidelines 에서 DAST 지침을 로드한다."""
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


async def _fetch_dast_compliance_context(vuln_type: str) -> str:
    """KISA 컴플라이언스 피드에서 vuln_type 관련 항목을 검색한다.

    best-effort: 실패/0건 시 빈 문자열 반환, 기존 DAST 분석 계속 진행.
    """
    if _search_compliance is None:
        return ""
    try:
        topic = f"{vuln_type.replace('_', ' ').lower()} 취약점 보안"
        return await _search_compliance(topic)
    except Exception as exc:
        logger.warning(
            "[dast_node] compliance_feed search failed vuln_type=%s error=%s (skip)",
            vuln_type, exc,
        )
        return ""
