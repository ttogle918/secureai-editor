"""
POST /agent/analyze  — 분석 세션 시작 (BackgroundTask)
POST /agent/cancel/{session_id}  — 분석 중단 요청
"""
import json
import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, status
from pydantic import BaseModel

from agent.graph_builder import get_graph
from agent.mcp_client import mcp_session
from config.settings import settings
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

        graph = get_graph()
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
            async for event in graph.astream(initial_state):
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
