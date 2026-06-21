# 스택 감지 맥락 교란 · DB 커넥션 누수 · 도커 동기화 스크립트 연결 실패 트러블슈팅 기록

**날짜**: 2026-06-20  
**브랜치**: `main`  
**관련 커밋**: 
- `feat(guidelines): add Android security guidelines and update SQL generation mapping` (794b0b8)
- `feat(ai-engine): implement path-aware stack detection in sast_node` (cacdaa4)
- `refactor(ai-engine): generalize default system prompt with CWE patterns` (668e59b)
- `perf(ai-engine): implement database connection pooling using psycopg_pool` (01883c6)
- `fix(scripts): bypass postgres-to-localhost host substitution when running in docker` (46476e5)

---

## 이슈 1 — 파일 확장자 기반 스택 감지로 인한 가이드라인 주입 맥락 교란

### 증상

- 안드로이드 Kotlin(`.kt`) 또는 Java(`.java`) 파일 검사 시 백엔드용 `java_spring` 보안 지침이 주입됨.
- 백엔드/도구용 TypeScript(`.ts`) 파일 검사 시 프론트엔드용 `frontend_react_nextjs` 지침이 오주입되어 SAST 분석 시 런타임 맥락 교란이 발생함.

### 원인 분석

- 기존 `_detect_stacks` 로직은 단순 파일 확장자 매핑(`_EXT_TO_STACKS`)에만 의존하였음.
- 이로 인해 `.kt`는 무조건 `java_spring`으로 판단되고, `.ts`/`.tsx`는 무조건 `frontend_react_nextjs`로 판단되어 다른 스택의 보안 규칙을 적용받음.

### 해결

파일의 물리적 디렉토리 경로(예: `apps/android` vs `apps/frontend` vs `apps/mcp_server`)를 분석하여 정확한 스택명을 추출하도록 `_detect_stacks`를 고도화하고, Android 가이드라인([STACK_android.md](file:///c:/Users/ttogl/workspace/secureai-editor/docs/security/stacks/STACK_android.md))을 신규 구축했습니다.

```python
# apps/ai_engine/agent/nodes/sast_node.py

def _detect_stacks(file_path: str, content: str) -> list[str]:
    normalized_path = file_path.replace("\\", "/").lower()
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".py":
        # Python framework detection ...
        return ["common_python", framework]

    # 코틀린/자바 파일 분기 (Android vs Spring Boot)
    if ext in (".java", ".kt"):
        if "apps/android" in normalized_path:
            return ["android"]
        else:
            return ["java_spring"]

    # 자바스크립트/타입스크립트 분기 (React vs Node)
    if ext in (".js", ".ts", ".jsx", ".tsx"):
        if "apps/frontend" in normalized_path:
            return ["frontend_react_nextjs", "common_js"]
        elif "apps/mcp_server" in normalized_path:
            return ["node_express_nestjs", "common_js"]
        else:
            # 기본값 (하위 호환성 유지)
            if ext in (".ts", ".tsx", ".jsx"):
                return ["frontend_react_nextjs", "common_js"]
            else:
                return ["node_express_nestjs", "common_js"]
```

---

## 이슈 2 — 매번 새로운 DB 물리 커넥션 개설로 인한 레이턴시 오버헤드 및 커넥션 누수 위험

### 증상

- SAST 분석 도중 스택별 가이드라인을 데이터베이스에서 매번 새로 조회할 때마다 커넥션 맺는 속도로 인해 레이턴시가 발생함.
- 트래픽 밀집 시 PostgreSQL 서버의 최대 커넥션 제한에 도달할 수 있는 위험이 잠재되어 있었음.

### 원인 분석

- `guidelines_client.py` 내부 `load_guidelines` 및 `search_guidelines_by_vuln_type`에서 DB 조회가 발생할 때마다 `async with await psycopg.AsyncConnection.connect(...)`를 명시적으로 개설하여 사용하고 닫는 구조였음.

### 해결

- `psycopg_pool` 패키지의 `AsyncConnectionPool`을 이용해 전역 커넥션 풀 싱글톤(`_pool`)을 적용하여 커넥션을 재사용하도록 리팩토링했습니다.
- **[추가 보완] 동시성 경쟁 상태(Race Condition) 방지**: 병렬 SAST 분석 중 풀이 아직 초기화되지 않은 상태에서 복수의 비동기 태스크가 `get_pool()`을 동시 호출할 경우 풀 인스턴스가 중복 생성될 수 있는 경쟁 상태를 발견했습니다. 이를 완벽히 방어하고자 `asyncio.Lock`을 사용한 이중 검사 락(double-checked locking) 패턴을 추가 통합했습니다.
- 애플리케이션 수명 주기 종료 시 커넥션이 안전하게 수거되도록 `main.py`의 `lifespan` 블록 내에서 `close_pool`을 명시적으로 트리거했습니다.

```python
# apps/ai_engine/infrastructure/guidelines_client.py

_pool: AsyncConnectionPool | None = None
_pool_lock = asyncio.Lock()

async def get_pool() -> AsyncConnectionPool:
    global _pool
    if _pool is None:
        async with _pool_lock:
            if _pool is None:
                _pool = AsyncConnectionPool(
                    conninfo=settings.postgres_url,
                    min_size=1,
                    max_size=5,
                    kwargs={"autocommit": True},
                    open=False,
                )
                await _pool.open()
    return _pool

async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None

async def load_guidelines(stacks: "str | list[str]") -> str:
    # ...
    pool = await get_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)
```

---

## 이슈 3 — 도커 컨테이너 내부에서 가이드라인 동기화 스크립트 실행 시 DB 접속 실패

### 증상

- 도커 컨테이너 내에서 `python scripts/sync_guidelines.py` 실행 시 다음과 같은 에러 로그와 함께 종료됨:
  `DB connection failed error=connection failed: connection to server at "127.0.0.1", port 5432 failed: Connection refused`

### 원인 분석

- `sync_guidelines.py`가 호스트 기반 실행을 디폴트로 전제하고 작성되어, DB URL 내의 호스트명 `@postgres:`를 강제로 `@localhost:`(127.0.0.1)로 치환하고 있었음.
- 그러나 도커 컨테이너 내부에서 실행할 경우, `localhost`가 아닌 내부 네트워크 호스트명 `postgres`를 그대로 사용해야 다른 PostgreSQL 데이터베이스 컨테이너에 도달할 수 있음.

### 해결

- `sync_guidelines.py` 내부에 `is_docker` 판단 로직(도커 기본 증적 파일인 `/.dockerenv` 확인 및 환경 변수 체크)을 추가하여, 컨테이너 내부 환경인 경우 호스트명 치환 로직을 바이패스하도록 보완하였습니다.

```python
# apps/ai_engine/scripts/sync_guidelines.py

    db_url = settings.postgres_url
    # 로컬 실행 시 Docker 내부 호스트명 'postgres'를 'localhost'로 교체 (단, Docker 내부 구동 시에는 유지)
    import os
    is_docker = os.path.exists("/.dockerenv") or os.environ.get("INTERNAL_API_KEY") is not None
    if not is_docker and "@postgres:" in db_url and "localhost" not in db_url:
        db_url = db_url.replace("@postgres:", "@localhost:")
```

---

## 이슈 4 — 워크플로우 노드 간의 이중/삼중 파일 읽기로 인한 I/O 오버헤드 및 GitHub API 속도 한계 소모

### 증상

- 1개 파일을 SAST 분석하는 1사이클 내에 동일한 파일을 최대 3번(캐시 조회 시 1회, 캐시 미스 스캔 시 1회, AST 할루시네이션 가드 검증 시 1회) 반복해서 로드하는 성능 저하가 발생함.
- 특히 `github` 소스 타입으로 스캔 시 깃허브 API 호출 횟수가 최대 3배로 폭증하여 Rate Limit 소모 속도가 지나치게 빨랐음.
- 또한 `cache_check_node`가 로컬 `read_file`만 하드코딩 지원하여 GitHub 스캔 시 에러(`Exception`)가 터지면서 캐시 조회가 항상 실패하고 캐시 미스로 처리되었음.

### 원인 분석

- `cache_check_node`, `sast_node`, `validate_findings_node` 3개 노드가 독자적인 파일 읽기 로직(`read_file` / `get_github_file_content`)을 각각 수행함.
- LangGraph의 체크포인트 비대화를 막기 위해 `content`를 최종 상태로 보존하지 않는 의도된 가이드라인이 존재했으나, 임시 라이프사이클을 타는 상태 공유 체계가 부재하여 비효율적인 반복 로드가 발생함.

### 해결

- `AgentState`에 `current_file_content` 임시 필드를 도입했습니다.
- `cache_check_node`가 GitHub/로컬 환경 분기를 타며 파일을 1회 읽고, 해시 계산 후 `current_file_content`에 내용을 실어 다음 노드로 넘깁니다.
- `sast_node`와 `validate_findings_node`는 해당 임시 필드가 있으면 파일 읽기를 우회(skip)하고 캐싱된 내용만 활용하도록 개선했습니다.
- 루프가 끝나 다음 파일로 전이하기 직전인 `validate_findings_node` 리턴 시점에 `current_file_content: None`으로 가비지 컬렉션을 명시하여 영구 체크포인트 크기 비대화를 원천 차단했습니다.

