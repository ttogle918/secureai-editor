"""
POST /agent/scan-commits — GitHub 커밋 히스토리 시크릿 스캔

처리 흐름:
1. github_list_commits MCP 툴로 커밋 목록 조회
2. github_get_commit_diff MCP 툴로 각 커밋 diff 획득
3. 정규식으로 1차 패턴 매칭 (AWS Key, GitHub Token, JWT, Private Key 등)
4. Claude로 2차 분류 (실제 시크릿 vs 테스트 더미)
5. Backend /api/v1/internal/vulnerabilities 에 결과 저장
"""
import hashlib
import json
import logging
import re
from typing import Any

import httpx
from fastapi import APIRouter, BackgroundTasks, status
from pydantic import BaseModel

from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["secret-scan"])

# ─── 시크릿 패턴 정규식 ──────────────────────────────────────────────────────────

_SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("AWS_ACCESS_KEY",     re.compile(r"(?<![A-Z0-9])(AKIA[0-9A-Z]{16})(?![A-Z0-9])")),
    ("AWS_SECRET_KEY",     re.compile(r"(?i)aws[_\-\s]*secret[_\-\s]*access[_\-\s]*key\s*[=:]\s*['\"]?([A-Za-z0-9/+=]{40})['\"]?")),
    ("GITHUB_TOKEN",       re.compile(r"(?<![A-Za-z0-9])(gh[pousr]_[A-Za-z0-9_]{36,255})(?![A-Za-z0-9])")),
    ("JWT_TOKEN",          re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("PRIVATE_KEY",        re.compile(r"-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE KEY-----")),
    ("GENERIC_API_KEY",    re.compile(r"(?i)(?:api[_\-]?key|api[_\-]?secret|auth[_\-]?token)\s*[=:]\s*['\"]([A-Za-z0-9_\-]{20,})['\"]")),
    ("GOOGLE_API_KEY",     re.compile(r"(?<![A-Za-z0-9])AIza[0-9A-Za-z\-_]{35}(?![A-Za-z0-9])")),
    ("SLACK_TOKEN",        re.compile(r"(?<![A-Za-z0-9])xox[baprs]-[0-9A-Za-z\-]{10,}(?![A-Za-z0-9])")),
]

# diff에서 추가된 라인만 추출 (+로 시작, +++ 헤더 제외)
_ADDED_LINE_PATTERN = re.compile(r"^\+(?!\+\+)(.*)$", re.MULTILINE)

# 시크릿이 아닌 테스트/예시 패턴 — 1차 필터
_DUMMY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?i)(example|sample|dummy|fake|test|placeholder|your[-_]?(?:api[-_]?)?key(?:[-_]here)?|xxx+|abc+|123456789|changeme)"),
    re.compile(r"(?i)(TODO|FIXME|INSERT|REPLACE|<your|<enter)"),
    re.compile(r"(?i)[-_](here|goes|here|value|token)$"),
]


# ─── Request / Response ───────────────────────────────────────────────────────

class CommitScanRequest(BaseModel):
    session_id: str
    project_id: str
    owner: str
    repo: str
    ref: str | None = None
    github_token: str | None = None    # 로그에 절대 출력 금지
    per_page: int = 30
    preferred_model: str | None = None
    user_api_key: str | None = None    # BYOK 복호화 키 (로그 출력 금지)


class CommitScanResponse(BaseModel):
    session_id: str
    status: str
    commits_scanned: int
    secrets_found: int


# ─── Router ───────────────────────────────────────────────────────────────────

@router.post(
    "/scan-commits",
    response_model=CommitScanResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def scan_commits(req: CommitScanRequest, background_tasks: BackgroundTasks):
    """GitHub 커밋 히스토리에서 시크릿을 스캔한다 (비동기 백그라운드 실행)."""
    background_tasks.add_task(_run_secret_scan, req)
    return CommitScanResponse(
        session_id=req.session_id,
        status="accepted",
        commits_scanned=0,
        secrets_found=0,
    )


# ─── 내부 MCP HTTP 클라이언트 ─────────────────────────────────────────────────

async def _call_mcp_tool(tool_name: str, args: dict[str, Any]) -> Any:
    """MCP 서버의 stdio 툴을 직접 호출하는 대신,
    AI Engine 내부 httpx 를 통해 GitHub REST API를 호출한다.

    주의: 시크릿 스캔은 독립적인 API 경로이므로 LangGraph MCP 세션 없이
    GitHub REST API를 직접 호출한다.
    """
    raise NotImplementedError(f"MCP tool {tool_name} — use _github_* helpers instead")


async def _github_list_commits(
    owner: str, repo: str, ref: str | None, per_page: int, token: str | None
) -> list[dict]:
    """GitHub REST API로 커밋 목록을 조회한다."""
    headers = _build_github_headers(token)
    params: dict[str, Any] = {"per_page": min(max(1, per_page), 100)}
    if ref:
        params["sha"] = ref

    url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers, params=params)
        resp.raise_for_status()
        items = resp.json()

    return [
        {
            "sha":     item["sha"],
            "message": (item.get("commit", {}).get("message", "") or "").split("\n")[0],
            "date":    item.get("commit", {}).get("author", {}).get("date", ""),
            "author":  (item.get("author") or {}).get("login", "unknown"),
        }
        for item in items
    ]


async def _github_get_commit_diff(
    owner: str, repo: str, sha: str, token: str | None
) -> dict:
    """GitHub REST API로 특정 커밋의 diff를 조회한다."""
    headers = _build_github_headers(token)
    url = f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    commit_data = data.get("commit", {})
    return {
        "sha":     sha,
        "message": (commit_data.get("message", "") or "").split("\n")[0],
        "date":    commit_data.get("author", {}).get("date", ""),
        "files": [
            {
                "filename": f.get("filename", ""),
                "patch":    f.get("patch"),
                "status":   f.get("status", ""),
            }
            for f in data.get("files", [])
        ],
    }


def _build_github_headers(token: str | None) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "secureai-mcp/1.0",
    }
    effective_token = token or settings.github_token if hasattr(settings, "github_token") else token
    if effective_token:
        headers["Authorization"] = f"Bearer {effective_token}"
        # token은 로그에 절대 출력 금지
    return headers


# ─── 시크릿 탐지 로직 ─────────────────────────────────────────────────────────

def _extract_added_lines(patch: str | None) -> str:
    """diff patch에서 추가된 라인(+로 시작)만 추출한다."""
    if not patch:
        return ""
    return "\n".join(
        m.group(1) for m in _ADDED_LINE_PATTERN.finditer(patch)
    )


def _is_likely_dummy(value: str) -> bool:
    """매칭된 값이 테스트용 더미일 가능성이 높으면 True를 반환한다."""
    return any(p.search(value) for p in _DUMMY_PATTERNS)


def _scan_diff_with_regex(diff: dict) -> list[dict]:
    """단일 커밋 diff를 정규식으로 스캔하여 의심 항목 목록을 반환한다.

    반환 형식::
        {
            "sha": "...",
            "filename": "...",
            "pattern_type": "AWS_ACCESS_KEY",
            "matched_value": "AKIA...",   # 민감 정보 — 로그 출력 금지
            "added_line": "...",
        }
    """
    findings: list[dict] = []
    sha = diff.get("sha", "")

    for file_info in diff.get("files", []):
        filename = file_info.get("filename", "")
        patch = file_info.get("patch")
        added_content = _extract_added_lines(patch)
        if not added_content:
            continue

        for pattern_type, pattern in _SECRET_PATTERNS:
            for match in pattern.finditer(added_content):
                matched_value = match.group(1) if match.lastindex else match.group(0)
                if _is_likely_dummy(matched_value):
                    continue
                findings.append({
                    "sha":           sha,
                    "filename":      filename,
                    "pattern_type":  pattern_type,
                    "matched_value": matched_value,
                    "added_line":    match.string[
                        max(0, match.start() - 40):match.end() + 40
                    ].replace(matched_value, "***REDACTED***"),
                })

    return findings


async def _classify_with_claude(
    findings: list[dict],
    model: str | None,
    api_key: str | None,
) -> list[dict]:
    """Claude로 2차 분류 — 실제 시크릿 vs 테스트 더미.

    API 호출 실패 시 모든 항목을 실제 시크릿으로 처리한다 (보수적 전략).
    """
    if not findings:
        return []

    from anthropic import AsyncAnthropic
    from config.settings import settings as cfg

    client = AsyncAnthropic(api_key=api_key or cfg.claude_api_key)
    effective_model = model or cfg.claude_model

    items_text = "\n".join(
        f"{i+1}. type={f['pattern_type']} file={f['filename']} sha={f['sha'][:8]} context={f['added_line']}"
        for i, f in enumerate(findings)
    )

    system_prompt = """\
You are a security engineer classifying potential secret leaks found in git commit diffs.
For each item, decide if it is a REAL secret or a TEST/DUMMY value.

Respond ONLY with valid JSON (no markdown):
{
  "classifications": [
    {"index": 1, "is_real_secret": true, "reason": "looks like a real AWS key pattern"}
  ]
}

Rules:
- is_real_secret: true = real credential that should be revoked
- is_real_secret: false = test dummy, example value, or false positive
- Never include full secret values in reasons
"""

    try:
        response = await client.messages.create(
            model=effective_model,
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {
                    "role": "user",
                    "content": f"Classify these potential secrets:\n\n{items_text}",
                }
            ],
        )
        raw = response.content[0].text
        result = json.loads(raw)
        classifications: list[dict] = result.get("classifications", [])

        real_secrets: list[dict] = []
        for clf in classifications:
            idx = clf.get("index", 0) - 1
            if 0 <= idx < len(findings) and clf.get("is_real_secret", True):
                real_secrets.append(findings[idx])
        return real_secrets

    except Exception as exc:
        # Claude 호출 실패 시 보수적으로 모두 실제 시크릿으로 처리
        logger.warning("[secret-scan] Claude classification failed: %s — keeping all %d findings", exc, len(findings))
        return findings


def _build_vulnerability_payload(
    session_id: str,
    project_id: str,
    finding: dict,
) -> dict:
    """탐지 결과를 Backend 취약점 저장 형식으로 변환한다."""
    filename = finding["filename"]
    sha = finding["sha"]
    pattern_type = finding["pattern_type"]

    fingerprint = hashlib.sha256(
        f"{sha}:{filename}:{pattern_type}".encode()
    ).hexdigest()

    return {
        "sessionId":   session_id,
        "projectId":   project_id,
        "filePath":    f"git://{sha[:8]}/{filename}",
        "vulnerabilities": [
            {
                "lineNumber":  None,
                "vulnType":    "SECRET_EXPOSURE",
                "severity":    "CRITICAL",
                "category":    "SECURITY",
                "cwe":         "CWE-312",
                "owasp":       "A02:2021",
                "description": (
                    f"Potential {pattern_type} detected in commit {sha[:8]}. "
                    f"File: {filename}. Secret may be exposed in git history."
                ),
                "codeSnippet": finding.get("added_line", ""),
                "callChain":   [],
                "fingerprint": fingerprint,
            }
        ],
    }


async def _save_findings_to_backend(session_id: str, project_id: str, findings: list[dict]) -> int:
    """탐지된 시크릿을 Backend에 저장한다. 실패 시 0을 반환하고 로그만 남긴다."""
    if not findings:
        return 0

    total_saved = 0
    for finding in findings:
        payload = _build_vulnerability_payload(session_id, project_id, finding)
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{settings.backend_internal_url}/api/v1/internal/vulnerabilities",
                    json=payload,
                    headers={"X-Internal-Key": settings.internal_api_key},
                )
                resp.raise_for_status()
                saved = resp.json().get("data", {}).get("saved", 0)
                total_saved += saved
        except Exception as exc:
            logger.error(
                "[secret-scan] save_finding failed session=%s sha=%s: %s",
                session_id, finding.get("sha", "")[:8], exc,
            )
            # skip & log — 전체 세션 중단 금지

    logger.info("[secret-scan] saved=%d session=%s", total_saved, session_id)
    return total_saved


# ─── 메인 스캔 태스크 ─────────────────────────────────────────────────────────

async def _run_secret_scan(req: CommitScanRequest) -> None:
    """백그라운드에서 실행되는 메인 스캔 로직."""
    # github_token은 로그에 절대 출력 금지
    logger.info(
        "[secret-scan] session=%s owner=%s repo=%s ref=%s per_page=%d",
        req.session_id, req.owner, req.repo, req.ref, req.per_page,
    )

    all_findings: list[dict] = []
    commits_scanned = 0

    try:
        commits = await _github_list_commits(
            req.owner, req.repo, req.ref, req.per_page, req.github_token
        )
        logger.info("[secret-scan] session=%s commits=%d", req.session_id, len(commits))

        for commit in commits:
            sha = commit["sha"]
            try:
                diff = await _github_get_commit_diff(
                    req.owner, req.repo, sha, req.github_token
                )
                findings = _scan_diff_with_regex(diff)
                all_findings.extend(findings)
                commits_scanned += 1
            except Exception as exc:
                logger.warning(
                    "[secret-scan] session=%s sha=%s error=%s — skipping",
                    req.session_id, sha[:8], exc,
                )
                # skip & log — 개별 커밋 오류 시 전체 세션 중단 금지

        # 2차 Claude 분류
        real_findings = await _classify_with_claude(
            all_findings, req.preferred_model, req.user_api_key
        )

        # Backend에 저장
        saved = await _save_findings_to_backend(req.session_id, req.project_id, real_findings)
        logger.info(
            "[secret-scan] session=%s done commits=%d regex_hits=%d claude_real=%d saved=%d",
            req.session_id, commits_scanned, len(all_findings), len(real_findings), saved,
        )

    except Exception as exc:
        logger.exception("[secret-scan] session=%s fatal error: %s", req.session_id, exc)
