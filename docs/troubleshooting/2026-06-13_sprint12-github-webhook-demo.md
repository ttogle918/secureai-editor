# 2026-06-13 Sprint 12 — GitHub App PR 웹훅 라이브 시연 트러블슈팅

**주제**: PR 웹훅→AI 분석 자동화 실 시연(ngrok) 중 발견·해결한 인프라/버그 이슈  
**범위**: 실 GitHub PR #78 전구간(웹훅→설치토큰→Check Run→분석) 테스트  
**대상 커밋**: e795f99, b4018bc, 9bb9159, 9cc45b5, a387c3b  
**영향도**: Critical(웹훅 동작 불가) ~ Medium(시계스큐 엣지케이스)

---

## 이슈 1 — 웹훅 POST가 항상 401 (한 번도 도달 못 함)

### 증상
- 로컬 POST `localhost:8080/webhooks/github` → 401 Unauthorized
- ngrok 트래픽 `https://<url>.ngrok.app/webhooks/github` → 401
- GitHub App 웹훅 배달 시도 → 404/실패 (로그에 엔드포인트 존재 안 함)
- 웹훅이 한 번도 Spring 백엔드에 도달하지 못하고 차단됨

### 원인 분석
**근본 원인**: SecurityConfig의 permitAll 매처 경로 오류

```
❌ 현재: permitAll("/webhooks/github")
✅ 실제 엔드포인트: /api/v1/webhooks/github
```

- 컨트롤러: `@RequestMapping("/api/v1/webhooks")` + `@PostMapping("/github")`
- 다른 모든 public 엔드포인트(`/api/v1/auth/register`, `/api/v1/auth/login` 등)는 `/api/v1/*` prefix로 보호됨
- SecurityConfig의 `permitAll("/webhooks/github")`는 prefix 누락 → Spring이 라우트를 매칭 못 함
- 결과: 실제 요청(`/api/v1/webhooks/github`)은 인증 필터에 걸려 GitHub 서명 검증 **이전**에 401로 차단

### 해결
**커밋**: e795f99

```java
// SecurityConfig.java
- .permitAll("/webhooks/github")  // ❌ prefix 누락
+ .permitAll("/api/v1/webhooks/github")  // ✅ 정정
```

**검증**: 수정 후 테스트
- 로컬 `curl -X POST http://localhost:8080/api/v1/webhooks/github` → **401 → 400** (서명검증 도달로 정상화)
- ngrok POST → GitHub 서명 검증 거리 도달 확인
- 이후 모든 웹훅 flow가 정상 진행

### 교훈
- 경로 prefix 불일치는 조용히 진행되지 않음 — 전체 flow를 차단하는 보안 버그
- 이전 세션부터 "웹훅이 안 들어온다"는 현상은 사실 여기서 비롯됨
- 단위테스트(mock SecurityContext)로는 잡지 못하는 라우팅 버그 → 라이브만 포착

---

## 이슈 2 — GitHub App JWT가 401 'exp too far in the future'

### 증상
- 라이브 `GET /app` 첫 호출(App JWT 검증용)
- GitHub API 응답: `401 Unauthorized` + `"Expiration time' claim ('exp') is too far in the future"`
- 실제로는 토큰이 유효하고(서명/payload 정상), 시간 차이만 문제
- 이후 재호출하면 대간 200 성공(재요청 지연으로 exp 초과치가 줄어듦)

### 원인 분석
**근본 원인**: JWT exp 마진 부족 + 시계 스큐

```
GitHubAppAuthService:
- JWT_EXPIRY_SECONDS = 600 (정확히 10분)
- exp = now + 600s

GitHub 검증 정책:
- exp <= server_time + 600s 면 거부
- 즉, 클라이언트 시간이 서버보다 조금만 앞서거나
- 요청 네트워크 지연(예: 500ms)으로 exp 초과 → 401
```

**구체 상황**:
- exp=600s 설정 → GitHub 수락 상한(600s)과 정확히 일치
- 클라이언트(로컬)-GitHub 서버 시계 스큐 ≥ 1~2s + 요청지연 합산 → 601s 초과 → 거부
- 단위테스트: 시간 mocking(now+600)으로 통과하나 실 엔드포인트는 실 시간차 반영

### 해결
**커밋**: b4018bc

```java
// GitHubAppAuthService.java
- private static final long JWT_EXPIRY_SECONDS = 600L;  // ❌ 마진 0
+ private static final long JWT_EXPIRY_SECONDS = 540L;  // ✅ 60초 마진 확보
```

**추가 변경**:
- `GitHubAppAuthServiceTest`: exp 검증 상한을 명시적으로 문서화(600s)
- `.gitignore`: GitHub App PEM 파일 명시(`*.pem`) — 실수 방지

**검증**:
- 라이브 `GET /app` 재호출 → **200 OK** (slug="secure-editor", appId=3851268 등 반환)
- JWT exp ≤ 540s로 안정화 → 시계스큐 60s 버퍼

### 교훈
- exp=now+max_allowed는 이론상 안전하지만 실제엔 위험 (시계스큐 + 지연)
- JWT 만료 시간은 **마진을 충분히** 잡아야 함
- 단위테스트만으로는 실 시간 거동(네트워크 지연, 시계 스큐)을 반영 못함

---

## 이슈 3 — ai_engine 분석 콜백이 SESSION_NOT_FOUND

### 증상
- 실 PR #78 시연: 웹훅→설치토큰 검증→Check Run 생성→`startAnalysis` 호출 까지 성공
- 직후 백엔드 로그: `BusinessException: SESSION_NOT_FOUND (sessionId=<random-uuid>)`
- `SELECT * FROM analysis_sessions` → **0행** (DB에 세션 행이 없음)
- ai_engine이 진행 로그(예: `[SCAN_STARTED]`)를 콜백할 때 ProgressLogService에서 세션 조회 실패
- Check Run이 `in_progress` 상태로 멈춤 (complete 전환 안 됨)

### 원인 분석
**근본 원인**: TASK-1211 `handlePullRequest`가 AnalysisSession 엔티티를 DB에 저장하지 않음

```java
// ❌ 현재 코드 (버그)
handlePullRequest(payload) {
  UUID sessionId = UUID.randomUUID();  // 랜덤 id만 생성
  // ❌ AnalysisSession을 만들지 않음
  
  dispatchAnalysis(sessionId, ...);
}

// ai_engine 콜백
progressLogService.saveLog(sessionId, ...) {
  session = analysisSessionRepository.findById(sessionId)  // ❌ 못 찾음
  throw new BusinessException("SESSION_NOT_FOUND")
}
```

**설계상 간극**:
- 정상 흐름(`/api/v1/projects/{id}/scan`):
  - AnalysisService.startAnalysis → 새 AnalysisSession 엔티티 생성·저장 → DB id 획득 → 분석 디스패치
- 웹훅 흐름:
  - 랜덤 UUID로 sessionId 대충 만들고, 엔티티 미생성 → DB 조회 불가 → 콜백 실패

### 해결
**커밋**: 9bb9159

```java
// GitHubWebhookService.java
handlePullRequest(payload) {
  // 1. 프로젝트 조회 + owner 로드
  Project project = projectRepository.findByIdWithOwner(projectId)
    .orElseThrow(...);
  
  // 2. AnalysisSession 엔티티 생성 (정상 흐름 미러링)
  AnalysisSession session = AnalysisSession.builder()
    .project(project)
    .user(project.getOwner())
    .scanMode("AUDIT")
    .build();
  analysisSessionRepository.save(session);  // ✅ DB 저장
  
  // 3. 저장된 id를 sessionId로 사용
  dispatchAnalysis(session.getId(), fileFilter, scanMode);
}
```

**추가 변경**:
- `AnalysisSessionRepository` 의존성 주입
- 단위테스트(`GitHubWebhookServiceTest`):
  - mock `analysisSessionRepository.save(any())` → ArgumentCaptor로 저장된 sessionId 검증
  - RedisSubscriber 콜백 mock

**검증**:
- 단위 테스트 GREEN ✅
- 실 PR 시연: ai_engine 진행 로그 콜백 성공 (SESSION_NOT_FOUND 에러 해소)
- Check Run: `in_progress` → `completed` 전환 확인

### 교훈
- 웹훅(비동기)과 일반 API(동기)의 흐름을 분리할 때, 엔티티 초기화 로직을 빠뜨리기 쉬움
- 콜백 흐름은 "뒤에서" 시작되므로, 초기 데이터(session row)가 미리 DB에 있어야 함
- 단위테스트는 mock으로 통과 가능 → 라이브만 포착

---

## 이슈 4 — 도커 백엔드가 GitHub App 설정/PEM을 못 받음

### 증상 A: GitHub App 환경변수 누락
- docker-compose로 백엔드 컨테이너 시작
- 웹훅 도달 후 설치토큰 교환 시도 → App ID/PEM 누락 에러
- `GITHUB_APP_ID`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_APP_PRIVATE_KEY` 환경변수를 못 읽음
- 컨테이너 내 `env | grep GITHUB_APP` → 아무것도 없음

### 증상 B: PEM 파일 인라인 로드 실패
- .env에 PEM을 `\n` 이스케이프로 인라인:
  ```
  GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB...\n-----END RSA PRIVATE KEY-----"
  ```
- 에디터 편집 후 docker-compose up → `PRIVATE_KEY` 값이 첫 줄만 잘림
- JWT 서명 실패: `Invalid PEM structure`

### 원인 분석 A: docker-compose.yml 환경변수 전달 누락

```yaml
# ❌ 현재 (불완전)
services:
  backend:
    environment:
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
      # ❌ GitHub App 설정 없음
```

**결과**: 컨테이너가 `GITHUB_APP_ID`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_APP_PRIVATE_KEY`를 못 받음.

### 원인 분석 B: PEM 인라인 \n 이스케이프 문제

```env
# ❌ .env 인라인 (깨지기 쉬움)
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEp...\n-----END RSA PRIVATE KEY-----"
```

- 에디터(VS Code/IntelliJ)가 `\n`을 **실제 개행**으로 펼침
- docker-compose가 환경변수 읽을 때 개행 처리 불일치 → 첫 줄만 할당

### 해결 A: docker-compose.yml에 GitHub App 환경변수 추가
**커밋**: 9cc45b5

```yaml
# ✅ docker-compose.yml
services:
  backend:
    environment:
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
      GITHUB_APP_ID: ${GITHUB_APP_ID}  # ✅ 추가
      GITHUB_WEBHOOK_SECRET: ${GITHUB_WEBHOOK_SECRET}  # ✅ 추가
      GITHUB_APP_PRIVATE_KEY: ${GITHUB_APP_PRIVATE_KEY}  # ✅ 추가
```

### 해결 B: PEM을 파일 마운트로 주입
**커밋**: a387c3b

```yaml
# ✅ 호스트 .pem 파일을 읽기전용 마운트
services:
  backend:
    environment:
      GITHUB_APP_PRIVATE_KEY_PATH: /run/secrets/github-app.pem
    volumes:
      - "${GITHUB_APP_PRIVATE_KEY_PATH}:/run/secrets/github-app.pem:ro"
```

```java
// Spring 앱에서 경로로 읽기
String keyPath = environment.getProperty("GITHUB_APP_PRIVATE_KEY_PATH");
String privateKey = new String(Files.readAllBytes(Paths.get(keyPath)));
```

```env
# .env (경로만 보관, 인라인 PEM 제거)
GITHUB_APP_PRIVATE_KEY_PATH=~/.ssh/github-app.pem
```

**검증**:
- docker-compose build backend → 이미지 재빌드
- docker-compose up --force-recreate → 컨테이너 재생성
- 라이브 GET /app → 200 (토큰 교환 성공)

### 교훈
- 환경변수는 도커 `environment:` 블록에 **명시**해야 함 (source .env만으로 안 됨)
- PEM 같은 멀티라인 데이터는 **파일 마운트**가 더 견고 (인라인 이스케이프 함정 회피)
- 컨테이너 재시작 vs 재빌드 차이 이해 필수

---

## 이슈 5 — 도커 재기동 후 Flyway DB 인증 실패 + 코드 미반영

### 증상 A: Flyway 비밀번호 인증 실패
- `docker-compose down && docker-compose up -d` 후
- Flyway 마이그레이션 단계에서: `password authentication failed for user "secureai"`
- .env와 docker-compose의 `POSTGRES_PASSWORD` 모두 `changeme_in_production`인데도 불일치

### 증상 B: 마이그레이션 미적용 + 코드 미반영
- Flyway 재시도 후 성공하나, DB 테이블 구조가 낡음 (V050/V051 미적용)
- 예: `pr_review_history.session_id` 컬럼 없음 (V051에서 추가)
- 백엔드 코드에는 V051 마이그레이션 참고 로직이 있음 → INSERT 실패

### 원인 분석 A: Postgres 데이터 볼륨 초기화 타이밍
```yaml
# docker-compose.yml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: changeme_in_production
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

- Postgres는 **최초 컨테이너 시작 때만** `POSTGRES_PASSWORD` 환경변수를 적용 (entrypoint initdb)
- 이미 초기화된 데이터 볼륨(`postgres_data`)이 있으면, 비번 설정을 다시 하지 않음
- 결과: 데이터 볼륨이 **다른 비번**으로 이미 초기화돼 있고, .env 변경은 무시됨

### 원인 분석 B: docker-compose up -d는 재빌드 하지 않음
```bash
# ❌ 현재 (이미지 재사용)
docker-compose up -d

# 결과: 3시간 전 빌드된 이미지(우리 코드 없음)에서 컨테이너 시작
```

- 백엔드 코드를 수정(V051 마이그레이션 추가)하나, 이미지는 옛 버전
- V051 SQL 파일이 컨테이너 내 없음 → Flyway가 실행 못함

### 해결 A: DB 비밀번호 재설정
```bash
# 도커 컨테이너 내 postgres 진입
docker exec -it secureai-postgres psql -U postgres

# psql> 
ALTER USER secureai PASSWORD 'changeme_in_production';

# 또는 비번을 새걸로 변경 후 .env 업데이트
ALTER USER secureai PASSWORD 'new_password_here';
```

### 해결 B: 이미지 재빌드 + 컨테이너 강제 재생성
```bash
# 1. 빌드 갱신
docker-compose build backend ai_engine

# 2. 컨테이너 강제 재생성 (이미지 캐시 무시)
docker-compose up -d --force-recreate backend ai_engine

# 3. Flyway 로그 확인 (V050, V051, V052 등 모두 실행)
docker logs secureai-backend 2>&1 | grep Flyway
```

**검증**:
- Flyway: `Successfully validated 5 migrations` + V050/V051 모두 적용 확인
- DB 테이블: `\dt` → `pr_review_history` 최신 스키마 확인
- 백엔드 시작 성공 (컨테이너 로그 에러 없음)

### 교훈
- Docker 데이터 볼륨은 **영구 스토리지** — 환경변수 재설정 안 됨
- 이미지와 컨테이너 분리 이해: up는 컨테이너 기동만, 코드 변경 반영엔 빌드 필수
- 스테일 이미지 함정: `docker-compose logs` 보고 "어? 코드가 없네?" → 재빌드 필요

---

## 이슈 6 — ngrok/GitHub App 웹훅 설정 함정 (참고)

### 증상 및 원인
- **무료 ngrok 커스텀 도메인 거부**:
  - ngrok TLD: `.ngrok.app` (또는 임시 `.ngrok.io`)
  - GitHub App 웹훅 설정: `.app` TLD 요구
  - ERR_NGROK_313: "Custom subdomains are reserved for Pro" → 임시 URL만 할당 가능

- **도메인 TLD 불일치**:
  - ngrok 할당: `https://<random-hash>.ngrok-free.app`
  - GitHub 설정: `https://my-webhook.app` (예상)
  - 실제 매칭: 불일치 → 웹훅이 엉뚱한 엔드포인트로 가거나 실패

- **이벤트 구독 누락**:
  - GitHub App 설정 → Permissions & Events
  - "Pull request" 체크 누락 (대신 pull_request_review_*, pull_request_review_comment만 있음)
  - 결과: PR 생성해도 웹훅 이벤트 발화 안 됨

### 해결
```bash
# 1. ngrok 현재 URL 확인
curl http://localhost:4040/api/tunnels

# 출력 예:
# "public_url": "https://abc123.ngrok-free.app"

# 2. GitHub App 웹훅 URL 업데이트 (API)
curl -X PATCH \
  -H "Authorization: Bearer <app-token>" \
  https://api.github.com/app/hook/config \
  -d '{
    "url": "https://abc123.ngrok-free.app/api/v1/webhooks/github",
    "secret": "<webhook-secret>"
  }'

# 3. GitHub UI에서 이벤트 구독 활성화
# Settings → Code permissions (Read) → Events → "Pull request" 체크 (필수)
# (이벤트 구독은 API 미지원, UI 전용)

# 4. 테스트: 실 PR 생성
git push origin demo/webhook-sast
# GitHub: PR 생성
# Backend: 웹훅 로그 확인
docker logs secureai-backend 2>&1 | grep "handlePullRequest"
```

### 교훈
- 외부 터널 도구(ngrok)와 SaaS(GitHub) 통합은 주소 동기화 수동 필요
- API만으로 안 되는 설정(이벤트 구독)은 UI 문서화 필수

---

## 종합 정리

| 이슈 | 영향도 | 근본원인 | 해결 |
|------|--------|---------|------|
| **#1 웹훅 401** | **Critical** | SecurityConfig 경로 prefix 누락 | e795f99: `/webhooks` → `/api/v1/webhooks` |
| **#2 JWT exp 401** | High | 시계스큐 마진 부족(600→540s) | b4018bc: JWT_EXPIRY_SECONDS 조정 |
| **#3 SESSION_NOT_FOUND** | High | AnalysisSession 미생성 | 9bb9159: handlePullRequest에서 엔티티 저장 |
| **#4 Docker App env/PEM** | High | compose 미전달 + 인라인 \n 깨짐 | 9cc45b5, a387c3b: env 추가 + 파일마운트 |
| **#5 Flyway 비번/코드** | Medium | 데이터볼륨 영구화 + 이미지 캐시 | `build --force-recreate` + DB 비번 재설정 |
| **#6 ngrok URL/이벤트** | Low | 외부 도구 동기화 + UI 이벤트 설정 | API PATCH + 수동 UI 체크 |

### 라이브 검증의 가치
- **단위테스트(mock)로는 못 잡음**: 경로 불일치, 시계스큐, 엔티티 초기화, 환경변수 전달, 데이터볼륨 영구화
- **라이브 전구간만 드러남**: GitHub API(실 시간) + 웹훅(비동기) + DB(영구 상태) + 도커(격리) 모두 통과
- **신뢰도 vs 개발속도**: 5시간 시연 = 버그 6건 발견·수정 → 테스트 녹색 유지 + 신뢰도 대폭 향상

---

## 다음 시연/검증 체크리스트

- [ ] 실 PR #78: 웹훅 도달 → Check Run 생성 → 분석 완료 (E2E flow 재확인)
- [ ] ai_engine 분석 결과: 취약점 산출 확인 (DAST 아직 미완료 — TASK-1212 MCP 필요)
- [ ] Demo 아티팩트 정리: PR #78 close vs 유지, 브랜치 삭제 여부 결정
- [ ] 프로덕션 배포 전: .env 템플릿(GITHUB_APP_ID, PEM 경로) 문서화

---

**작성**: 2026-06-13  
**대상 브랜치**: feat/sprint12  
**연계 세션 로그**: docs/session_log/2026-06-13_session-summary.md (섹션 3 버그 수정 참고)
