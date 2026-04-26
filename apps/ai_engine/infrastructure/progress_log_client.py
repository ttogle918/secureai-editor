"""
진행 로그 클라이언트.

AI Engine → Spring Backend 방향의 내부 호출.
로그 저장 실패는 분석 흐름에 영향을 주지 않으므로 조용히 처리한다.
"""
import logging

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)


async def log_progress(
    session_id: str,
    step_name: str,
    step_order: int,
    status: str,
    target: str = "",
    detail: dict | None = None,
) -> None:
    """진행 로그를 Backend에 저장한다. 실패 시 로그만 남기고 계속 진행한다."""
    payload: dict = {
        "sessionId": session_id,
        "stepName": step_name,
        "stepOrder": step_order,
        "target": target,
        "status": status,
    }
    if detail is not None:
        payload["detail"] = detail

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.post(
                f"{settings.backend_internal_url}/api/v1/internal/progress-logs",
                json=payload,
                headers={"X-Internal-Key": settings.internal_api_key},
            )
            resp.raise_for_status()
    except Exception as exc:
        logger.warning(
            "[progress-log] failed session=%s step=%s status=%s: %s",
            session_id, step_name, status, exc,
        )


async def log_started(
    session_id: str, step_name: str, step_order: int, target: str = ""
) -> None:
    await log_progress(session_id, step_name, step_order, "started", target)


async def log_completed(
    session_id: str,
    step_name: str,
    step_order: int,
    target: str = "",
    detail: dict | None = None,
) -> None:
    await log_progress(session_id, step_name, step_order, "completed", target, detail)


async def log_failed(
    session_id: str,
    step_name: str,
    step_order: int,
    target: str = "",
    detail: dict | None = None,
) -> None:
    await log_progress(session_id, step_name, step_order, "failed", target, detail)
