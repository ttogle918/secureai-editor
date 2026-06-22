"""
TASK-1402 — patch_test_runner 단위 테스트.

실제 Docker 호출 없이 mock으로 격리 네트워크 보안 규칙·
비-Python 스킵·컨테이너 타임아웃 처리를 검증한다.

통합 테스트 (실제 Docker 필요):
    pytest tests/sandbox/ -m integration -v
    → 실제 Python+pytest 컨테이너 실행, 문법에러 패치→FAILED, 정상 패치→VERIFIED 검증.
"""
import os
import pytest
from unittest.mock import AsyncMock, patch as mock_patch

import agent.sandbox.patch_test_runner as runner_module
from agent.sandbox.patch_test_runner import (
    SandboxResult,
    _assert_network_isolation,
    run,
)


# ─── 격리 네트워크 assert ──────────────────────────────────────────────────────

def test_assert_network_isolation_passes_with_correct_network(monkeypatch):
    """DAST_NETWORK=dast-isolated-net 이면 통과한다."""
    monkeypatch.setattr(runner_module, "_REQUIRED_NETWORK", "dast-isolated-net")
    # 예외 없이 통과해야 함
    _assert_network_isolation()


def test_assert_network_isolation_raises_on_wrong_network(monkeypatch):
    """격리 네트워크명 불일치 시 RuntimeError를 발생시킨다 (보안 규칙)."""
    monkeypatch.setattr(runner_module, "_REQUIRED_NETWORK", "wrong-network")
    with pytest.raises(RuntimeError, match="dast-isolated-net"):
        _assert_network_isolation()


# ─── 비-Python 언어 → PENDING 스킵 ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_non_python_language_returns_pending_like_result(monkeypatch):
    """비-Python 언어 입력 시 passed=False, log에 언어명이 포함된다."""
    monkeypatch.setattr(runner_module, "_REQUIRED_NETWORK", "dast-isolated-net")
    result = await run("public class X {}", "// no test", language="java")
    assert result.passed is False
    assert "java" in result.log.lower() or "non-python" in result.log.lower()


# ─── 컨테이너 타임아웃 → FAILED ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_timeout_returns_failed(monkeypatch):
    """컨테이너 타임아웃 시 passed=False, log에 'Timed out' 메시지가 포함된다."""
    import asyncio
    monkeypatch.setattr(runner_module, "_REQUIRED_NETWORK", "dast-isolated-net")
    monkeypatch.setattr(runner_module, "_PYTEST_IMAGE", "python:3.12-slim")

    async def fake_run_in_container(container_name, patched_code, test_code):
        return SandboxResult(passed=False, log="Timed out after 60s", exit_code=-1)

    monkeypatch.setattr(runner_module, "_run_in_container", fake_run_in_container)

    result = await run("x = 1", "def test(): pass", language="python")
    assert result.passed is False
    assert "Timed out" in result.log


# ─── docker not found → FAILED ───────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_docker_not_found_returns_failed(monkeypatch):
    """docker 바이너리가 없으면 passed=False, log에 'docker' 포함."""
    monkeypatch.setattr(runner_module, "_REQUIRED_NETWORK", "dast-isolated-net")

    async def fake_run_in_container(container_name, patched_code, test_code):
        return SandboxResult(passed=False, log="docker binary not found", exit_code=-1)

    monkeypatch.setattr(runner_module, "_run_in_container", fake_run_in_container)

    result = await run("x = 1", "def test(): pass", language="python")
    assert result.passed is False
    assert "docker" in result.log.lower()


# ─── 정상 실행 → passed=True ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_success_returns_passed_true(monkeypatch):
    """컨테이너가 exit_code=0으로 종료되면 passed=True를 반환한다."""
    monkeypatch.setattr(runner_module, "_REQUIRED_NETWORK", "dast-isolated-net")

    async def fake_run_in_container(container_name, patched_code, test_code):
        return SandboxResult(passed=True, log="1 passed in 0.01s", exit_code=0)

    monkeypatch.setattr(runner_module, "_run_in_container", fake_run_in_container)

    result = await run("x = 1", "def test_vulnerability_fixed(): assert True", language="python")
    assert result.passed is True
    assert result.exit_code == 0


# ─── 로그 잘림 안전성 ────────────────────────────────────────────────────────

def test_log_max_bytes_constant_is_positive():
    """_LOG_MAX_BYTES 상수가 양수여야 한다."""
    assert runner_module._LOG_MAX_BYTES > 0


# ─── 통합 테스트 마커 (실제 Docker 필요, 수동 검증) ──────────────────────────

@pytest.mark.integration
@pytest.mark.asyncio
async def test_integration_syntax_error_patch_returns_failed():
    """
    [통합 테스트] 문법 에러 패치 → FAILED.

    실행 조건:
        - Docker가 설치되고 dast-isolated-net 네트워크가 생성되어 있어야 함.
        - pytest tests/sandbox/ -m integration -v 로 실행.

    수동 검증 항목:
        1. dast-isolated-net 격리 컨테이너에서 실행됨 (docker inspect 확인)
        2. postgres/redis 도달 불가 확인 (네트워크 격리)
    """
    result = await run(
        patched_code="def login(user, pwd\n    return True",  # 의도적 문법 에러
        test_code="def test_vulnerability_fixed(): import module; assert True",
        language="python",
    )
    assert result.passed is False


@pytest.mark.integration
@pytest.mark.asyncio
async def test_integration_valid_patch_returns_verified():
    """
    [통합 테스트] 정상 패치 + 통과 테스트 → VERIFIED.

    실행 조건:
        - Docker가 설치되고 dast-isolated-net 네트워크가 생성되어 있어야 함.
    """
    patched_code = """
def get_user(conn, username):
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE name = %s", (username,))
    return cursor.fetchone()
"""
    test_code = """
def test_vulnerability_fixed():
    # SQL 인젝션이 파라미터 바인딩으로 방어되는지 확인
    import inspect
    import module
    src = inspect.getsource(module.get_user)
    # f-string 대신 파라미터 바인딩(%s)을 사용하는지 확인
    assert '%s' in src or '?' in src
    assert 'f"' not in src
"""
    result = await run(
        patched_code=patched_code,
        test_code=test_code,
        language="python",
    )
    assert result.passed is True
