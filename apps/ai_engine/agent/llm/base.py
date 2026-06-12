"""
LLM 프로바이더 추상 인터페이스 (Protocol — DIP).

모든 프로바이더는 이 Protocol을 충족해야 한다.
호출부는 구체 클래스가 아닌 LLMProvider 타입에만 의존한다.
"""
from typing import Protocol, runtime_checkable


# usage dict 의 4가지 키 — 모든 프로바이더가 이 형식으로 정규화한다.
USAGE_KEYS = ("input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens")


@runtime_checkable
class LLMProvider(Protocol):
    """SAST 분석에 사용되는 LLM 프로바이더 인터페이스.

    구현체:
      - AnthropicProvider  (anthropic SDK, prompt caching 지원)
      - OpenAICompatProvider (openai SDK — Gemini/OpenAI endpoint 공용)
    """

    async def analyze(
        self,
        system_text: str,
        user_content: str,
        model: str,
        max_tokens: int = 4096,
    ) -> tuple[str, dict]:
        """LLM에 분석을 요청하고 (원문 응답, token_usage_dict)를 반환한다.

        token_usage_dict 는 반드시 아래 4키를 포함해야 한다:
          input_tokens, output_tokens,
          cache_creation_input_tokens, cache_read_input_tokens
        """
        ...
