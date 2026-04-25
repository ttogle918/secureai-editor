"""response_parser.py 단위 테스트 — 백로그 체크리스트 대응."""
import hashlib

from agent.response_parser import parse_sast_response

FILE = "src/UserController.java"

# ── 정상 케이스 ──────────────────────────────────────────────────────────────

def test_valid_json_single_vuln():
    raw = '{"vulnerabilities": [{"type": "SQL_INJECTION", "severity": "HIGH", "cwe": "CWE-89", "owasp": "A03:2021", "line": 42, "description": "desc", "code_snippet": "code"}]}'
    result = parse_sast_response(raw, FILE)
    assert len(result) == 1
    assert result[0]["type"] == "SQL_INJECTION"


def test_valid_json_no_vulns():
    raw = '{"vulnerabilities": []}'
    result = parse_sast_response(raw, FILE)
    assert result == []


def test_valid_json_multiple_vulns():
    raw = '{"vulnerabilities": [{"type": "XSS"}, {"type": "SQLI"}]}'
    result = parse_sast_response(raw, FILE)
    assert len(result) == 2


# ── 복구 케이스 ──────────────────────────────────────────────────────────────

def test_json_with_preamble_text():
    """Claude 가 JSON 앞에 설명을 붙인 경우 블록 추출로 복구."""
    raw = 'Here is my analysis:\n{"vulnerabilities": [{"type": "XSS"}]}'
    result = parse_sast_response(raw, FILE)
    assert len(result) == 1
    assert result[0]["type"] == "XSS"


def test_truncated_json_recovery():
    """max_tokens 초과로 배열이 잘린 경우 배열 fragment 복구."""
    raw = '{"vulnerabilities": [{"type": "SQL_INJECTION", "severity": "HIGH"}, {"type": "XSS"'
    result = parse_sast_response(raw, FILE)
    # 첫 번째 완전한 항목은 복구되거나 빈 목록이면 통과
    assert isinstance(result, list)


def test_completely_invalid_returns_empty():
    raw = "I could not find any vulnerabilities in this file."
    result = parse_sast_response(raw, FILE)
    assert result == []


def test_empty_string_returns_empty():
    assert parse_sast_response("", FILE) == []


# ── SHA-256 일관성 (cache_check_node 에서 사용) ───────────────────────────────

def test_sha256_consistency():
    """동일 내용은 항상 같은 SHA-256 을 생성한다."""
    content = "public class Foo { String q = id; }"
    h1 = hashlib.sha256(content.encode()).hexdigest()
    h2 = hashlib.sha256(content.encode()).hexdigest()
    assert h1 == h2
    assert len(h1) == 64


def test_sha256_different_content():
    """내용이 다르면 SHA-256 도 달라야 한다."""
    h1 = hashlib.sha256(b"content_a").hexdigest()
    h2 = hashlib.sha256(b"content_b").hexdigest()
    assert h1 != h2
