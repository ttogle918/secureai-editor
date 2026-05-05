"""
보안 전문가 채팅 클라이언트 — multi-turn 스트리밍.

- AsyncAnthropic.messages.stream() 으로 SSE 청크 전달
- 시스템 프롬프트에 prompt caching (cache_control: ephemeral) 적용
- 이력은 최대 10턴(메시지 20개)으로 제한
"""
import logging
from typing import AsyncIterator

from anthropic import AsyncAnthropic

from config.settings import settings

logger = logging.getLogger(__name__)

_client: AsyncAnthropic | None = None

# 이력 최대 메시지 수 (role 기준 턴 아님, 실제 메시지 오브젝트 수)
_MAX_HISTORY_MESSAGES = 20  # 10턴 = user/assistant 각 10개

_SYSTEM_PROMPT = """\
You are a security expert specializing in software vulnerability analysis (SAST, DAST, CVE).
You help developers understand security vulnerabilities found in their code and suggest remediations.

Guidelines:
- Respond in the same language as the user's question (Korean or English).
- Be concise, accurate, and actionable.
- When referencing vulnerabilities, cite CWE IDs and OWASP categories where applicable.
- Never fabricate vulnerability data; if uncertain, say so clearly.\
"""


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.claude_api_key)
    return _client


def _trim_history(history: list[dict]) -> list[dict]:
    """이력이 최대 메시지 수를 초과하면 오래된 것부터 드롭한다."""
    if len(history) <= _MAX_HISTORY_MESSAGES:
        return history
    # 오래된 메시지를 앞에서 제거. 짝이 맞도록 2개씩 드롭 (user+assistant 한 쌍)
    excess = len(history) - _MAX_HISTORY_MESSAGES
    # 짝수 단위로 드롭해 role 순서 유지
    drop_count = excess if excess % 2 == 0 else excess + 1
    return history[drop_count:]


async def stream_chat(
    session_id: str,
    history: list[dict],
    user_message: str,
) -> AsyncIterator[str]:
    """
    multi-turn 채팅 메시지를 Claude에 스트리밍 요청하고 텍스트 청크를 yield한다.

    Args:
        session_id: 세션 식별자 (로깅용)
        history: [{role, content}, ...] 형태의 이전 메시지 이력
        user_message: 현재 사용자 메시지

    Yields:
        텍스트 청크 문자열
    """
    client = _get_client()

    trimmed = _trim_history(history)
    messages = [*trimmed, {"role": "user", "content": user_message}]

    logger.info(
        "[chat] session=%s history_len=%d user_msg_len=%d",
        session_id,
        len(trimmed),
        len(user_message),
    )

    async with client.messages.stream(
        model=settings.claude_model,
        max_tokens=2048,
        system=[
            {
                "type": "text",
                "text": _SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=messages,
    ) as stream:
        async for text_chunk in stream.text_stream:
            yield text_chunk
