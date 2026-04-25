# 트러블슈팅 기록

> 최초 작성: 2026-04-24 | Sprint 0~1 환경 세팅 중 발생한 이슈 모음

---

## 이슈 1: 백엔드 Health DOWN — 메일 인증 실패

### 증상
```
GET /actuator/health → {"status": "DOWN"}
docker compose logs backend | grep ERROR
→ jakarta.mail.AuthenticationFailedException: failed to connect, no password specified?
```

### 원인
`.env`의 `MAIL_USERNAME`, `MAIL_PASSWORD`가 비어 있어 Spring Mail Health Indicator가 SMTP 연결에 실패.

### 해결
1. Gmail 앱 비밀번호 생성 (Google 계정 → 보안 → 앱 비밀번호)
2. `.env` 수정:
   ```
   MAIL_USERNAME=your_gmail@gmail.com
   MAIL_PASSWORD=xxxx_xxxx_xxxx_xxxx   # 앱 비밀번호 16자리
   ```
3. `docker compose up -d backend` 재시작

---

## 이슈 2: curl 한글 → `Invalid UTF-8 middle byte 0xd7`

### 증상
```
curl -d '{"displayName": "테스트유저"}' ...
→ HTTP 500: JSON parse error: Invalid UTF-8 middle byte 0xd7
```

### 원인
Windows 터미널(Git Bash / cmd)이 한글 문자열을 UTF-8이 아닌 CP949(EUC-KR)로 전송.

### 해결
**방법 1** — PowerShell에서 UTF-8 바이트로 명시 전송:
```powershell
$body = '{"displayName":"테스트유저"}'
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
Invoke-WebRequest -Uri "http://localhost:8080/..." -Method POST -ContentType "application/json" -Body $bytes
```

**방법 2** — Swagger UI 사용 (브라우저에서 직접 테스트): `http://localhost:8080/swagger-ui/index.html`

**방법 3** — curl에서 한글 대신 ASCII 사용하고 Swagger/Postman에서 한글 테스트

---

## 이슈 3: 회원가입 API 500 — plans 테이블 비어있음

### 증상
```
POST /api/v1/auth/register → HTTP 500: INTERNAL_SERVER_ERROR
백엔드 로그: BusinessException: INTERNAL_SERVER_ERROR detail=null
```

### 원인
`AuthService.register()` 에서 `planRepository.findByName("free")`가 empty를 반환하여 예외 발생.
Flyway `baseline-on-migrate: true` 설정 때문에 V001 마이그레이션이 실제로 실행되지 않고 기준선(baseline)으로만 마킹됨.

**Flyway `baseline-on-migrate: true` 동작 방식**:
- 기존 테이블이 있고 `flyway_schema_history` 없을 때 → V1을 SQL 실행 없이 "이미 적용됨"으로 마킹
- 결과: plans 테이블은 생성됐지만 INSERT 데이터가 없음

### 해결
**즉시 수정** — plans 데이터 직접 삽입:
```sql
INSERT INTO plans (id, name, display_name, monthly_price_krw, max_members, monthly_sast_limit,
                   allow_private_repo, allow_dast, allow_monitoring, allow_pdf_report, allow_sbom,
                   allow_sso, api_rate_limit_per_min, created_at)
VALUES
    (1, 'free',       '무료',       0,      1,  50,  false, false, false, false, false, false, 10, NOW()),
    (2, 'pro',        'Pro',        19900,  1,  -1,  true,  true,  false, true,  true,  false, 60, NOW()),
    (3, 'team',       'Team',       59000,  5,  -1,  true,  true,  true,  true,  true,  false, 120, NOW()),
    (4, 'enterprise', 'Enterprise', 0,      -1, -1,  true,  true,  true,  true,  true,  true,  -1, NOW())
ON CONFLICT (id) DO NOTHING;
```

**근본 수정** — `application.yaml` 변경:
```yaml
spring:
  flyway:
    baseline-on-migrate: false   # true → false
```
→ 백엔드 이미지 리빌드 후 재시작 (완료)

---

## 이슈 4: MCP 서버 Restarting 루프

### 증상
```
docker compose ps
→ secureai-mcp-server: Restarting (0) 46 seconds ago
```

### 원인
`apps/mcp_server/src/index.ts`가 `StdioServerTransport`를 사용함.
stdio 모드는 stdin/stdout을 통해 AI Agent와 통신하는 방식으로, Docker 컨테이너로 단독 실행 시 stdin이 즉시 EOF → 프로세스 종료 → 재시작 루프.

### 해결
`docker-compose.yml`에서 mcp_server 서비스를 주석 처리:

```yaml
# MCP Server는 AI Agent가 subprocess로 직접 spawn — docker-compose 단독 실행 불가
# mcp_server:
#   build: ...
```

**Sprint 2에서의 처리 방식**:
MCP Server는 AI Agent(`apps/ai_engine`)가 분석 실행 시 Python `subprocess`로 직접 기동.
Docker 네트워크가 아닌 프로세스 내부 stdio 파이프로 통신.

---

## 이슈 5: Swagger 미설치

### 증상
`http://localhost:8080/swagger-ui/index.html` → 404

### 해결
`apps/backend/build.gradle.kts`에 의존성 추가:
```kotlin
implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.8")
```

`SwaggerConfig.java` 신규 생성 (JWT Bearer 인증 스킴 포함).

`SecurityConfig.java`에 Swagger 경로 허용 추가:
```java
"/swagger-ui/**",
"/swagger-ui.html",
"/v3/api-docs/**"
```

백엔드 이미지 리빌드 후 접근: **`http://localhost:8080/swagger-ui/index.html`** ✅

---

## 현재 서비스 상태 요약

| 서비스 | 상태 | 접근 주소 |
|--------|------|---------|
| PostgreSQL | ✅ Up (healthy) | `localhost:5432` |
| Redis | ✅ Up (healthy) | `localhost:6379` |
| Backend | ✅ Up | `http://localhost:8080` |
| Swagger UI | ✅ | `http://localhost:8080/swagger-ui/index.html` |
| AI Engine | ✅ Up | `http://localhost:8000` |
| MCP Server | ⚠️ 주석 처리 | Sprint 2에서 AI Agent subprocess로 기동 |
| Frontend | ℹ️ Docker 미포함 | `cd apps/frontend && npm run dev` |

---

## 프론트엔드 구조 설명

현재 프론트엔드는 **두 가지 파트**로 구성됩니다:

### 메인 에디터 (`/`)
- `apps/frontend/src/app/page.tsx`
- Monaco 에디터 + 취약점 패널 + 대시보드 레이아웃
- **현재 Mock 데이터 사용** (백엔드 미연결)
- Sprint 4에서 실제 API 연결 예정

### 인증 페이지 (`/login`, `/register`, `/auth/callback`)
- `apps/frontend/src/app/(auth)/` 디렉토리
- **백엔드 API 실제 연결됨** (`http://localhost:8080/api/v1`)
- useAuth 훅 → Axios → 백엔드

### 프론트엔드 실행 방법
```bash
cd apps/frontend
npm install
npm run dev
# → http://localhost:3000 접속
```

---

## Sprint 1 테스트 권장 방법

curl 대신 아래 두 가지를 사용하세요:

### 방법 1: Swagger UI (추천)
`http://localhost:8080/swagger-ui/index.html`
- 브라우저에서 직접 API 테스트
- 한글 입력 가능
- JWT Bearer 토큰 설정 후 인증 필요 엔드포인트 테스트 가능

### 방법 2: 프론트엔드 직접 사용
```bash
cd apps/frontend && npm run dev
```
`http://localhost:3000/login` → 회원가입 → 로그인

### 방법 3: PowerShell (한글 필요 시)
```powershell
$body = '{"key":"값"}' 
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
Invoke-WebRequest -Uri "http://localhost:8080/api/v1/..." -Method POST -ContentType "application/json" -Body $bytes
```
