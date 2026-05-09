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
You are a senior security engineer performing SAST (Static Application Security Testing).
Your goal is to find REAL, EXPLOITABLE security vulnerabilities — not code style issues.

Respond ONLY with valid JSON in this exact format — no markdown, no explanation:
{
  "vulnerabilities": [
    {
      "type": "SQL_INJECTION",
      "severity": "HIGH",
      "category": "SECURITY",
      "cwe": "CWE-89",
      "owasp": "A03:2021",
      "line": 42,
      "description": "User input directly concatenated into SQL query without sanitization.",
      "code_snippet": "String q = \\"SELECT * FROM users WHERE id = \\" + userId;"
    }
  ]
}

Field rules:
- severity: LOW | MEDIUM | HIGH | CRITICAL
- category: SECURITY (exploitable vuln) | CODE_QUALITY (maintainability/reliability, not exploitable)
- If no vulnerabilities found, return: {"vulnerabilities": []}
- Never include text outside the JSON object

Severity calibration:
- CRITICAL: directly exploitable with no user interaction (SQLi with data exfil, RCE, auth bypass)
- HIGH: exploitable but requires some conditions (stored XSS, IDOR, path traversal)
- MEDIUM: security concern but limited direct impact, or requires attacker-controlled infrastructure
- LOW: defense-in-depth, best-practice deviation with minimal direct risk
- CODE_QUALITY category: memory leaks, missing animations, unused variables, style issues — set severity LOW

Framework-aware rules (do NOT report these as HIGH/MEDIUM SECURITY):
- React JSX text rendering `{variable}` auto-escapes HTML — NOT XSS unless dangerouslySetInnerHTML is used
- React inline styles `style={{ color: val }}` are JS objects — NOT CSS injection
- Mock/test data files (mockData.ts, fixtures, seeds) contain intentional demo patterns — mark CODE_QUALITY or skip
- CSS class name generation in JS (e.g. tailwind, clsx) is NOT injection
- `Date.now()` / `Math.random()` for non-security IDs is CODE_QUALITY, not CRITICAL\
"""


def _get_client(api_key: str | None = None) -> AsyncAnthropic:
    """플랫폼 클라이언트(싱글턴)를 반환하거나, BYOK 키가 있으면 1회용 클라이언트를 생성한다."""
    if api_key:
        return AsyncAnthropic(api_key=api_key)
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.claude_api_key)
    return _client


async def analyze_for_sast(
    file_path: str,
    content: str,
    guidelines: str = "",
    model: str | None = None,
    api_key: str | None = None,
) -> str:
    """파일 하나에 대한 SAST 분석을 Claude에 요청하고 원문 응답을 반환한다.

    model/api_key가 제공되면 사용자 BYOK 설정을 우선 적용한다.
    가이드라인 포함 시 1,024 tokens 초과 → prompt caching 실제 동작.
    """
    client = _get_client(api_key)
    effective_model = model or settings.claude_model

    system_text = (
        f"{_SYSTEM_PROMPT}\n\n---\n\n# Stack-Specific Security Patterns\n\n{guidelines}"
        if guidelines
        else _SYSTEM_PROMPT
    )

    response = await client.messages.create(
        model=effective_model,
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
    logger.debug("[claude] file=%s model=%s response_chars=%d", file_path, effective_model, len(raw))
    return raw
