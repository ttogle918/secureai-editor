"""
Backend 내부 API 클라이언트.

AI Engine → Spring Backend 방향의 내부 호출만 담당한다.
X-Internal-Key 헤더로 인증한다.
모듈 레벨 AsyncClient로 TCP 연결 풀을 재사용한다.
"""
import hashlib
import logging

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)

# 연결 풀 재사용을 위해 모듈 레벨 클라이언트 생성
_client = httpx.AsyncClient(
    base_url=settings.backend_internal_url,
    timeout=15,
    headers={"X-Internal-Key": settings.internal_api_key},
)


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
        resp = await _client.post("/api/v1/internal/vulnerabilities", json=payload)
        resp.raise_for_status()
        saved: int = resp.json().get("data", {}).get("saved", 0)
        logger.info("[backend-api] saved=%d session=%s file=%s", saved, session_id, file_path)
        return saved
    except Exception as exc:
        logger.error("[backend-api] save_vulnerabilities failed session=%s: %s", session_id, exc)
        return 0


def _snake_to_camel(s: str) -> str:
    """snake_case 키를 camelCase로 변환한다."""
    head, *tail = s.split("_")
    return head + "".join(p.capitalize() for p in tail)


def _camelize_keys(d: dict) -> dict:
    return {_snake_to_camel(k): v for k, v in d.items()}


async def save_patch_results(
    session_id: str,
    project_id: str,
    patch_results: list[dict],
) -> int:
    """패치 결과 목록을 Backend에 저장한다. 실패 시 0을 반환하고 로그만 남긴다."""
    if not patch_results:
        return 0

    # PatchResult.to_dict()는 snake_case 키를 주지만 Backend PatchItem DTO는
    # camelCase(filePath/vulnType/…)를 기대한다. 변환 없이 보내면 explanation만
    # 매핑되고 file_path 등은 null → patch_suggestions NOT NULL 제약 위반(500).
    payload = {
        "sessionId": session_id,
        "projectId": project_id,
        "patches": [_camelize_keys(p) for p in patch_results],
    }

    try:
        resp = await _client.post("/api/v1/internal/patches", json=payload)
        resp.raise_for_status()
        saved: int = resp.json().get("data", {}).get("saved", 0)
        logger.info("[backend-api] patch saved=%d session=%s", saved, session_id)
        return saved
    except Exception as exc:
        logger.error("[backend-api] save_patch_results failed session=%s: %s", session_id, exc)
        return 0


async def get_vuln_context(project_id: str) -> list[dict]:
    """프로젝트의 최근 30일 취약점 유형 집계를 Backend에서 조회한다.

    ADR-016: MCP PostgreSQL f-string SQL 대체 — Backend JPQL 파라미터 바인딩 사용.
    실패 시 빈 리스트를 반환하고 분석을 중단하지 않는다.

    반환 형태: [{"vulnType": "SQL_INJECTION", "count": 3, "maxSeverity": "HIGH"}, ...]
    """
    try:
        resp = await _client.get(
            f"/api/v1/internal/projects/{project_id}/vuln-context"
        )
        resp.raise_for_status()
        items: list = resp.json().get("data", []) or []
        logger.debug("[backend-api] vuln_context project=%s items=%d", project_id, len(items))
        return items
    except Exception as exc:
        logger.warning("[backend-api] get_vuln_context failed project=%s: %s", project_id, exc)
        return []


async def report_token_usage(
    session_id: str,
    user_id: str,
    project_id: str,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cache_creation: int,
    cache_read: int,
) -> None:
    """세션 종료 시 누적 토큰 사용량을 Backend에 1회 보고한다 (COST-3).

    파일별 POST 금지 — 세션 종료 노드(patch_node)에서만 호출한다.
    토큰 수치는 로그에 기록하되, API 키·토큰 값은 절대 출력 금지.
    실패 시 경고 로그만 남기고 세션 실패로 전파하지 않는다.
    """
    payload = {
        "userId": user_id,
        "projectId": project_id,
        "provider": provider,
        "model": model,
        "inputTokens": input_tokens,
        "outputTokens": output_tokens,
        "cacheCreation": cache_creation,
        "cacheRead": cache_read,
    }
    try:
        resp = await _client.post(
            f"/api/v1/internal/sessions/{session_id}/token-usage",
            json=payload,
        )
        resp.raise_for_status()
        logger.info(
            "[backend-api] token_usage reported session=%s provider=%s model=%s "
            "input=%d output=%d cache_creation=%d cache_read=%d",
            session_id, provider, model,
            input_tokens, output_tokens, cache_creation, cache_read,
        )
    except Exception as exc:
        logger.warning(
            "[backend-api] report_token_usage failed session=%s provider=%s: %s",
            session_id, provider, exc,
        )


async def report_patch_verification(
    patch_id: str,
    status: str,
    log: str | None = None,
) -> None:
    """패치 검증 결과를 Backend 내부 API로 보고한다 (TASK-1402).

    POST /api/v1/internal/patches/{patchId}/verification (X-Internal-Key)
    status: "VERIFIED" 또는 "FAILED" (PENDING은 보고 대상 아님)
    log: 실행 로그 요약 — 민감 토큰·페이로드 절대 포함 금지.

    실패 시 경고 로그만 남기고 전체 세션을 중단하지 않는다.
    """
    if status not in ("VERIFIED", "FAILED"):
        logger.warning(
            "[backend-api] report_patch_verification invalid status=%s patch_id=%s",
            status, patch_id,
        )
        return

    payload: dict = {"status": status}
    if log is not None:
        payload["log"] = log

    try:
        resp = await _client.post(
            f"/api/v1/internal/patches/{patch_id}/verification",
            json=payload,
        )
        resp.raise_for_status()
        logger.info(
            "[backend-api] patch_verification reported patch_id=%s status=%s",
            patch_id, status,
        )
    except Exception as exc:
        logger.warning(
            "[backend-api] report_patch_verification failed patch_id=%s status=%s: %s",
            patch_id, status, exc,
        )


async def get_patch_examples(vuln_type: str, language: str) -> list[dict]:
    """이전 성공 패치 예시를 Backend에서 조회한다 (최대 3건).

    ADR-016: MCP PostgreSQL f-string SQL 대체 — Backend JPQL 파라미터 바인딩 사용.
    프로젝트와 무관하게 vuln_type + language 조합으로 전역 패턴을 조회한다.
    실패 시 빈 리스트를 반환하고 패치 생성을 계속 진행한다.

    반환 형태: [{"originalSnippet": "...", "patchedSnippet": "...", "explanation": "..."}, ...]
    """
    try:
        resp = await _client.get(
            "/api/v1/internal/patch-examples",
            params={"vulnType": vuln_type, "language": language},
        )
        resp.raise_for_status()
        items: list = resp.json().get("data", []) or []
        logger.debug("[backend-api] patch_examples vuln=%s lang=%s items=%d", vuln_type, language, len(items))
        return items
    except Exception as exc:
        logger.warning("[backend-api] get_patch_examples failed vuln=%s lang=%s: %s", vuln_type, language, exc)
        return []
