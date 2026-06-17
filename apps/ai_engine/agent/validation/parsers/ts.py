"""
TypeScript/JavaScript 파서 — 정규식 라인 범위 기반 검증.

tree-sitter 없이 정규식만으로 주석/공백 라인을 판별한다.
결정론적, LLM 미사용.
"""
import logging
import re

logger = logging.getLogger(__name__)

# 단행 주석 패턴
_SINGLE_LINE_COMMENT = re.compile(r"^\s*//")
# 블록 주석 시작 패턴
_BLOCK_COMMENT_START = re.compile(r"^\s*/\*")
# 블록 주석 종료 패턴
_BLOCK_COMMENT_END = re.compile(r"\*/")


def _classify_lines(lines: list[str]) -> list[bool]:
    """각 라인이 실질 코드(True)인지 아닌지(False)를 반환한다.

    블록 주석, 단행 주석, 빈 줄은 False 처리한다.
    """
    result: list[bool] = []
    in_block_comment = False

    for raw in lines:
        stripped = raw.strip()

        if in_block_comment:
            if _BLOCK_COMMENT_END.search(stripped):
                in_block_comment = False
            result.append(False)
            continue

        if not stripped:
            result.append(False)
            continue

        if _BLOCK_COMMENT_START.match(stripped):
            if _BLOCK_COMMENT_END.search(stripped[2:]):
                # 같은 라인에서 끝나는 블록 주석
                result.append(False)
            else:
                in_block_comment = True
                result.append(False)
            continue

        if _SINGLE_LINE_COMMENT.match(stripped):
            result.append(False)
            continue

        result.append(True)

    return result


def verify_line(file_content: str, line: int) -> dict:
    """TypeScript/JavaScript 파일에서 지정 라인이 실재하는 비주석/비공백 코드 라인인지 검증한다.

    정규식 기반 라인 분류를 사용한다. (tree-sitter 미사용)

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

    is_code = _classify_lines(lines)
    if not is_code[line - 1]:
        raw = lines[line - 1]
        return {
            "verified": False,
            "reason": f"line {line} is empty or comment: {repr(raw.strip()[:60])}",
        }

    return {"verified": True, "reason": "line exists and is non-comment code"}
