"""
TASK-1402 — patch_verify_node 단위 테스트.

실제 LLM / Docker 호출 없이 mock으로 검증한다:
- 상태 전이 (PENDING → VERIFIED / FAILED)
- 테스트 코드 프롬프트 조립 (_build_test_prompt)
- 비-Python 파일 → PENDING 유지
- patch_id 없는 항목 스킵
- 샌드박스 RuntimeError → FAILED (전체 중단 없음)
- Backend 보고 실패 → 경고만 (전체 중단 없음)
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch as mock_patch

from agent.nodes.patch_verify_node import (
    _build_test_prompt,
    _is_python_file,
    _verify_single_patch,
    patch_verify_node,
)
from agent.sandbox.patch_test_runner import SandboxResult


# ─── _is_python_file ─────────────────────────────────────────────────────────

def test_is_python_file_py_extension():
    assert _is_python_file("src/app.py") is True


def test_is_python_file_uppercase_extension():
    assert _is_python_file("src/app.PY") is True


def test_is_python_file_java_returns_false():
    assert _is_python_file("src/Dao.java") is False


def test_is_python_file_no_extension_returns_false():
    assert _is_python_file("Makefile") is False


def test_is_python_file_ts_returns_false():
    assert _is_python_file("app.ts") is False


# ─── _build_test_prompt ──────────────────────────────────────────────────────

def test_build_test_prompt_contains_vuln_type():
    patch = {
        "vulnType": "SQL_INJECTION",
        "filePath": "src/db.py",
        "description": "Unsanitized query",
        "patchedSnippet": "cursor.execute(query, (val,))",
    }
    prompt = _build_test_prompt(patch)
    assert "SQL_INJECTION" in prompt


def test_build_test_prompt_contains_patched_snippet():
    patch = {
        "vulnType": "XSS",
        "filePath": "src/view.py",
        "patchedSnippet": "html.escape(user_input)",
    }
    prompt = _build_test_prompt(patch)
    assert "html.escape(user_input)" in prompt


def test_build_test_prompt_uses_snake_case_key_fallback():
    """patch_node 출력 키가 snake_case인 경우도 처리한다."""
    patch = {
        "vuln_type": "PATH_TRAVERSAL",
        "file_path": "src/reader.py",
        "patched_snippet": "safe_path = os.path.abspath(user_path)",
    }
    prompt = _build_test_prompt(patch)
    assert "PATH_TRAVERSAL" in prompt
    assert "safe_path" in prompt


def test_build_test_prompt_instructs_pytest():
    """프롬프트에 pytest 테스트 함수 작성 지침이 포함된다."""
    patch = {"vulnType": "SQLI", "patchedSnippet": "pass"}
    prompt = _build_test_prompt(patch)
    assert "test_vulnerability_fixed" in prompt
    assert "pytest" in prompt.lower()


# ─── _verify_single_patch — 비-Python 파일 → PENDING ─────────────────────────

@pytest.mark.asyncio
async def test_verify_single_patch_non_python_returns_pending():
    patch = {
        "id": "patch-java-001",
        "filePath": "src/Dao.java",
        "patchedSnippet": "// safe java code",
        "vulnType": "SQL_INJECTION",
    }
    result = await _verify_single_patch(patch)
    assert result["status"] == "PENDING"
    assert result["patch_id"] == "patch-java-001"


@pytest.mark.asyncio
async def test_verify_single_patch_empty_snippet_returns_failed():
    patch = {
        "id": "patch-py-001",
        "filePath": "src/app.py",
        "patchedSnippet": "",
        "vulnType": "XSS",
    }
    result = await _verify_single_patch(patch)
    assert result["status"] == "FAILED"
    assert "empty" in result["log"].lower()


# ─── _verify_single_patch — VERIFIED / FAILED ────────────────────────────────

@pytest.mark.asyncio
async def test_verify_single_patch_returns_verified_on_pass():
    patch = {
        "id": "patch-py-verified",
        "filePath": "src/db.py",
        "patchedSnippet": "cursor.execute(q, (v,))",
        "vulnType": "SQL_INJECTION",
        "description": "Used parameterized query",
    }
    fake_test_code = "def test_vulnerability_fixed(): assert True"
    fake_run_result = SandboxResult(passed=True, log="1 passed in 0.01s", exit_code=0)

    with mock_patch(
        "agent.nodes.patch_verify_node._generate_test_code",
        new=AsyncMock(return_value=fake_test_code),
    ), mock_patch(
        "agent.nodes.patch_verify_node.patch_test_runner.run",
        new=AsyncMock(return_value=fake_run_result),
    ):
        result = await _verify_single_patch(patch)

    assert result["status"] == "VERIFIED"
    assert result["patch_id"] == "patch-py-verified"


@pytest.mark.asyncio
async def test_verify_single_patch_returns_failed_on_test_failure():
    patch = {
        "id": "patch-py-failed",
        "filePath": "src/app.py",
        "patchedSnippet": "import sys; sys.exit(1)",
        "vulnType": "PATH_TRAVERSAL",
    }
    fake_test_code = "def test_vulnerability_fixed(): assert False"
    fake_run_result = SandboxResult(passed=False, log="FAILED 1 error", exit_code=1)

    with mock_patch(
        "agent.nodes.patch_verify_node._generate_test_code",
        new=AsyncMock(return_value=fake_test_code),
    ), mock_patch(
        "agent.nodes.patch_verify_node.patch_test_runner.run",
        new=AsyncMock(return_value=fake_run_result),
    ):
        result = await _verify_single_patch(patch)

    assert result["status"] == "FAILED"


@pytest.mark.asyncio
async def test_verify_single_patch_sandbox_runtime_error_returns_failed():
    """격리 네트워크 누락 RuntimeError → FAILED (전체 중단 없음)."""
    patch = {
        "id": "patch-py-isolated",
        "filePath": "src/app.py",
        "patchedSnippet": "x = 1",
        "vulnType": "XSS",
    }
    with mock_patch(
        "agent.nodes.patch_verify_node._generate_test_code",
        new=AsyncMock(return_value="def test_ok(): pass"),
    ), mock_patch(
        "agent.nodes.patch_verify_node.patch_test_runner.run",
        new=AsyncMock(side_effect=RuntimeError("dast-isolated-net missing")),
    ):
        result = await _verify_single_patch(patch)

    assert result["status"] == "FAILED"
    assert "dast-isolated-net" in result["log"]


@pytest.mark.asyncio
async def test_verify_single_patch_test_generation_failure_returns_failed():
    """테스트 코드 생성 실패 → FAILED."""
    patch = {
        "id": "patch-py-gen-fail",
        "filePath": "src/app.py",
        "patchedSnippet": "safe_code = True",
        "vulnType": "XSS",
    }
    with mock_patch(
        "agent.nodes.patch_verify_node._generate_test_code",
        new=AsyncMock(return_value=""),  # 빈 문자열 반환
    ):
        result = await _verify_single_patch(patch)

    assert result["status"] == "FAILED"
    assert "generation" in result["log"].lower()


# ─── patch_verify_node (전체 노드) ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_patch_verify_node_empty_results_returns_empty_dict():
    state = {
        "session_id": "sess-001",
        "project_id": "proj-001",
        "patch_results": [],
    }
    result = await patch_verify_node(state)
    assert result == {}


@pytest.mark.asyncio
async def test_patch_verify_node_skips_patches_without_id():
    """patch_id 없는 항목은 스킵하고 전체 노드가 완료된다."""
    state = {
        "session_id": "sess-002",
        "project_id": "proj-002",
        "patch_results": [
            {"filePath": "src/app.py", "patchedSnippet": "x = 1", "vulnType": "XSS"},
        ],
    }
    result = await patch_verify_node(state)
    # verification_results 가 없거나 빈 리스트
    assert result.get("verification_results", []) == []


@pytest.mark.asyncio
async def test_patch_verify_node_reports_verified_to_backend():
    """VERIFIED 결과는 report_patch_verification으로 보고된다."""
    patch_id = "uuid-patch-verified"
    state = {
        "session_id": "sess-003",
        "project_id": "proj-003",
        "patch_results": [
            {
                "id": patch_id,
                "filePath": "src/db.py",
                "patchedSnippet": "safe = True",
                "vulnType": "SQLI",
            }
        ],
    }

    with mock_patch(
        "agent.nodes.patch_verify_node._verify_single_patch",
        new=AsyncMock(return_value={"patch_id": patch_id, "status": "VERIFIED", "log": "ok"}),
    ), mock_patch(
        "agent.nodes.patch_verify_node.report_patch_verification",
        new=AsyncMock(),
    ) as mock_report:
        result = await patch_verify_node(state)

    mock_report.assert_called_once_with(
        patch_id=patch_id,
        status="VERIFIED",
        log="ok",
    )
    assert result["verification_results"][0]["status"] == "VERIFIED"


@pytest.mark.asyncio
async def test_patch_verify_node_does_not_report_pending():
    """PENDING 항목은 Backend에 보고하지 않는다."""
    patch_id = "uuid-patch-pending"
    state = {
        "session_id": "sess-004",
        "project_id": "proj-004",
        "patch_results": [
            {
                "id": patch_id,
                "filePath": "src/Dao.java",  # 비-Python
                "patchedSnippet": "// java code",
                "vulnType": "SQL_INJECTION",
            }
        ],
    }

    with mock_patch(
        "agent.nodes.patch_verify_node.report_patch_verification",
        new=AsyncMock(),
    ) as mock_report:
        result = await patch_verify_node(state)

    # PENDING은 보고 대상 아님
    mock_report.assert_not_called()
    assert result["verification_results"][0]["status"] == "PENDING"


@pytest.mark.asyncio
async def test_patch_verify_node_backend_report_failure_does_not_abort():
    """Backend 보고 실패는 경고 로그만 남기고 전체 노드를 완료시킨다."""
    patch_id = "uuid-patch-report-fail"
    state = {
        "session_id": "sess-005",
        "project_id": "proj-005",
        "patch_results": [
            {
                "id": patch_id,
                "filePath": "src/app.py",
                "patchedSnippet": "safe = True",
                "vulnType": "XSS",
            }
        ],
    }

    with mock_patch(
        "agent.nodes.patch_verify_node._verify_single_patch",
        new=AsyncMock(return_value={"patch_id": patch_id, "status": "VERIFIED", "log": "ok"}),
    ), mock_patch(
        "agent.nodes.patch_verify_node.report_patch_verification",
        new=AsyncMock(side_effect=Exception("network error")),
    ):
        # 예외가 전파되지 않아야 함
        result = await patch_verify_node(state)

    # 노드는 정상 완료
    assert "verification_results" in result
