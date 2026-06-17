"""
Java 파서 — `javalang` 기반 라인 검증.

결정론적, LLM 미사용.
javalang 미설치 시 ImportError → ast_verifier에서 보류 처리.
"""
import logging
import re

logger = logging.getLogger(__name__)

# 단행 주석 패턴 (// 로 시작)
_SINGLE_LINE_COMMENT = re.compile(r"^\s*//")
# 블록 주석 시작/끝 패턴
_BLOCK_COMMENT_START = re.compile(r"^\s*/\*")
_BLOCK_COMMENT_END = re.compile(r"\*/")


def _classify_lines(lines: list[str]) -> list[bool]:
    """각 라인이 실질 코드(True)인지 아닌지(False)를 반환한다.

    블록 주석 내부 라인과 단행 주석, 공백 라인은 False로 분류한다.
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
            # 같은 라인에 블록 끝이 있으면 단일 라인 블록 주석
            if _BLOCK_COMMENT_END.search(stripped[2:]):
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
    """Java 파일에서 지정 라인이 실재하는 비주석/비공백 코드 라인인지 검증한다.

    javalang AST 파싱을 시도하고, 실패 시 라인 기반 검증만 수행한다.

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

    # 라인 분류
    is_code = _classify_lines(lines)
    if not is_code[line - 1]:
        raw = lines[line - 1]
        return {
            "verified": False,
            "reason": f"line {line} is empty or comment: {repr(raw.strip()[:60])}",
        }

    # javalang AST 구문 검증 시도 — 실패 시 라인 검증 결과만 사용
    try:
        import javalang  # noqa: PLC0415
        javalang.parse.parse(file_content)
    except ImportError:
        logger.debug("[java_parser] javalang not installed — skipping AST check")
    except Exception as exc:
        logger.debug("[java_parser] parse error — pass-through: %s", exc)
        return {"verified": True, "reason": "java parse error — pass-through"}

    return {"verified": True, "reason": "line exists and is non-comment Java code"}
