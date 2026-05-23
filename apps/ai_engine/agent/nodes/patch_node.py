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
from anthropic import AsyncAnthropic
from jinja2 import Environment, FileSystemLoader

from agent.agent_state import AgentState
from agent.nodes.diff_generator import parse_patch_response
from config.settings import settings
from infrastructure.backend_api_client import get_patch_examples, save_patch_results

logger = logging.getLogger(__name__)
tracer = trace.get_tracer(__name__)

_redis: aioredis.Redis | None = None
_client: AsyncAnthropic | None = None

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


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.claude_api_key)
    return _client


def _detect_language(file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower()
    return _LANG_EXTENSIONS.get(ext, "plaintext")


def _build_cache_key(vuln_type: str, file_path: str) -> str:
    ext = os.path.splitext(file_path)[1].lower().lstrip(".") or "txt"
    return f"{_CACHE_PREFIX}{vuln_type}:{ext}"


async def _call_claude(prompt: str, api_key: str | None = None, model: str | None = None) -> str:
    client = AsyncAnthropic(api_key=api_key or settings.claude_api_key) if api_key else _get_client()
    response = await client.messages.create(
        model=model or settings.claude_model,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": "You are a security expert specializing in secure code remediation. Respond only with valid JSON.",
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


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
    vuln: dict, file_path: str, api_key: str | None = None, model: str | None = None
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

    raw = await _call_claude(prompt, api_key=api_key, model=model)
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
                    result = await _generate_patch_for_vuln(vuln, file_path, api_key=user_api_key, model=preferred_model)
                    if result is not None:
                        patch_results.append(result)
                except Exception as exc:
                    logger.warning(
                        "[patch] skip vuln session=%s file=%s vuln_type=%s error=%s",
                        session_id, file_path, vuln.get("type"), exc,
                    )

        logger.info("[patch] session=%s generated=%d patches", session_id, len(patch_results))

    await save_patch_results(session_id, project_id, patch_results)

    return {"patch_results": patch_results}
