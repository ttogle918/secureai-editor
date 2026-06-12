import asyncio
import json
import logging
import os
import re

import redis.asyncio as aioredis
from opentelemetry import trace
from prometheus_client import Counter

from agent.agent_state import AgentState
from agent.claude_client import analyze_for_sast
from agent.llm.factory import PROVIDER_ANTHROPIC, PROVIDER_GEMINI, PROVIDER_OPENAI
from agent.nodes.code_chunker import chunk_file
from agent.nodes.vuln_classifier import classify_and_enrich
from infrastructure.backend_api_client import get_vuln_context, save_vulnerabilities
from agent.response_parser import parse_sast_response
from agent.tools.mcp_filesystem_tools import read_file
from agent.tools.mcp_github_tools import get_github_file_content
from config.settings import settings
from infrastructure.guidelines_client import load_guidelines
from infrastructure.progress_log_client import log_completed, log_failed, log_started

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

# Prometheus 커스텀 카운터 — 모듈 레벨 선언으로 프로세스당 한 번만 생성한다.
_ai_tokens_counter = Counter(
    "secureai_ai_tokens_total",
    "Total AI tokens consumed",
    ["service"],
)

_redis: aioredis.Redis | None = None
_CACHE_PREFIX = "secureai:sast:cache:"

# 파일 확장자 → security_guidelines.target_stack 기본 매핑
# Python은 프레임워크 감지가 필요하므로 _detect_stacks 에서 별도 처리한다.
_EXT_TO_STACKS: dict[str, list[str]] = {
    ".java": ["java_spring"],
    ".kt":   ["java_spring"],
    ".js":   ["node_express_nestjs", "common_js"],
    ".ts":   ["frontend_react_nextjs", "common_js"],
    ".tsx":  ["frontend_react_nextjs", "common_js"],
    ".jsx":  ["frontend_react_nextjs", "common_js"],
    ".go":   ["go_gin_echo"],
    ".php":  ["php_web"],
    ".rb":   ["ruby_rails"],
}

# Python 프레임워크 감지 정규식 패턴 (상수화)
_DJANGO_PATTERN = re.compile(r"(?:import django|from django[\s.])", re.MULTILINE)
_FLASK_PATTERN  = re.compile(r"(?:import flask|from flask[\s.])",  re.MULTILINE)
# fastapi는 else 기본값이므로 패턴 불필요


def _detect_stacks(file_path: str, content: str) -> list[str]:
    """파일 경로와 이미 읽은 내용을 바탕으로 target_stack 목록을 반환한다.

    load_guidelines 가 항상 "common" 을 추가하므로 여기서는 common을 명시하지 않는다.
    이중 파일 읽기 및 경로 순회를 방지하기 위해 content 인자를 그대로 사용한다.
    """
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".py":
        framework: str
        if _DJANGO_PATTERN.search(content):
            framework = "python_django"
        elif _FLASK_PATTERN.search(content):
            framework = "python_flask"
        else:
            framework = "python_fastapi"
        return ["common_python", framework]

    return list(_EXT_TO_STACKS.get(ext, ["common"]))


_CACHE_TTL = 60 * 60 * 24 * 7  # 7일
_STEP_ORDER = 2

# 이 라인 수를 초과하면 청크 분할 후 병렬 처리
_CHUNK_THRESHOLD = 300


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def _publish_scanning(
    session_id: str,
    file_path: str,
    idx: int,
    total_files: int,
) -> None:
    """SAST 시작 시점에 Redis 채널에 scanning 이벤트를 발행한다.

    publish 실패는 warning 로그만 남기고 분석 흐름을 막지 않는다.
    """
    try:
        channel = f"secureai:progress:{session_id}"
        payload = json.dumps({
            "session_id": session_id,
            "type": "progress",
            "node": "sast",
            "phase": "scanning",
            "file": file_path,
            "current": idx + 1,
            "total": total_files,
        })
        await _get_redis().publish(channel, payload)
    except Exception as exc:
        logger.warning("[sast] scanning publish failed session=%s file=%s: %s", session_id, file_path, exc)


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


_EMPTY_USAGE: dict = {
    "input_tokens": 0, "output_tokens": 0,
    "cache_creation_input_tokens": 0, "cache_read_input_tokens": 0,
}


def _add_usage(a: dict, b: dict) -> dict:
    return {k: a.get(k, 0) + b.get(k, 0) for k in _EMPTY_USAGE}


async def _analyze_chunks(
    file_path: str,
    content: str,
    guidelines: str = "",
    model: str | None = None,
    api_key: str | None = None,
    provider: str = PROVIDER_ANTHROPIC,
) -> tuple[list[dict], dict]:
    """파일을 청크로 분할하고 LLM 프로바이더를 병렬 호출해 (취약점 목록, token_usage)를 반환한다.

    300 라인 이하면 청크 없이 단일 호출, 초과면 asyncio.gather로 병렬 처리한다.
    개별 청크 분석 오류는 경고 로그만 남기고 해당 청크 결과를 빈 목록으로 처리한다.
    """
    chunks = chunk_file(file_path, content)

    if len(chunks) == 1:
        raw, usage = await analyze_for_sast(
            file_path, chunks[0].content, guidelines, model, api_key, provider=provider
        )
        return parse_sast_response(raw, file_path), usage

    tasks = [
        analyze_for_sast(
            f"{file_path}[chunk {c.chunk_index + 1}/{c.total_chunks}]",
            c.content,
            guidelines,
            model,
            api_key,
            provider=provider,
        )
        for c in chunks
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    all_vulns: list[dict] = []
    total_usage = dict(_EMPTY_USAGE)
    for chunk, result in zip(chunks, results):
        if isinstance(result, BaseException):
            logger.warning(
                "[sast] chunk error file=%s chunk=%d/%d: %s",
                file_path, chunk.chunk_index + 1, chunk.total_chunks, result,
            )
            continue
        raw, usage = result
        all_vulns.extend(parse_sast_response(raw, file_path))
        total_usage = _add_usage(total_usage, usage)

    return _dedup_vulns(all_vulns), total_usage


async def _fetch_prev_vuln_context(project_id) -> str:
    """이전에 발견된 취약점 유형 목록을 Backend 내부 API로 조회해 컨텍스트 문자열로 반환한다.

    ADR-016: MCP PostgreSQL f-string SQL 대체 — Backend JPQL 파라미터 바인딩 사용.
    실패 시 빈 문자열을 반환하며 분석을 중단하지 않는다.
    """
    try:
        items = await get_vuln_context(str(project_id))
        if not items:
            return ""
        lines = [
            f"{item['vulnType']} | count: {item['count']} | max_severity: {item['maxSeverity']}"
            for item in items
            if item.get("vulnType")
        ]
        return "\n".join(lines) if lines else ""
    except Exception as exc:
        logger.warning("[sast] prev_vuln_context failed project=%s error=%s", project_id, exc)
        return ""


async def sast_node(state: AgentState) -> dict:
    """
    Claude + MCP 로 현재 파일을 SAST 분석한다.

    - 파일 내용을 MCP 로 다시 읽는다 (state 에 내용을 저장하지 않아 체크포인트 크기 절감)
    - 300 라인 초과 파일은 청크로 분할해 병렬 분석 후 결과를 병합한다
    - 분석 결과를 Redis 에 캐시한다
    - 오류 발생 시 해당 파일 스킵하고 계속 진행 (전체 세션은 유지)
    - 파일 완료 시 progress_percent 를 갱신하고 progress log 에 기록한다
    - asyncio Task 경계에서 ContextVar 단절 방지를 위해 수동 span 사용
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
    await _publish_scanning(session_id, file_path, idx, total_files)

    with tracer.start_as_current_span("sast_node") as span:
      span.set_attribute("session_id", session_id)
      span.set_attribute("file_path", file_path)
      span.set_attribute("file_index", idx)
      span.set_attribute("total_files", total_files)

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

        stacks = _detect_stacks(file_path, content)
        guidelines = await load_guidelines(stacks)

        # OTel span 안에서 조회하여 DB 조회 시간도 트레이싱에 포함된다.
        prev_vuln_context = await _fetch_prev_vuln_context(state["project_id"])
        if prev_vuln_context:
            guidelines = (
                guidelines
                + "\n\n### Previous Vulnerabilities in This Project (last 30 days)\n"
                + prev_vuln_context
            )

        # ── Provider/Model 결정 블록 ──────────────────────────────────────────
        # 우선순위:
        # 1. preferred_provider (COST-4 에서 state에 주입 — 현재 없으면 None)
        # 2. scan_mode 기반 라우팅 (AUDIT→audit_provider, PIPELINE→pipeline_provider)
        # 3. AUDIT→gemini 인데 키 없음 → anthropic audit_model 폴백 (세션 중단 금지)
        preferred_provider: str | None = state.get("preferred_provider")  # COST-4 준비
        if preferred_provider is None:
            scan_mode = state.get("scan_mode", "PIPELINE")
            if scan_mode == "AUDIT":
                preferred_provider = settings.audit_provider
            else:
                preferred_provider = settings.pipeline_provider

        # AUDIT fallback: gemini 라우팅인데 키 없으면 anthropic haiku로 폴백
        resolved_provider = preferred_provider
        if resolved_provider == PROVIDER_GEMINI and not settings.gemini_api_key:
            logger.warning(
                "[sast] session=%s AUDIT→gemini requested but GEMINI_API_KEY not set; "
                "falling back to anthropic audit_model=%s",
                session_id, settings.audit_model,
            )
            resolved_provider = PROVIDER_ANTHROPIC

        # preferred_model(BYOK)이 명시적으로 지정된 경우 그것을 최우선으로 사용한다.
        # 없으면 provider/scan_mode에 맞는 기본 모델을 settings에서 직접 조회한다.
        preferred_model = state.get("preferred_model")
        if preferred_model is None:
            effective_scan_mode = state.get("scan_mode", "PIPELINE")
            if resolved_provider == PROVIDER_ANTHROPIC and effective_scan_mode == "AUDIT":
                # anthropic fallback 또는 원래 anthropic audit 라우팅
                preferred_model = settings.audit_model
            elif resolved_provider == PROVIDER_ANTHROPIC:
                preferred_model = settings.pipeline_model
            elif resolved_provider == PROVIDER_GEMINI:
                preferred_model = settings.gemini_model
            elif resolved_provider == PROVIDER_OPENAI:
                preferred_model = settings.openai_model
            else:
                preferred_model = settings.pipeline_model

        user_api_key = state.get("user_api_key")
        raw_vulns, file_usage = await _analyze_chunks(
            file_path, content, guidelines, preferred_model, user_api_key, resolved_provider
        )
        vulns = classify_and_enrich(raw_vulns, file_path)

        token_count = file_usage.get("input_tokens", 0) + file_usage.get("output_tokens", 0)
        if token_count > 0:
            _ai_tokens_counter.labels(service="sast").inc(token_count)

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

        logger.info(
            "[sast] session=%s file=%s vulns=%d progress=%.1f%% in=%d out=%d",
            session_id, file_path, len(vulns), progress_percent,
            file_usage["input_tokens"], file_usage["output_tokens"],
        )
        result = {"file": file_path, "vulnerabilities": vulns, "cached": False}

      except Exception as exc:
          logger.error("[sast] session=%s file=%s error=%s", session_id, file_path, exc)
          await log_failed(
              session_id, "sast", _STEP_ORDER,
              target=file_path,
              detail={"error": str(exc)},
          )
          file_usage = dict(_EMPTY_USAGE)
          result = {"file": file_path, "vulnerabilities": [], "error": str(exc)}

    prev_usage = state.get("token_usage") or dict(_EMPTY_USAGE)
    return {
        "sast_results": state.get("sast_results", []) + [result],
        "progress_percent": progress_percent,
        "token_usage": _add_usage(prev_usage, file_usage),
    }
