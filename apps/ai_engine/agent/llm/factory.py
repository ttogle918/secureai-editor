"""
LLM 프로바이더 팩토리.

get_provider(provider, api_key=None) -> LLMProvider

- anthropic: AnthropicProvider (플랫폼 키 싱글턴 / BYOK 1회용)
- gemini:    OpenAICompatProvider (Gemini OpenAI호환 엔드포인트)
- openai:    OpenAICompatProvider (OpenAI 직접)
- 미지원:    ValueError 즉시 발생
"""
import logging

from agent.llm.base import LLMProvider
from agent.llm.anthropic_provider import AnthropicProvider
from agent.llm.openai_compat_provider import OpenAICompatProvider
from config.settings import settings

logger = logging.getLogger(__name__)

# provider 리터럴 상수 — 매직 스트링 금지
PROVIDER_ANTHROPIC = "anthropic"
PROVIDER_GEMINI    = "gemini"
PROVIDER_OPENAI    = "openai"

# Gemini OpenAI호환 엔드포인트 — 상수화
GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"

# 플랫폼 anthropic 싱글턴 캐시 (BYOK가 아닐 때 재사용)
_anthropic_singleton: AnthropicProvider | None = None


def get_provider(provider: str, api_key: str | None = None) -> LLMProvider:
    """프로바이더 식별자에 맞는 LLMProvider 인스턴스를 반환한다.

    Args:
        provider: "anthropic" | "gemini" | "openai"
        api_key:  BYOK 키. None이면 플랫폼 기본 키 사용.

    Returns:
        LLMProvider Protocol을 충족하는 인스턴스.

    Raises:
        ValueError: 지원하지 않는 provider 식별자인 경우.
        ValueError: gemini/openai 요청인데 플랫폼 키도 없고 api_key도 없는 경우.
    """
    global _anthropic_singleton

    if provider == PROVIDER_ANTHROPIC:
        if api_key:
            # BYOK: 1회용 인스턴스
            return AnthropicProvider(api_key=api_key)
        # 플랫폼 키: 싱글턴 재사용
        if _anthropic_singleton is None:
            _anthropic_singleton = AnthropicProvider(api_key=None)
        return _anthropic_singleton

    if provider == PROVIDER_GEMINI:
        effective_key = api_key or settings.gemini_api_key
        if not effective_key:
            raise ValueError(
                "Gemini provider requested but GEMINI_API_KEY is not configured. "
                "Set GEMINI_API_KEY in .env or pass api_key explicitly."
            )
        return OpenAICompatProvider(api_key=effective_key, base_url=GEMINI_BASE_URL)

    if provider == PROVIDER_OPENAI:
        effective_key = api_key or settings.openai_api_key
        if not effective_key:
            raise ValueError(
                "OpenAI provider requested but OPENAI_API_KEY is not configured. "
                "Set OPENAI_API_KEY in .env or pass api_key explicitly."
            )
        return OpenAICompatProvider(api_key=effective_key, base_url=None)

    raise ValueError(
        f"Unsupported provider: '{provider}'. "
        f"Supported values: {PROVIDER_ANTHROPIC!r}, {PROVIDER_GEMINI!r}, {PROVIDER_OPENAI!r}."
    )
