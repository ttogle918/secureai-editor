"""
Python 파서 — stdlib `ast` 기반 라인 검증.

결정론적, LLM 미사용.
"""
import ast
import logging

logger = logging.getLogger(__name__)


def verify_line(file_content: str, line: int) -> dict:
    """Python 파일에서 지정 라인이 실재하는 비주석/비공백 코드 라인인지 검증한다.

    검증 전략:
    1. line이 파일 라인 수 범위 내인지 확인
    2. 해당 라인이 비공백/비주석인지 확인
    3. ast.parse로 전체 파일 구문 확인 (파서 에러 시 보류)

    Args:
        file_content: 파일 전체 내용 문자열
        line: 1-based 라인 번호

    Returns:
        {"verified": bool, "reason": str}
    """
    lines = file_content.splitlines()
    total_lines = len(lines)

    # 범위 검증
    if line < 1 or line > total_lines:
        return {
            "verified": False,
            "reason": f"line {line} out of range (file has {total_lines} lines)",
        }

    # 비공백/비주석 검증 (0-indexed)
    raw = lines[line - 1]
    stripped = raw.strip()
    if not stripped or stripped.startswith("#"):
        return {
            "verified": False,
            "reason": f"line {line} is empty or comment: {repr(stripped[:60])}",
        }

    # ast 구문 검증 — 파싱 실패 시 보류(통과)
    try:
        ast.parse(file_content, filename="<verify>")
    except SyntaxError as exc:
        logger.debug("[python_parser] syntax error — pass-through: %s", exc)
        return {"verified": True, "reason": "syntax error in file — pass-through"}

    return {"verified": True, "reason": "line exists and is non-comment code"}
