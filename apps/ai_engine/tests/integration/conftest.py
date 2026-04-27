"""
통합 테스트 환경 설정.

1. psycopg3 Windows 호환: ProactorEventLoop → SelectorEventLoop 전환
2. 프로젝트 루트 .env 로드: pydantic-settings는 apps/ai_engine/ 기준으로 .env를 읽어서
   루트 .env를 자동으로 인식하지 못한다. 통합 테스트 전에 명시적으로 로드한다.
3. POSTGRES_URL 자동 구성: DB_USER / DB_PASSWORD / DB_NAME 조합으로 localhost URL 생성
   (settings.py 기본값은 Docker 내부 hostname 'postgres'를 사용하므로 로컬에서 틀림)
"""
import asyncio
import os
import sys
from pathlib import Path

# ── 1. Windows event loop 호환 ────────────────────────────────────────
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# ── 2. 프로젝트 루트 .env 로드 ────────────────────────────────────────
# tests/integration/ → tests/ → apps/ai_engine/ → apps/ → project root

# 수정 전
_project_root = Path(__file__).parents[2]

# 수정 후 (안전한 방식)
# import os

# 현재 파일 기준으로 'tests' 폴더가 있는 곳까지 올라가서 루트를 잡습니다.
# current_path = Path(__file__).resolve()
# 보통 /app/tests/integration/conftest.py 구조라면 2단계 위가 루트입니다.
# _project_root = current_path.parent.parent.parent 

# 만약 root를 못 찾을까 봐 걱정된다면 sys.path에 추가할 때 이렇게 하기도 합니다.
# import sys
# if str(_project_root) not in sys.path:
#     sys.path.insert(0, str(_project_root))


_project_env = _project_root / ".env"

if _project_env.exists():
    from dotenv import dotenv_values
    for k, v in dotenv_values(_project_env).items():
        os.environ.setdefault(k, v)

# ── 3. POSTGRES_URL 로컬용으로 강제 구성 ──────────────────────────────
# settings.py 기본값의 'postgres' hostname 대신 localhost 사용
_db_user = os.environ.get("DB_USER", "secureai")
_db_pass = os.environ.get("DB_PASSWORD", "changeme_in_production")
_db_name = os.environ.get("DB_NAME", "secureai")
os.environ["POSTGRES_URL"] = (
    f"postgresql://{_db_user}:{_db_pass}@localhost:5432/{_db_name}"
)
