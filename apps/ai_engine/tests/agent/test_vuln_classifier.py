"""
TASK-302 — vuln_classifier.py 단위 테스트.

CWE/OWASP 매핑 정규화 및 callChain 구성 로직을 검증한다.
"""
import pytest

from agent.nodes.vuln_classifier import (
    build_call_chain,
    classify_and_enrich,
    normalize_vuln,
)


# ---------------------------------------------------------------------------
# normalize_vuln — CWE/OWASP 매핑
# ---------------------------------------------------------------------------

def test_sql_injection_cwe_owasp():
    """SQL_INJECTION → CWE-89, OWASP A03:2021 매핑."""
    vuln = {"type": "SQL_INJECTION", "severity": "HIGH", "line": 42}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-89"
    assert result["owasp"] == "A03:2021"


def test_xss_cwe_owasp():
    """XSS → CWE-79, OWASP A03:2021 매핑."""
    vuln = {"type": "XSS", "severity": "MEDIUM", "line": 10}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-79"
    assert result["owasp"] == "A03:2021"


def test_idor_cwe_owasp():
    """IDOR → CWE-284, OWASP A01:2021 매핑."""
    vuln = {"type": "IDOR", "severity": "HIGH", "line": 5}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-284"
    assert result["owasp"] == "A01:2021"


def test_path_traversal_cwe_owasp():
    """PATH_TRAVERSAL → CWE-22, OWASP A01:2021 매핑."""
    vuln = {"type": "PATH_TRAVERSAL", "severity": "HIGH", "line": 20}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-22"
    assert result["owasp"] == "A01:2021"


def test_ssrf_cwe_owasp():
    """SSRF → CWE-918, OWASP A10:2021 매핑."""
    vuln = {"type": "SSRF", "severity": "HIGH", "line": 33}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-918"
    assert result["owasp"] == "A10:2021"


def test_hardcoded_credentials_cwe_owasp():
    """HARDCODED_CREDENTIALS → CWE-798, OWASP A07:2021 매핑."""
    vuln = {"type": "HARDCODED_CREDENTIALS", "severity": "CRITICAL", "line": 3}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-798"
    assert result["owasp"] == "A07:2021"


# ---------------------------------------------------------------------------
# normalize_vuln — 기존 값 보존 및 원본 불변성
# ---------------------------------------------------------------------------

def test_existing_cwe_preserved():
    """기존 cwe 값이 있으면 덮어쓰지 않는다."""
    vuln = {"type": "SQL_INJECTION", "cwe": "CWE-89", "owasp": "A03:2021"}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-89"
    assert result["owasp"] == "A03:2021"


def test_existing_cwe_custom_value_preserved():
    """기존에 다른 cwe 값이 있어도 덮어쓰지 않는다."""
    vuln = {"type": "SQL_INJECTION", "cwe": "CWE-99", "owasp": "A01:2021"}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-99"
    assert result["owasp"] == "A01:2021"


def test_normalize_does_not_mutate_original():
    """normalize_vuln은 원본 dict를 수정하지 않는다."""
    vuln = {"type": "XSS", "severity": "MEDIUM"}
    original_keys = set(vuln.keys())
    _ = normalize_vuln(vuln)
    assert set(vuln.keys()) == original_keys
    assert "cwe" not in vuln
    assert "owasp" not in vuln


# ---------------------------------------------------------------------------
# normalize_vuln — 알 수 없는 타입
# ---------------------------------------------------------------------------

def test_unknown_type_returns_empty_strings():
    """알 수 없는 타입이면 cwe/owasp를 빈 문자열로 채운다."""
    vuln = {"type": "UNKNOWN_VULN", "severity": "LOW"}
    result = normalize_vuln(vuln)
    assert result.get("cwe", "") == ""
    assert result.get("owasp", "") == ""


def test_empty_type_returns_empty_strings():
    """type 필드가 없으면 cwe/owasp를 빈 문자열로 채운다."""
    vuln = {"severity": "LOW", "line": 1}
    result = normalize_vuln(vuln)
    assert result.get("cwe", "") == ""
    assert result.get("owasp", "") == ""


# ---------------------------------------------------------------------------
# normalize_vuln — 대소문자 무관 정규화
# ---------------------------------------------------------------------------

def test_case_insensitive_type_lower():
    """소문자 타입 "sql_injection" → CWE-89 매핑."""
    vuln = {"type": "sql_injection", "severity": "HIGH"}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-89"


def test_case_insensitive_type_mixed():
    """혼합 대소문자 "Sql_Injection" → CWE-89 매핑."""
    vuln = {"type": "Sql_Injection", "severity": "HIGH"}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-89"


def test_case_insensitive_type_xss():
    """소문자 "xss" → CWE-79 매핑."""
    vuln = {"type": "xss"}
    result = normalize_vuln(vuln)
    assert result["cwe"] == "CWE-79"


# ---------------------------------------------------------------------------
# build_call_chain — 계층별 callChain 구성
# ---------------------------------------------------------------------------

def test_call_chain_controller_layer():
    """Controller 파일에서 callChain에 Controller와 하위 계층이 포함된다."""
    vuln = {"type": "SQL_INJECTION", "line": 42}
    chain = build_call_chain(vuln, "src/main/java/io/secureai/UserController.java")
    assert len(chain) >= 2
    assert any("Controller" in node for node in chain)
    assert any("Service" in node or "Repository" in node for node in chain)


def test_call_chain_service_layer():
    """Service 파일에서 callChain에 Service와 Repository가 포함된다."""
    vuln = {"type": "SQL_INJECTION", "line": 15}
    chain = build_call_chain(vuln, "src/main/java/io/secureai/UserService.java")
    assert len(chain) >= 1
    assert any("Service" in node for node in chain)


def test_call_chain_repository_layer():
    """Repository 파일에서 callChain은 단일 Repository 항목이다."""
    vuln = {"type": "SQL_INJECTION", "line": 8}
    chain = build_call_chain(vuln, "src/main/java/io/secureai/UserRepository.java")
    assert len(chain) == 1
    assert "Repository" in chain[0]


def test_call_chain_unknown_layer_single_item():
    """계층 감지 불가 파일은 단일 항목 체인을 반환한다."""
    vuln = {"type": "XSS", "line": 5}
    chain = build_call_chain(vuln, "src/utils/helper.js")
    assert len(chain) == 1
    assert "Helper" in chain[0] or "helper" in chain[0].lower()


def test_call_chain_frontend_layer():
    """Frontend component 파일은 Frontend → Controller → Service → Repository 체인."""
    vuln = {"type": "XSS", "line": 10}
    chain = build_call_chain(vuln, "src/components/UserComponent.tsx")
    assert len(chain) >= 2
    assert any("Component" in node or "Frontend" in node.lower() for node in chain)


def test_call_chain_returns_list():
    """build_call_chain은 항상 리스트를 반환한다."""
    vuln = {"type": "CSRF", "line": 1}
    chain = build_call_chain(vuln, "src/any/file.py")
    assert isinstance(chain, list)
    assert len(chain) >= 1


def test_call_chain_not_empty():
    """callChain은 항상 비어있지 않다 (빈 리스트보다 추론된 체인이 낫다)."""
    vuln = {"type": "SQL_INJECTION", "line": 42}
    chain = build_call_chain(vuln, "src/main/java/io/secureai/UserController.java")
    assert len(chain) > 0


def test_call_chain_mybatis_mapper_treated_as_repository():
    """MyBatis Mapper 파일은 Repository 계층으로 처리된다."""
    vuln = {"type": "SQL_INJECTION", "line": 5}
    chain = build_call_chain(vuln, "src/mapper/UserMapper.java")
    assert len(chain) == 1
    assert "Mapper" in chain[0] or "Repository" in chain[0].lower() or "mapper" in chain[0].lower()


# ---------------------------------------------------------------------------
# classify_and_enrich — 일괄 처리
# ---------------------------------------------------------------------------

def test_classify_and_enrich_count():
    """classify_and_enrich 결과 수가 입력과 동일하다."""
    vulns = [
        {"type": "SQL_INJECTION", "severity": "HIGH", "line": 1},
        {"type": "XSS", "severity": "MEDIUM", "line": 2},
        {"type": "IDOR", "severity": "HIGH", "line": 3},
    ]
    result = classify_and_enrich(vulns, "src/UserController.java")
    assert len(result) == len(vulns)


def test_classify_and_enrich_adds_cwe_and_owasp():
    """classify_and_enrich 후 모든 항목에 cwe, owasp, callChain이 포함된다."""
    vulns = [
        {"type": "SQL_INJECTION", "severity": "HIGH", "line": 10},
    ]
    result = classify_and_enrich(vulns, "src/UserController.java")
    item = result[0]
    assert "cwe" in item
    assert "owasp" in item
    assert "callChain" in item
    assert item["cwe"] == "CWE-89"


def test_classify_and_enrich_empty_list():
    """빈 목록 입력 시 빈 목록을 반환한다."""
    result = classify_and_enrich([], "src/UserController.java")
    assert result == []


def test_classify_and_enrich_preserves_original_fields():
    """classify_and_enrich는 기존 필드를 보존한다."""
    vulns = [
        {"type": "XSS", "severity": "HIGH", "line": 5, "description": "desc", "code_snippet": "code"},
    ]
    result = classify_and_enrich(vulns, "src/view/UserView.html")
    item = result[0]
    assert item["severity"] == "HIGH"
    assert item["line"] == 5
    assert item["description"] == "desc"
    assert item["code_snippet"] == "code"


def test_classify_and_enrich_call_chain_is_list():
    """classify_and_enrich 후 callChain은 항상 리스트다."""
    vulns = [{"type": "SQL_INJECTION", "line": 1}]
    result = classify_and_enrich(vulns, "src/UserRepository.java")
    assert isinstance(result[0]["callChain"], list)
