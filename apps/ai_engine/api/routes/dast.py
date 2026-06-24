"""
POST /agent/dast/start              — DAST 분석 시작 (BackgroundTask)
POST /agent/dast/batch              — 다수 취약점 배치 DAST 분석 (BackgroundTask)
GET  /agent/dast/logs/{session_id}  — SSE 로그 스트리밍

target_url 과 params 는 절대 로그에 출력하지 않는다.
"""
import asyncio
import json
import logging
from collections import defaultdict
from typing import List

import redis.asyncio as aioredis
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent.dast_graph_builder import get_dast_graph
from agent.nodes.dast.dast_node import _load_dast_guidelines
from config.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["dast"])

_DAST_CHANNEL_PREFIX = "secureai:dast:logs:"
_SSE_KEEPALIVE_SECONDS = 30
_SSE_POLL_INTERVAL = 0.5

# 도커-per-익스플로잇 과부하와 대상 서버 과부하를 방지하기 위해
# 동시 실행 타깃 수를 제한한다.
_BATCH_CONCURRENCY = 4
# 단일 배치 요청에 허용되는 최대 타깃 수 — 초과 시 422 반환
_BATCH_MAX_TARGETS = 50


class DastStartRequest(BaseModel):
    session_id: str
    vuln_id: str
    vuln_type: str
    target_url: str    # 로그 출력 금지
    endpoint: str
    params: dict


class DastBatchTarget(BaseModel):
    vuln_id: str
    vuln_type: str
    target_url: str    # 로그 출력 금지
    endpoint: str
    params: dict


class DastBatchRequest(BaseModel):
    session_id: str
    targets: List[DastBatchTarget]


@router.post("/dast/batch", status_code=status.HTTP_202_ACCEPTED)
async def start_dast_batch(req: DastBatchRequest, background_tasks: BackgroundTasks):
    """배치 DAST 분석을 백그라운드로 시작하고 202 를 반환한다.

    targets 개수가 _BATCH_MAX_TARGETS 를 초과하면 422 를 반환한다.
    각 타깃의 진행/결과는 기존 SSE GET /agent/dast/logs/{session_id} 로 구독한다.
    """
    if len(req.targets) > _BATCH_MAX_TARGETS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"targets 는 최대 {_BATCH_MAX_TARGETS} 개까지 허용됩니다.",
        )

    logger.info(
        "[dast/batch] session=%s target_count=%d",
        req.session_id,
        len(req.targets),
        # target_url 과 params 는 의도적으로 로그 제외
    )

    background_tasks.add_task(_run_dast_batch, req.session_id, req.targets)
    return {"session_id": req.session_id, "status": "accepted", "total": len(req.targets)}


@router.post("/dast/start", status_code=status.HTTP_202_ACCEPTED)
async def start_dast(req: DastStartRequest, background_tasks: BackgroundTasks):
    """DAST 분석을 백그라운드로 시작하고 202 를 반환한다."""
    logger.info(
        "[dast/start] session=%s vuln_id=%s vuln_type=%s endpoint=%s",
        req.session_id,
        req.vuln_id,
        req.vuln_type,
        req.endpoint,
        # target_url 과 params 는 의도적으로 로그 제외
    )
    initial_state = {
        "session_id": req.session_id,
        "vuln_id": req.vuln_id,
        "vuln_type": req.vuln_type,
        "target_url": req.target_url,
        "endpoint": req.endpoint,
        "params": req.params,
        "retry_count": 0,
        "max_retries": 3,
        "exploit_outcome": None,
        "dast_guidelines": "",
        "status": "running",
        "log_messages": [],
    }
    background_tasks.add_task(_run_dast_graph, initial_state)
    return {"session_id": req.session_id, "status": "accepted"}


@router.get("/dast/logs/{session_id}")
async def stream_dast_logs(
    session_id: str,
    batch: bool = Query(default=False, description="배치 DAST 모드 — True 이면 dast_batch_complete 에서만 스트림을 종료한다."),
) -> StreamingResponse:
    """Redis SUBSCRIBE 를 통해 DAST 로그를 SSE 로 스트리밍한다.

    - batch=False (기본): 단건 모드 — dast_result 또는 dast_error 에서 종료.
    - batch=True: 배치 모드 — dast_result 로는 종료하지 않고 dast_batch_complete 에서만 종료.
    30 초 동안 메시지가 없으면 keep-alive 이벤트를 발행한다.
    """
    return StreamingResponse(
        _sse_generator(session_id, batch=batch),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _run_dast_batch(session_id: str, targets: List[DastBatchTarget]) -> None:
    """백그라운드 태스크: 배치 DAST 분석을 실행한다.

    vuln_type 별로 타깃을 그룹핑하여 지침을 그룹당 1회만 로드한다.
    동시 실행은 _BATCH_CONCURRENCY 개로 제한하여 Docker 과부하를 방지한다.
    개별 타깃 실패는 전체 배치를 중단하지 않고 skip & log 처리한다.
    """
    grouped = _group_targets_by_vuln_type(targets)
    semaphore = asyncio.Semaphore(_BATCH_CONCURRENCY)

    total = len(targets)
    succeeded = 0
    skipped = 0

    tasks = []
    for vuln_type, group in grouped.items():
        # 그룹 내 지침을 1회 로드하여 각 타깃의 initial_state에 주입한다.
        # dast_node 는 dast_guidelines 가 비어 있을 때만 로드하므로
        # 미리 주입하면 중복 벡터 검색 호출을 회피한다.
        guidelines = await _load_dast_guidelines_safe(vuln_type)
        for target in group:
            initial_state = _build_initial_state(session_id, target, guidelines)
            tasks.append(_run_single_target(semaphore, initial_state))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    for r in results:
        if isinstance(r, Exception):
            skipped += 1
        else:
            succeeded += 1

    await _publish_batch_complete(session_id, total, succeeded, skipped)


def _group_targets_by_vuln_type(
    targets: List[DastBatchTarget],
) -> dict[str, List[DastBatchTarget]]:
    """타깃 목록을 vuln_type 별로 그룹핑한다."""
    groups: dict[str, List[DastBatchTarget]] = defaultdict(list)
    for target in targets:
        groups[target.vuln_type].append(target)
    return groups


async def _load_dast_guidelines_safe(vuln_type: str) -> str:
    """지침 로드 실패 시 빈 문자열을 반환하여 배치를 중단하지 않는다."""
    try:
        return await _load_dast_guidelines(vuln_type)
    except Exception as exc:
        logger.warning("[dast/batch] guidelines load failed vuln_type=%s error=%s", vuln_type, exc)
        return ""


def _build_initial_state(session_id: str, target: DastBatchTarget, guidelines: str) -> dict:
    """단일 타깃의 DastState 초기값을 생성한다.

    target_url 과 params 는 로그 출력 금지이므로 이 함수에서도 로그 없이 처리한다.
    """
    return {
        "session_id": session_id,
        "vuln_id": target.vuln_id,
        "vuln_type": target.vuln_type,
        "target_url": target.target_url,
        "endpoint": target.endpoint,
        "params": target.params,
        "retry_count": 0,
        "max_retries": 3,
        "exploit_outcome": None,
        "dast_guidelines": guidelines,
        "status": "running",
        "log_messages": [],
    }


async def _run_single_target(semaphore: asyncio.Semaphore, initial_state: dict) -> None:
    """세마포어로 동시성을 제어하며 단일 타깃을 실행한다.

    실패 시 예외를 재발생시켜 gather 에서 Exception 으로 수집되게 한다.
    개별 실패가 배치 전체를 중단하지 않도록 gather(return_exceptions=True) 와 함께 사용한다.
    """
    session_id = initial_state["session_id"]
    vuln_id = initial_state["vuln_id"]
    async with semaphore:
        try:
            graph = get_dast_graph()
            await graph.ainvoke(initial_state)
            logger.info("[dast/batch] session=%s vuln_id=%s completed", session_id, vuln_id)
        except Exception as exc:
            logger.error("[dast/batch] session=%s vuln_id=%s failed: %s", session_id, vuln_id, exc)
            raise


async def _publish_batch_complete(
    session_id: str, total: int, succeeded: int, skipped: int
) -> None:
    """배치 전체 완료 신호를 SSE 채널과 Redis 키에 발행한다.

    SSE 클라이언트는 이 이벤트를 수신하면 스트림을 종료한다.
    늦게 구독한 클라이언트를 위해 result_key 에도 저장한다 (5분 TTL).
    """
    message = json.dumps({
        "type": "dast_batch_complete",
        "total": total,
        "succeeded": succeeded,
        "skipped": skipped,
    })
    channel = f"{_DAST_CHANNEL_PREFIX}{session_id}"
    result_key = f"secureai:dast:result:{session_id}"
    try:
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            await r.setex(result_key, 300, message)
            await r.publish(channel, message)
        logger.info(
            "[dast/batch] session=%s batch_complete total=%d succeeded=%d skipped=%d",
            session_id,
            total,
            succeeded,
            skipped,
        )
    except Exception as exc:
        logger.error("[dast/batch] failed to publish batch_complete session=%s: %s", session_id, exc)


async def _run_dast_graph(initial_state: dict) -> None:
    """백그라운드 태스크: DAST 그래프를 실행한다.

    그래프 내부의 notify_node 가 Redis PUBLISH 를 담당하므로
    여기서는 ainvoke 만 호출한다.
    """
    session_id = initial_state["session_id"]
    try:
        graph = get_dast_graph()
        await graph.ainvoke(initial_state)
        logger.info("[dast] session=%s graph completed", session_id)
    except Exception as exc:
        logger.error("[dast] session=%s graph error: %s", session_id, exc)
        await _publish_error(session_id, str(exc))


async def _publish_error(session_id: str, error_message: str) -> None:
    """그래프 실행 중 예외가 발생하면 SSE 채널에 오류 이벤트를 발행한다."""
    message = json.dumps({"type": "dast_error", "error": error_message})
    channel = f"{_DAST_CHANNEL_PREFIX}{session_id}"
    try:
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        async with r:
            await r.publish(channel, message)
    except Exception as exc:
        logger.error("[dast] failed to publish error event session=%s: %s", session_id, exc)


async def _sse_generator(session_id: str, batch: bool = False):
    """Redis SUBSCRIBE 를 통해 SSE 이벤트를 생성하는 제너레이터.

    batch=False(단건): dast_result 또는 dast_error 수신 시 스트림 종료.
    batch=True(배치): dast_result 는 중간 이벤트로 계속 전달하고,
                      dast_batch_complete 또는 dast_error 수신 시에만 종료.
                      배치 진행 중 재구독 시 단건 result 캐시로 조기 종료되지 않도록
                      캐시 체크는 dast_batch_complete 인 경우에만 즉시 반환한다.
    """
    channel = f"{_DAST_CHANNEL_PREFIX}{session_id}"
    result_key = f"secureai:dast:result:{session_id}"
    r = aioredis.from_url(settings.redis_url, decode_responses=True)
    pubsub = r.pubsub()

    try:
        await pubsub.subscribe(channel)

        # 구독 전 이미 완료된 경우를 처리 (race condition 방어)
        # 배치 모드: result_key 가 dast_batch_complete 일 때만 즉시 반환한다.
        #           단건 dast_result 가 캐시되어 있으면 무시 — 배치 진행 중 재구독이
        #           첫 타깃 결과 캐시로 조기 종료되는 것을 방지한다.
        cached = await r.get(result_key)
        if cached and _is_terminal_cache(cached, batch):
            yield f"data: {cached}\n\n"
            return

        idle_seconds = 0.0

        while True:
            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True),
                    timeout=_SSE_POLL_INTERVAL,
                )
            except asyncio.TimeoutError:
                message = None

            if message and message.get("data"):
                data = message["data"]
                yield f"data: {data}\n\n"
                idle_seconds = 0.0

                if _is_terminal_message(data, batch):
                    break
            else:
                idle_seconds += _SSE_POLL_INTERVAL
                if idle_seconds >= _SSE_KEEPALIVE_SECONDS:
                    yield 'data: {"type":"keepalive"}\n\n'
                    idle_seconds = 0.0

    except Exception as exc:
        logger.error("[dast/sse] session=%s error: %s", session_id, exc)
        yield f'data: {json.dumps({"type": "dast_error", "error": str(exc)})}\n\n'
    finally:
        try:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            await r.aclose()
        except Exception as exc:
            logger.warning("[dast/sse] cleanup failed session=%s: %s", session_id, exc)


def _is_terminal_message(data: str, batch: bool) -> bool:
    """수신 메시지가 스트림을 종료시키는 이벤트인지 판별한다.

    단건(batch=False): dast_result 또는 dast_error 가 종료 이벤트.
    배치(batch=True):  dast_result 는 중간 이벤트이므로 계속 수신하고,
                       dast_batch_complete 또는 dast_error 에서만 종료한다.
    """
    try:
        msg_type = json.loads(data).get("type")
    except (json.JSONDecodeError, AttributeError):
        return False

    if batch:
        return msg_type in ("dast_batch_complete", "dast_error")
    return msg_type in ("dast_result", "dast_error")


def _is_terminal_cache(cached: str, batch: bool) -> bool:
    """캐시된 result_key 값이 즉시 반환 후 스트림을 종료할 수 있는 상태인지 판별한다.

    단건(batch=False): dast_result 또는 dast_error 캐시는 즉시 반환.
    배치(batch=True):  dast_batch_complete 캐시만 즉시 반환.
                       배치 진행 중 단건 타깃의 dast_result 가 캐시되어 있어도 무시해
                       재구독이 조기 종료되지 않게 한다.
    """
    try:
        msg_type = json.loads(cached).get("type")
    except (json.JSONDecodeError, AttributeError):
        return False

    if batch:
        return msg_type == "dast_batch_complete"
    return msg_type in ("dast_result", "dast_error")
