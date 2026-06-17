"""
AST 할루시네이션 가드 — 결정론적 검증 레이어 (VAL-3).

결정론적(LLM 미사용), 재현성 100%.

검증 전략 (MVP):
  1. file:line이 파일 라인 수 범위 내인가?
  2. 해당 라인이 비주석/비공백 실재 코드 라인인가?
  (source→sink 심층 검증은 Sprint 14 이월)

언어 지원:
  - Python  → stdlib `ast` (parsers/python.py)
  - Java    → `javalang`   (parsers/java.py)
  - TS/JS   → 정규식       (parsers/ts.py)
  - 미지원  → 보류(verified=True) — 거짓 폐기로 recall 훼손 금지

설계 원칙:
  - OCP: 새 언어 파서 추가 시 _PARSER_MAP에 등록만 하면 됨 (기존 코드 수정 불필요)
  - SRP: 파서별 책임 분리 (파서 파일 한 개당 한 언어)
  - 불확실 시 통과(recall 보호)
"""
import logging
import os
from typing import Callable, TypedDict

logger = logging.getLogger(__name__)

# 경로 순회 방어용 금지 패턴
_TRAVERSAL_PATTERNS = ("..", "~", "//")


class VerifyResult(TypedDict):
    verified: bool
    reason: str


# 확장자 → 파서 함수 매핑 (OCP: 확장 시 이 dict에만 추가)
# 파서 함수 시그니처: (file_content: str, line: int) -> VerifyResult
_PARSER_MAP: dict[str, Callable[[str, int], VerifyResult]] = {}


def _load_parsers() -> None:
    """파서 모듈을 지연 로드하여 _PARSER_MAP을 구성한다.

    ImportError가 발생해도 해당 파서만 제외하고 계속 진행한다.
    """
    global _PARSER_MAP  # noqa: PLW0603

    try:
        from agent.validation.parsers.python import verify_line as py_verify
        _PARSER_MAP[".py"] = py_verify
    except ImportError as exc:
        logger.warning("[ast_verifier] python parser load failed: %s", exc)

    try:
        from agent.validation.parsers.java import verify_line as java_verify
        _PARSER_MAP[".java"] = java_verify
        _PARSER_MAP[".kt"] = java_verify  # Kotlin도 Java 파서로 라인 기반 검증
    except ImportError as exc:
        logger.warning("[ast_verifier] java parser load failed: %s", exc)

    try:
        from agent.validation.parsers.ts import verify_line as ts_verify
        _PARSER_MAP[".ts"] = ts_verify
        _PARSER_MAP[".tsx"] = ts_verify
        _PARSER_MAP[".js"] = ts_verify
        _PARSER_MAP[".jsx"] = ts_verify
    except ImportError as exc:
        logger.warning("[ast_verifier] ts parser load failed: %s", exc)


# 모듈 import 시 파서 로드
_load_parsers()


def _is_safe_path(file_path: str) -> bool:
    """경로 순회 시도를 차단한다."""
    return not any(pat in file_path for pat in _TRAVERSAL_PATTERNS)


def verify_finding(finding: dict, file_content: str, language: str) -> VerifyResult:
    """finding 하나를 검증하고 결과를 반환한다.

    MVP 검증 = (1) file:line 범위 + (2) 비주석/비공백 라인 실재.

    불확실한 경우(파서 없음, 예외, line 정보 없음)는 항상 통과(recall 보호).

    Args:
        finding: SAST 결과 dict (line, file 키 포함)
        file_content: 해당 파일의 전체 내용
        language: 파일 언어 ("python" | "java" | "typescript" | "javascript" | ...)

    Returns:
        VerifyResult: {"verified": bool, "reason": str}
    """
    # file 경로 순회 방어
    file_path: str = finding.get("file", "")
    if file_path and not _is_safe_path(file_path):
        logger.warning("[ast_verifier] path traversal attempt blocked: %s", file_path)
        return {"verified": True, "reason": "path traversal blocked — pass-through"}

    # line 정보 없으면 file 존재만 확인 (line 0, None, 빈 값 모두 포함)
    raw_line = finding.get("line")
    if raw_line is None or raw_line == 0 or raw_line == "":
        if not file_content:
            return {"verified": False, "reason": "file content is empty and line is missing"}
        return {"verified": True, "reason": "no line info — file existence confirmed, pass-through"}

    try:
        line = int(raw_line)
    except (TypeError, ValueError):
        return {"verified": True, "reason": f"non-integer line={raw_line!r} — pass-through"}

    # 파일 내용 없으면 보류
    if not file_content:
        return {"verified": True, "reason": "file content unavailable — pass-through"}

    # 확장자로 파서 선택
    ext = _ext_for_language(language, file_path)
    parser = _PARSER_MAP.get(ext)

    if parser is None:
        return {"verified": True, "reason": f"unsupported language={language!r} — pass-through"}

    try:
        return parser(file_content, line)
    except Exception as exc:
        logger.warning(
            "[ast_verifier] parser error file=%s line=%d lang=%s: %s",
            file_path, line, language, exc,
        )
        return {"verified": True, "reason": f"parser exception — pass-through: {exc}"}


def _ext_for_language(language: str, file_path: str) -> str:
    """언어 이름 또는 파일 경로에서 확장자를 결정한다.

    파일 경로에서 직접 추출한 확장자를 우선한다.
    언어 이름 매핑은 파일 경로 확장자 감지 실패 시 fallback으로 사용한다.
    """
    # 파일 경로 기반 확장자 우선
    if file_path:
        _, ext = os.path.splitext(file_path)
        if ext:
            return ext.lower()

    # 언어 이름 → 확장자 fallback 매핑
    _LANG_TO_EXT: dict[str, str] = {
        "python": ".py",
        "java": ".java",
        "kotlin": ".kt",
        "typescript": ".ts",
        "javascript": ".js",
    }
    return _LANG_TO_EXT.get(language.lower(), "")
