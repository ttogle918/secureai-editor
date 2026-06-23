"""
패치 테스트 샌드박스 실행기 — Python+pytest 단일 언어 한정 (TASK-1402).

보안 불변식 (CLAUDE.md):
- 컨테이너는 반드시 dast-isolated-net 네트워크에 격리하여 실행한다.
- 격리 네트워크명 불일치 시 RuntimeError 발생, 실행 중단.
- 테스트 코드·실행 로그에 민감 토큰·페이로드 포함 금지.
- 컨테이너 타임아웃 → FAILED 처리, cleanup 실패 → 강제 종료 + 로그.

스코프 한정:
- Python+pytest 단일 언어. 비-Python 언어는 호출자에서 PENDING 유지 처리.
- 다언어 확장(Java/JUnit, JS/Jest)은 이후 스프린트에서 이미지 추가.

사전 빌드 (필수 — 격리 네트워크는 PyPI 도달 불가):
    docker build -f agent/sandbox/Dockerfile.patch-verify \
      -t secureai-patch-verify:latest agent/sandbox
    # 다른 이미지를 쓰려면 PATCH_VERIFY_IMAGE 환경변수로 오버라이드.

통합 테스트 실행 방법 (실제 Docker 필요):
    python -m pytest tests/sandbox/ -m integration -v
    또는 직접 임포트 후 asyncio.run(run(patched_code, test_code)) 호출.
"""
import asyncio
import logging
import os
import uuid
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# ─── 상수 ─────────────────────────────────────────────────────────────────────

# 격리 네트워크명 — CLAUDE.md 보안 규칙 (docker-compose.yml external:true)
_REQUIRED_NETWORK: str = os.environ.get("DAST_NETWORK", "dast-isolated-net")

# Python+pytest 검증용 Docker 이미지 (단일 언어 한정).
# 기본값은 pytest를 미리 구운 secureai-patch-verify 이미지다.
# dast-isolated-net은 PyPI에 도달할 수 없어 런타임 pip install이 불가하므로
# pytest가 박힌 이미지를 써야 한다(Dockerfile.patch-verify 참고 — 사전 빌드 필요).
_PYTEST_IMAGE: str = os.environ.get(
    "PATCH_VERIFY_IMAGE", "secureai-patch-verify:latest"
)

# 컨테이너 실행 타임아웃 (초)
_CONTAINER_TIMEOUT_SECONDS: int = int(os.environ.get("PATCH_VERIFY_TIMEOUT", "60"))

# 실행 중 로그 최대 길이 (보안: 민감 정보 노출 방지)
_LOG_MAX_BYTES: int = 4096


@dataclass(frozen=True)
class SandboxResult:
    """패치 샌드박스 실행 결과.

    'Test*' / 'Patch*' 클래스명은 pytest 수집 경고를 유발할 수 있어
    'SandboxResult'로 명명한다.
    """

    passed: bool
    log: str
    exit_code: int


# 하위 호환 별칭
TestRunResult = SandboxResult
PatchRunResult = SandboxResult


async def run(patched_code: str, test_code: str, language: str = "python") -> SandboxResult:
    """패치된 코드와 pytest 테스트를 격리 컨테이너에서 실행하고 결과를 반환한다.

    흐름:
    1. 격리 네트워크 assert (누락 시 RuntimeError — 실행 중단)
    2. 임시 컨테이너 ID 생성
    3. docker run --network dast-isolated-net ... 실행
    4. 타임아웃 시 FAILED + 사유 로그
    5. 컨테이너 cleanup (실패 시 강제 종료 + 경고 로그)
    6. 결과 반환

    Args:
        patched_code: 패치된 Python 코드 (테스트 대상 모듈 내용)
        test_code:    Claude가 생성한 pytest 테스트 코드
        language:     파일 언어 (현재 "python" 만 지원)

    Returns:
        TestRunResult(passed=True/False, log=..., exit_code=...)

    Raises:
        RuntimeError: 격리 네트워크명 불일치 시 (보안 규칙)
    """
    _assert_network_isolation()

    if language.lower() != "python":
        # 비-Python 언어는 PENDING 유지 — 호출자에서 처리
        logger.info("[sandbox] non-python language=%s → skip (PENDING 유지)", language)
        return SandboxResult(passed=False, log=f"Non-Python language '{language}': skipped", exit_code=-1)

    container_name = f"secureai-patch-verify-{uuid.uuid4().hex[:8]}"
    return await _run_in_container(container_name, patched_code, test_code)


def _assert_network_isolation() -> None:
    """격리 네트워크 설정이 올바른지 검증한다.

    DAST_NETWORK 환경변수가 'dast-isolated-net' 이 아닌 경우 RuntimeError 발생.
    보안 규칙 (CLAUDE.md): 격리 네트워크 누락 시 실행 중단.
    """
    if _REQUIRED_NETWORK != "dast-isolated-net":
        raise RuntimeError(
            f"[sandbox] 보안 위반: DAST_NETWORK='{_REQUIRED_NETWORK}' — "
            f"반드시 'dast-isolated-net' 이어야 합니다. 실행 중단."
        )


async def _run_in_container(
    container_name: str,
    patched_code: str,
    test_code: str,
) -> SandboxResult:
    """격리 컨테이너에서 pytest를 실행하고 결과를 반환한다.

    컨테이너에 두 파일을 마운트할 수 없으므로 -c 플래그로 인라인 실행한다.
    patched_code를 module.py로, test_code를 test_patch.py로 /tmp에 생성 후 pytest 실행.
    """
    # 코드 내용을 base64 인코딩해 명령 인젝션 방지
    import base64
    patched_b64 = base64.b64encode(patched_code.encode()).decode()
    test_b64 = base64.b64encode(test_code.encode()).decode()

    # 루트 파일시스템이 --read-only이므로 pytest를 기본 site-packages에 설치할 수 없다.
    # 따라서 쓰기 가능한 tmpfs(/tmp)에 --target으로 설치하고 PYTHONPATH로 로드한다.
    # pytest가 이미 설치된 이미지(PATCH_VERIFY_IMAGE 오버라이드)면 설치를 건너뛴다.
    # 파이프(| tail)로 pip 종료코드를 삼키지 않는다 — 설치 실패가 곧 FAILED로 드러나야 한다.
    inline_script = (
        "set -e; "
        "python -c \""
        "import base64, pathlib; "
        f"pathlib.Path('/tmp/module.py').write_bytes(base64.b64decode('{patched_b64}')); "
        f"pathlib.Path('/tmp/test_patch.py').write_bytes(base64.b64decode('{test_b64}'))"
        "\"; "
        "python -c 'import pytest' 2>/dev/null || "
        "pip install pytest --quiet --no-cache-dir --target=/tmp/pylibs; "
        "cd /tmp && PYTHONPATH=/tmp/pylibs python -m pytest test_patch.py -x --tb=short"
    )

    cmd = [
        "docker", "run",
        "--rm",
        "--name", container_name,
        "--network", _REQUIRED_NETWORK,
        "--memory", "256m",
        "--cpus", "0.5",
        "--read-only",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
        _PYTEST_IMAGE,
        "sh", "-c", inline_script,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        try:
            stdout, _ = await asyncio.wait_for(
                proc.communicate(), timeout=_CONTAINER_TIMEOUT_SECONDS
            )
        except asyncio.TimeoutError:
            logger.warning(
                "[sandbox] container timed out name=%s timeout_s=%d",
                container_name, _CONTAINER_TIMEOUT_SECONDS,
            )
            await _force_remove_container(container_name)
            return SandboxResult(
                passed=False,
                log=f"Timed out after {_CONTAINER_TIMEOUT_SECONDS}s",
                exit_code=-1,
            )

        raw_log = stdout.decode(errors="replace") if stdout else ""
        truncated_log = raw_log[:_LOG_MAX_BYTES]
        exit_code = proc.returncode if proc.returncode is not None else -1
        passed = exit_code == 0

        logger.info(
            "[sandbox] run complete name=%s exit_code=%d passed=%s",
            container_name, exit_code, passed,
        )
        return SandboxResult(passed=passed, log=truncated_log, exit_code=exit_code)

    except FileNotFoundError:
        # docker 바이너리 없음 (단위 테스트 환경 등)
        logger.error("[sandbox] docker not found — cannot run container")
        return SandboxResult(passed=False, log="docker binary not found", exit_code=-1)
    except Exception as exc:
        logger.error("[sandbox] unexpected error name=%s: %s", container_name, exc)
        await _force_remove_container(container_name)
        return SandboxResult(passed=False, log=str(exc), exit_code=-1)


async def _force_remove_container(container_name: str) -> None:
    """컨테이너를 강제 종료·삭제한다. 실패 시 경고 로그만 남긴다."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker", "rm", "-f", container_name,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.wait(), timeout=10)
        logger.debug("[sandbox] container force-removed name=%s", container_name)
    except Exception as exc:
        logger.warning("[sandbox] cleanup failed name=%s: %s", container_name, exc)
