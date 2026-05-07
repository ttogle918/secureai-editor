"""
Anthropic SDK 래퍼 — SAST 분석 전용.

- 시스템 프롬프트에 prompt caching 적용 (반복 호출 시 토큰 절감)
- 반환값은 원문 텍스트 (파싱은 response_parser.py 에서 처리)
"""
import logging

from anthropic import AsyncAnthropic

from config.settings import settings

logger = logging.getLogger(__name__)

_client: AsyncAnthropic | None = None

_SYSTEM_PROMPT = """\
You are a security expert specializing in source code vulnerability analysis (SAST).
Analyze the provided source code and identify ALL security vulnerabilities.

Respond ONLY with valid JSON in this exact format — no markdown, no explanation:
{
  "vulnerabilities": [
    {
      "type": "SQL_INJECTION",
      "severity": "HIGH",
      "cwe": "CWE-89",
      "owasp": "A03:2021",
      "line": 42,
      "description": "User input directly concatenated into SQL query without sanitization.",
      "code_snippet": "String q = \\"SELECT * FROM users WHERE id = \\" + userId;"
    }
  ]
}

Rules:
- severity MUST be one of: LOW, MEDIUM, HIGH, CRITICAL
- If no vulnerabilities found, return: {"vulnerabilities": []}
- Never include text outside the JSON object\
"""


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.claude_api_key)
    return _client


async def analyze_for_sast(file_path: str, content: str, guidelines: str = "") -> str:
    """파일 하나에 대한 SAST 분석을 Claude에 요청하고 원문 응답을 반환한다.

    guidelines가 있으면 시스템 프롬프트에 추가한다.
    가이드라인 포함 시 1,024 tokens 초과 → prompt caching 실제 동작.
    동일 stack의 파일들은 시스템 프롬프트가 동일하므로 두 번째 호출부터 cache HIT.
    """
    client = _get_client()

    system_text = (
        f"{_SYSTEM_PROMPT}\n\n---\n\n# Stack-Specific Security Patterns\n\n{guidelines}"
        if guidelines
        else _SYSTEM_PROMPT
    )

    response = await client.messages.create(
        model=settings.claude_model,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": system_text,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": f"File: {file_path}\n\n```\n{content}\n```",
            }
        ],
    )

    raw = response.content[0].text
    logger.debug("[claude] file=%s response_chars=%d", file_path, len(raw))
    return raw
