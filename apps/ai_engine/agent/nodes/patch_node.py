"""
패치 생성 노드 — LangGraph 노드.

sast_results에서 취약점 목록을 읽어 각 취약점에 대한 안전한 수정 코드를 생성한다.
Redis 캐시(TTL 24h)를 먼저 확인해 같은 언어·같은 취약점 유형에 대한 재호출을 줄인다.
개별 취약점 처리 오류는 경고 로그 후 스킵하며 전체 세션을 중단하지 않는다.
"""
import json
import logging
import os

import redis.asyncio as aioredis
from opentelemetry import trace
from jinja2 import Environment, FileSystemLoader

from agent.agent_state import AgentState
from agent.llm.factory import get_provider, PROVIDER_GEMINI, PROVIDER_OPENAI
from agent.nodes.diff_generator import parse_patch_response
from config.settings import settings
from infrastructure.backend_api_client import get_patch_examples, report_token_usage, save_patch_results

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

_redis: aioredis.Redis | None = None

_CACHE_PREFIX = "secureai:patch:"
_CACHE_TTL = 60 * 60 * 24  # 24h
_STEP_ORDER = 4

_PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "..", "prompts")
_jinja_env = Environment(
    loader=FileSystemLoader(_PROMPTS_DIR),
    autoescape=False,
)

_LANG_EXTENSIONS: dict[str, str] = {
    ".java": "java",
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".go": "go",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".kt": "kotlin",
    ".swift": "swift",
}


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _detect_language(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    return _LANG_EXTENSIONS.get(ext, "plaintext")


def _build_cache_key(vuln_type: str, file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower().lstrip(".") or "txt"
    return f"{_CACHE_PREFIX}{vuln_type}:{ext}"


async def _call_llm(
    prompt: str, provider: str, api_key: str | None = None, model: str | None = None
) -> str:
    """선택된 provider(anthropic/gemini/openai)로 패치 생성을 요청한다.

    sast_node와 동일하게 get_provider 추상화를 사용한다. preferred_provider를
    무시하고 Anthropic으로 직행하던 버그(gemini 모델 → Anthropic 404)를 방지한다.
    """
    llm = get_provider(provider, api_key=api_key)
    system_text = (
        "You are a security expert specializing in secure code remediation. "
        "Respond only with valid JSON."
    )
    raw, _usage = await llm.analyze(
        system_text, prompt, model or settings.claude_model, max_tokens=2048
    )
    return raw


async def _fetch_prev_patch_example(vuln_type: str, language: str) -> str:
    """이전 성공 패치 예시를 Backend 내부 API로 조회해 프롬프트용 문자열로 반환한다.

    ADR-016: MCP PostgreSQL f-string SQL 대체 — Backend JPQL 파라미터 바인딩 사용.
    실패 시 빈 문자열을 반환하며 패치 생성을 계속 진행한다.
    """
    try:
        items = await get_patch_examples(vuln_type, language)
        if not items:
            return ""
        parts = []
        for item in items:
            original = item.get("originalSnippet", "")
            patched = item.get("patchedSnippet", "")
            explanation = item.get("explanation", "")
            if original and patched:
                parts.append(
                    f"Before:\n{original}\n\nAfter:\n{patched}\n\nExplanation: {explanation}"
                )
        return "\n---\n".join(parts) if parts else ""
    except Exception as exc:
        logger.debug("[patch] prev_patch_example failed vuln_type=%s lang=%s error=%s", vuln_type, language, exc)
        return ""


async def _generate_patch_for_vuln(
    vuln: dict, file_path: str, provider: str, api_key: str | None = None, model: str | None = None
) -> dict | None:
    """취약점 하나에 대한 패치를 생성한다. 실패 시 None을 반환한다."""
    vuln_type = vuln.get("type", "UNKNOWN")
    language = _detect_language(file_path)
    cache_key = _build_cache_key(vuln_type, file_path)
    r = _get_redis()

    cached_raw = await r.get(cache_key)
    if cached_raw:
        patch_result = parse_patch_response(cached_raw, vuln, file_path)
        if patch_result:
            logger.debug("[patch] cache HIT key=%s", cache_key)
            return patch_result.to_dict()

    # Redis 캐시 미스 — Backend 내부 API로 이전 성공 패치 예시 조회 (없으면 "")
    prev_patch_example = await _fetch_prev_patch_example(vuln_type, language)

    template = _jinja_env.get_template("patch_generation.jinja2")
    prompt = template.render(
        vuln_type=vuln_type,
        severity=vuln.get("severity", "MEDIUM"),
        cwe=vuln.get("cwe", ""),
        description=vuln.get("description", ""),
        code_snippet=vuln.get("code_snippet", ""),
        file_path=file_path,
        language=language,
        prev_patch_example=prev_patch_example,
    )

    raw = await _call_llm(prompt, provider, api_key=api_key, model=model)
    patch_result = parse_patch_response(raw, vuln, file_path)
    if patch_result is None:
        return None

    await r.setex(cache_key, _CACHE_TTL, raw)
    logger.debug("[patch] cache MISS key=%s — stored", cache_key)
    return patch_result.to_dict()


async def patch_node(state: AgentState) -> dict:
    """
    sast_results의 모든 파일·취약점에 대해 패치를 생성하고 patch_results를 반환한다.

    - 개별 취약점 오류는 경고 로그 후 스킵 (전체 세션은 유지)
    - 완료 후 Backend에 결과를 저장한다
    - asyncio Task 경계에서 ContextVar 단절 방지를 위해 수동 span 사용
    """
    session_id = state["session_id"]
    project_id = state["project_id"]
    sast_results: list[dict] = state.get("sast_results", [])
    user_api_key: str | None = state.get("user_api_key")
    preferred_model: str | None = state.get("preferred_model")

    # provider/model 해석 (sast_node와 동일 규칙) — preferred_provider를 존중해
    # gemini/openai 패치도 올바른 엔드포인트로 보낸다. (이전: Anthropic 직행 → 404)
    provider = state.get("preferred_provider")
    if provider is None:
        scan_mode = state.get("scan_mode", "PIPELINE")
        provider = settings.audit_provider if scan_mode == "AUDIT" else settings.pipeline_provider
    # gemini 라우팅인데 서버 키도 BYOK 키도 없을 때만 anthropic 폴백 (세션 중단 금지)
    if provider == PROVIDER_GEMINI and not settings.gemini_api_key and not user_api_key:
        provider = "anthropic"
        preferred_model = None
    if preferred_model is None:
        if provider == PROVIDER_GEMINI:
            preferred_model = settings.gemini_model
        elif provider == PROVIDER_OPENAI:
            preferred_model = settings.openai_model
        else:
            preferred_model = settings.claude_model

    with tracer.start_as_current_span("patch_node") as span:
        span.set_attribute("session_id", session_id)
        span.set_attribute("project_id", str(project_id))
        span.set_attribute("sast_result_count", len(sast_results))

        patch_results: list[dict] = []
        for file_result in sast_results:
            file_path = file_result.get("file", "")
            vulns = file_result.get("vulnerabilities", [])
            for vuln in vulns:
                try:
                    result = await _generate_patch_for_vuln(vuln, file_path, provider, api_key=user_api_key, model=preferred_model)
                    if result is not None:
                        patch_results.append(result)
                except Exception as exc:
                    logger.warning(
                        "[patch] skip vuln session=%s file=%s vuln_type=%s error=%s",
                        session_id, file_path, vuln.get("type"), exc,
                    )

        logger.info("[patch] session=%s generated=%d patches", session_id, len(patch_results))

    await save_patch_results(session_id, project_id, patch_results)

    # COST-3: 세션 종료 시 누적 토큰 사용량 집계 1회 콜백 (파일별 POST 금지)
    await _report_session_token_usage(state)

    return {"patch_results": patch_results}


async def _report_session_token_usage(state: AgentState) -> None:
    """세션의 누적 토큰 사용량을 Backend에 1회 보고한다 (COST-3).

    state.token_usage 는 planning_node / sast_node 등에서 _add_usage 로 누적된 값.
    provider/model 은 state.preferred_provider / preferred_model 우선,
    없으면 scan_mode 기반 기본값을 사용한다.
    실패 시 경고 로그만 남기고 세션 완료 처리를 방해하지 않는다.
    """
    session_id = state["session_id"]
    user_id = state.get("user_id") or state.get("userId")
    project_id = state["project_id"]

    # user_id가 없으면 보고 불가 — 경고만 남기고 생략
    if not user_id:
        logger.warning("[patch] token_usage report skipped: user_id missing session=%s", session_id)
        return

    token_usage: dict = state.get("token_usage") or {}
    input_tokens        = int(token_usage.get("input_tokens", 0))
    output_tokens       = int(token_usage.get("output_tokens", 0))
    cache_creation      = int(token_usage.get("cache_creation_input_tokens", 0))
    cache_read          = int(token_usage.get("cache_read_input_tokens", 0))

    # provider/model 결정: preferred_provider → scan_mode fallback
    provider = state.get("preferred_provider")
    model = state.get("preferred_model")

    if not provider:
        scan_mode = (state.get("scan_mode") or "PIPELINE").upper()
        if scan_mode == "AUDIT":
            provider = settings.audit_provider
            model = model or settings.gemini_model
        else:
            provider = settings.pipeline_provider
            model = model or settings.pipeline_model

    if not model:
        model = settings.pipeline_model

    await report_token_usage(
        session_id=session_id,
        user_id=str(user_id),
        project_id=str(project_id),
        provider=provider,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_creation=cache_creation,
        cache_read=cache_read,
    )
