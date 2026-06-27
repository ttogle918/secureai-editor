"""
CWE/OWASP 분류 자동 매핑 및 callChain 구성 모듈.

- normalize_vuln: type 필드 기준으로 cwe/owasp 표준값을 보완한다.
- build_call_chain: 파일 경로와 취약점 위치를 기반으로 호출 경로를 추론한다.
- classify_and_enrich: 위 두 함수를 취약점 목록에 일괄 적용한다.

외부 I/O 없는 순수 함수 모듈 — code_chunker.py와 동일 패턴.
"""
import re
from pathlib import Path

# OWASP Top 10 2021 기준 매핑 테이블.
# 형식: "TYPE": ("CWE-XXX", "AXX:2021")
_CWE_OWASP_MAP: dict[str, tuple[str, str]] = {
    "SQL_INJECTION":            ("CWE-89",  "A03:2021"),
    "XSS":                      ("CWE-79",  "A03:2021"),
    "CROSS_SITE_SCRIPTING":     ("CWE-79",  "A03:2021"),
    "PATH_TRAVERSAL":           ("CWE-22",  "A01:2021"),
    "COMMAND_INJECTION":        ("CWE-78",  "A03:2021"),
    "IDOR":                     ("CWE-284", "A01:2021"),
    "BROKEN_ACCESS_CONTROL":    ("CWE-284", "A01:2021"),
    "INSECURE_DESERIALIZATION": ("CWE-502", "A08:2021"),
    "XXE":                      ("CWE-611", "A05:2021"),
    "SSRF":                     ("CWE-918", "A10:2021"),
    "OPEN_REDIRECT":            ("CWE-601", "A01:2021"),
    "HARDCODED_CREDENTIALS":    ("CWE-798", "A07:2021"),
    "WEAK_CRYPTOGRAPHY":        ("CWE-327", "A02:2021"),
    "INSECURE_RANDOM":          ("CWE-338", "A02:2021"),
    "SENSITIVE_DATA_EXPOSURE":  ("CWE-200", "A02:2021"),
    "SENSITIVE_DATA_IN_URL":    ("CWE-200", "A02:2021"),
    "CSRF":                     ("CWE-352", "A01:2021"),
    "LOG_INJECTION":            ("CWE-117", "A09:2021"),
    "LDAP_INJECTION":           ("CWE-90",  "A03:2021"),
    "XPATH_INJECTION":          ("CWE-643", "A03:2021"),
    "UNVALIDATED_REDIRECT":     ("CWE-601", "A01:2021"),
    "SECURITY_MISCONFIGURATION":("CWE-16",  "A05:2021"),
    "MISSING_AUTH":             ("CWE-306", "A07:2021"),
    "JWT_NONE_ALGORITHM":       ("CWE-347", "A02:2021"),
}

# 파일 경로 내 키워드로 계층을 감지한다.
# 값은 계층 레이블이며 callChain 체인 순서 결정에 사용된다.
_LAYER_KEYWORDS: dict[str, str] = {
    "controller": "Controller",
    "service":    "Service",
    "repository": "Repository",
    "mapper":     "Repository",   # MyBatis
    "dao":        "Repository",
    "handler":    "Controller",
    "resolver":   "Service",
    "route":      "Controller",   # FastAPI/Express
    "router":     "Controller",
    "view":       "Frontend",
    "component":  "Frontend",
    "page":       "Frontend",
    "template":   "Frontend",
}

# 계층 순서: Frontend → Controller → Service → Repository
_LAYER_ORDER: list[str] = ["Frontend", "Controller", "Service", "Repository"]

# 취약점 유형별 메서드 이름 추정 패턴
_METHOD_HINTS: dict[str, str] = {
    "SQL_INJECTION":  "findById",
    "IDOR":           "findById",
    "SENSITIVE_DATA_IN_URL": "findById",
    "XSS":            "render",
    "LOG_INJECTION":  "log",
    "COMMAND_INJECTION": "execute",
    "PATH_TRAVERSAL": "readFile",
    "SSRF":           "fetchUrl",
}
_DEFAULT_METHOD = "process"


def normalize_vuln(vuln: dict) -> dict:
    """취약점 dict의 cwe/owasp 필드를 표준값으로 보완한 새 dict를 반환한다.

    - type을 대문자로 정규화 후 _CWE_OWASP_MAP에서 조회한다.
    - cwe/owasp가 이미 있으면 덮어쓰지 않는다.
    - 매핑에 없는 type이면 cwe/owasp는 빈 문자열로 유지한다.
    - 원본 dict를 수정하지 않고 새 dict를 반환한다.
    """
    vuln_type = vuln.get("type", "").upper()
    mapped_cwe, mapped_owasp = _CWE_OWASP_MAP.get(vuln_type, ("", ""))

    return {
        **vuln,
        "cwe":   vuln.get("cwe") or mapped_cwe,
        "owasp": vuln.get("owasp") or mapped_owasp,
    }


def _detect_layer(file_path: str) -> str | None:
    """파일 경로에서 계층 키워드를 탐지해 계층 레이블을 반환한다."""
    lower = file_path.lower()
    for keyword, layer in _LAYER_KEYWORDS.items():
        if keyword in lower:
            return layer
    return None


def _to_pascal_case(stem: str) -> str:
    """파일명 스템을 PascalCase 클래스명으로 변환한다.

    예: "user_controller" → "UserController", "UserController" → "UserController"
    """
    parts = re.split(r"[_\-\s]+", stem)
    if len(parts) == 1:
        # 구분자 없음 → 이미 PascalCase이거나 단일 단어; 첫 글자만 대문자 보장
        return stem[0].upper() + stem[1:] if stem else stem
    return "".join(p.capitalize() for p in parts if p)


def _method_for_type(vuln_type: str) -> str:
    """취약점 유형에 맞는 메서드 이름을 반환한다."""
    return _METHOD_HINTS.get(vuln_type.upper(), _DEFAULT_METHOD)


def build_call_chain(vuln: dict, file_path: str) -> list[str]:
    """파일 경로와 취약점 정보를 기반으로 호출 경로를 추론한다.

    callChain은 추론값이므로 정확도보다 일관된 형식이 중요하다.
    빈 리스트보다 추론된 체인이 항상 낫다.

    계층 감지 규칙:
    - 파일 경로 내 키워드(_LAYER_KEYWORDS)로 현재 계층 결정
    - 감지된 계층 위치부터 Repository까지 체인 구성
    - 감지 불가 시 단일 항목 체인 반환
    """
    stem = Path(file_path).stem
    class_name = _to_pascal_case(stem)
    vuln_type = vuln.get("type", "")
    method = _method_for_type(vuln_type)

    layer = _detect_layer(file_path)

    if layer is None:
        # 계층 감지 불가 → 단일 항목
        return [f"{class_name}.{method}"]

    layer_index = _LAYER_ORDER.index(layer) if layer in _LAYER_ORDER else len(_LAYER_ORDER)

    # 감지된 계층부터 Repository까지 체인 구성
    # 각 계층의 클래스명은 계층 레이블을 class_name 접미어로 붙여 생성한다.
    # 단, 감지된 계층의 클래스명은 실제 파일명(class_name)을 우선 사용한다.
    chain: list[str] = []
    for i, layer_label in enumerate(_LAYER_ORDER[layer_index:], start=layer_index):
        if i == layer_index:
            # 현재 파일의 실제 클래스명 사용
            node_class = class_name
        else:
            # 후속 계층은 기본 클래스명 + 계층 접미어로 추정
            # 예: "User" + "Service" → "UserService"
            base = _strip_layer_suffix(class_name)
            node_class = f"{base}{layer_label}"
        chain.append(f"{node_class}.{method}")

    return chain


def _strip_layer_suffix(class_name: str) -> str:
    """클래스명에서 계층 접미어를 제거해 기본 도메인 이름을 추출한다.

    예: "UserController" → "User", "UserService" → "User", "User" → "User"
    """
    for layer in _LAYER_ORDER:
        if class_name.endswith(layer):
            return class_name[: -len(layer)]
    return class_name


def classify_and_enrich(vulns: list[dict], file_path: str) -> list[dict]:
    """취약점 목록에 CWE/OWASP 정규화와 callChain을 추가한다."""
    return [
        {**normalize_vuln(v), "callChain": build_call_chain(v, file_path)}
        for v in vulns
    ]
