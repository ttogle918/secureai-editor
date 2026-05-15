"""백엔드 Docker 샌드박스 실행 클라이언트.

AI Engine → Backend 방향의 내부 DAST 실행 요청만 담당한다.
target_url 및 params 는 절대 로그에 출력하지 않는다.
"""
import logging

import httpx

from agent.nodes.dast.dast_state import DastState
from config.settings import settings

logger = logging.getLogger(__name__)

_INTERNAL_HEADERS = {"X-Internal-Key": settings.internal_api_key}
_DAST_EXECUTE_PATH = "/api/internal/dast/execute"
_TIMEOUT_SECONDS = 350.0


async def run_dast_in_sandbox(state: DastState) -> dict:
    """백엔드 내부 API POST /api/internal/dast/execute 를 호출하여
    Docker 샌드박스 내에서 익스플로잇을 실행한다.

    응답 형식:
        {"success": bool, "payload": str, "evidence": str,
         "response_snippet": str, "error": str|None}

    실패 시 예외를 전파하지 않고 success=False 인 dict 를 반환한다.
    """
    payload_body = {
        "vulnId": state["vuln_id"],
        "vulnType": state["vuln_type"],
        "targetUrl": state["target_url"],   # 로그 출력 금지
        "endpoint": state["endpoint"],
        "params": state["params"],
    }
    url = f"{settings.backend_internal_url}{_DAST_EXECUTE_PATH}"

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
        try:
            resp = await client.post(url, json=payload_body, headers=_INTERNAL_HEADERS)
            resp.raise_for_status()
            return resp.json()
        except Exception as exc:
            logger.error(
                "[docker_tool] sandbox call failed vuln_id=%s error=%s",
                state["vuln_id"],
                str(exc),
            )
            return {
                "success": False,
                "payload": "",
                "evidence": "",
                "response_snippet": "",
                "error": str(exc),
            }
