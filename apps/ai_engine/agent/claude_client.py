"""
SAST 분석 진입점 — LLM 프로바이더로 얇은 위임.

기존 시그니처(file_path, content, guidelines, model, api_key)를 유지하며,
내부에서 AnthropicProvider 또는 provider 인자에 맞는 구현체를 통해 호출한다.

기존 호출부(sast_node 등)는 변경 없이 사용 가능하다.
"""
import logging

from agent.llm.factory import get_provider, PROVIDER_ANTHROPIC, PROVIDER_GEMINI, PROVIDER_OPENAI
from config.settings import settings

logger = logging.getLogger(__name__)

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
- `Date.now()` / `Math.random()` for non-security IDs is CODE_QUALITY, not CRITICAL

Common vulnerability patterns (ALWAYS report these as CRITICAL/HIGH SECURITY):
- SQL Injection (CWE-89): Raw sql queries constructed using string concatenation/interpolation with user input without parameterized queries (e.g. `mysql_query()`, `db.rawQuery()`, `execute()`).
- Command Injection (CWE-78): Running shell or system commands (e.g., `system()`, `exec()`, `shell_exec()`, `subprocess.run()`) with unvalidated user input.
- Path Traversal (CWE-22): File access using paths derived from unvalidated user input (e.g., `include()`, `require()`, `os.ReadFile()`).
- Cross-Site Scripting (XSS) (CWE-79): Direct output of user input to HTML without proper escaping/sanitization (e.g. `echo $_GET[...]`, `response.write()`).
- Insecure Deserialization (CWE-502): Deserializing untrusted data without validation.
- Unrestricted File Upload (CWE-434): File uploads allowed without proper validation.
- Hardcoded Cryptographic Keys (CWE-321): Hardcoding encryption keys, tokens, or passwords in source code.
"""


def _build_system_text(guidelines: str) -> str:
    """가이드라인 유무에 따라 system_text를 구성한다."""
    if guidelines:
        return f"{_SYSTEM_PROMPT}\n\n---\n\n# Stack-Specific Security Patterns\n\n{guidelines}"
    return _SYSTEM_PROMPT


async def analyze_for_sast(
    file_path: str,
    content: str,
    guidelines: str = "",
    model: str | None = None,
    api_key: str | None = None,
    *,
    provider: str = PROVIDER_ANTHROPIC,
) -> tuple[str, dict]:
    """파일 하나에 대한 SAST 분석을 요청하고 (원문 응답, token_usage)를 반환한다.

    Args:
        file_path:  분석 대상 파일 경로 (로그 및 컨텍스트용).
        content:    파일 내용 문자열.
        guidelines: 스택별 보안 가이드라인 (optional).
        model:      사용할 모델명. None이면 provider 기본 모델 사용.
        api_key:    BYOK 키. None이면 플랫폼 기본 키 사용.
        provider:   "anthropic" | "gemini" | "openai" (keyword-only, 기본 anthropic).

    Returns:
        (raw_text, usage_dict) — usage_dict 는 4키(input/output/cache_creation/cache_read).
    """
    system_text = _build_system_text(guidelines)
    user_content = f"File: {file_path}\n\n```\n{content}\n```"

    # 프로바이더에 맞는 기본 모델 결정
    effective_model = model or _default_model_for(provider)

    llm = get_provider(provider, api_key)
    raw, usage = await llm.analyze(system_text, user_content, effective_model)

    logger.debug(
        "[claude_client] file=%s provider=%s model=%s in=%d out=%d",
        file_path, provider, effective_model,
        usage["input_tokens"], usage["output_tokens"],
    )
    return raw, usage


def _default_model_for(provider: str) -> str:
    """provider에 맞는 settings 기본 모델명을 반환한다."""
    if provider == PROVIDER_ANTHROPIC:
        return settings.claude_model
    if provider == PROVIDER_GEMINI:
        return settings.gemini_model
    if provider == PROVIDER_OPENAI:
        return settings.openai_model
    # 미지원 provider는 factory.get_provider 에서 ValueError 발생하므로 여기선 claude 기본
    return settings.claude_model
