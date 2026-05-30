"""
POST /agent/sbom/analyze — SBOM 분석 엔드포인트

Request:
    {
        "session_id": "uuid",
        "project_id": "uuid",
        "files": {"pom.xml": "...", "package.json": "..."}
    }

Response:
    {
        "session_id": "uuid",
        "total_components": 42,
        "matched_cves": 3,
        "cyclonedx": { ... }
    }

처리 흐름:
1. 파일명 기반 파서 자동 선택 → 컴포넌트 파싱
2. Backend CVE 검색 API 호출 → CVE 매칭
3. CycloneDX JSON 생성
4. Backend POST /api/v1/internal/sbom/components 로 저장
"""
import logging

import httpx
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from agent.tools.cve_matcher import match_cve
from agent.tools.sbom_parser import parse_file, to_cyclonedx
from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["sbom"])

_SBOM_SAVE_PATH = "/api/v1/internal/sbom/components"
_HTTP_TIMEOUT = 15


class SbomAnalyzeRequest(BaseModel):
    session_id: str
    project_id: str
    files: dict[str, str]  # {파일경로: 파일내용}


class SbomAnalyzeResponse(BaseModel):
    session_id: str
    total_components: int
    matched_cves: int
    cyclonedx: dict


@router.post("/sbom/analyze", response_model=SbomAnalyzeResponse)
async def analyze_sbom(req: SbomAnalyzeRequest) -> SbomAnalyzeResponse:
    """SBOM 파일들을 파싱하고 CVE를 매칭한 뒤 결과를 Backend에 저장한다."""
    logger.info(
        "[sbom] session=%s project=%s files=%s",
        req.session_id, req.project_id, list(req.files.keys()),
    )

    # 1. 파서 자동 감지 → 컴포넌트 파싱
    all_components: list[dict] = []
    for file_path, content in req.files.items():
        try:
            parsed = parse_file(file_path, content)
            all_components.extend(parsed)
            logger.info(
                "[sbom] session=%s file=%s parsed=%d components",
                req.session_id, file_path, len(parsed),
            )
        except Exception as exc:
            # 개별 파일 실패 시 스킵, 전체 세션 유지
            logger.warning(
                "[sbom] session=%s file=%s parse error: %s",
                req.session_id, file_path, exc,
            )

    if not all_components:
        logger.warning("[sbom] session=%s no components parsed", req.session_id)

    # 2. CVE 매칭
    cve_matches: list[dict] = []
    try:
        cve_matches = await match_cve(all_components, req.session_id)
    except Exception as exc:
        logger.warning("[sbom] session=%s CVE matching failed: %s", req.session_id, exc)

    # 3. CycloneDX JSON 생성
    cyclonedx = to_cyclonedx(all_components, cve_matches)

    # 4. Backend에 저장 (실패해도 응답은 정상 반환)
    await _save_to_backend(req.session_id, req.project_id, all_components, cve_matches)

    matched_count = sum(len(m.get("cves", [])) for m in cve_matches)
    logger.info(
        "[sbom] session=%s total_components=%d matched_cves=%d",
        req.session_id, len(all_components), matched_count,
    )

    return SbomAnalyzeResponse(
        session_id=req.session_id,
        total_components=len(all_components),
        matched_cves=matched_count,
        cyclonedx=cyclonedx,
    )


async def _save_to_backend(
    session_id: str,
    project_id: str,
    components: list[dict],
    cve_matches: list[dict],
) -> None:
    """파싱된 컴포넌트와 CVE 매칭 결과를 Backend에 저장한다.

    실패 시 경고 로그만 기록하고 예외를 전파하지 않는다.
    """
    if not components:
        return

    # CVE 매칭 결과를 component 이름 기준으로 인덱싱
    cve_map: dict[str, list[str]] = {}
    for match in cve_matches:
        name = match.get("component", {}).get("name", "")
        cve_ids = [c.get("cveId", "") for c in match.get("cves", []) if c.get("cveId")]
        if name and cve_ids:
            cve_map[name] = cve_ids

    payload = {
        "sessionId": session_id,
        "projectId": project_id,
        "components": [
            {
                "name": c.get("name"),
                "version": c.get("version"),
                "ecosystem": c.get("ecosystem"),
                "cveIds": cve_map.get(c.get("name", ""), []),
            }
            for c in components
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            resp = await client.post(
                f"{settings.backend_internal_url}{_SBOM_SAVE_PATH}",
                json=payload,
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            resp.raise_for_status()
            saved = resp.json().get("data", {}).get("saved", 0)
            logger.info(
                "[sbom] session=%s backend saved=%d components",
                session_id, saved,
            )
    except Exception as exc:
        logger.warning(
            "[sbom] session=%s backend save failed: %s",
            session_id, exc,
        )
