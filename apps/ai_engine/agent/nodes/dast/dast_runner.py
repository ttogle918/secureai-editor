"""DAST 익스플로잇 조율 모듈.

vuln_type 문자열로 적절한 executor를 선택하고 실행한다.
새 취약점 유형 추가 시 _EXECUTOR_MAP 에만 등록하면 된다.
"""
import logging
from typing import Callable, Coroutine, TypedDict

from agent.nodes.dast.executors import (
    execute_auth_bypass,
    execute_idor,
    execute_sqli,
    execute_ssrf,
    execute_xss,
)

logger = logging.getLogger(__name__)


class ExploitOutcome(TypedDict):
    success: bool
    payload: str
    response_snippet: str
    evidence: str
    error: str | None


# Strategy 패턴: vuln_type → executor 함수 매핑
_ExecutorFn = Callable[[str, str, dict], Coroutine[None, None, ExploitOutcome]]

_EXECUTOR_MAP: dict[str, _ExecutorFn] = {
    "SQL_INJECTION": execute_sqli,
    "XSS": execute_xss,
    "IDOR": execute_idor,
    "SSRF": execute_ssrf,
    "AUTH_BYPASS": execute_auth_bypass,
}


async def run_dast(
    vuln_type: str,
    endpoint: str,
    target_url: str,
    params: dict,
) -> ExploitOutcome:
    """취약점 유형에 맞는 executor를 선택하여 실행한다.

    인자 순서는 호출부(backend DastExecutionService 의 샌드박스 스크립트)가
    run_dast(VULN_TYPE, DAST_ENDPOINT, DAST_TARGET_URL, PARAMS) 로 넘기는 것과 일치한다.
    (이전 시그니처는 endpoint/target_url 순서가 뒤바뀌어 executor가 잘못된 URL을 만들었다.)

    지원하지 않는 유형은 executor를 호출하지 않고 즉시 실패 결과를 반환한다.
    executor 내부에서 발생한 예외는 여기서 포착하여 전체 파이프라인이 중단되지 않도록 한다.
    """
    executor = _EXECUTOR_MAP.get(vuln_type.upper())

    if executor is None:
        logger.warning("[dast_runner] unsupported vuln_type=%s", vuln_type)
        return ExploitOutcome(
            success=False,
            payload="",
            response_snippet="",
            evidence="unsupported vuln type",
            error=None,
        )

    logger.info("[dast_runner] vuln_type=%s endpoint=%s", vuln_type, endpoint)
    try:
        return await executor(target_url, endpoint, params)
    except Exception as exc:
        logger.error("[dast_runner] executor error vuln_type=%s: %s", vuln_type, exc)
        return ExploitOutcome(
            success=False,
            payload="",
            response_snippet="",
            evidence="executor raised an unexpected exception",
            error=str(exc),
        )
