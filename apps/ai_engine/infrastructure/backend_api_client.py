"""
Backend 내부 API 클라이언트.

AI Engine → Spring Backend 방향의 내부 호출만 담당한다.
X-Internal-Key 헤더로 인증한다.
"""
import hashlib
import logging

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)


def _fingerprint(file_path: str, line_number, vuln_type: str) -> str:
    line = str(line_number) if line_number is not None else "0"
    return hashlib.sha256(f"{file_path}:{line}:{vuln_type}".encode()).hexdigest()


async def save_vulnerabilities(
    session_id: str,
    project_id: str,
    file_path: str,
    vulnerabilities: list[dict],
) -> int:
    """취약점 목록을 Backend에 저장한다. 실패 시 0을 반환하고 로그만 남긴다."""
    if not vulnerabilities:
        return 0

    items = []
    for v in vulnerabilities:
        vuln_type = v.get("type", "UNKNOWN")
        line = v.get("line")
        items.append({
            "lineNumber":   line,
            "vulnType":     vuln_type,
            "severity":     v.get("severity", "MEDIUM"),
            "category":     v.get("category", "SECURITY"),
            "cwe":          v.get("cwe"),
            "owasp":        v.get("owasp"),
            "description":  v.get("description"),
            "codeSnippet":  v.get("code_snippet"),
            "callChain":    v.get("callChain") or v.get("call_chain", []),
            "fingerprint":  _fingerprint(file_path, line, vuln_type),
        })

    payload = {
        "sessionId":       session_id,
        "projectId":       project_id,
        "filePath":        file_path,
        "vulnerabilities": items,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.backend_internal_url}/api/v1/internal/vulnerabilities",
                json=payload,
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            resp.raise_for_status()
            saved: int = resp.json().get("data", {}).get("saved", 0)
            logger.info("[backend-api] saved=%d session=%s file=%s", saved, session_id, file_path)
            return saved
    except Exception as exc:
        logger.error("[backend-api] save_vulnerabilities failed session=%s: %s", session_id, exc)
        return 0


async def save_patch_results(
    session_id: str,
    project_id: str,
    patch_results: list[dict],
) -> int:
    """패치 결과 목록을 Backend에 저장한다. 실패 시 0을 반환하고 로그만 남긴다."""
    if not patch_results:
        return 0

    payload = {
        "sessionId": session_id,
        "projectId": project_id,
        "patches": patch_results,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.backend_internal_url}/api/v1/internal/patches",
                json=payload,
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            resp.raise_for_status()
            saved: int = resp.json().get("data", {}).get("saved", 0)
            logger.info("[backend-api] patch saved=%d session=%s", saved, session_id)
            return saved
    except Exception as exc:
        logger.error("[backend-api] save_patch_results failed session=%s: %s", session_id, exc)
        return 0
