"""
POST /agent/confirm/{session_id} — 사용자 컨펌 게이트 처리 (STAGE-2).

체크포인트에서 stages/files_to_scan 읽기 → 제외 반영 → graph.aupdate_state → 재개.

보안:
- excluded_file_paths는 체크포인트의 원본 files_to_scan 교집합만 허용(경로순회 방어).
  planning_node._filter_to_whitelist 재사용.
- 모든 stage 제외 시 400 반환.
"""
import json
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from langgraph.errors import GraphInterrupt
from pydantic import BaseModel

from agent.graph_builder import get_graph
from agent.mcp_client import mcp_session
from agent.nodes.planning_node import _filter_to_whitelist
from config.settings import settings
from infrastructure.checkpointer import get_checkpointer
from infrastructure.redis_client import get_redis

# STAGE-2 FAIL-3: 런타임 임포트(from api.routes.analyze import ...) 제거.
# 공유 헬퍼를 streaming_helpers에서 모듈 상단에서 임포트해 순환 임포트를 차단한다.
from api.routes.streaming_helpers import (
    _cancel_flags,
    _handle_node_event,
    _publish_confirmation_events,
    _update_last_stage_no,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])


class ConfirmPlanRequest(BaseModel):
    """사용자 컨펌 게이트 요청 body."""
    # None = 전체 stage 포함(기본값), 리스트 = 선택 stage만 포함
    selected_stage_nos: list[int] | None = None
    # 제외할 파일 경로 목록 (체크포인트 files_to_scan 교집합만 적용)
    excluded_file_paths: list[str] = []


@router.post("/confirm/{session_id}", status_code=status.HTTP_202_ACCEPTED)
async def confirm_plan(
    session_id: str,
    req: ConfirmPlanRequest,
    background_tasks: BackgroundTasks,
):
    """계획 컨펌 후 그래프 재개."""
    checkpointer = get_checkpointer()
    if checkpointer is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="checkpointer not initialized — cannot confirm",
        )

    config = {"configurable": {"thread_id": session_id}}

    # 체크포인트에서 현재 stages/files_to_scan 읽기
    try:
        checkpoint_tuple = await checkpointer.aget_tuple(config)
    except Exception as exc:
        logger.error("[confirm] session=%s checkpoint read failed: %s", session_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="checkpoint read failed",
        )

    if checkpoint_tuple is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session checkpoint not found",
        )

    channel_values = checkpoint_tuple.checkpoint.get("channel_values", {})
    original_stages: list[dict] = channel_values.get("stages") or []
    original_files: list[str] = channel_values.get("files_to_scan") or []

    if not original_stages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="no stages found in checkpoint — cannot confirm",
        )

    # stage 선택 필터: selected_stage_nos가 None이면 전체 포함
    filtered_stages = _apply_stage_selection(original_stages, req.selected_stage_nos)

    if not filtered_stages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="all stages excluded — at least one stage must be selected",
        )

    # 제외 파일 적용: 원본 files_to_scan 화이트리스트와 교집합만 허용(경로순회 방어)
    whitelist = set(original_files)
    excluded = set(req.excluded_file_paths) & whitelist  # 외부 경로 무시
    filtered_stages = _apply_file_exclusion(filtered_stages, excluded)

    # 제외 후 모든 stage가 비어있는 경우 400
    non_empty = [s for s in filtered_stages if s.get("files")]
    if not non_empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="all stages are empty after file exclusion",
        )

    # 최종 files_to_scan: stage 순서대로 평탄화
    new_files_to_scan = _flatten_stages(non_empty)

    background_tasks.add_task(
        _run_confirm,
        session_id=session_id,
        new_stages=non_empty,
        new_files_to_scan=new_files_to_scan,
        channel_values=channel_values,
    )
    return {"session_id": session_id, "status": "accepted"}


# ── 내부 헬퍼 ─────────────────────────────────────────────────────────────────

def _apply_stage_selection(
    stages: list[dict],
    selected_stage_nos: list[int] | None,
) -> list[dict]:
    """selected_stage_nos가 None이면 전체를 반환, 리스트면 해당 stage만 반환."""
    if selected_stage_nos is None:
        return list(stages)
    nos = set(selected_stage_nos)
    return [s for s in stages if s.get("stage_no") in nos]


def _apply_file_exclusion(
    stages: list[dict],
    excluded: set[str],
) -> list[dict]:
    """각 stage의 files에서 excluded 경로를 제거한다."""
    if not excluded:
        return stages
    result: list[dict] = []
    for stage in stages:
        remaining = [f for f in stage.get("files", []) if f not in excluded]
        result.append({**stage, "files": remaining})
    return result


def _flatten_stages(stages: list[dict]) -> list[str]:
    """stage 순서대로 파일을 평탄화한다. 중복은 첫 번째 등장만 유지."""
    seen: set[str] = set()
    result: list[str] = []
    for stage in sorted(stages, key=lambda s: s.get("stage_no", 0)):
        for f in stage.get("files", []):
            if f not in seen:
                seen.add(f)
                result.append(f)
    return result


async def _run_confirm(
    session_id: str,
    new_stages: list[dict],
    new_files_to_scan: list[str],
    channel_values: dict,
) -> None:
    """체크포인트 갱신 후 그래프 재개."""
    redis = await get_redis()
    channel = f"secureai:progress:{session_id}"

    async def publish(event_type: str, **kwargs):
        payload = json.dumps({"session_id": session_id, "type": event_type, **kwargs})
        await redis.publish(channel, payload)

    checkpointer = get_checkpointer()
    if checkpointer is None:
        logger.error("[confirm] session=%s checkpointer not initialized", session_id)
        await publish("error", message="checkpointer not initialized — cannot resume after confirm")
        return

    config = {"configurable": {"thread_id": session_id}}

    try:
        # STAGE-2 Dev 보완 #2: graph.aupdate_state(config, values, as_node="planning_node")
        # checkpointer.aupdate_state는 없음. graph 인스턴스로 호출 + as_node 필수.
        graph = get_graph(checkpointer=checkpointer, interrupt=True)
        await graph.aupdate_state(
            config,
            {
                "stages": new_stages,
                "files_to_scan": new_files_to_scan,
                "current_file_index": 0,
                "confirmed": True,
            },
            as_node="planning_node",
        )
        logger.info(
            "[confirm] session=%s state updated stages=%d files=%d",
            session_id, len(new_stages), len(new_files_to_scan),
        )
    except Exception as exc:
        logger.exception("[confirm] session=%s aupdate_state failed: %s", session_id, exc)
        await publish("error", message=f"confirm state update failed: {exc}")
        return

    # 재개 — mcp_session이 필요한 경우 channel_values에서 workspace_root/source_type 복원
    workspace_root = channel_values.get("workspace_root", settings.mcp_workspace_root)
    source_type = channel_values.get("source_type", "local")

    try:
        logger.info("[confirm] session=%s resuming after confirmation workspace=%s",
                    session_id, workspace_root)
        await publish("started")

        async with mcp_session(session_id, workspace_root, settings.mcp_server_script):
            full_state: dict = dict(channel_values)
            full_state.update({
                "stages": new_stages,
                "files_to_scan": new_files_to_scan,
                "current_file_index": 0,
                "confirmed": True,
            })
            last_stage_no: int | None = None

            _cancel_flags[session_id] = False
            try:
                async for event in graph.astream(None, config):  # None = 체크포인트에서 재개
                    if _cancel_flags.get(session_id):
                        logger.info("[confirm] session=%s cancelled by flag", session_id)
                        await publish("cancelled")
                        return

                    node_name, update = next(iter(event.items()))
                    full_state.update(update)
                    state = full_state

                    await _handle_node_event(publish, node_name, state, last_stage_no,
                                             session_id, _cancel_flags)
                    last_stage_no = _update_last_stage_no(node_name, state, last_stage_no)

            except GraphInterrupt:
                logger.info("[confirm] session=%s unexpected GraphInterrupt after confirm", session_id)
                await _publish_confirmation_events(publish, full_state)

            except Exception as exc:
                logger.exception("[confirm] session=%s error during resume", session_id)
                await publish("error", message=str(exc))

    except Exception as exc:
        logger.exception("[confirm] session=%s error", session_id)
        await publish("error", message=str(exc))
    finally:
        _cancel_flags.pop(session_id, None)
