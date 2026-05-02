import asyncio
import json
import logging

import redis.asyncio as aioredis

from agent.agent_state import AgentState
from agent.claude_client import analyze_for_sast
from agent.nodes.code_chunker import chunk_file
from agent.nodes.vuln_classifier import classify_and_enrich
from agent.response_parser import parse_sast_response
from agent.tools.mcp_filesystem_tools import read_file
from agent.tools.mcp_github_tools import get_github_file_content
from config.settings import settings
from infrastructure.backend_api_client import save_vulnerabilities
from infrastructure.progress_log_client import log_completed, log_failed, log_started

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None
_CACHE_PREFIX = "secureai:sast:cache:"
_CACHE_TTL = 60 * 60 * 24 * 7  # 7일
_STEP_ORDER = 2

# 이 라인 수를 초과하면 청크 분할 후 병렬 처리
_CHUNK_THRESHOLD = 300


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _dedup_vulns(vulns: list[dict]) -> list[dict]:
    """같은 (line, type) 조합의 중복 취약점을 제거한다.

    청크 오버랩 구간에서 동일 취약점이 두 번 감지될 수 있으므로
    첫 번째 발견 항목만 유지한다.
    """
    seen: set[tuple] = set()
    result: list[dict] = []
    for v in vulns:
        key = (v.get("line"), v.get("type"))
        if key not in seen:
            seen.add(key)
            result.append(v)
    return result


async def _analyze_chunks(file_path: str, content: str) -> list[dict]:
    """파일을 청크로 분할하고 Claude를 병렬 호출해 취약점 목록을 반환한다.

    300 라인 이하면 청크 없이 단일 호출, 초과면 asyncio.gather로 병렬 처리한다.
    개별 청크 분석 오류는 경고 로그만 남기고 해당 청크 결과를 빈 목록으로 처리한다.
    """
    chunks = chunk_file(file_path, content)

    if len(chunks) == 1:
        raw = await analyze_for_sast(file_path, chunks[0].content)
        return parse_sast_response(raw, file_path)

    # 청크가 여러 개면 병렬 호출 (chunk label을 파일명에 포함해 로그 추적 용이)
    tasks = [
        analyze_for_sast(
            f"{file_path}[chunk {c.chunk_index + 1}/{c.total_chunks}]",
            c.content,
        )
        for c in chunks
    ]
    raw_results = await asyncio.gather(*tasks, return_exceptions=True)

    all_vulns: list[dict] = []
    for chunk, raw in zip(chunks, raw_results):
        if isinstance(raw, BaseException):
            logger.warning(
                "[sast] chunk error file=%s chunk=%d/%d: %s",
                file_path, chunk.chunk_index + 1, chunk.total_chunks, raw,
            )
            continue
        chunk_vulns = parse_sast_response(raw, file_path)
        all_vulns.extend(chunk_vulns)

    return _dedup_vulns(all_vulns)


async def sast_node(state: AgentState) -> dict:
    """
    Claude + MCP 로 현재 파일을 SAST 분석한다.

    - 파일 내용을 MCP 로 다시 읽는다 (state 에 내용을 저장하지 않아 체크포인트 크기 절감)
    - 300 라인 초과 파일은 청크로 분할해 병렬 분석 후 결과를 병합한다
    - 분석 결과를 Redis 에 캐시한다
    - 오류 발생 시 해당 파일 스킵하고 계속 진행 (전체 세션은 유지)
    - 파일 완료 시 progress_percent 를 갱신하고 progress log 에 기록한다
    """
    session_id = state["session_id"]
    idx = state["current_file_index"]
    files = state["files_to_scan"]
    file_path = files[idx]
    sha256 = state.get("current_file_sha256")

    total_files = len(files)
    progress_percent = (idx + 1) / total_files * 100

    logger.info("[sast] session=%s file=%s (%d/%d)", session_id, file_path, idx + 1, total_files)
    await log_started(session_id, "sast", _STEP_ORDER, target=file_path)

    try:
        source_type = state.get("source_type", "local")
        if source_type == "github":
            # github_token은 로그에 절대 출력 금지
            content = await get_github_file_content(
                session_id,
                state["github_owner"],
                state["github_repo"],
                file_path,
                state.get("github_ref"),
                state.get("github_token"),
            )
        else:
            content = await read_file(session_id, file_path)
        raw_vulns = await _analyze_chunks(file_path, content)
        vulns = classify_and_enrich(raw_vulns, file_path)

        if sha256:
            r = _get_redis()
            await r.setex(f"{_CACHE_PREFIX}{sha256}", _CACHE_TTL, json.dumps(vulns))

        await save_vulnerabilities(session_id, state["project_id"], file_path, vulns)
        await log_completed(
            session_id, "sast", _STEP_ORDER,
            target=file_path,
            detail={
                "vulnCount": len(vulns),
                "progressPercent": round(progress_percent, 1),
                "fileIndex": idx + 1,
                "totalFiles": total_files,
            },
        )

        logger.info("[sast] session=%s file=%s vulns=%d progress=%.1f%%", session_id, file_path, len(vulns), progress_percent)
        result = {"file": file_path, "vulnerabilities": vulns, "cached": False}

    except Exception as exc:
        logger.error("[sast] session=%s file=%s error=%s", session_id, file_path, exc)
        await log_failed(
            session_id, "sast", _STEP_ORDER,
            target=file_path,
            detail={"error": str(exc)},
        )
        result = {"file": file_path, "vulnerabilities": [], "error": str(exc)}

    return {
        "sast_results": state.get("sast_results", []) + [result],
        "progress_percent": progress_percent,
    }
