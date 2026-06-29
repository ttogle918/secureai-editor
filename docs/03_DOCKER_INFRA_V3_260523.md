# SecureAI — Docker 인프라 v3.0
> 기준: Sprint 8 완료 (+ Sprint 9: Prometheus/Grafana 추가)  
> 작성일: 2026-05-22  
> **정본 지정일**: 2026-05-23 | 구버전(`03_DOCKER_INFRA.md`, `03_DOCKER_INFRA_V2.md`) 아카이브 완료

## 버전 이력

| 버전 | 기준일 | 주요 변경 |
|------|--------|---------|
| V1 | 2026-04-19 | 초기 구성 — postgres, redis, backend, ai_engine, frontend, mcp_server 6개 서비스, app-net/data-net/dast-net 3개 네트워크 |
| V2 | 2026-04 (Sprint 6) | pgvector/pgvector:pg15 이미지 변경, dast-isolated-net 격리 네트워크 분리, DAST 샌드박스 Docker Socket 마운트 구성 |
| V3 | 2026-05-22 | Sprint 8: Nginx API Gateway(`:80/443`), Jaeger(OpenTelemetry, `:16686/4317`) 추가, k6 성능 테스트 서비스 추가. Sprint 9: Prometheus(`:9090`), Grafana(`:3000`) 추가, AI Engine `ports→expose` 변환(외부 차단) |
| **V4 정정 (현재)** | 2026-06-29 | **코드 정합 정정**(아래 §0). Sprint 12 Loki/Promtail 추가, AI엔진 host 8000 재노출, 네트워크 3종(trace-net 없음), DAST 비격리 실태, 포트 정정 |

---

## 0. ⚠️ 현재 구현 정합 (2026-06-29 — `docker-compose.yml` 기준, 본 섹션 우선)

> 본문 §1~§8은 Sprint 8 기준. 아래가 현재 실제 구성. **충돌 시 §0이 정본.**

### 0.1 실제 서비스 (12종 + 주석 2종)

| 컨테이너 | 이미지 | 포트(host→cont) | 네트워크 | 비고 |
|---------|--------|-----------------|---------|------|
| postgres | pgvector/pgvector:pg15 | 5434→5432 | data-net | |
| redis | redis:7-alpine | 6379 | data-net | db1 사용 |
| backend | build | 8080 | **app-net+data-net** | docker.sock 마운트(DooD), github-app.pem 마운트 |
| ai_engine | build (hostname ai-engine) | **8000 publish + expose** | **app-net+data-net** | FE가 DAST SSE 직접 구독차 host 노출 |
| jaeger | jaegertracing/all-in-one:1.56 | 16686/4317/**4318** | app-net+data-net | |
| nginx | nginx:1.25-alpine | 80/443 | app-net+**dast-isolated-net** | |
| prometheus | prom/prometheus | 9090 | app-net | |
| **loki** | grafana/loki:3.0.0 | 3100 | app-net | **신규(TASK-1603)** |
| **promtail** | grafana/promtail:3.0.0 | — | app-net | docker.sock tail **신규** |
| grafana | grafana/grafana | **3001→3000** | app-net | Loki+Prometheus DS |
| k6 | grafana/k6 | — | app-net | profile:perf |
| zap | ghcr.io/zaproxy/zaproxy:stable | — | **dast-isolated-net** | profile:zap |
| ~~frontend~~ | (주석) | 3000 | — | dev는 **로컬 npm** |
| ~~mcp_server~~ | (주석) | — | — | ai_engine **stdio subprocess** |

### 0.2 네트워크 — 실제 3종

```
app-net           (bridge)        : nginx·backend·ai_engine·jaeger·prometheus·grafana·loki·promtail
data-net          (bridge)        : backend·ai_engine·postgres·redis·jaeger
dast-isolated-net (external:true) : nginx·zap(profile). backend는 docker.sock(DooD)로 호스트망 직접 참조
```
> ❌ 본문 §2의 `frontend-net`·`trace-net`은 **존재하지 않는다**.

### 0.3 Sentry (env-gated, TASK-1804)
`BACKEND_SENTRY_DSN`/`AI_ENGINE_SENTRY_DSN` 미설정 시 비활성. backend·ai_engine·frontend 3곳.

### 0.4 DAST 격리 실태
제품 DAST executor는 **ai_engine 프로세스 內 httpx**로 app-net에서 실행(비격리) → ai_engine이 data-net 멀티홈이라 SSRF 측면이동 표면 존재. 격리화 = 백로그 **TASK-1227**. dast-isolated-net 격리는 **ZAP 한정**.

---

## 1. 서비스 구성

| 컨테이너 | 이미지 / 빌드 | 역할 | 포트 |
|---------|-------------|------|------|
| `secureai-nginx` | `nginx:1.25-alpine` | API Gateway, SSL 터미네이션, 라우팅 | 80, 443 |
| `secureai-postgres` | `pgvector/pgvector:pg15` | 메인 DB (pgvector 포함), LangGraph 체크포인터 | 5432 |
| `secureai-redis` | `redis:7-alpine` | 진행 이벤트 Pub/Sub, 세션 캐시, Rate Limiting | 6379 |
| `secureai-backend` | `apps/backend/Dockerfile` | REST API, SSE, 내부 API 라우팅 (Spring Boot 4) | 8080 |
| `secureai-ai-engine` | `apps/ai_engine/Dockerfile` | FastAPI + LangGraph SAST 파이프라인 (Python + Node.js) | 8000 |
| `secureai-jaeger` | `jaegertracing/all-in-one:latest` | OpenTelemetry 기반 분산 추적 수집 및 시각화 UI | 16686, 4317 |
| `secureai-k6` | `grafana/k6:latest` | CI/CD 및 성능(부하) 테스트용 (별도 실행) | - |

> **MCP Server**는 별도 컨테이너가 아닌 AI Engine이 **subprocess**로 spawn함 (`node /app/mcp_server/dist/index.js`).  

---

## 2. 네트워크

```
frontend-net (bridge) : 외부 ↔ nginx
app-net      (bridge) : nginx ↔ backend, backend ↔ ai_engine (HTTP)
data-net     (bridge) : backend + ai_engine ↔ postgres, redis
trace-net    (bridge) : backend + ai_engine ↔ jaeger (OTLP)
dast-net     (bridge, internal) : DAST 샌드박스용 컨테이너 격리 네트워크
```

---

## 3. AI Engine Dockerfile 변경사항

```dockerfile
FROM python:3.12-slim AS base
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Node.js 설치 (MCP Server subprocess 실행용)
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

---

## 4. 볼륨 마운트 구성

### 4.1 AI Engine
```yaml
ai_engine:
  volumes:
    - ${WORKSPACE_PATH:-/workspace}:/workspace:ro   # 분석 대상 소스코드 디렉토리
    - ./apps/mcp_server:/app/mcp_server:ro          # MCP Server dist/ + node_modules/
```

### 4.2 Nginx API Gateway
```yaml
nginx:
  volumes:
    - ./config/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./certs:/etc/nginx/certs:ro                   # SSL 인증서
```

---

## 5. LangGraph PostgreSQL 체크포인터 (pgvector)

Sprint 8부터 `postgres:15-alpine`에서 `pgvector/pgvector:pg15`로 변경되었습니다. (추후 RAG 기능을 위한 벡터 저장소 지원)

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

---

## 6. 환경변수 전체 목록

### 6.1 공통 (필수)

| 변수 | 설명 |
|------|------|
| `DB_PASSWORD` | PostgreSQL 비밀번호 |
| `REDIS_PASSWORD` | Redis 비밀번호 |
| `INTERNAL_API_KEY` | Backend ↔ AI Engine 내부 통신 키 |

### 6.2 Backend 추가 필수

| 변수 | 설명 |
|------|------|
| `JWT_SECRET` | JWT 서명 키 (64자 이상) |
| `SECUREAI_ENCRYPTION_KEY` | AES-256-GCM 키 (base64 32바이트) |
| `AI_AGENT_URL` | `http://ai_engine:8000` (compose 내부) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://jaeger:4317` (OpenTelemetry) |

### 6.3 AI Engine 추가 필수

| 변수 | 설명 |
|------|------|
| `CLAUDE_API_KEY` | Anthropic API 키 |
| `POSTGRES_URL` | `postgresql://<user>:<pass>@postgres:5432/<db>` |
| `REDIS_URL` | `redis://:<pass>@redis:6379/1` |
| `WORKSPACE_PATH` | 로컬 소스코드 경로 (호스트 → `/workspace` 마운트) |
| `MCP_WORKSPACE_ROOT` | `/workspace` (컨테이너 내부 경로, 기본값 유지) |
| `BACKEND_INTERNAL_URL` | `http://backend:8080` |

---

## 7. 개발 환경 시작 순서

```bash
# 1. 환경변수 설정
cp .env.example .env
# .env 편집: DB_PASSWORD, REDIS_PASSWORD, INTERNAL_API_KEY, CLAUDE_API_KEY, WORKSPACE_PATH

# 2. MCP Server 빌드 (최초 1회)
cd apps/mcp_server && npm install && npm run build && cd ../..

# 3. 인프라 실행 (Nginx, Jaeger 포함)
docker compose build
docker compose up -d

# 4. 헬스체크 및 추적 확인
curl http://localhost/actuator/health    # Nginx를 통한 백엔드 헬스체크
curl http://localhost:8000/health        # AI Engine 헬스체크
# Jaeger UI: http://localhost:16686
```

---

## 8. v2 대비 변경 요약 (Sprint 8)

| 항목 | v2 (Sprint 2) | v3 (Sprint 8) |
|------|------------------|------------------|
| 진입점 (Gateway) | Backend 직접 노출 | Nginx API Gateway (포트 80/443) |
| 분산 추적 | 없음 | Jaeger (OTLP 4317, UI 16686) 추가 |
| 데이터베이스 이미지 | `postgres:15-alpine` | `pgvector/pgvector:pg15` |
| 성능 테스트 | 없음 | k6 컨테이너 기반 부하 테스트 환경 추가 |
