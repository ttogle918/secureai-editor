"""
POST /agent/analyze          — 새 분석 세션 시작 (BackgroundTask)
POST /agent/resume/{id}      — 체크포인트에서 재개 (BackgroundTask)
POST /agent/cancel/{id}      — 분석 중단 요청
"""
import json
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel

from agent.graph_builder import get_graph
from agent.mcp_client import mcp_session
from config.settings import settings
from infrastructure.checkpointer import get_checkpointer
from infrastructure.redis_client import get_redis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["agent"])

_cancel_flags: dict[str, bool] = {}


class AnalyzeRequest(BaseModel):
    session_id: str
    project_id: str
    workspace_root: str


@router.post("/analyze", status_code=status.HTTP_202_ACCEPTED)
async def start_analyze(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    _cancel_flags[req.session_id] = False
    background_tasks.add_task(_run_analysis, req.session_id, req.project_id, req.workspace_root)
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


async def _run_analysis(session_id: str, project_id: str, workspace_root: str) -> None:
    redis = await get_redis()
    channel = f"secureai:progress:{session_id}"

    async def publish(event_type: str, **kwargs):
        payload = json.dumps({"session_id": session_id, "type": event_type, **kwargs})
        await redis.publish(channel, payload)

    try:
        logger.info("[analyze] session=%s starting", session_id)
        await publish("started")

        checkpointer = get_checkpointer()
        graph = get_graph(checkpointer=checkpointer)
        config = {"configurable": {"thread_id": session_id}}
        initial_state = {
            "session_id": session_id,
            "project_id": project_id,
            "workspace_root": workspace_root,
            "files_to_scan": [],
            "current_file_index": 0,
            "current_file_sha256": None,
            "cache_hit": False,
            "sast_results": [],
            "status": "running",
            "error_message": None,
        }

        async with mcp_session(session_id, workspace_root, settings.mcp_server_script):
            async for event in graph.astream(initial_state, config):
                if _cancel_flags.get(session_id):
                    logger.info("[analyze] session=%s cancelled by flag", session_id)
                    await publish("cancelled")
                    return

                node_name, state = next(iter(event.items()))

                if node_name == "scan_files_node":
                    total = len(state.get("files_to_scan", []))
                    await publish("scan_complete", total=total)

                elif node_name == "cache_check_node":
                    idx = state.get("current_file_index", 0)
                    files = state.get("files_to_scan", [])
                    file_path = files[idx] if idx < len(files) else ""
                    hit = state.get("cache_hit", False)
                    await publish(
                        "progress",
                        node="cache_check",
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
                        file=file_path,
                        current=idx + 1,
                        total=len(files),
                    )

                elif node_name == "aggregate_node":
                    results = state.get("sast_results", [])
                    await publish("completed", vuln_count=len(results), results=results)

    except Exception as exc:
        logger.exception("[analyze] session=%s error", session_id)
        await publish("error", message=str(exc))
    finally:
        _cancel_flags.pop(session_id, None)


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

    # 체크포인트 상태에서 workspace_root 읽기
    workspace_root = settings.mcp_workspace_root
    try:
        checkpoint_tuple = await checkpointer.aget_tuple(config)
        if checkpoint_tuple:
            channel_values = checkpoint_tuple.checkpoint.get("channel_values", {})
            workspace_root = channel_values.get("workspace_root", workspace_root)
    except Exception as exc:
        logger.warning("[resume] session=%s checkpoint read failed: %s", session_id, exc)

    graph = get_graph(checkpointer=checkpointer)

    try:
        logger.info("[resume] session=%s resuming workspace=%s", session_id, workspace_root)
        await publish("started")

        async with mcp_session(session_id, workspace_root, settings.mcp_server_script):
            async for event in graph.astream(None, config):  # None = 체크포인트에서 재개
                if _cancel_flags.get(session_id):
                    logger.info("[resume] session=%s cancelled by flag", session_id)
                    await publish("cancelled")
                    return

                node_name, state = next(iter(event.items()))

                if node_name == "scan_files_node":
                    total = len(state.get("files_to_scan", []))
                    await publish("scan_complete", total=total)

                elif node_name == "cache_check_node":
                    idx = state.get("current_file_index", 0)
                    files = state.get("files_to_scan", [])
                    file_path = files[idx] if idx < len(files) else ""
                    hit = state.get("cache_hit", False)
                    await publish(
                        "progress",
                        node="cache_check",
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
                        file=file_path,
                        current=idx + 1,
                        total=len(files),
                    )

                elif node_name == "aggregate_node":
                    results = state.get("sast_results", [])
                    await publish("completed", vuln_count=len(results), results=results)

    except Exception as exc:
        logger.exception("[resume] session=%s error", session_id)
        await publish("error", message=str(exc))
    finally:
        _cancel_flags.pop(session_id, None)
