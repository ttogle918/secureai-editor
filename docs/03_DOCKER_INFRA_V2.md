# SecureAI — Docker 인프라 v2.0
> 기준 브랜치: `feat/task206-checkpointer` (Sprint 2 완료)  
> 이전 버전: `03_DOCKER_INFRA.md` (Sprint 1 설계안)  
> 변경 요약: Node.js 추가, MCP Server 볼륨 마운트, WORKSPACE_PATH 파라미터화, PostgreSQL 체크포인터

---

## 1. 서비스 구성

| 컨테이너 | 이미지 / 빌드 | 역할 | 포트 |
|---------|-------------|------|------|
| `secureai-postgres` | `postgres:15-alpine` | 메인 DB (Flyway 마이그레이션, LangGraph 체크포인터) | 5432 |
| `secureai-redis` | `redis:7-alpine` | 진행 이벤트 Pub/Sub, 세션 캐시 | 6379 |
| `secureai-backend` | `apps/backend/Dockerfile` (Spring Boot 4.0.5 / Java 21, ddl-auto:update) | REST API, SSE, 내부 API 라우팅 | 8080 |
| `secureai-ai-engine` | `apps/ai_engine/Dockerfile` (Python 3.12 + Node.js 20) | FastAPI + LangGraph SAST 파이프라인 | 8000 |

> **MCP Server**는 별도 컨테이너가 아닌 AI Engine이 **subprocess**로 spawn함 (`node /app/mcp_server/dist/index.js`).  
> `docker-compose.yml`의 `mcp_server` 섹션은 주석 처리 상태이며 사용하지 않음.

---

## 2. 네트워크

```
app-net  (bridge) : backend ↔ ai_engine (HTTP)
data-net (bridge) : backend + ai_engine ↔ postgres, redis
dast-net (bridge, internal) : Sprint 3 DAST 샌드박스용 (현재 미사용)
```

---

## 3. AI Engine Dockerfile 변경사항

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Sprint 2: Node.js 설치 (MCP Server subprocess 실행용)
RUN apt-get update && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 secureai \
 && adduser  --system --uid 1001 --ingroup secureai secureai

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chown -R secureai:secureai /app
USER secureai

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Sprint 1 대비 변경점**: `nodejs` 패키지 설치 추가 (MCP Server subprocess 실행에 필요).

---

## 4. AI Engine 볼륨 마운트

```yaml
ai_engine:
  volumes:
    - ${WORKSPACE_PATH:-/workspace}:/workspace:ro   # 분석 대상 소스코드 디렉토리
    - ./apps/mcp_server:/app/mcp_server:ro          # MCP Server dist/ + node_modules/
```

### 4.1 WORKSPACE_PATH

분석할 소스코드 디렉토리를 컨테이너의 `/workspace`로 마운트.  
`.env`에 설정하지 않으면 기본값 `/workspace` (CI/Linux 환경용).

```bash
# .env (로컬 Windows 개발 예시)
WORKSPACE_PATH=C:/Users/yourname/workspace/secureai-editor
```

컨테이너 내부 AI Engine은 `settings.mcp_workspace_root = "/workspace"` 경로를 기준으로 파일을 스캔.

### 4.2 MCP Server 볼륨

`apps/mcp_server/` 디렉토리 전체(dist/ + node_modules/ 포함)를 `/app/mcp_server`로 마운트.  
AI Engine이 `node /app/mcp_server/dist/index.js`를 subprocess로 실행할 때 ESM import가 `node_modules`를 찾을 수 있어야 함.

> **주의**: `apps/mcp_server/dist/`와 `apps/mcp_server/node_modules/`가 로컬에 빌드되어 있어야 함.  
> 빌드 방법: `cd apps/mcp_server && npm install && npm run build`

---

## 5. requirements.txt 변경사항 (Sprint 2)

```
psycopg[binary]==3.2.6   # LangGraph AsyncPostgresSaver용 libpq 번들 드라이버
psycopg-pool==3.2.6      # AsyncConnectionPool
langgraph-checkpoint-postgres  # AsyncPostgresSaver
```

---

## 6. LangGraph PostgreSQL 체크포인터

AI Engine 시작 시(`lifespan`) PostgreSQL에 연결해 `AsyncPostgresSaver`를 초기화.  
연결 실패 시 체크포인터 없이 동작(세션 재개 불가, 분석은 가능).

```python
# apps/ai_engine/main.py (lifespan)
_pool = AsyncConnectionPool(
    conninfo=settings.postgres_url,  # POSTGRES_URL 환경변수
    min_size=1,
    max_size=5,
    kwargs={"autocommit": True},
    open=False,
)
await _pool.open()
saver = AsyncPostgresSaver(_pool)
await saver.setup()  # checkpoints 테이블 자동 생성
set_checkpointer(saver)
```

`POSTGRES_URL` 환경변수: `postgresql://<user>:<password>@postgres:5432/<db>`

---

## 7. 환경변수 전체 목록

### 7.1 공통 (필수)

| 변수 | 설명 |
|------|------|
| `DB_PASSWORD` | PostgreSQL 비밀번호 |
| `REDIS_PASSWORD` | Redis 비밀번호 |
| `INTERNAL_API_KEY` | Backend ↔ AI Engine 내부 통신 키 |

### 7.2 Backend 추가 필수

| 변수 | 설명 |
|------|------|
| `JWT_SECRET` | JWT 서명 키 (64자 이상) |
| `SECUREAI_ENCRYPTION_KEY` | AES-256-GCM 키 (base64 32바이트) |
| `AI_AGENT_URL` | `http://ai_engine:8000` (compose 내부) |

### 7.3 AI Engine 추가 필수

| 변수 | 설명 |
|------|------|
| `CLAUDE_API_KEY` | Anthropic API 키 |
| `POSTGRES_URL` | `postgresql://<user>:<pass>@postgres:5432/<db>` |
| `REDIS_URL` | `redis://:<pass>@redis:6379/1` |
| `WORKSPACE_PATH` | 로컬 소스코드 경로 (호스트 → `/workspace` 마운트) |
| `MCP_WORKSPACE_ROOT` | `/workspace` (컨테이너 내부 경로, 기본값 유지) |
| `BACKEND_INTERNAL_URL` | `http://backend:8080` |

### 7.4 선택

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` | Claude 모델 ID |
| `LANGCHAIN_API_KEY` | — | LangSmith 추적 키 |
| `LANGCHAIN_PROJECT` | `secureai-agent` | LangSmith 프로젝트명 |
| `LANGCHAIN_TRACING_V2` | `false` | LangSmith 활성화 |
| `GITHUB_CLIENT_ID/SECRET` | — | GitHub OAuth |

---

## 8. 개발 환경 시작 순서

```bash
# 1. 환경변수 설정
cp .env.example .env
# .env 편집: DB_PASSWORD, REDIS_PASSWORD, INTERNAL_API_KEY, CLAUDE_API_KEY, WORKSPACE_PATH

# 2. MCP Server 빌드 (최초 1회)
cd apps/mcp_server && npm install && npm run build && cd ../..

# 3. AI Engine 이미지 빌드 (Node.js 추가 후 필요)
docker compose build ai_engine

# 4. 전체 스택 실행
docker compose up -d

# 5. 헬스체크
curl http://localhost:8080/actuator/health
curl http://localhost:8000/health
```

---

## 9. v1 대비 변경 요약

| 항목 | v1 (Sprint 1 설계) | v2 (Sprint 2 실제) |
|------|------------------|------------------|
| AI Engine 이미지 | `python:3.12-slim` | `python:3.12-slim` + Node.js 20 |
| MCP 실행 방식 | docker-compose 서비스 (미구현) | AI Engine subprocess spawn |
| 분석 대상 경로 | 하드코딩 `/workspace` | `WORKSPACE_PATH` 환경변수로 파라미터화 |
| 세션 체크포인트 | 없음 | LangGraph AsyncPostgresSaver (PostgreSQL) |
| AI Engine → DB | Redis만 | Redis + PostgreSQL (체크포인터) |
| psycopg | 미사용 | `psycopg[binary]==3.2.6` |
