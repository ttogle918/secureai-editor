"""
Sentry PII 스크럽 필터 (TASK-1804 보안 필수)

민감 데이터(JWT/Authorization/X-Internal-Key/password 등)가
Sentry로 전송되지 않도록 before_send 훅에서 이벤트를 정제한다.

SRP: 이 모듈은 Sentry 이벤트 PII 스크럽 책임만 가진다.
"""

import re
from typing import Any

_REDACTED = "[REDACTED]"

# JWT 패턴 — eyJ로 시작하는 세 파트 구조
_JWT_PATTERN = re.compile(r"eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*")

# 스크럽할 HTTP 헤더 (소문자 정규화 후 비교)
_SENSITIVE_HEADERS = frozenset({
    "authorization",
    "x-internal-key",
    "cookie",
    "set-cookie",
    "x-api-key",
})

# 스크럽할 요청 파라미터/바디 키 (소문자 정규화 후 비교)
_SENSITIVE_PARAM_KEYS = frozenset({
    "password",
    "passwd",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "api_key",
    "private_key",
})


def scrub_sentry_event(event: dict[str, Any], hint: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Sentry 이벤트에서 PII를 제거하고 반환한다.

    before_send 훅 시그니처와 호환: (event, hint) -> event
    """
    request = event.get("request")
    if not request:
        return event

    _scrub_headers(request)
    _scrub_query_string(request)
    _scrub_body(request)
    return event


def _scrub_headers(request: dict[str, Any]) -> None:
    headers = request.get("headers")
    if not isinstance(headers, dict):
        return
    for key in list(headers.keys()):
        if key.lower() in _SENSITIVE_HEADERS:
            headers[key] = _REDACTED


def _scrub_query_string(request: dict[str, Any]) -> None:
    query_string = request.get("query_string")
    if not query_string:
        return

    # JWT 패턴 감지 시 쿼리 스트링 전체 마스킹
    if _JWT_PATTERN.search(query_string):
        request["query_string"] = _REDACTED
        return

    request["query_string"] = _mask_sensitive_params(query_string)


def _scrub_body(request: dict[str, Any]) -> None:
    body = request.get("data")
    if not isinstance(body, dict):
        return
    for key in list(body.keys()):
        if key.lower() in _SENSITIVE_PARAM_KEYS:
            body[key] = _REDACTED


def _mask_sensitive_params(query_string: str) -> str:
    """쿼리 스트링에서 민감 파라미터 값만 마스킹한다."""
    parts = []
    for pair in query_string.split("&"):
        if "=" not in pair:
            parts.append(pair)
            continue
        key, _, value = pair.partition("=")
        if key.lower() in _SENSITIVE_PARAM_KEYS:
            parts.append(f"{key}={_REDACTED}")
        else:
            parts.append(f"{key}={value}")
    return "&".join(parts)
