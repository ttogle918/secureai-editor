"""
Sentry PII 스크럽 필터 단위 테스트 (TASK-1804 필수 보안 검증)

민감 데이터(JWT/Authorization/X-Internal-Key/password)가
Sentry 이벤트에서 제거되는지 확인한다.
"""

import pytest
from infrastructure.sentry_filter import scrub_sentry_event, _mask_sensitive_params


# ── Authorization 헤더 스크럽 ─────────────────────────────────────────────


def test_scrubs_authorization_header():
    """Authorization 헤더는 [REDACTED]로 교체된다."""
    event = {
        "request": {
            "headers": {"Authorization": "Bearer eyJsecrettoken"}
        }
    }
    result = scrub_sentry_event(event)
    assert result["request"]["headers"]["Authorization"] == "[REDACTED]"


def test_scrubs_x_internal_key_header():
    """X-Internal-Key 헤더는 [REDACTED]로 교체된다."""
    event = {
        "request": {
            "headers": {"X-Internal-Key": "super-secret-internal-key-12345"}
        }
    }
    result = scrub_sentry_event(event)
    assert result["request"]["headers"]["X-Internal-Key"] == "[REDACTED]"


def test_scrubs_header_case_insensitive():
    """헤더 키 대소문자 무관하게 스크럽한다."""
    event = {
        "request": {
            "headers": {"authorization": "Bearer token123", "COOKIE": "session=abc"}
        }
    }
    result = scrub_sentry_event(event)
    assert result["request"]["headers"]["authorization"] == "[REDACTED]"
    assert result["request"]["headers"]["COOKIE"] == "[REDACTED]"


def test_preserves_non_sensitive_header():
    """비민감 헤더(Content-Type)는 보존된다."""
    event = {
        "request": {
            "headers": {"Content-Type": "application/json", "Accept": "application/json"}
        }
    }
    result = scrub_sentry_event(event)
    assert result["request"]["headers"]["Content-Type"] == "application/json"
    assert result["request"]["headers"]["Accept"] == "application/json"


# ── 쿼리 스트링 스크럽 ───────────────────────────────────────────────────


def test_masks_password_in_query_string():
    """쿼리 스트링에서 password 파라미터를 마스킹한다."""
    event = {
        "request": {
            "query_string": "username=user&password=secret123"
        }
    }
    result = scrub_sentry_event(event)
    qs = result["request"]["query_string"]
    assert "password=[REDACTED]" in qs
    assert "secret123" not in qs


def test_redacts_entire_query_string_containing_jwt():
    """쿼리 스트링에 JWT 패턴이 있으면 전체를 [REDACTED]로 교체한다."""
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    event = {
        "request": {
            "query_string": f"token={jwt}"
        }
    }
    result = scrub_sentry_event(event)
    assert result["request"]["query_string"] == "[REDACTED]"


def test_preserves_non_sensitive_query_params():
    """비민감 쿼리 파라미터는 보존된다."""
    event = {
        "request": {
            "query_string": "page=1&size=10&sort=createdAt"
        }
    }
    result = scrub_sentry_event(event)
    assert result["request"]["query_string"] == "page=1&size=10&sort=createdAt"


# ── 바디 데이터 스크럽 ───────────────────────────────────────────────────


def test_scrubs_password_from_body():
    """요청 바디에서 password 키를 스크럽한다."""
    event = {
        "request": {
            "data": {
                "username": "user@example.com",
                "password": "mySecretPassword",
            }
        }
    }
    result = scrub_sentry_event(event)
    data = result["request"]["data"]
    assert data["password"] == "[REDACTED]"
    assert data["username"] == "user@example.com"


def test_scrubs_token_from_body():
    """바디에서 access_token 키를 스크럽한다."""
    event = {
        "request": {
            "data": {
                "access_token": "eyJhbGci...",
                "email": "test@example.com",
            }
        }
    }
    result = scrub_sentry_event(event)
    data = result["request"]["data"]
    assert data["access_token"] == "[REDACTED]"
    assert data["email"] == "test@example.com"


def test_does_not_modify_non_dict_body():
    """바디가 dict가 아니면 수정하지 않는다."""
    event = {
        "request": {
            "data": "raw string body"
        }
    }
    result = scrub_sentry_event(event)
    assert result["request"]["data"] == "raw string body"


# ── null/빈 케이스 ────────────────────────────────────────────────────────


def test_handles_event_without_request():
    """request 필드가 없는 이벤트는 그대로 반환된다."""
    event = {"level": "error", "message": "Something went wrong"}
    result = scrub_sentry_event(event)
    assert result == event


def test_handles_empty_headers():
    """빈 헤더 딕셔너리는 정상 처리된다."""
    event = {"request": {"headers": {}}}
    result = scrub_sentry_event(event)
    assert result["request"]["headers"] == {}


def test_handles_none_query_string():
    """query_string이 None이면 스킵한다."""
    event = {"request": {"headers": {}, "query_string": None}}
    result = scrub_sentry_event(event)
    assert result["request"]["query_string"] is None


# ── _mask_sensitive_params 직접 테스트 ──────────────────────────────────


def test_mask_sensitive_params_masks_only_sensitive():
    """복합 쿼리 스트링에서 민감 파라미터만 마스킹된다."""
    result = _mask_sensitive_params("name=alice&password=pass&age=30&token=abc")
    assert "name=alice" in result
    assert "age=30" in result
    assert "password=[REDACTED]" in result
    assert "token=[REDACTED]" in result
    assert "pass" not in result.split("password=")[1].split("&")[0]


def test_mask_sensitive_params_no_equal_sign():
    """등호가 없는 파라미터는 그대로 보존된다."""
    result = _mask_sensitive_params("flagonly&key=val")
    assert "flagonly" in result
    assert "key=val" in result


# ── 복합 시나리오 ─────────────────────────────────────────────────────────


def test_scrubs_all_sensitive_fields_in_one_event():
    """Authorization 헤더 + password 바디가 모두 스크럽된다."""
    event = {
        "request": {
            "headers": {
                "Authorization": "Bearer jwt.token.here",
                "Content-Type": "application/json",
            },
            "query_string": "debug=true",
            "data": {
                "username": "admin",
                "password": "admin1234",
            },
        }
    }
    result = scrub_sentry_event(event)
    assert result["request"]["headers"]["Authorization"] == "[REDACTED]"
    assert result["request"]["headers"]["Content-Type"] == "application/json"
    assert result["request"]["data"]["password"] == "[REDACTED]"
    assert result["request"]["data"]["username"] == "admin"
    assert result["request"]["query_string"] == "debug=true"
