"""
Anthropic SDK 기반 LLMProvider 구현체.

- system prompt 에 ephemeral cache_control 적용 (prompt caching, 반복 호출 비용 절감)
- 플랫폼 키: 싱글턴 클라이언트 재사용
- BYOK 키: 1회용 클라이언트 생성
"""
import logging

from anthropic import AsyncAnthropic

from config.settings import settings

logger = logging.getLogger(__name__)

# 플랫폼 키 싱글턴 — 모듈 레벨 보관
_platform_client: AsyncAnthropic | None = None


def _get_client(api_key: str | None) -> AsyncAnthropic:
    """플랫폼 싱글턴 또는 BYOK 1회용 클라이언트를 반환한다."""
    if api_key:
        # BYOK: 키를 로그에 절대 출력하지 않는다.
        return AsyncAnthropic(api_key=api_key)
    global _platform_client
    if _platform_client is None:
        _platform_client = AsyncAnthropic(api_key=settings.claude_api_key)
    return _platform_client


class AnthropicProvider:
    """Anthropic Claude API 프로바이더.

    prompt caching(ephemeral)을 system 블록에 적용한다.
    """

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key

    async def analyze(
        self,
        system_text: str,
        user_content: str,
        model: str,
        max_tokens: int = 4096,
    ) -> tuple[str, dict]:
        """Anthropic messages.create 호출 후 (raw_text, usage_4keys) 반환."""
        client = _get_client(self._api_key)
        response = await client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=[
                {
                    "type": "text",
                    "text": system_text,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[
                {"role": "user", "content": user_content}
            ],
        )

        raw = response.content[0].text
        u = response.usage
        usage = {
            "input_tokens":                  u.input_tokens,
            "output_tokens":                 u.output_tokens,
            "cache_creation_input_tokens":   getattr(u, "cache_creation_input_tokens", 0) or 0,
            "cache_read_input_tokens":       getattr(u, "cache_read_input_tokens", 0) or 0,
        }
        logger.debug(
            "[anthropic] model=%s in=%d out=%d cache_write=%d cache_read=%d",
            model,
            usage["input_tokens"], usage["output_tokens"],
            usage["cache_creation_input_tokens"], usage["cache_read_input_tokens"],
        )
        return raw, usage
