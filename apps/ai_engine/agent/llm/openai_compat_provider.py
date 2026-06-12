"""
OpenAI SDK 기반 LLMProvider 구현체 (Gemini OpenAI호환 엔드포인트 / OpenAI 직접 공용).

핵심 차이점 (Anthropic과의 비교):
  - system 메시지를 messages 배열 첫 번째 항목으로 전달 (role=system)
  - cache_control 헤더 제거 (OpenAI 호환 API는 무시하거나 오류 발생)
  - usage 정규화: prompt_tokens→input_tokens, completion_tokens→output_tokens
  - 응답 markdown 펜스 스트립(```json … ```)
  - 빈 응답("") 가드
"""
import logging
import re

from openai import AsyncOpenAI, BadRequestError, UnprocessableEntityError

logger = logging.getLogger(__name__)

# thinking 최소화: gemini-2.5-flash 는 reasoning 토큰을 사용하므로 budget=0 으로 최소화한다.
# 엔드포인트/모델 버전에 따라 미지원일 수 있어 거부 시 제거하고 재시도한다.
_THINKING_EXTRA_BODY = {"thinking_config": {"thinking_budget": 0}}

# markdown 코드 펜스 제거 정규식
_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)


def _strip_fences(text: str) -> str:
    """응답에서 ```json … ``` 펜스를 제거한다. 펜스 없으면 원문 반환."""
    match = _FENCE_RE.search(text)
    return match.group(1) if match else text


class OpenAICompatProvider:
    """OpenAI SDK로 호출 가능한 엔드포인트 프로바이더.

    Gemini: base_url=GEMINI_BASE_URL, api_key=GEMINI_API_KEY
    OpenAI: base_url=None(기본), api_key=OPENAI_API_KEY
    """

    def __init__(self, api_key: str, base_url: str | None = None) -> None:
        # api_key는 로그에 절대 출력하지 않는다.
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    async def _create_with_thinking_fallback(self, model: str, max_tokens: int, messages: list):
        """thinking 비활성 extra_body로 호출하되, 엔드포인트가 거부하면 제거하고 재시도한다."""
        try:
            return await self._client.chat.completions.create(
                model=model, max_tokens=max_tokens, messages=messages,
                extra_body=_THINKING_EXTRA_BODY,
            )
        except (BadRequestError, UnprocessableEntityError) as exc:
            # 거부 이유는 모델 버전별. 키/페이로드는 로그 금지 — model명과 예외 타입만.
            logger.warning(
                "[openai_compat] thinking_config rejected by endpoint (model=%s): %s; retrying without",
                model, type(exc).__name__,
            )
            return await self._client.chat.completions.create(
                model=model, max_tokens=max_tokens, messages=messages,
            )

    async def analyze(
        self,
        system_text: str,
        user_content: str,
        model: str,
        max_tokens: int = 4096,
    ) -> tuple[str, dict]:
        """OpenAI 호환 chat.completions.create 호출 후 (raw_text, usage_4keys) 반환.

        system 역할을 messages 첫 항목으로 전달한다.
        cache_control은 적용하지 않는다.
        """
        messages = [
            {"role": "system", "content": system_text},
            {"role": "user",   "content": user_content},
        ]
        response = await self._create_with_thinking_fallback(model, max_tokens, messages)

        choice = response.choices[0]
        raw = choice.message.content or ""

        # 빈 응답 가드
        if not raw.strip():
            logger.warning("[openai_compat] model=%s returned empty response, returning empty json", model)
            raw = '{"vulnerabilities": []}'

        # markdown 펜스 스트립
        raw = _strip_fences(raw)

        # usage 정규화 (OpenAI → 내부 4키 형식)
        u = response.usage
        usage = {
            "input_tokens":                  getattr(u, "prompt_tokens", 0) or 0,
            "output_tokens":                 getattr(u, "completion_tokens", 0) or 0,
            "cache_creation_input_tokens":   0,
            "cache_read_input_tokens":       0,
        }
        logger.debug(
            "[openai_compat] model=%s in=%d out=%d",
            model, usage["input_tokens"], usage["output_tokens"],
        )
        return raw, usage
