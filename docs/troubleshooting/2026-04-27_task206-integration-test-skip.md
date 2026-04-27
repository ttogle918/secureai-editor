# [2026-04-27 19:00] TASK-206 통합 테스트 Skip/Error 트러블슈팅

**파일 설명**: LangGraph Checkpointer 통합 테스트(`tests/integration/test_checkpointer_integration.py`)가  
로컬과 Docker 환경 양쪽에서 모두 SKIP 또는 ERROR로 실행되지 않던 문제 추적 및 해결 기록.

---

## 에러 원인

### 원인 1 — `setup()` 호출이 try-except 블록 밖에 위치

`saver` fixture에서 `await instance.setup()`이 try-except 밖에 있었음.  
`pool.open(timeout=5)`은 psycopg-pool이 백그라운드 태스크로 연결을 시도하고 즉시 반환하기 때문에  
postgres 포트가 닫혀 있어도 예외 없이 성공 반환. 이후 `setup()`에서 30초 대기 후 `PoolTimeout` 발생 → **SKIP 대신 ERROR**.

```
ERROR tests/integration/...::test_checkpoint_saved_after_run
E   psycopg_pool.PoolTimeout: couldn't get a connection after 30.00 sec
```

### 원인 2 — 로컬/Docker 구분 없이 POSTGRES_URL을 `localhost`로 강제 덮어쓰기

`tests/integration/conftest.py`가 항상 `localhost:5432`로 `POSTGRES_URL`을 설정.  
Docker 내부에서는 postgres 호스트명이 `postgres`인데 `localhost`로 바꿔버려 연결 실패 → **Docker에서도 SKIP**.

```python
# 문제 코드 (항상 localhost로 덮어씀)
os.environ["POSTGRES_URL"] = f"postgresql://...@localhost:5432/..."
```

### 원인 3 — `psycopg[binary]` 미설치로 import 실패

`requirements.txt`에 `psycopg-pool` 만 있고 `psycopg[binary]` (또는 `psycopg[c]`) 가 없어서  
libpq 드라이버를 찾지 못하고 import 자체가 실패 → `_HAS_DEPS = False` → **즉시 SKIP**.

```
ImportError: no pq wrapper available.
- couldn't import psycopg 'c' implementation: No module named 'psycopg_c'
- couldn't import psycopg 'binary' implementation: No module named 'psycopg_binary'
- couldn't import psycopg 'python' implementation: libpq library not found
```

### 원인 4 — LangGraph 1.x `interrupt_after` 동작 변경

LangGraph 1.x에서 `interrupt_after=["step_one"]` 사용 시 `__interrupt__` 이벤트가 추가로 emit됨.  
테스트가 `["step_one"]`만 기대했으나 실제로는 `["step_one", "__interrupt__"]`이 반환되어 **FAILED**.

```
AssertionError: interrupt_after 설정 시 step_one에서 멈춰야 함.
실제: ['step_one', '__interrupt__']
assert ['step_one', '__interrupt__'] == ['step_one']
```

---

## 해결 방법

### 해결 1 — `setup()` 및 `pool.wait()` 를 try-except 안으로 이동

`await instance.setup()`을 try-except 안으로 옮기고, `pool.open()` 직후에 `pool.wait(timeout=3)`을 추가해  
실제 연결 수립 여부를 빠르게 확인. 연결 실패 시 30초 대기 없이 즉시 SKIP.

```python
# 수정 후 (test_checkpointer_integration.py)
pool = None
instance = None
try:
    pool = AsyncConnectionPool(conninfo=..., open=False)
    await pool.open(timeout=3)
    await pool.wait(timeout=3)       # ← 추가: 연결 수립 확인
    instance = AsyncPostgresSaver(pool)
    await instance.setup()           # ← try-except 안으로 이동
except Exception as exc:
    if pool is not None:
        await pool.close()
    pytest.skip(f"PostgreSQL 연결 불가 (Docker 환경에서 실행하세요): {exc}")
```

**결과**: 120초 ERROR × 4 → 33초 SKIP × 4

---

### 해결 2 — Docker 환경에서 POSTGRES_URL 덮어쓰기 방지

`/.dockerenv` 파일 존재 여부로 Docker 내부인지 판별하여,  
Docker 안에서는 docker-compose 환경변수(`postgres:5432`)를 그대로 사용.

```python
# 수정 후 (tests/integration/conftest.py)
_in_docker = Path("/.dockerenv").exists()
if not _in_docker:
    # 로컬에서만 localhost로 교체
    os.environ["POSTGRES_URL"] = f"postgresql://...@localhost:5432/..."
```

**결과**: Docker에서 올바른 postgres hostname 사용 → 연결 성공

---

### 해결 3 — `psycopg[binary]` 를 requirements.txt에 추가

libpq를 번들로 포함한 binary wheel을 명시적으로 설치.  
재빌드 없이 컨테이너에서 즉시 확인할 때는 `docker exec -u root`로 설치.

```
# requirements.txt 추가
psycopg[binary]==3.2.6   # TASK-206: libpq 번들 드라이버 (C/binary 확장)
```

```bash
# 임시 확인용 (재빌드 전)
docker exec -u root secureai-ai-engine pip install "psycopg[binary]==3.2.6"
```

**이후 영구 적용 방법:**
```bash
docker compose build ai-engine
docker compose up -d ai-engine
```

---

### 해결 4 — LangGraph 1.x `__interrupt__` 이벤트 필터링

노드 이름 목록에서 `__` 로 시작하는 내부 이벤트를 필터링하여 비교.

```python
# 수정 후 (test_checkpointer_integration.py)
user_first = [n for n in first_nodes if not n.startswith("__")]
assert user_first == ["step_one"], ...

user_second = [n for n in second_nodes if not n.startswith("__")]
assert "step_one" not in user_second, ...
assert "step_two" in user_second, ...
```

---

## 해결 완료!

```
docker exec secureai-ai-engine python -m pytest tests/integration/ -v

tests/integration/test_checkpointer_integration.py::test_checkpoint_saved_after_run PASSED
tests/integration/test_checkpointer_integration.py::test_thread_id_isolation PASSED
tests/integration/test_checkpointer_integration.py::test_resume_runs_only_remaining_nodes PASSED
tests/integration/test_checkpointer_integration.py::test_resume_of_completed_thread_is_noop PASSED

============================== 4 passed in 0.64s ==============================
```

> **주의**: 컨테이너 재시작 또는 재빌드 후에도 유지되려면 `docker compose build ai-engine` 실행 필요.  
> `psycopg[binary]`가 `requirements.txt`에 추가됐으므로 재빌드 시 자동 설치됨.
