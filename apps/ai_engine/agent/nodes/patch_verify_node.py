"""
패치 검증 노드 — LangGraph 노드 (TASK-1402, Python+pytest 한정).

역할 (SRP):
1. patch_results에서 Python 패치를 선별한다.
2. 패치+취약점 컨텍스트 → Claude API로 임시 pytest 테스트 코드 생성.
3. agent/sandbox/patch_test_runner.run()으로 dast-isolated-net 격리 컨테이너 실행.
4. VERIFIED / FAILED / PENDING 상태 판정 후 backend_api_client.report_patch_verification() 보고.

보안 불변식:
- 샌드박스 반드시 dast-isolated-net 격리 (누락 시 RuntimeError — 개별 실패, 전체 중단 금지).
- 민감 토큰·페이로드 로그 출력 금지.
- 비-Python 언어 → PENDING 유지 (건너뜀).
- 개별 패치 검증 실패가 전체 그래프 중단 금지.

스코프 한정 (Dev 권고):
- Python+pytest 단일 언어. 다언어(Java/JUnit, JS/Jest)는 후속 스프린트.
"""
import logging
import os
from typing import Any

from anthropic import AsyncAnthropic

from agent.agent_state import AgentState
from agent.sandbox import patch_test_runner
from config.settings import settings
from infrastructure.backend_api_client import report_patch_verification

logger = logging.getLogger(__name__)

# ─── 상수 ─────────────────────────────────────────────────────────────────────

_PYTHON_EXTENSIONS: frozenset[str] = frozenset({".py"})

# pytest 테스트 생성 프롬프트 시스템 메시지 (prompt caching 활성화)
_SYSTEM_PROMPT = (
    "You are a security testing expert. Generate a concise pytest test that "
    "verifies the patched code no longer contains the reported vulnerability. "
    "Return ONLY valid Python test code, no explanation, no markdown fences. "
    "The test file imports from 'module' (the patched code module)."
)


def _is_python_file(file_path: str) -> bool:
    """파일 경로의 확장자가 Python인지 확인한다."""
    ext = os.path.splitext(file_path)[1].lower()
    return ext in _PYTHON_EXTENSIONS


def _build_test_prompt(patch: dict) -> str:
    """패치+취약점 컨텍스트로 pytest 테스트 생성 프롬프트를 조립한다.

    민감 페이로드를 포함하지 않도록 vuln_type / description / patched_snippet 만 사용한다.
    """
    vuln_type = patch.get("vulnType") or patch.get("vuln_type", "UNKNOWN")
    description = patch.get("description") or ""
    patched_snippet = patch.get("patchedSnippet") or patch.get("patched_snippet") or ""
    file_path = patch.get("filePath") or patch.get("file_path", "unknown")

    return (
        f"Vulnerability type: {vuln_type}\n"
        f"File: {file_path}\n"
        f"Description: {description}\n\n"
        f"Patched code (save as module.py):\n"
        f"```python\n{patched_snippet}\n```\n\n"
        "Write a pytest test function named `test_vulnerability_fixed` that:\n"
        "1. Imports from 'module'\n"
        "2. Calls the relevant function with a payload that would trigger the vulnerability\n"
        "3. Asserts the fix is in place (e.g., raises exception, sanitizes output, rejects input)\n"
        "Return ONLY the Python test code."
    )


async def _generate_test_code(
    patch: dict,
    api_key: str | None = None,
    model: str | None = None,
) -> str:
    """Claude API로 임시 pytest 테스트 코드를 생성한다.

    prompt caching 활성화 (cache_control: ephemeral).
    실패 시 빈 문자열을 반환하고 개별 패치 검증을 건너뜀.
    """
    client = AsyncAnthropic(api_key=api_key or settings.claude_api_key)
    prompt = _build_test_prompt(patch)

    try:
        response = await client.messages.create(
            model=model or settings.claude_model,
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": _SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text
    except Exception as exc:
        logger.warning("[patch-verify] test code generation failed: %s", exc)
        return ""


async def _verify_single_patch(
    patch: dict,
    api_key: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """패치 하나를 검증하고 {patch_id, status, log} 딕셔너리를 반환한다.

    상태 판정:
    - 비-Python 파일 → PENDING (유지)
    - 테스트 코드 생성 실패 → FAILED
    - 문법 에러·테스트 실패 → FAILED
    - 정상 컴파일+테스트 통과 → VERIFIED
    - RuntimeError (격리 네트워크 누락) → FAILED + 로그 (전체 중단 금지)
    """
    patch_id = patch.get("id") or patch.get("patch_id")
    file_path = patch.get("filePath") or patch.get("file_path", "")
    patched_snippet = patch.get("patchedSnippet") or patch.get("patched_snippet") or ""

    if not _is_python_file(file_path):
        logger.info(
            "[patch-verify] non-python file=%s patch_id=%s → PENDING", file_path, patch_id
        )
        return {"patch_id": patch_id, "status": "PENDING", "log": f"Non-Python: {file_path}"}

    if not patched_snippet.strip():
        logger.warning("[patch-verify] empty patched_snippet patch_id=%s → FAILED", patch_id)
        return {"patch_id": patch_id, "status": "FAILED", "log": "Empty patched snippet"}

    # Step 1: Claude로 pytest 테스트 생성
    test_code = await _generate_test_code(patch, api_key=api_key, model=model)
    if not test_code.strip():
        return {"patch_id": patch_id, "status": "FAILED", "log": "Test code generation failed"}

    # Step 2: dast-isolated-net 격리 컨테이너 실행
    try:
        result = await patch_test_runner.run(
            patched_code=patched_snippet,
            test_code=test_code,
            language="python",
        )
    except RuntimeError as exc:
        # 격리 네트워크 누락 — 개별 FAILED (전체 중단 금지)
        logger.error("[patch-verify] sandbox isolation error patch_id=%s: %s", patch_id, exc)
        return {"patch_id": patch_id, "status": "FAILED", "log": str(exc)}
    except Exception as exc:
        logger.error("[patch-verify] sandbox error patch_id=%s: %s", patch_id, exc)
        return {"patch_id": patch_id, "status": "FAILED", "log": str(exc)}

    # Step 3: 결과 판정
    if result.exit_code == -1 and "Non-Python" in result.log:
        # patch_test_runner가 비-Python으로 판단 (방어적 처리)
        return {"patch_id": patch_id, "status": "PENDING", "log": result.log}

    status = "VERIFIED" if result.passed else "FAILED"
    logger.info(
        "[patch-verify] patch_id=%s status=%s exit_code=%d",
        patch_id, status, result.exit_code,
    )
    return {"patch_id": patch_id, "status": status, "log": result.log}


async def patch_verify_node(state: AgentState) -> dict:
    """
    patch_results의 Python 패치에 대해 pytest 검증을 실행하고
    결과를 Backend 내부 API로 보고한다.

    - 개별 패치 검증 실패는 경고 로그 후 스킵 (전체 세션 유지)
    - 비-Python 패치 → PENDING 유지 (보고 대상 제외)
    - patch_id 없는 항목 → 스킵
    - Backend 보고 실패 → 경고 로그만 (전체 중단 금지)
    """
    patch_results: list[dict] = state.get("patch_results", [])
    user_api_key: str | None = state.get("user_api_key")
    preferred_model: str | None = state.get("preferred_model")

    if not patch_results:
        logger.info("[patch-verify] patch_results 없음 — 스킵")
        return {}

    verification_results: list[dict] = []

    for patch in patch_results:
        patch_id = patch.get("id") or patch.get("patch_id")
        if not patch_id:
            logger.warning("[patch-verify] patch_id 없음 — 스킵 (patch=%s)", patch.get("filePath"))
            continue

        try:
            result = await _verify_single_patch(
                patch, api_key=user_api_key, model=preferred_model
            )
            verification_results.append(result)
        except Exception as exc:
            logger.warning(
                "[patch-verify] skip patch_id=%s error=%s", patch_id, exc
            )

    # Backend 보고 (PENDING은 초기 상태이므로 보고 제외)
    reportable = [r for r in verification_results if r["status"] in ("VERIFIED", "FAILED")]
    for result in reportable:
        try:
            await report_patch_verification(
                patch_id=result["patch_id"],
                status=result["status"],
                log=result.get("log"),
            )
        except Exception as exc:
            logger.warning(
                "[patch-verify] report failed patch_id=%s: %s", result["patch_id"], exc
            )

    logger.info(
        "[patch-verify] complete total=%d reported=%d",
        len(verification_results), len(reportable),
    )
    return {"verification_results": verification_results}
