"""
시크릿 탐지 LangGraph 노드.

커밋 diff에서 AWS Key, GitHub PAT 등 시크릿 패턴을 정규식으로 탐지한다.
탐지 결과의 matched_value는 반드시 마스킹(***)하여 로그·응답에 실제 값이 노출되지 않도록 한다.

OTel span을 포함하며, 개별 커밋 처리 실패 시 skip & log (전체 세션 중단 금지).
"""
import logging
import math
import re
from typing import TypedDict

from opentelemetry import trace

from agent.agent_state import AgentState

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

# ─── 시크릿 탐지 정규식 패턴 ──────────────────────────────────────────────────

_SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    # AWS Access Key: AKIA + 정확히 16자리 대문자/숫자 (경계 검사 포함)
    ("AWS_ACCESS_KEY",  re.compile(r"(?<![A-Z0-9])(AKIA[0-9A-Z]{16})(?![A-Z0-9])")),
    # GitHub PAT: ghp_ 36자+, github_pat_ 82자+
    ("GITHUB_PAT",      re.compile(
        r"(?<![A-Za-z0-9])"
        r"(ghp_[a-zA-Z0-9]{36,}|github_pat_[a-zA-Z0-9_]{82,})"
        r"(?![A-Za-z0-9])"
    )),
    # GitHub Actions / OAuth / 기타 토큰 (ghs_, gho_, ghu_, ghr_)
    ("GITHUB_TOKEN",    re.compile(r"(?<![A-Za-z0-9])(gh[sousr]_[A-Za-z0-9_]{36,255})(?![A-Za-z0-9])")),
    # AWS Secret Access Key
    ("AWS_SECRET_KEY",  re.compile(
        r"(?i)aws[_\-\s]*secret[_\-\s]*access[_\-\s]*key\s*[=:]\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?"
    )),
    # Private Key 헤더
    ("PRIVATE_KEY",     re.compile(r"-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE KEY-----")),
    # Generic API Key / Secret
    ("GENERIC_API_KEY", re.compile(
        r"(?i)(?:api[_\-]?key|api[_\-]?secret|auth[_\-]?token)\s*[=:]\s*['\"]([A-Za-z0-9_\-]{20,})['\"]"
    )),
]

# diff에서 추가된 라인만 추출 (+로 시작, +++ 헤더 제외)
_ADDED_LINE_RE = re.compile(r"^\+(?!\+\+)(.*)$", re.MULTILINE)

# 더미/테스트 패턴 필터 — 1차 필터링으로 오탐 제거
_DUMMY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?i)(example|sample|dummy|fake|test|placeholder|your[-_]?(?:api[-_]?)?key(?:[-_]here)?|xxx+|abc+|changeme)"),
    re.compile(r"(?i)(TODO|FIXME|INSERT|REPLACE|<your|<enter)"),
]

# Shannon 엔트로피 > 이 값이면 고엔트로피 문자열로 판정
_ENTROPY_THRESHOLD = 4.5
# 고엔트로피 판정 최소 길이
_ENTROPY_MIN_LENGTH = 20

_MASKED_VALUE = "****"


# ─── 탐지 결과 타입 ──────────────────────────────────────────────────────────

class SecretFinding(TypedDict):
    pattern_type: str    # AWS_ACCESS_KEY | GITHUB_PAT | GENERIC_API_KEY | HIGH_ENTROPY
    file_path: str       # 파일 경로
    line_number: int     # 추가된 라인 번호 (1-based, 계산 불가 시 0)
    matched_value: str   # 실제 값 마스킹 — 항상 "****"
    sha: str             # 커밋 SHA


# ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

def _shannon_entropy(text: str) -> float:
    """Shannon 엔트로피를 계산한다 (bits per symbol)."""
    if not text:
        return 0.0
    length = len(text)
    freq: dict[str, int] = {}
    for ch in text:
        freq[ch] = freq.get(ch, 0) + 1
    return -sum(
        (count / length) * math.log2(count / length)
        for count in freq.values()
    )


def _is_high_entropy(value: str) -> bool:
    """길이 20+ 이고 Shannon 엔트로피가 임계값 초과이면 True를 반환한다."""
    return len(value) >= _ENTROPY_MIN_LENGTH and _shannon_entropy(value) > _ENTROPY_THRESHOLD


def _is_likely_dummy(value: str) -> bool:
    """테스트/예제용 더미일 가능성이 높으면 True를 반환한다."""
    return any(p.search(value) for p in _DUMMY_PATTERNS)


def _extract_added_lines(patch: str | None) -> list[tuple[int, str]]:
    """diff patch에서 추가된 라인(+로 시작)을 [(라인번호, 내용)] 목록으로 반환한다.

    라인 번호는 patch 내 추가 라인 순서 기준 1-based이며 실제 파일 라인 번호와 다를 수 있다.
    """
    if not patch:
        return []
    lines: list[tuple[int, str]] = []
    for idx, m in enumerate(_ADDED_LINE_RE.finditer(patch), start=1):
        lines.append((idx, m.group(1)))
    return lines


def _scan_single_diff(diff: dict) -> list[SecretFinding]:
    """단일 커밋 diff에서 시크릿을 탐지한다.

    matched_value는 항상 "****"로 마스킹하여 반환한다.
    실제 값은 이 함수 외부로 절대 유출하지 않는다.
    """
    findings: list[SecretFinding] = []
    sha = diff.get("sha", "")

    for file_info in diff.get("files", []):
        filename = file_info.get("filename", "")
        patch = file_info.get("patch")
        added_lines = _extract_added_lines(patch)

        for line_no, line_content in added_lines:
            # 1차: 정규식 패턴 매칭
            for pattern_type, pattern in _SECRET_PATTERNS:
                for match in pattern.finditer(line_content):
                    raw_value = match.group(1) if match.lastindex else match.group(0)
                    if _is_likely_dummy(raw_value):
                        continue
                    findings.append(SecretFinding(
                        pattern_type=pattern_type,
                        file_path=filename,
                        line_number=line_no,
                        matched_value=_MASKED_VALUE,   # 실제 값 절대 노출 금지
                        sha=sha,
                    ))

            # 2차: 고엔트로피 문자열 탐지
            # 공백 기준으로 토큰을 분리해 각 토큰의 엔트로피를 측정한다.
            for token in line_content.split():
                if _is_high_entropy(token) and not _is_likely_dummy(token):
                    findings.append(SecretFinding(
                        pattern_type="HIGH_ENTROPY",
                        file_path=filename,
                        line_number=line_no,
                        matched_value=_MASKED_VALUE,   # 실제 값 절대 노출 금지
                        sha=sha,
                    ))

    return findings


# ─── LangGraph 노드 ──────────────────────────────────────────────────────────

async def secret_scan_node(state: AgentState) -> AgentState:
    """커밋 diff 목록에서 시크릿을 탐지하는 LangGraph 노드.

    입력 state 키:
        commits: list[{sha, files: [{filename, patch}]}]

    출력 state 키:
        secrets_found: list[SecretFinding]

    동작 규칙:
    - 개별 커밋 처리 실패 시 skip & log (전체 세션 중단 금지).
    - matched_value는 항상 "****" 마스킹 — 실제 값 로그·응답 노출 금지.
    - OTel span으로 세션 및 탐지 결과를 추적한다.
    """
    session_id = state.get("session_id", "unknown")
    commits: list[dict] = state.get("commits", [])

    logger.info("[secret-scan-node] session=%s commits=%d", session_id, len(commits))

    all_findings: list[SecretFinding] = []

    with tracer.start_as_current_span("secret_scan_node") as span:
        span.set_attribute("session_id", session_id)
        span.set_attribute("commit_count", len(commits))

        for commit in commits:
            sha = "unknown"
            try:
                if not commit:
                    logger.warning(
                        "[secret-scan-node] session=%s received None commit — skipping",
                        session_id,
                    )
                    continue
                sha = commit.get("sha", "unknown")
                findings = _scan_single_diff(commit)
                all_findings.extend(findings)
                if findings:
                    # 탐지 결과는 sha와 패턴 타입만 기록 — 실제 값 로그 금지
                    detected_types = [f["pattern_type"] for f in findings]
                    logger.info(
                        "[secret-scan-node] session=%s sha=%s found=%d types=%s",
                        session_id, sha[:8], len(findings), detected_types,
                    )
            except Exception as exc:
                logger.warning(
                    "[secret-scan-node] session=%s sha=%s error=%s — skipping",
                    session_id, sha[:8] if len(sha) >= 8 else sha, exc,
                )
                # skip & log — 개별 커밋 오류로 전체 세션 중단 금지

        span.set_attribute("secrets_found", len(all_findings))
        logger.info(
            "[secret-scan-node] session=%s done commits=%d secrets=%d",
            session_id, len(commits), len(all_findings),
        )

    return {**state, "secrets_found": all_findings}
