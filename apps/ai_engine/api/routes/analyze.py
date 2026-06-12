"""
POST /agent/analyze          — 새 분석 세션 시작 (BackgroundTask)
POST /agent/resume/{id}      — 체크포인트에서 재개 (BackgroundTask)
POST /agent/cancel/{id}      — 분석 중단 요청
"""
import json
import logging
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel

from agent.graph_builder import get_graph
from agent.mcp_client import mcp_session
from config.settings import settings
from infrastructure.checkpointer import get_checkpointer
from infrastructure.redis_client import get_redis
from infrastructure.workspace_staging import cleanup_staged_workspace, is_workspace_id, stage_workspace

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])


# ── stage 이벤트 헬퍼 ─────────────────────────────────────────────────────────

def _find_stage_for_file(file_path: str, stages: list[dict]) -> dict | None:
    """파일이 속한 stage를 반환한다. 없으면 None."""
    for stage in stages:
        if file_path in stage.get("files", []):
            return stage
    return None


async def _emit_stage_events(
    publish,
    file_path: str,
    stages: list[dict],
    last_stage_no: int | None,
) -> int | None:
    """파일의 stage가 직전과 달라지면 stage_started 이벤트를 발행한다.

    Returns:
        현재 stage_no (이벤트 발행 여부와 무관하게 최신값 반환)
    """
    if not stages:
        return last_stage_no

    stage = _find_stage_for_file(file_path, stages)
    if stage is None:
        return last_stage_no

    current_stage_no = stage.get("stage_no")
    if current_stage_no != last_stage_no:
        await publish(
            "stage_started",
            stage_no=current_stage_no,
            name=stage.get("name"),
            total_in_stage=len(stage.get("files", [])),
        )
    return current_stage_no


def _is_stage_completed(
    files: list[str],
    stages: list[dict],
    next_idx: int,
    last_stage_no: int,
) -> bool:
    """next_file_node 이후 stage 완료 여부를 판정한다.

    다음 처리 파일(next_idx)의 stage가 last_stage_no와 다르거나
    파일이 소진됐으면 stage 완료로 간주한다.
    """
    if next_idx >= len(files):
        return True
    next_file = files[next_idx]
    next_stage = _find_stage_for_file(next_file, stages)
    if next_stage is None:
        return False
    return next_stage.get("stage_no") != last_stage_no

_cancel_flags: dict[str, bool] = {}


class AnalyzeRequest(BaseModel):
    session_id: str
    project_id: str
    workspace_root: str = ""
    source_type: str = "local"
    scan_mode: str = "PIPELINE"          # "AUDIT" | "PIPELINE"
    planning_mode: Literal["DETERMINISTIC", "LLM"] = "DETERMINISTIC"
    github_owner: str | None = None
    github_repo: str | None = None
    github_ref: str | None = None
    github_token: str | None = None      # 복호화된 값 (로그 출력 금지)
    preferred_model: str | None = None
    user_api_key: str | None = None      # BYOK 복호화 키 (로그 출력 금지)
    preferred_provider: str | None = None  # COST-4 멀티-프로바이더 (anthropic|gemini|openai)
    file_filter: list[str] | None = None # 선택 분석 — None/빈 값 = 전체 (하위 호환)
    # COST-3: 세션 종료 시 토큰 사용량 콜백에 사용 (로그 출력 금지)
    user_id: str | None = None


@router.post("/analyze", status_code=status.HTTP_202_ACCEPTED)
async def start_analyze(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    _cancel_flags[req.session_id] = False
    background_tasks.add_task(_run_analysis, req)
    return {"session_id": req.session_id, "status": "accepted"}


@router.post("/resume/{session_id}", status_code=status.HTTP_202_ACCEPTED)
async def resume_analyze(session_id: str, background_tasks: BackgroundTasks):
    _cancel_flags[session_id] = False
    background_tasks.add_task(_run_resume, session_id)
    return {"session_id": session_id, "status": "accepted"}


@router.post("/cancel/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_analyze(session_id: str):
    if session_id not in _cancel_flags:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="session not found")
    _cancel_flags[session_id] = True


async def _run_analysis(req: AnalyzeRequest) -> None:
    session_id = req.session_id
    redis = await get_redis()
    channel = f"secureai:progress:{session_id}"

    async def publish(event_type: str, **kwargs):
        payload = json.dumps({"session_id": session_id, "type": event_type, **kwargs})
        await redis.publish(channel, payload)

    staged_path: str | None = None
    try:
        # github_token은 로그에 절대 출력 금지
        logger.info("[analyze] session=%s starting source_type=%s", session_id, req.source_type)
        await publish("started")

        # 로컬 워크스페이스: Redis ID → 임시 디렉토리로 스테이징
        workspace_root = req.workspace_root
        if req.source_type != "github" and is_workspace_id(workspace_root):
            workspace_root = await stage_workspace(workspace_root)
            staged_path = workspace_root

        checkpointer = get_checkpointer()
        graph = get_graph(checkpointer=checkpointer)
        config = {"configurable": {"thread_id": session_id}}
        initial_state = {
            "session_id": session_id,
            "project_id": req.project_id,
            "workspace_root": workspace_root,
            "source_type": req.source_type,
            "scan_mode": req.scan_mode,
            "github_owner": req.github_owner,
            "github_repo": req.github_repo,
            "github_ref": req.github_ref,
            "github_token": req.github_token,
            "preferred_model": req.preferred_model,
            "user_api_key": req.user_api_key,
            "preferred_provider": req.preferred_provider,  # COST-4 멀티-프로바이더
            "user_id": req.user_id,                         # COST-3 토큰 사용량 콜백용
            "files_to_scan": [],
            "file_filter": req.file_filter,
            "api_groups": [],
            "planning_mode": req.planning_mode,
            "stages": [],
            "current_file_index": 0,
            "current_file_sha256": None,
            "cache_hit": False,
            "sast_results": [],
            "patch_results": [],
            "progress_percent": 0.0,
            "token_usage": {"input_tokens": 0, "output_tokens": 0, "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0},
            "status": "running",
            "error_message": None,
        }

        async with mcp_session(session_id, workspace_root, settings.mcp_server_script):
            last_stage_no: int | None = None
            # astream 기본(updates) 모드는 각 노드의 "부분 출력"만 준다.
            # 누적 state를 유지해야 다른 노드가 채운 값(files_to_scan·
            # current_file_index·stages·sast_results·token_usage)을 정확히 읽는다.
            full_state: dict = dict(initial_state)
            async for event in graph.astream(initial_state, config):
                if _cancel_flags.get(session_id):
                    logger.info("[analyze] session=%s cancelled by flag", session_id)
                    await publish("cancelled")
                    return

                node_name, update = next(iter(event.items()))
                full_state.update(update)
                state = full_state

                if node_name == "scan_files_node":
                    files = state.get("files_to_scan", [])
                    await publish("scan_complete", total=len(files), files=files)

                elif node_name == "api_discovery_node":
                    await publish("api_plan", api_groups=state.get("api_groups", []))

                elif node_name == "planning_node":
                    stages = state.get("stages", [])
                    await publish(
                        "stage_plan",
                        stages=[
                            {
                                "stage_no": s.get("stage_no"),
                                "name": s.get("name"),
                                "file_count": len(s.get("files", [])),
                            }
                            for s in stages
                        ],
                    )

                elif node_name == "cache_check_node":
                    idx = state.get("current_file_index", 0)
                    files = state.get("files_to_scan", [])
                    stages = state.get("stages", [])
                    file_path = files[idx] if idx < len(files) else ""
                    hit = state.get("cache_hit", False)
                    last_stage_no = await _emit_stage_events(
                        publish, file_path, stages, last_stage_no
                    )
                    await publish(
                        "progress",
                        node="cache_check",
                        phase="checking",
                        file=file_path,
                        current=idx + 1,
                        total=len(files),
                        cache_hit=hit,
                    )

                elif node_name == "sast_node":
                    idx = state.get("current_file_index", 0)
                    files = state.get("files_to_scan", [])
                    file_path = files[idx] if idx < len(files) else ""
                    await publish(
                        "progress",
                        node="sast",
                        phase="done",
                        file=file_path,
                        current=idx + 1,
                        total=len(files),
                    )

                elif node_name == "next_file_node":
                    # stage 완료 감지: 다음 파일의 stage가 바뀌거나 파일이 소진됐을 때
                    files = state.get("files_to_scan", [])
                    stages = state.get("stages", [])
                    next_idx = state.get("current_file_index", 0)
                    if last_stage_no is not None:
                        completed = _is_stage_completed(files, stages, next_idx, last_stage_no)
                        if completed:
                            await publish("stage_completed", stage_no=last_stage_no)

                elif node_name == "aggregate_node":
                    results = state.get("sast_results", [])
                    vuln_count = sum(len(r.get("vulnerabilities", [])) for r in results)
                    await publish("progress", node="aggregate", vuln_count=vuln_count)

                elif node_name == "patch_node":
                    results = state.get("sast_results", [])
                    vuln_count = sum(len(r.get("vulnerabilities", [])) for r in results)
                    token_usage = state.get("token_usage", {})
                    await publish("completed", vuln_count=vuln_count, results=results, token_usage=token_usage)

    except Exception as exc:
        logger.exception("[analyze] session=%s error", session_id)
        await publish("error", message=str(exc))
    finally:
        _cancel_flags.pop(session_id, None)
        if staged_path:
            cleanup_staged_workspace(staged_path)


async def _run_resume(session_id: str) -> None:
    redis = await get_redis()
    channel = f"secureai:progress:{session_id}"

    async def publish(event_type: str, **kwargs):
        payload = json.dumps({"session_id": session_id, "type": event_type, **kwargs})
        await redis.publish(channel, payload)

    checkpointer = get_checkpointer()
    if checkpointer is None:
        logger.error("[resume] session=%s checkpointer not initialized", session_id)
        await publish("error", message="checkpointer not initialized — cannot resume")
        return

    config = {"configurable": {"thread_id": session_id}}

    # 체크포인트 상태에서 workspace_root 및 source_type 읽기
    workspace_root = settings.mcp_workspace_root
    source_type = "local"
    resumed_values: dict = {}
    try:
        checkpoint_tuple = await checkpointer.aget_tuple(config)
        if checkpoint_tuple:
            resumed_values = checkpoint_tuple.checkpoint.get("channel_values", {})
            workspace_root = resumed_values.get("workspace_root", workspace_root)
            source_type = resumed_values.get("source_type", "local")
    except Exception as exc:
        logger.warning("[resume] session=%s checkpoint read failed: %s", session_id, exc)

    graph = get_graph(checkpointer=checkpointer)

    try:
        # github_token은 로그에 절대 출력 금지
        logger.info("[resume] session=%s resuming workspace=%s source_type=%s",
                    session_id, workspace_root, source_type)
        await publish("started")

        async with mcp_session(session_id, workspace_root, settings.mcp_server_script):
            last_stage_no: int | None = None
            # 누적 state 유지 (resume은 체크포인트 channel_values에서 시작)
            full_state: dict = dict(resumed_values)
            async for event in graph.astream(None, config):  # None = 체크포인트에서 재개
                if _cancel_flags.get(session_id):
                    logger.info("[resume] session=%s cancelled by flag", session_id)
                    await publish("cancelled")
                    return

                node_name, update = next(iter(event.items()))
                full_state.update(update)
                state = full_state

                if node_name == "scan_files_node":
                    files = state.get("files_to_scan", [])
                    await publish("scan_complete", total=len(files), files=files)

                elif node_name == "api_discovery_node":
                    await publish("api_plan", api_groups=state.get("api_groups", []))

                elif node_name == "planning_node":
                    stages = state.get("stages", [])
                    await publish(
                        "stage_plan",
                        stages=[
                            {
                                "stage_no": s.get("stage_no"),
                                "name": s.get("name"),
                                "file_count": len(s.get("files", [])),
                            }
                            for s in stages
                        ],
                    )

                elif node_name == "cache_check_node":
                    idx = state.get("current_file_index", 0)
                    files = state.get("files_to_scan", [])
                    stages = state.get("stages", [])
                    file_path = files[idx] if idx < len(files) else ""
                    hit = state.get("cache_hit", False)
                    last_stage_no = await _emit_stage_events(
                        publish, file_path, stages, last_stage_no
                    )
                    await publish(
                        "progress",
                        node="cache_check",
                        phase="checking",
                        file=file_path,
                        current=idx + 1,
                        total=len(files),
                        cache_hit=hit,
                    )

                elif node_name == "sast_node":
                    idx = state.get("current_file_index", 0)
                    files = state.get("files_to_scan", [])
                    file_path = files[idx] if idx < len(files) else ""
                    await publish(
                        "progress",
                        node="sast",
                        phase="done",
                        file=file_path,
                        current=idx + 1,
                        total=len(files),
                    )

                elif node_name == "next_file_node":
                    files = state.get("files_to_scan", [])
                    stages = state.get("stages", [])
                    next_idx = state.get("current_file_index", 0)
                    if last_stage_no is not None:
                        completed = _is_stage_completed(files, stages, next_idx, last_stage_no)
                        if completed:
                            await publish("stage_completed", stage_no=last_stage_no)

                elif node_name == "aggregate_node":
                    results = state.get("sast_results", [])
                    vuln_count = sum(len(r.get("vulnerabilities", [])) for r in results)
                    await publish("progress", node="aggregate", vuln_count=vuln_count)

                elif node_name == "patch_node":
                    results = state.get("sast_results", [])
                    vuln_count = sum(len(r.get("vulnerabilities", [])) for r in results)
                    token_usage = state.get("token_usage", {})
                    await publish("completed", vuln_count=vuln_count, results=results, token_usage=token_usage)

    except Exception as exc:
        logger.exception("[resume] session=%s error", session_id)
        await publish("error", message=str(exc))
    finally:
        _cancel_flags.pop(session_id, None)
