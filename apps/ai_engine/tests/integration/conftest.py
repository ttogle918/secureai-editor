"""
통합 테스트 환경 설정.

1. psycopg3 Windows 호환: ProactorEventLoop → SelectorEventLoop 전환
2. 프로젝트 루트 .env 로드: pydantic-settings는 apps/ai_engine/ 기준으로 .env를 읽어서
   루트 .env를 자동으로 인식하지 못한다. 통합 테스트 전에 명시적으로 로드한다.
3. POSTGRES_URL 구성:
   - Docker 내부 (/.dockerenv 존재): settings.py 기본값 사용 (hostname=postgres)
   - 로컬: DB_USER/DB_PASSWORD/DB_NAME 조합으로 localhost URL 구성
"""
import asyncio
import os
import sys
from pathlib import Path

import pytest


def pytest_collection_modifyitems(items):
    """이 디렉터리의 모든 테스트에 'integration' 마커를 자동 적용한다.

    덕분에 `pytest -m "not integration"` 으로도 단위 테스트만 선택 실행할 수 있다.
    (CI 단위 잡은 --ignore=tests/integration 로 디렉터리 자체를 제외한다.)
    """
    for item in items:
        if "tests/integration/" in str(item.fspath).replace("\\", "/"):
            item.add_marker(pytest.mark.integration)

# ── 1. Windows event loop 호환 ────────────────────────────────────────
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# ── 2. 프로젝트 루트 .env 로드 ────────────────────────────────────────
_project_root = Path(__file__).parents[2]
_project_env = _project_root / ".env"

if _project_env.exists():
    from dotenv import dotenv_values
    for k, v in dotenv_values(_project_env).items():
        os.environ.setdefault(k, v)

# ── 3. POSTGRES_URL 구성 ──────────────────────────────────────────────
# Docker 환경: /.dockerenv 존재 → hostname이 이미 'postgres'이므로 덮어쓰지 않음
# 로컬 환경: settings.py 기본값(postgres hostname)은 틀리므로 localhost로 교체
_in_docker = Path("/.dockerenv").exists()
if not _in_docker:
    _db_user = os.environ.get("DB_USER", "secureai")
    _db_pass = os.environ.get("DB_PASSWORD", "changeme_in_production")
    _db_name = os.environ.get("DB_NAME", "secureai")
    os.environ["POSTGRES_URL"] = (
        f"postgresql://{_db_user}:{_db_pass}@localhost:5434/{_db_name}"
    )
