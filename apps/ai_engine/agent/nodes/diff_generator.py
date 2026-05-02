"""
unified diff 생성 및 Claude 응답 파싱 — 순수 함수 모듈.

외부 I/O 없음. 테스트에서 네트워크/Redis 없이 단독 실행 가능하다.
"""
import difflib
import json
import logging
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)


@dataclass
class PatchResult:
    file_path: str
    vuln_type: str
    original_snippet: str
    patched_snippet: str
    unified_diff: str
    explanation: str

    def to_dict(self) -> dict:
        return asdict(self)


def generate_unified_diff(original: str, patched: str, file_path: str) -> str:
    """두 코드 문자열 사이의 unified diff를 반환한다.

    difflib 표준 형식(--- / +++ / @@ 헤더 포함)을 생성한다.
    원본과 수정본이 동일하면 빈 문자열을 반환한다.
    """
    original_lines = original.splitlines(keepends=True)
    patched_lines = patched.splitlines(keepends=True)

    diff_lines = list(
        difflib.unified_diff(
            original_lines,
            patched_lines,
            fromfile=f"--- {file_path}",
            tofile=f"+++ {file_path}",
        )
    )
    return "".join(diff_lines)


def parse_patch_response(raw: str, vuln: dict, file_path: str) -> "PatchResult | None":
    """Claude 응답 텍스트를 파싱해 PatchResult를 반환한다.

    JSON 파싱 실패, 필수 필드 누락, 빈 diff 등 오류 발생 시 None을 반환하고
    경고 로그를 남긴다. 호출자가 None을 보고 해당 취약점을 스킵하도록 설계됐다.
    """
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.warning("[diff-gen] JSON parse error file=%s vuln=%s: %s", file_path, vuln.get("type"), exc)
        return None

    patched_snippet = data.get("patched_snippet", "").strip()
    unified_diff = data.get("unified_diff", "").strip()
    explanation = data.get("explanation", "").strip()

    if not patched_snippet:
        logger.warning("[diff-gen] empty patched_snippet file=%s vuln=%s", file_path, vuln.get("type"))
        return None

    original_snippet = vuln.get("code_snippet", "") or ""

    # unified_diff가 비어 있으면 원본과 수정본으로 직접 생성한다
    if not unified_diff:
        unified_diff = generate_unified_diff(original_snippet, patched_snippet, file_path)

    return PatchResult(
        file_path=file_path,
        vuln_type=vuln.get("type", "UNKNOWN"),
        original_snippet=original_snippet,
        patched_snippet=patched_snippet,
        unified_diff=unified_diff,
        explanation=explanation,
    )
