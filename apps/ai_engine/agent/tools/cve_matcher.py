"""
CVE 매칭 클라이언트.

AI Engine → Backend GET /api/v1/cve/search?packageName=xxx&version=yyy 로
CVE 정보를 조회하고 컴포넌트별 매칭 결과를 반환한다.

X-Internal-Key 헤더로 인증한다.
모듈 레벨 AsyncClient로 TCP 연결 풀을 재사용한다.
"""
import logging

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)

_CVE_SEARCH_PATH = "/api/v1/cve/search"

_client = httpx.AsyncClient(
    base_url=settings.backend_internal_url,
    timeout=10,
    headers={"X-Internal-Key": settings.internal_api_key},
)


async def match_cve(components: list[dict], session_id: str) -> list[dict]:
    """컴포넌트 목록에 대해 Backend CVE 검색 API를 호출하고 매칭 결과를 반환한다.

    개별 컴포넌트 검색 실패 시 해당 컴포넌트를 건너뛰고 계속 진행한다
    (전체 세션 실패 금지 원칙).

    Args:
        components: [{"name": str, "version": str | None, "ecosystem": str}] 형태의 목록
        session_id: 로그용 세션 식별자

    Returns:
        [{"component": dict, "cves": list[dict]}] 형태의 매칭 결과 목록
        CVE가 없는 컴포넌트는 결과에 포함하지 않는다.
    """
    if not components:
        return []

    results: list[dict] = []

    for comp in components:
        name = comp.get("name")
        version = comp.get("version")

        if not name:
            continue

        try:
            params: dict[str, str] = {"packageName": name}
            if version:
                params["version"] = version

            resp = await _client.get(_CVE_SEARCH_PATH, params=params)
            resp.raise_for_status()

            data = resp.json()
            cve_list: list[dict] = data.get("data", {}).get("cves", [])

            if cve_list:
                logger.info(
                    "[cve-matcher] session=%s component=%s found=%d CVEs",
                    session_id, name, len(cve_list),
                )
                results.append({"component": comp, "cves": cve_list})

        except httpx.HTTPStatusError as exc:
            logger.warning(
                "[cve-matcher] session=%s component=%s HTTP %d: %s",
                session_id, name, exc.response.status_code, exc,
            )
        except Exception as exc:
            logger.warning(
                "[cve-matcher] session=%s component=%s error: %s",
                session_id, name, exc,
            )

    logger.info(
        "[cve-matcher] session=%s total_components=%d matched=%d",
        session_id, len(components), len(results),
    )
    return results
