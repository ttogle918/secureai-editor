# SecureAI — REST API 설계서
> 작성자: 시니어 백엔드 개발자 / 데이터 아키텍처 전문가 공동 작성  
> 기준 스택: Spring Boot 4 + Spring Security 7 + Spring AI  
> 인증 방식: JWT Bearer Token (Access 15min / Refresh 30day Rotation)  
> 작성일: 2026-04-19 | 버전: v1.0

---

## 목차

1. [공통 규칙](#1-공통-규칙)
2. [인증 API (Auth)](#2-인증-api-auth)
3. [사용자 API (Users)](#3-사용자-api-users)
4. [프로젝트 API (Projects)](#4-프로젝트-api-projects)
5. [분석 세션 API (Analysis)](#5-분석-세션-api-analysis)
6. [취약점 API (Vulnerabilities)](#6-취약점-api-vulnerabilities)
7. [DAST API (Dynamic Analysis)](#7-dast-api-dynamic-analysis)
8. [패치 API (Patches)](#8-패치-api-patches)
9. [리포트 API (Reports)](#9-리포트-api-reports)
10. [GitHub 연동 API](#10-github-연동-api)
11. [CVE / SBOM API](#11-cve--sbom-api)
12. [모니터링 API (Phase 3)](#12-모니터링-api-phase-3)
13. [Webhook API](#13-webhook-api)
14. [AI 채팅 API](#14-ai-채팅-api)
15. [관리자 API (Admin)](#15-관리자-api-admin)
16. [에러 코드 정의](#16-에러-코드-정의)
17. [성능 / 캐싱 / 스케줄링 전략 요약](#17-성능--캐싱--스케줄링-전략-요약)

---

## 1. 공통 규칙

### 1.1 Base URL
```
개발:  http://localhost:8080/api/v1
운영:  https://api.secureai.io/api/v1
```

### 1.2 Request Headers

```http
Authorization: Bearer {accessToken}     # 인증 필요 API
Content-Type: application/json
Accept: application/json
X-Request-ID: {uuid}                    # 클라이언트 요청 추적 (선택)
```

### 1.3 Response Envelope

```json
// 성공
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-04-19T14:32:01Z",
    "version": "1.0"
  }
}

// 성공 (페이지네이션)
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "size": 20,
    "totalElements": 142,
    "totalPages": 8,
    "hasNext": true
  }
}

// 에러
{
  "success": false,
  "error": {
    "code": "VULN_NOT_FOUND",
    "message": "취약점을 찾을 수 없습니다.",
    "detail": "vulnerabilityId=xxx is not found in sessionId=yyy",
    "timestamp": "2026-04-19T14:32:01Z"
  }
}
```

### 1.4 HTTP 상태코드 원칙

| 상황 | 코드 |
|------|------|
| 조회 성공 | 200 |
| 생성 성공 (비동기 포함) | 201 |
| 수정 성공 (응답 본문 없음) | 204 |
| 잘못된 요청 | 400 |
| 미인증 | 401 |
| 권한 없음 (플랜/역할) | 403 |
| 리소스 없음 | 404 |
| 중복 | 409 |
| 요청 횟수 초과 | 429 |
| 서버 에러 | 500 |

### 1.5 Rate Limiting

- 응답 헤더로 현재 상태 반환:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1745070721
```
- 플랜별 제한: Free(10/min), Pro(60/min), Team(120/min), Enterprise(무제한)
- Redis Counter (`secureai:ratelimit:{userId}:api`) + `@RateLimiter` AOP

### 1.6 성능 관련 공통 사항

- **캐시**: `@Cacheable`/`@CacheEvict` (Spring Cache + Redis) 명시
- **비동기**: `@Async("analysisExecutor")` — 즉시 201 반환 후 백그라운드 처리
- **페이지네이션**: Offset 기반 (기본 page=0, size=20, 최대 size=100)
- **N+1 방지**: JPA `@EntityGraph` 또는 Fetch Join 명시 필요 구간 표시

---

## 2. 인증 API (Auth)

### 2.1 회원가입

```
POST /auth/register
인증: 불필요
```

**Request Body**
```json
{
  "email": "dev@example.com",
  "password": "SecurePass123!",
  "username": "devuser",
  "displayName": "개발자"
}
```

**Response 201**
```json
{
  "data": {
    "userId": "uuid",
    "email": "dev@example.com",
    "username": "devuser",
    "message": "이메일 인증 메일이 발송되었습니다."
  }
}
```

**처리 흐름**
- 이메일/username 중복 확인 (DB 조회)
- Bcrypt(rounds=12) 해싱
- 이메일 인증 토큰 생성 → 비동기 발송 (`@Async("emailExecutor")`)
- Audit Log 기록

---

### 2.2 이메일 인증

```
GET /auth/verify-email?token={token}
인증: 불필요
```

**Response 200**
```json
{ "data": { "message": "이메일 인증이 완료되었습니다." } }
```

---

### 2.3 로그인

```
POST /auth/login
인증: 불필요
```

**Request Body**
```json
{
  "email": "dev@example.com",
  "password": "SecurePass123!"
}
```

**Response 200**
```json
{
  "data": {
    "accessToken": "eyJhbGc...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "dev@example.com",
      "username": "devuser",
      "displayName": "개발자",
      "planId": 1,
      "planName": "free"
    }
  }
}
```

**Set-Cookie** (HttpOnly, Secure, SameSite=Strict)
```
refresh_token={token}; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=2592000
```

**처리 흐름**
- 로그인 실패 5회 → `locked_until = NOW() + 15 min`
- 성공 시 `last_login_at`, `login_fail_count=0` 업데이트
- Refresh Token 해시 → Redis (`secureai:refresh:{hash}`, TTL 30일) + DB 저장
- `secureai:user:{userId}:plan` Redis 캐시 갱신

---

### 2.4 Access Token 갱신

```
POST /auth/refresh
인증: 불필요 (Refresh Token Cookie)
```

**Response 200**
```json
{
  "data": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 900
  }
}
```

**처리 흐름** (Refresh Token Rotation)
1. Cookie에서 Refresh Token 추출
2. SHA-256 해시 → Redis 조회
3. 유효하면 구 토큰 Redis + DB 무효화
4. 새 Refresh Token 발급 → Redis + DB 저장 + 새 Cookie

---

### 2.5 로그아웃

```
POST /auth/logout
인증: 필요
```

**Response 204**
- Redis에서 Refresh Token 해시 삭제
- Cookie 만료 처리 (Max-Age=0)

---

### 2.6 GitHub OAuth — 시작

```
GET /auth/github
인증: 불필요
```

**Response 302** → GitHub OAuth 페이지로 리다이렉트

---

### 2.7 GitHub OAuth — 콜백

```
GET /auth/github/callback?code={code}&state={state}
인증: 불필요
```

**Response 302** → 프론트엔드 (`/auth/callback?accessToken=...`)

**처리 흐름**
- GitHub API로 사용자 정보 조회
- 기존 계정 연결 or 신규 생성
- `github_token` AES-256-GCM 암호화 후 저장

---

### 2.8 비밀번호 재설정 요청

```
POST /auth/forgot-password
인증: 불필요
Body: { "email": "..." }
```

**Response 200** — 항상 동일 메시지 (이메일 존재 여부 비노출)

---

### 2.9 비밀번호 재설정

```
POST /auth/reset-password
인증: 불필요
Body: { "token": "...", "newPassword": "..." }
```

**Response 200**

---

## 3. 사용자 API (Users)

### 3.1 내 정보 조회

```
GET /users/me
인증: 필요
캐시: @Cacheable("userPlan") → secureai:user:{userId}:plan (TTL 5min)
```

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "email": "dev@example.com",
    "username": "devuser",
    "displayName": "개발자",
    "githubLogin": "devuser",
    "plan": {
      "id": 1,
      "name": "free",
      "displayName": "무료",
      "allowDast": false,
      "allowMonitoring": false
    },
    "usage": {
      "sastUsageThisMonth": 12,
      "sastMonthlyLimit": 50,
      "sastResetAt": "2026-05-01T00:00:00Z"
    },
    "createdAt": "2026-04-01T09:00:00Z"
  }
}
```

---

### 3.2 내 정보 수정

```
PATCH /users/me
인증: 필요
캐시: @CacheEvict("userPlan")
```

**Request Body** (부분 수정)
```json
{
  "displayName": "새 이름",
  "timezone": "Asia/Seoul",
  "locale": "ko"
}
```

---

### 3.3 비밀번호 변경

```
PUT /users/me/password
인증: 필요
Body: { "currentPassword": "...", "newPassword": "..." }
```

---

### 3.4 계정 탈퇴

```
DELETE /users/me
인증: 필요
Body: { "confirmPassword": "...", "reason": "..." }
```

**처리 흐름**
- Soft Delete (`deleted_at = NOW()`)
- GitHub Token 즉시 DB에서 삭제
- `@Async`: 30일 후 하드 삭제 스케줄 등록

---

## 4. 프로젝트 API (Projects)

### 4.1 프로젝트 목록 조회

```
GET /projects?page=0&size=20&sort=updatedAt,desc
인증: 필요
캐시: 없음 (실시간 반영 필요)
```

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "secureai-frontend",
      "language": "typescript",
      "framework": "nextjs",
      "sourceType": "github",
      "latestSecurityScore": 72,
      "latestSession": {
        "id": "uuid",
        "status": "completed",
        "vulnCountCritical": 3,
        "completedAt": "2026-04-19T14:32:00Z"
      },
      "createdAt": "2026-04-01T09:00:00Z"
    }
  ]
}
```

**주의**: `latestSession`은 JOIN으로 가져오되, N+1 방지를 위해 `@EntityGraph` 사용

---

### 4.2 프로젝트 생성

```
POST /projects
인증: 필요
플랜 제한: @PreAuthorize("@planChecker.canCreateProject(#userId)")
```

**Request Body**
```json
{
  "name": "my-startup-api",
  "description": "스타트업 백엔드 프로젝트",
  "sourceType": "github",
  "githubRepoFullName": "myorg/my-startup-api",
  "githubDefaultBranch": "main"
}
```

**Response 201**
```json
{
  "data": {
    "id": "uuid",
    "name": "my-startup-api",
    "sourceType": "github"
  }
}
```

---

### 4.3 프로젝트 상세 조회

```
GET /projects/{projectId}
인증: 필요
캐시: @Cacheable("projectDetail", key="#projectId") TTL 1min
```

**Response 200** — 프로젝트 전체 정보 + 최근 5개 세션 요약

---

### 4.4 프로젝트 수정

```
PUT /projects/{projectId}
인증: 필요 (owner or admin)
캐시: @CacheEvict("projectDetail", key="#projectId")
```

---

### 4.5 프로젝트 삭제

```
DELETE /projects/{projectId}
인증: 필요 (owner만)
```

**처리 흐름**: Soft Delete → `@Async` 72시간 후 하드 삭제 (관련 세션/리포트 포함)

---

### 4.6 팀 멤버 조회

```
GET /projects/{projectId}/members
인증: 필요 (해당 프로젝트 멤버)
```

---

### 4.7 팀 멤버 초대

```
POST /projects/{projectId}/members/invite
인증: 필요 (owner or admin)
플랜 제한: @PreAuthorize("@planChecker.canAddMember(#projectId)")
Body: { "email": "...", "role": "viewer" }
```

---

### 4.8 팀 멤버 제거

```
DELETE /projects/{projectId}/members/{userId}
인증: 필요 (owner or admin)
```

---

## 5. 분석 세션 API (Analysis)

### 5.1 분석 시작 ⭐ (핵심 API)

```
POST /analysis/sessions
인증: 필요
플랜 제한: @PreAuthorize("@planChecker.canStartAnalysis(#userId, #request.layerType)")
```

**Request Body**
```json
{
  "projectId": "uuid",
  "layerType": "full",
  "targetPath": "/Users/dev/workspace/my-project",
  "targetBranch": "main",
  "options": {
    "includeSast": true,
    "includeGithub": true,
    "includeDast": false,
    "fileExtensions": [".java", ".ts", ".py"],
    "excludePaths": ["node_modules", "build", ".git"]
  }
}
```

**Response 201** (즉시 반환 — 비동기 처리 시작)
```json
{
  "data": {
    "sessionId": "uuid",
    "status": "pending",
    "message": "분석이 시작되었습니다. SSE 스트림으로 진행 상황을 확인하세요.",
    "sseUrl": "/api/v1/analysis/sessions/{sessionId}/stream"
  }
}
```

**내부 처리 흐름** (`@Async("analysisExecutor")`)
```
1. AnalysisSession DB 저장 (status=pending)
2. SAST 사용량 체크 → users.sast_usage_this_month 증가 (DB UPDATE)
3. 파일 목록 SHA-256 해시 계산 → Redis 캐시 조회
4. Redis Pub/Sub 채널 생성: secureai:sse:{sessionId}
5. LangGraph4j 에이전트 파이프라인 시작:
   a. SAST 에이전트 (Claude AI) → 취약점 배치 저장
   b. 각 파일 처리마다 SSE 이벤트 발행
   c. DAST 에이전트 (선택) → Docker 컨테이너 실행
6. 완료 → 세션 집계 업데이트 → 프로젝트 점수 갱신
7. Redis 채널 종료 메시지 발행
```

---

### 5.2 SSE 실시간 스트림 ⭐

```
GET /analysis/sessions/{sessionId}/stream
인증: 필요 (Authorization 쿼리파라미터 허용: ?token=...)
Content-Type: text/event-stream
```

**SSE 이벤트 형식**
```
event: progress
data: {"type":"progress","step":"sast_scanning","progressPct":25,"message":"UserController.java 분석 중...","timestamp":"2026-04-19T14:32:01Z"}

event: vuln_found
data: {"type":"vuln_found","vulnerability":{"id":"uuid","type":"SQL_INJECTION","severity":"critical","filePath":"src/UserController.java","lineStart":46}}

event: dast_log
data: {"type":"dast_log","level":"error","message":"EXPLOIT SUCCESS — 23 rows 노출","timestamp":"..."}

event: completed
data: {"type":"completed","securityScore":72,"vulnCountTotal":6,"duration":142}

event: error
data: {"type":"error","code":"DAST_TIMEOUT","message":"DAST 실행 제한 시간(300초) 초과"}
```

**구현 상세**
```java
// Spring SseEmitter + Redis Subscribe
@GetMapping(value = "/sessions/{sessionId}/stream", 
            produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter streamSession(@PathVariable UUID sessionId) {
    SseEmitter emitter = new SseEmitter(300_000L); // 5분 타임아웃
    redisSubscriber.subscribe("secureai:sse:" + sessionId, emitter);
    return emitter;
}
```

---

### 5.3 세션 상태 조회

```
GET /analysis/sessions/{sessionId}
인증: 필요
캐시: Redis secureai:session:{sessionId}:status (TTL 30s, 진행 중일 때만)
```

**Response 200**
```json
{
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "layerType": "full",
    "status": "completed",
    "progressPct": 100,
    "securityScore": 72,
    "vulnCountCritical": 3,
    "vulnCountHigh": 2,
    "vulnCountMedium": 1,
    "vulnCountLow": 0,
    "vulnCountTotal": 6,
    "filesScanned": 8,
    "linesScanned": 1842,
    "aiTokensUsed": 24580,
    "startedAt": "2026-04-19T14:32:00Z",
    "completedAt": "2026-04-19T14:34:22Z",
    "durationSeconds": 142
  }
}
```

---

### 5.4 세션 목록 조회

```
GET /analysis/sessions?projectId={id}&page=0&size=20&status=completed
인증: 필요
```

---

### 5.5 세션 취소

```
POST /analysis/sessions/{sessionId}/cancel
인증: 필요 (세션 소유자)
```

**처리**: `status=cancelled` 업데이트 → LangGraph4j 파이프라인 중단 시그널 → Docker 컨테이너 강제 종료

---

### 5.6 분석 히스토리 (프로젝트별)

```
GET /projects/{projectId}/analysis/history?page=0&size=10
인증: 필요
```

**Response** — 세션 목록 + 보안 점수 트렌드

---

## 6. 취약점 API (Vulnerabilities)

### 6.1 취약점 목록 조회 ⭐

```
GET /analysis/sessions/{sessionId}/vulnerabilities
  ?severity=critical,high
  &apiGroup=/api/users
  &status=open
  &page=0&size=50
인증: 필요
캐시: 없음 (필터 조합이 많아 캐시 효율 낮음)
```

**Response 200**
```json
{
  "data": [
    {
      "id": "uuid",
      "vulnType": "SQL_INJECTION",
      "severity": "critical",
      "cvssScore": 9.8,
      "owaspCategory": "A03:2021",
      "cweId": 89,
      "cweName": "Improper Neutralization of Special Elements in SQL Command",
      "filePath": "src/controllers/UserController.java",
      "lineStart": 46,
      "lineEnd": 47,
      "codeSnippet": "String q = \"SELECT * FROM users WHERE name='\" + dto.getName() + \"'\";",
      "callChain": [
        {"node": "LoginPage.tsx:18", "type": "frontend"},
        {"node": "POST /api/users/login", "type": "endpoint"},
        {"node": "UserController.login():40", "type": "controller"},
        {"node": "userRepo.query():46", "type": "vulnerability"}
      ],
      "description": "사용자 입력값이 SQL 쿼리에 직접 삽입됩니다...",
      "attackScenario": "' OR '1'='1 주입 시 전체 DB 접근 가능",
      "apiGroup": "/api/users",
      "isApiRelated": true,
      "status": "open",
      "hasPatchSuggestion": true,
      "hasExploitResult": true,
      "createdAt": "2026-04-19T14:32:15Z"
    }
  ],
  "pagination": { "page": 0, "size": 50, "totalElements": 6 }
}
```

**N+1 방지**: `LEFT JOIN FETCH patch_suggestions, exploit_results WHERE exists` (단건 체크)

---

### 6.2 취약점 상세 조회

```
GET /vulnerabilities/{vulnerabilityId}
인증: 필요
```

**Response 200** — 취약점 전체 정보 + patch_suggestions + exploit_results

---

### 6.3 취약점 상태 변경

```
PATCH /vulnerabilities/{vulnerabilityId}/status
인증: 필요 (해당 프로젝트 admin or owner)
캐시: @CacheEvict 세션 캐시
```

**Request Body**
```json
{
  "status": "accepted_risk",
  "reason": "내부 네트워크에서만 사용되는 API이므로 위험도 낮음"
}
```

**처리**
- `status`, `fixed_at`(status=fixed), `fixed_by` 업데이트
- 세션의 `patched_count` 증가 (trigger 또는 service 레이어)
- Audit Log 기록

---

### 6.4 취약점 벌크 상태 변경

```
PATCH /analysis/sessions/{sessionId}/vulnerabilities/bulk-status
인증: 필요 (admin or owner)
```

**Request Body**
```json
{
  "vulnerabilityIds": ["uuid1", "uuid2"],
  "status": "fixed"
}
```

---

### 6.5 API 그룹 목록 조회 (필터바용)

```
GET /analysis/sessions/{sessionId}/vulnerabilities/api-groups
인증: 필요
캐시: @Cacheable TTL 5min (세션이 완료된 경우 값이 바뀌지 않음)
```

**Response 200**
```json
{
  "data": {
    "apiGroups": ["/api/users", "/api/auth", "/api/payment"],
    "hasNonApiVulns": true
  }
}
```

---

### 6.6 보안 점수 트렌드 (대시보드)

```
GET /projects/{projectId}/vulnerabilities/trend?days=7
인증: 필요
캐시: @Cacheable TTL 10min
```

**Response 200**
```json
{
  "data": {
    "trend": [
      {"date": "2026-04-13", "score": 45, "vulnTotal": 12},
      {"date": "2026-04-19", "score": 72, "vulnTotal": 6}
    ]
  }
}
```

---

## 7. DAST API (Dynamic Analysis)

### 7.1 스캔 대상 등록

```
POST /dast/targets
인증: 필요
플랜 제한: @PreAuthorize("@planChecker.allowsDast(#userId)")
```

**Request Body**
```json
{
  "projectId": "uuid",
  "targetUrl": "https://my-app.vercel.app",
  "consentAccepted": true
}
```

**Response 201**
```json
{
  "data": {
    "targetId": "uuid",
    "targetHost": "my-app.vercel.app",
    "verificationStatus": "pending",
    "verification": {
      "method": "txt_record",
      "token": "secureai-verify-a1b2c3d4e5f6",
      "instruction": "DNS TXT 레코드에 '_secureai.my-app.vercel.app = secureai-verify-a1b2c3d4e5f6' 를 추가하세요.",
      "alternativeMethod": "file_upload",
      "fileInstruction": "https://my-app.vercel.app/.well-known/secureai.txt 에 토큰을 배치하세요."
    },
    "expiresAt": "2026-04-20T14:32:00Z"
  }
}
```

---

### 7.2 도메인 소유권 확인

```
POST /dast/targets/{targetId}/verify
인증: 필요
```

**Response 200**
```json
{
  "data": {
    "verified": true,
    "verifiedAt": "2026-04-19T14:35:00Z"
  }
}
```

**처리**: DNS TXT 조회 또는 HTTP GET으로 파일 확인 → `verification_status = 'verified'`

---

### 7.3 DAST 실행 ⭐

```
POST /dast/run
인증: 필요
플랜 제한: @PreAuthorize("@planChecker.allowsDast(#userId)")
Rate Limit: 도메인당 1시간 3회 (Redis 카운터)
```

**Request Body**
```json
{
  "sessionId": "uuid",
  "targetId": "uuid",
  "scanProfile": "owasp_top10",
  "options": {
    "testSqli": true,
    "testXss": true,
    "testIdor": true,
    "testSsrf": false,
    "maxRetries": 3,
    "timeoutSeconds": 300
  }
}
```

**Response 201** (즉시 반환)
```json
{
  "data": {
    "dastJobId": "uuid",
    "status": "queued",
    "estimatedSeconds": 120,
    "sseUrl": "/api/v1/dast/{dastJobId}/stream"
  }
}
```

**내부 처리 흐름** (`@Async("dastExecutor")`)
```
1. Redis 분산 락 획득 (secureai:dast:lock:{domain})
2. Rate Limit 카운터 확인 (secureai:ratelimit:{domain}:dast)
3. Docker 컨테이너 생성:
   - Image: secureai-dast-sandbox:latest
   - Network: none (대상 도메인만 허용하는 custom bridge)
   - Memory: 512MB, CPU: 0.5
   - Timeout: 300s
4. LangGraph4j DAST 에이전트:
   - 페이로드 생성 (Claude API)
   - HTTP 요청 실행
   - 응답 분석
   - 실패 시 페이로드 재생성 (최대 3회)
5. 결과 AES-256-GCM 암호화 저장
6. exploit_results DB 저장
7. 관련 vulnerability 상태 업데이트
8. Redis 락 해제
9. SSE 완료 이벤트 발행
```

---

### 7.4 DAST 스트림

```
GET /dast/{dastJobId}/stream
Content-Type: text/event-stream
```

---

### 7.5 DAST 결과 조회

```
GET /dast/{dastJobId}/result
인증: 필요
```

**Response 200**
```json
{
  "data": {
    "dastJobId": "uuid",
    "status": "completed",
    "results": [
      {
        "vulnerabilityId": "uuid",
        "exploitType": "sqli",
        "isSuccess": true,
        "payloadSummary": "' OR '1'='1' --",
        "httpStatusCode": 200,
        "evidenceType": "db_dump",
        "responseSnippet": "... 23 rows returned ...",
        "executionTimeMs": 234
      }
    ],
    "containerStats": {
      "executionTimeMs": 45230,
      "retryCount": 0
    }
  }
}
```

---

## 8. 패치 API (Patches)

### 8.1 패치 제안 조회

```
GET /vulnerabilities/{vulnerabilityId}/patches
인증: 필요
캐시: @Cacheable("patchSuggestion", key="#vulnerabilityId") TTL 1h
```

**Response 200**
```json
{
  "data": {
    "patches": [
      {
        "id": "uuid",
        "originalCode": "String q = \"SELECT * FROM...\";",
        "patchedCode": "PreparedStatement ps = con.prepareStatement(...);",
        "diffUnified": "@@ -46,2 +46,4 @@\n-String q = ...\n+PreparedStatement ps = ...",
        "explanation": "PreparedStatement로 파라미터화 쿼리 처리 — 입력값을 SQL 명령이 아닌 데이터로만 취급합니다.",
        "patchLanguage": "java",
        "aiModel": "claude-sonnet-4",
        "confidenceScore": 0.97,
        "isApplied": false
      }
    ]
  }
}
```

---

### 8.2 패치 생성 요청 (재생성)

```
POST /vulnerabilities/{vulnerabilityId}/patches/generate
인증: 필요
```

**Response 201** (비동기)
```json
{
  "data": {
    "patchId": "uuid",
    "status": "generating",
    "message": "AI 패치 코드를 생성 중입니다. 완료 시 알림을 받으실 수 있습니다."
  }
}
```

**내부 처리** (`@Async("patchExecutor")`)
- 패치 템플릿 캐시 확인 (`secureai:patch:template:{key}`)
- HIT: 캐시 재사용 (즉시 저장)
- MISS: Claude API 호출 → 생성 → Redis 캐시 저장 (TTL 7일)

---

### 8.3 패치 적용 처리

```
PATCH /patches/{patchId}/apply
인증: 필요
```

**Request Body**
```json
{
  "appliedManually": true,
  "notes": "직접 코드에 적용 완료"
}
```

**Response 200** — `is_applied=true`, `applied_at`, `applied_by` 업데이트

---

### 8.4 세션 전체 패치 제안 목록

```
GET /analysis/sessions/{sessionId}/patches?isApplied=false&page=0&size=20
인증: 필요
```

---

## 9. 리포트 API (Reports)

### 9.1 리포트 생성 요청

```
POST /reports
인증: 필요
플랜 제한: @PreAuthorize("@planChecker.allowsPdfReport(#userId)")
```

**Request Body**
```json
{
  "sessionId": "uuid",
  "format": "pdf",
  "title": "SecureAI 보안 감사 리포트 — 2026년 4월",
  "options": {
    "includeExploitDetails": false,
    "includeSourceCode": true,
    "includePatchCode": true,
    "language": "ko"
  }
}
```

**Response 202** (비동기 생성)
```json
{
  "data": {
    "reportId": "uuid",
    "status": "generating",
    "estimatedSeconds": 30
  }
}
```

**내부 처리** (`@Async("reportExecutor")`)
- iText 7로 PDF 생성
- `secureai:report:{reportId}:status` Redis 업데이트
- 완료 시 다운로드 토큰 생성 (UUID, TTL 24h)

---

### 9.2 리포트 상태 조회

```
GET /reports/{reportId}
인증: 필요
캐시: Redis secureai:report:{reportId}:status
```

**Response 200**
```json
{
  "data": {
    "reportId": "uuid",
    "status": "ready",
    "format": "pdf",
    "fileSizeBytes": 245632,
    "downloadUrl": "/api/v1/reports/{reportId}/download?token={downloadToken}",
    "downloadTokenExpiresAt": "2026-04-20T14:32:00Z",
    "generatedAt": "2026-04-19T14:32:30Z"
  }
}
```

---

### 9.3 리포트 다운로드

```
GET /reports/{reportId}/download?token={downloadToken}
인증: 불필요 (서명 토큰으로 인증)
```

**Response 200**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="secureai-report-20260419.pdf"
```

---

### 9.4 리포트 목록 조회

```
GET /reports?projectId={uuid}&page=0&size=10
인증: 필요
```

---

### 9.5 공개 공유 링크 생성

```
POST /reports/{reportId}/share
인증: 필요
Body: { "enablePublicShare": true }
```

**Response 200**
```json
{
  "data": {
    "shareUrl": "https://secureai.io/shared/reports/{publicShareToken}"
  }
}
```

---

## 10. GitHub 연동 API

### 10.1 GitHub 저장소 목록 조회

```
GET /github/repos?page=0&size=30
인증: 필요 (GitHub 토큰 필요)
캐시: @Cacheable("githubRepos") TTL 5min
```

**내부 처리**: GitHub API `/user/repos` 호출 → 결과 캐시

---

### 10.2 GitHub 설정 저장

```
POST /projects/{projectId}/github-config
인증: 필요 (owner or admin)
```

**Request Body**
```json
{
  "repoFullName": "myorg/my-app",
  "defaultBranch": "main",
  "autoReviewEnabled": true,
  "blockMergeOnCritical": false,
  "commentOnPr": true
}
```

**처리**: GitHub Webhook 등록 → `webhook_id`, `webhook_secret_hash` 저장

---

### 10.3 GitHub 설정 조회

```
GET /projects/{projectId}/github-config
인증: 필요
```

---

### 10.4 커밋 히스토리 시크릿 스캔

```
POST /github/scan/history
인증: 필요
플랜 제한: Pro 이상
```

**Request Body**
```json
{
  "projectId": "uuid",
  "repoFullName": "myorg/my-app",
  "scanDepth": 100
}
```

**Response 202** (비동기, SSE 연결 권장)

**내부 처리** (`@Async`)
- GitHub API로 커밋 목록 조회 (페이지네이션)
- 각 커밋의 diff 분석 (Claude AI)
- 시크릿 패턴 매칭
- 결과를 취약점으로 저장

---

### 10.5 PR 리뷰 이력 조회

```
GET /projects/{projectId}/github/pr-reviews?page=0&size=20
인증: 필요
```

**Response 200**
```json
{
  "data": [
    {
      "prNumber": 42,
      "prTitle": "feat: 사용자 로그인 개선",
      "prAuthor": "devuser",
      "reviewStatus": "changes_required",
      "vulnCountNew": 2,
      "vulnCountFixed": 0,
      "securityScore": 65,
      "reviewedAt": "2026-04-18T10:20:00Z"
    }
  ]
}
```

---

## 11. CVE / SBOM API

### 11.1 SBOM 생성 요청

```
POST /analysis/sessions/{sessionId}/sbom
인증: 필요
플랜 제한: @PreAuthorize("@planChecker.allowsSbom(#userId)")
```

**Response 202** (비동기)

**내부 처리** (`@Async("sbomExecutor")`)
- 의존성 파일 파싱 (pom.xml / package.json / requirements.txt / Cargo.toml)
- 컴포넌트 추출 (50개씩 청크 처리)
- NVD API 또는 Redis 캐시에서 CVE 매칭
- `dependency_components` + `vulnerability_cve_mapping` 저장
- CycloneDX JSON 형식으로 SBOM 파일 생성

---

### 11.2 SBOM 조회

```
GET /analysis/sessions/{sessionId}/sbom
인증: 필요
```

**Response 200**
```json
{
  "data": {
    "totalComponents": 142,
    "directDependencies": 38,
    "vulnerableComponents": 5,
    "components": [
      {
        "packageName": "org.springframework.boot:spring-boot-starter-web",
        "packageVersion": "3.2.0",
        "ecosystem": "maven",
        "isDirect": true,
        "purl": "pkg:maven/org.springframework.boot/spring-boot-starter-web@3.2.0",
        "license": "Apache-2.0",
        "hasKnownVuln": false,
        "vulnCveIds": []
      }
    ]
  }
}
```

---

### 11.3 CVE 상세 조회

```
GET /cve/{cveId}
인증: 필요
캐시: @Cacheable("cveData", key="#cveId") TTL 6h
```

**Response 200**
```json
{
  "data": {
    "cveId": "CVE-2024-38816",
    "description": "Spring Framework...",
    "cvssV3Score": 7.5,
    "cvssV3Vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
    "severity": "high",
    "publishedAt": "2024-09-13",
    "affectedPackages": [
      {"name": "org.springframework:spring-webmvc", "versionRange": "< 5.3.39"}
    ]
  }
}
```

---

## 12. 모니터링 API (Phase 3)

### 12.1 모니터링 활성화

```
POST /dast/targets/{targetId}/monitoring/enable
인증: 필요
플랜 제한: @PreAuthorize("@planChecker.allowsMonitoring(#userId)")
Body: { "intervalHours": 24, "notifyChannels": ["email", "slack"] }
```

---

### 12.2 모니터링 결과 조회

```
GET /dast/targets/{targetId}/monitoring/results?page=0&size=20
인증: 필요
```

---

### 12.3 모니터링 알림 설정

```
PUT /dast/targets/{targetId}/monitoring/notifications
인증: 필요
Body: { "slackWebhookUrl": "...", "emailList": ["admin@example.com"] }
```

---

## 13. Webhook API

### 13.1 GitHub PR 이벤트 수신 ⭐

```
POST /webhooks/github
인증: 불필요 (X-Hub-Signature-256 검증)
```

**Request Headers**
```
X-GitHub-Event: pull_request
X-Hub-Signature-256: sha256={HMAC}
```

**Request Body** (GitHub PR Webhook Payload)

**처리 흐름**
```
1. HMAC-SHA256 서명 검증 (webhook_secret_hash)
2. action = 'opened' or 'synchronize' 일 때만 처리
3. PR 번호, head SHA, 브랜치 정보 추출
4. @Async: 분석 세션 자동 생성 (layerType=sast, targetBranch=headBranch)
5. 분석 완료 후 GitHub API로 PR 코멘트 작성
6. blockMergeOnCritical=true이면 GitHub Check Status 실패 처리
7. pr_review_history 저장
```

**Response 200** (즉시 반환, 처리는 비동기)

---

## 14. AI 채팅 API

### 14.1 채팅 메시지 전송 (SSE 스트리밍)

```
POST /chat/sessions/{sessionId}/message
인증: 필요
Content-Type: text/event-stream (Accept)
```

**Request Body**
```json
{
  "message": "SQL Injection 취약점 어떻게 고쳐?",
  "context": {
    "vulnerabilityId": "uuid",
    "filePath": "src/UserController.java"
  }
}
```

**Response (SSE 스트리밍)**
```
event: chunk
data: {"content": "PreparedStatement를"}

event: chunk
data: {"content": " 사용하면"}

event: done
data: {"totalTokens": 428, "model": "claude-sonnet-4"}
```

**내부 처리**
- 취약점 컨텍스트 주입 (코드 스니펫, CWE, OWASP)
- Claude API SSE 스트리밍 → 클라이언트로 중계
- 대화 이력 (최근 10턴) 유지 — Redis (`secureai:chat:{sessionId}:history`)

---

### 14.2 채팅 이력 조회

```
GET /chat/sessions/{sessionId}/history
인증: 필요
```

---

## 15. 관리자 API (Admin)

> 모든 Admin API: `@PreAuthorize("hasRole('ADMIN')")`

### 15.1 사용자 통계

```
GET /admin/stats/users?period=monthly
인증: ADMIN
캐시: @Cacheable TTL 1h
```

### 15.2 NVD 강제 동기화

```
POST /admin/jobs/nvd-sync
인증: ADMIN
```

**Response 202** — `NvdSyncJob` 즉시 실행 트리거

### 15.3 만료 데이터 정리

```
POST /admin/jobs/cleanup
인증: ADMIN
```

### 15.4 사용자 플랜 변경

```
PATCH /admin/users/{userId}/plan
인증: ADMIN
Body: { "planId": 2 }
캐시: @CacheEvict("userPlan", key="#userId")
```

---

## 16. 에러 코드 정의

| 코드 | HTTP | 설명 |
|------|------|------|
| `AUTH_INVALID_CREDENTIALS` | 401 | 이메일/비밀번호 불일치 |
| `AUTH_ACCOUNT_LOCKED` | 401 | 로그인 실패 5회 초과 잠금 |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | 이메일 미인증 |
| `AUTH_TOKEN_EXPIRED` | 401 | Access Token 만료 |
| `AUTH_REFRESH_INVALID` | 401 | Refresh Token 무효 또는 재사용 |
| `PLAN_FEATURE_NOT_ALLOWED` | 403 | 플랜에서 지원하지 않는 기능 |
| `PLAN_LIMIT_EXCEEDED` | 403 | 월별 사용 한도 초과 |
| `RATE_LIMIT_EXCEEDED` | 429 | API 호출 횟수 초과 |
| `PROJECT_NOT_FOUND` | 404 | 프로젝트 없음 |
| `PROJECT_ACCESS_DENIED` | 403 | 프로젝트 접근 권한 없음 |
| `SESSION_NOT_FOUND` | 404 | 분석 세션 없음 |
| `SESSION_ALREADY_RUNNING` | 409 | 동일 프로젝트 분석 진행 중 |
| `VULN_NOT_FOUND` | 404 | 취약점 없음 |
| `DAST_DOMAIN_NOT_VERIFIED` | 403 | 도메인 소유권 미확인 |
| `DAST_RATE_LIMIT_EXCEEDED` | 429 | 도메인별 DAST 횟수 초과 |
| `DAST_CONTAINER_TIMEOUT` | 500 | Docker 컨테이너 타임아웃 |
| `DAST_LOCK_FAILED` | 409 | 동일 도메인 DAST 실행 중 |
| `GITHUB_AUTH_REQUIRED` | 403 | GitHub 연동 필요 |
| `GITHUB_WEBHOOK_INVALID` | 400 | Webhook 서명 불일치 |
| `REPORT_STILL_GENERATING` | 202 | 리포트 생성 중 |
| `SBOM_PARSE_FAILED` | 422 | 의존성 파일 파싱 실패 |

---

## 17. 성능 / 캐싱 / 스케줄링 전략 요약

### 17.1 캐싱 전략 한눈에 보기

| API | 캐시 키 | TTL | Evict 조건 |
|-----|---------|-----|-----------|
| GET /users/me | `secureai:user:{userId}:plan` | 5min | 플랜 변경, 사용량 변경 |
| GET /projects/{id} | `secureai:project:{id}` | 1min | 프로젝트 수정 |
| GET /sessions/{id}/vulns/api-groups | `secureai:apigroups:{sessionId}` | 5min | 새 취약점 추가 |
| GET /vulnerabilities/{id}/patches | `secureai:patch:{vulnId}` | 1h | 패치 생성/적용 |
| GET /projects/{id}/trend | `secureai:trend:{projectId}` | 10min | 새 세션 완료 |
| GET /cve/{cveId} | `secureai:cve:{cveId}` | 6h | NvdSyncJob 실행 |
| SAST 결과 | `secureai:sast:{hash}:{lang}` | 24h | 없음 (해시 기반) |
| 패치 템플릿 | `secureai:patch:template:{key}` | 7d | 없음 |

### 17.2 비동기 처리 Thread Pool 설정

```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean("analysisExecutor")
    public Executor analysisExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(5);
        exec.setMaxPoolSize(20);
        exec.setQueueCapacity(100);
        exec.setThreadNamePrefix("analysis-");
        exec.initialize();
        return exec;
    }

    @Bean("dastExecutor")
    public Executor dastExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(2);  // Docker 컨테이너 동시 실행 제한
        exec.setMaxPoolSize(5);
        exec.setQueueCapacity(20);
        exec.setThreadNamePrefix("dast-");
        exec.initialize();
        return exec;
    }

    @Bean("reportExecutor")
    public Executor reportExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(2);
        exec.setMaxPoolSize(5);
        exec.setThreadNamePrefix("report-");
        exec.initialize();
        return exec;
    }

    @Bean("emailExecutor")
    public Executor emailExecutor() {
        ThreadPoolTaskExecutor exec = new ThreadPoolTaskExecutor();
        exec.setCorePoolSize(2);
        exec.setMaxPoolSize(5);
        exec.setThreadNamePrefix("email-");
        exec.initialize();
        return exec;
    }
}
```

### 17.3 스케줄링 전체 목록

```java
@Component
public class ScheduledJobs {

    // 매일 03:00 — NVD CVE 동기화
    @Scheduled(cron = "0 0 3 * * *")
    @SchedulerLock(name = "NvdSyncJob", lockAtMostFor = "PT2H")
    public void nvdSync() { ... }

    // 매일 04:30 — 만료 데이터 정리 (GDPR 30일 삭제 + 90일 리포트)
    @Scheduled(cron = "0 30 4 * * *")
    @SchedulerLock(name = "ExpiredDataCleanup")
    public void expiredDataCleanup() {
        // exploit_results WHERE expires_at < NOW() → DELETE
        // reports WHERE expires_at < NOW() → 파일 삭제 + soft delete
        // audit_logs 13개월 이전 파티션 DROP
    }

    // 매시 정각 — 모니터링 스캔 대상 처리
    @Scheduled(cron = "0 0 * * * *")
    @SchedulerLock(name = "MonitoringJob", lockAtMostFor = "PT50M")
    public void monitoring() {
        // scan_targets WHERE next_scan_at <= NOW() → Passive 스캔 실행
    }

    // 매월 1일 01:00 — SAST 사용량 리셋
    @Scheduled(cron = "0 0 1 1 * *")
    public void resetSastUsage() {
        // UPDATE users SET sast_usage_this_month = 0, sast_usage_reset_at = next_month
    }

    // 30분마다 — 다음 달 DB 파티션 생성 확인
    @Scheduled(cron = "0 0 2 25 * *")  // 매월 25일 02:00
    public void createNextMonthPartitions() { ... }

    // 매주 월요일 09:00 — SSL 인증서 만료 체크
    @Scheduled(cron = "0 0 9 * * MON")
    public void sslCertCheck() { ... }
}
```

> **ShedLock 사용**: 다중 인스턴스 환경에서 스케줄 중복 실행 방지  
> `net.javacrumbs.shedlock:shedlock-spring:5.x` + `shedlock-provider-redis-spring`

### 17.4 Java 21 Virtual Thread 설정

```yaml
# application.yml
spring:
  threads:
    virtual:
      enabled: true   # Spring Boot 3.2+ — Tomcat, @Async 모두 Virtual Thread 사용
```

### 17.5 Docker Compose 서비스 구성

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: secureai
      POSTGRES_USER: secureai
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "secureai"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/secureai
      SPRING_DATASOURCE_PASSWORD: ${DB_PASSWORD}
      SPRING_REDIS_PASSWORD: ${REDIS_PASSWORD}
      CLAUDE_API_KEY: ${CLAUDE_API_KEY}
      SECUREAI_ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
      GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock  # DAST Docker 실행용
      - ./reports:/app/reports                       # PDF 저장
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8080/api/v1
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
```

---

*이전 문서: [01_ERD.md] — ERD 설계서*  
*이전 문서: [00_ARCHITECTURE_DECISIONS.md] — 아키텍처 의사결정 기록*
