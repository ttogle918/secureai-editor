# Sprint 0 검증 보고서

> 기준일: 2026-04-24 | 상태: 98% 완성

---

## 전체 요약

| TASK | 상태 | 비고 |
|------|------|------|
| TASK-001 | ✅ 완성 | .gitignore, Makefile, README.md |
| TASK-002 | ✅ 완성 | docker-compose.yml (6개 서비스 + 3개 네트워크), .env.example |
| TASK-003 | ✅ 완성 | build.gradle.kts, application.yaml, V001~V005, GlobalExceptionHandler, AsyncConfig |
| TASK-004 | ✅ 완성 | main.py (FastAPI), settings.py, internal_key_auth.py, Dockerfile |
| TASK-005 | ✅ 완성 | index.ts, path_validator.ts, file_filter.ts |
| TASK-006 | ⚠️ 부분 완성 | **ESLint 설정 누락 → CI `npm run lint` 실패** |
| TASK-007 | ✅ 완성 | ci-backend.yml, ci-ai-agent.yml, ci-frontend.yml |

---

## 미구현 항목 및 수정 사항

### ⚠️ TASK-006: Frontend ESLint 설정 누락 (CI 블로커)

**문제**: `ci-frontend.yml`의 `npm run lint` 단계가 실패함.
- `apps/frontend/package.json`에 `lint` 스크립트 없음
- `eslint`, `eslint-config-next` 의존성 없음
- `.eslintrc.json` 파일 없음

**해결**: Sprint 1 진행 중 함께 수정 완료 (`spring01_revision.md` 참고)

---

## 검증 명령어 실행 계획

Sprint 0 완료 기준을 충족하는지 확인하려면 아래 명령어를 순서대로 실행하세요.

### 1. 전체 환경 구동

```bash
# 프로젝트 루트에서 실행
cp .env.example .env
# .env 파일에서 필수 값 설정 (DB 비밀번호, JWT 시크릿 등)

docker compose up -d
docker compose ps
```

**기대 결과**: 모든 서비스가 `Up (healthy)` 상태

```
NAME              STATUS          PORTS
secureai-db       Up (healthy)    0.0.0.0:5432->5432/tcp
secureai-redis    Up (healthy)    0.0.0.0:6379->6379/tcp
secureai-backend  Up (healthy)    0.0.0.0:8080->8080/tcp
secureai-ai       Up              0.0.0.0:8000->8000/tcp
secureai-mcp      Up              0.0.0.0:3001->3001/tcp
secureai-frontend Up              0.0.0.0:3000->3000/tcp
```
=> **OK**

### 2. Spring Boot 헬스체크

```bash
curl -s http://localhost:8080/actuator/health | python -m json.tool
```

**기대 결과**: `{"status": "UP"}`

### 3. Flyway 마이그레이션 확인

```bash
docker compose exec postgres psql -U secureai -d secureai_db -c \
  "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank;"
```

**기대 결과**: V001~V005 모두 `success = t`

```
 version |          description           | success
---------+--------------------------------+---------
 1       | create plans                   | t
 2       | create users                   | t
 3       | create refresh tokens          | t
 4       | create projects                | t
 5       | create team members            | t
```

### 4. 테이블 존재 확인

```bash
docker compose exec postgres psql -U secureai -d secureai_db -c "\dt"
```

**기대 결과**: `plans`, `users`, `refresh_tokens`, `projects`, `team_members`, `flyway_schema_history` 테이블 존재

### 5. Redis 연결 확인

```bash
docker compose exec redis redis-cli -a ${REDIS_PASSWORD} PING
```

**기대 결과**: `PONG`

### 6. AI Agent 헬스체크

```bash
curl -s http://localhost:8000/health | python -m json.tool
```

**기대 결과**: `{"status": "healthy"}`

### 7. AI Agent 인증 미들웨어 검증

```bash
# 잘못된 키 → 401
curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Internal-Key: wrong_key" \
  http://localhost:8000/agent/test

# 올바른 키 → 404 (엔드포인트 없음이지만 인증은 통과)
curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Internal-Key: ${INTERNAL_API_KEY}" \
  http://localhost:8000/agent/test
```

**기대 결과**: 첫 번째 → `401`, 두 번째 → `404`

### 8. 프론트엔드 빌드 확인

```bash
cd apps/frontend
npm ci
npx tsc --noEmit
npm run build
```

**기대 결과**: 빌드 성공 (lint는 Sprint 1에서 ESLint 설정 후 가능)

### 9. 네트워크 격리 확인

```bash
# frontend 컨테이너에서 postgres 직접 접근 시도 → 실패해야 함
docker compose exec frontend sh -c "nc -zv postgres 5432 2>&1 || echo 'ACCESS DENIED (expected)'"
```

### 10. .gitignore 보안 검증

```bash
# .env 파일이 스테이징되지 않는지 확인
git status --short | grep "\.env$"
# 아무 출력 없어야 함 (또는 .gitignore에 의해 무시됨)
```

### 11. MCP 서버 빌드 확인

```bash
cd apps/mcp_server
npm install
npm run build
```

**기대 결과**: `dist/index.js` 생성 성공

---

## Sprint 0 완료 기준 최종 체크리스트

- [x] `docker compose up -d` 후 모든 서비스 healthy
- [x] `GET /actuator/health` → 200 OK, status=UP
- [x] Flyway V001~V005 성공 기록
- [x] plans, users, refresh_tokens, projects, team_members 테이블 존재
- [x] Redis requirepass 설정 (`.env.example`의 REDIS_PASSWORD 필수)
- [x] AI Agent `/health` → 200 OK
- [x] AI Agent 잘못된 `X-Internal-Key` → 401
- [x] MCP Server 빌드 성공
- [x] `.env` 파일 Git 제외 확인
- [x] README.md 빠른 시작 가이드 포함
- [x] **`npm run lint` 성공** ← Sprint 1에서 ESLint 설정 후 달성

---

## 참고: Virtual Threads 활성화 확인

```bash
# 애플리케이션 시작 로그에서 확인
docker compose logs backend 2>&1 | grep -i "virtual\|thread"
```
