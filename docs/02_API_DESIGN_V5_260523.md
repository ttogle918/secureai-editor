# SecureAI — REST API 설계서 v5.0
> 기준: Sprint 10 (Enterprise 기능 고도화 반영)  
> 작성일: 2026-05-22  
> **정본 지정일**: 2026-05-23 | 구버전(`02_API_DESIGN.md` ~ `V4`) 아카이브 완료

## 버전 이력

| 버전 | 기준일 | 주요 변경 |
|------|--------|---------|
| V1 | 2026-04-19 | 초기 API 설계 — Auth, Users, Projects, Analysis Sessions, SSE, Chat, Patches, Workspace (8개 그룹) |
| V2 | 2026-04 (Sprint 3) | SAST 파이프라인 API 상세 추가, CVE 조회 API, SBOM 파서 인터페이스 |
| V3 | 2026-04 (Sprint 5/6) | DAST API 추가 (도메인 소유권 확인, 샌드박스 실행, SSE 스트리밍). GitHub Webhook API |
| V4 | 2026-05-21 (Sprint 8) | 2FA API, IP Allowlist API, GDPR Export/Delete API, 보안 문서 생성 API (CISO/ISMS-P/행안부), SBOM 경로 변경(`/projects/{id}/sbom/components`) |
| **V5 (현재)** | 2026-05-22 (Sprint 10) | 위젯 리포트 Export, 팀 대시보드(Gamification·MTTR·ROI), 스캔 모드 선택, 야간 자동 스캔 스케줄링 API 추가, SBOM CycloneDX 내보내기(`GET /projects/{id}/sbom/cyclonedx`), 스케줄 Upsert 패턴으로 변경(`GET+PUT /projects/{id}/schedule` 단수형) |

---

## 목차

1. [공통 사항](#1-공통-사항)
2. [Auth API](#2-auth-api)
3. [Users API](#3-users-api)
4. [Projects API](#4-projects-api)
5. [Analysis Sessions API](#5-analysis-sessions-api)
6. [SSE 스트림 명세](#6-sse-스트림-명세)
7. [Chat API](#7-chat-api)
8. [Patches API](#8-patches-api)
9. [Workspace API](#9-workspace-api-인증-불필요)
10. [Progress API](#10-progress-api)
11. [AI Engine API (내부)](#11-ai-engine-api-내부)
12. [AI 검증 & DAST 샌드박스 API (신규)](#12-ai-검증--dast-샌드박스-api-신규)
13. [토큰 사용량 & 대시보드 API (Enterprise)](#13-토큰-사용량--대시보드-api-enterprise)
14. [야간 자동 스캔 스케줄링 API (신규)](#14-야간-자동-스캔-스케줄링-api-신규)
15. [에러 코드 전체 목록](#15-에러-코드-전체-목록)
16. [변경 이력](#16-변경-이력)

---

## 1. 공통 사항

### 1.1 Base URL

| 환경 | Backend | AI Engine |
|------|---------|-----------|
| 로컬 개발 | `http://localhost:8080` | `http://localhost:8000` |
| Docker Compose | `http://backend:8080` | `http://ai_engine:8000` |

### 1.2 인증

- 대부분의 API는 `Authorization: Bearer {accessToken}` 헤더를 요구한다.
- `accessToken`은 JWT이며 메모리에만 보관한다 (localStorage 저장 금지).
- `refreshToken`은 `HttpOnly; SameSite=Strict` 쿠키로만 전달된다.
- `/api/workspace` 엔드포인트는 인증을 요구하지 않는다.
- AI Engine 내부 API는 `X-Internal-Key` 헤더로 인증한다 (Backend ↔ AI Engine 전용).

### 1.3 표준 응답 구조

**성공**
```json
{
  "success": true,
  "data": { ... }
}
```

**페이지네이션 응답**
```json
{
  "success": true,
  "data": {
    "content": [ ... ],
    "page": 0,
    "size": 20,
    "totalElements": 100,
    "totalPages": 5,
    "last": false
  }
}
```

**에러**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "사람이 읽을 수 있는 설명"
  }
}
```

### 1.4 HTTP 상태 코드 사용 원칙

| 코드 | 사용 상황 |
|------|-----------|
| `200 OK` | 조회/수정 성공 |
| `201 Created` | 리소스 생성 성공 |
| `204 No Content` | 삭제 성공 |
| `400 Bad Request` | 요청 파라미터 유효성 오류 |
| `401 Unauthorized` | 인증 토큰 없음 또는 만료 |
| `403 Forbidden` | 권한 없음 (인증은 됐으나 접근 불가) |
| `404 Not Found` | 리소스 없음 |
| `409 Conflict` | 중복 리소스 |
| `422 Unprocessable Entity` | 비즈니스 로직 규칙 위반 |
| `500 Internal Server Error` | 서버 내부 오류 |

---

## 2. Auth API

Base path: `/api/v1/auth`  
인증: 불필요 (단, `/logout`은 refreshToken 쿠키 필요)

### 2.1 회원가입

```http
POST /api/v1/auth/register
Content-Type: application/json
```

**Request**
```json
{
  "email": "user@example.com",
  "username": "myuser",
  "password": "P@ssw0rd!min8"
}
```

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "message": "이메일 인증 링크를 발송했습니다.",
    "email": "user@example.com"
  }
}
```

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 이메일 중복 | `AUTH_EMAIL_ALREADY_EXISTS` | 409 |
| 유저명 중복 | `AUTH_USERNAME_ALREADY_EXISTS` | 409 |
| 비밀번호 형식 미달 | `AUTH_PASSWORD_TOO_WEAK` | 400 |

---

### 2.2 이메일 인증

```http
GET /api/v1/auth/verify-email?token={verificationToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "이메일 인증이 완료되었습니다."
  }
}
```

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 토큰 만료 또는 유효하지 않음 | `AUTH_TOKEN_INVALID` | 400 |

---

### 2.3 로그인

```http
POST /api/v1/auth/login
Content-Type: application/json
```

**Request**
```json
{
  "email": "user@example.com",
  "password": "P@ssw0rd!min8"
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

`Set-Cookie: refreshToken={token}; HttpOnly; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=604800`

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 이메일 미인증 상태 | `AUTH_EMAIL_NOT_VERIFIED` | 403 |
| 이메일/비밀번호 불일치 | `AUTH_INVALID_CREDENTIALS` | 401 |

---

### 2.4 토큰 갱신 (Silent Refresh)

```http
POST /api/v1/auth/refresh
Cookie: refreshToken={token}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| refreshToken 없음/만료 | `AUTH_TOKEN_EXPIRED` | 401 |

---

### 2.5 로그아웃

```http
POST /api/v1/auth/logout
Cookie: refreshToken={token}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "로그아웃 되었습니다."
  }
}
```

refreshToken을 DB에서 제거하고 쿠키를 만료시킨다.

---

### 2.6 GitHub OAuth 시작

```http
GET /api/v1/auth/github
```

**Response** `302 Found`  
GitHub OAuth 인증 페이지로 리다이렉트한다.  
CSRF 방어를 위해 `state` 값을 Redis에 10분간 저장한다.

---

### 2.7 GitHub OAuth 콜백

```http
GET /api/v1/auth/github/callback?code={code}&state={state}
```

**Response** `302 Found`  
프론트엔드로 리다이렉트한다:
```
http://localhost:3000/auth/github/callback?accessToken={token}
```

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| state 불일치 (CSRF 의심) | `AUTH_OAUTH_STATE_INVALID` | 400 |
| GitHub에서 code 거부 | `AUTH_OAUTH_CODE_INVALID` | 400 |

---

### 2.8 비밀번호 찾기

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json
```

**Request**
```json
{
  "email": "user@example.com"
}
```

**Response** `200 OK`  
이메일 존재 여부와 무관하게 동일한 응답을 반환한다 (이메일 열거 공격 방어).
```json
{
  "success": true,
  "data": {
    "message": "등록된 이메일이 있다면 비밀번호 재설정 링크를 발송합니다."
  }
}
```

---

### 2.9 비밀번호 재설정

```http
POST /api/v1/auth/reset-password
Content-Type: application/json
```

**Request**
```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewP@ssw0rd!"
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "비밀번호가 재설정되었습니다."
  }
}
```

---

## 3. Users API

Base path: `/api/v1/users`  
인증: `Authorization: Bearer {accessToken}` 필수

### 3.1 내 정보 조회

```http
GET /api/v1/users/me
Authorization: Bearer {accessToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "myuser",
    "displayName": "My User",
    "githubLogin": "myuser-gh",
    "plan": {
      "id": 1,
      "name": "free",
      "allowDast": false,
      "allowMonitoring": false
    },
    "usage": {
      "sastUsageThisMonth": 12,
      "sastMonthlyLimit": 50
    }
  }
}
```

`githubLogin`은 GitHub OAuth 연동 전에는 `null`이다.  
`plan.allowDast`, `plan.allowMonitoring`은 요금제에 따라 다르다.

---

## 4. Projects API

Base path: `/api/v1/projects`  
인증: `Authorization: Bearer {accessToken}` 필수

### 4.1 프로젝트 목록 조회

```http
GET /api/v1/projects?page=0&size=20
Authorization: Bearer {accessToken}
```

`updatedAt` 기준 내림차순으로 정렬한다.

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "uuid",
        "name": "my-spring-app",
        "description": "Spring Boot 백엔드",
        "sourceType": "github",
        "githubRepoFullName": "myorg/my-spring-app",
        "githubDefaultBranch": "main",
        "createdAt": "2026-05-01T09:00:00Z",
        "updatedAt": "2026-05-06T12:00:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 1,
    "totalPages": 1,
    "last": true
  }
}
```

---

### 4.2 프로젝트 생성

```http
POST /api/v1/projects
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**
```json
{
  "name": "my-spring-app",
  "description": "Spring Boot 백엔드 보안 분석",
  "sourceType": "github",
  "githubRepoFullName": "myorg/my-spring-app",
  "githubDefaultBranch": "main"
}
```

`sourceType` 허용값: `local` | `github` | `url`  
`githubRepoFullName`, `githubDefaultBranch`는 `sourceType: github` 일 때만 사용한다.

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "my-spring-app",
    "description": "Spring Boot 백엔드 보안 분석",
    "sourceType": "github",
    "githubRepoFullName": "myorg/my-spring-app",
    "githubDefaultBranch": "main",
    "createdAt": "2026-05-06T10:00:00Z",
    "updatedAt": "2026-05-06T10:00:00Z"
  }
}
```

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 프로젝트명 중복 | `PROJECT_NAME_DUPLICATE` | 409 |
| sourceType 유효하지 않음 | `PROJECT_INVALID_SOURCE_TYPE` | 400 |

---

### 4.3 프로젝트 단건 조회

```http
GET /api/v1/projects/{projectId}
Authorization: Bearer {accessToken}
```

**Response** `200 OK` — 4.2 응답과 동일한 형식

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 프로젝트 없음 또는 접근 권한 없음 | `PROJECT_ACCESS_DENIED` | 403 |

---

### 4.4 프로젝트 수정

```http
PUT /api/v1/projects/{projectId}
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request** — 변경할 필드만 포함 가능
```json
{
  "name": "updated-name",
  "description": "새로운 설명"
}
```

**Response** `200 OK` — 수정된 프로젝트 전체 반환

---

### 4.5 프로젝트 삭제

```http
DELETE /api/v1/projects/{projectId}
Authorization: Bearer {accessToken}
```

**Response** `204 No Content`

연관된 `analysis_sessions`, `vulnerabilities`, `patch_suggestions`도 함께 삭제된다.

---

### 4.6 팀 멤버 목록 조회

```http
GET /api/v1/projects/{projectId}/members
Authorization: Bearer {accessToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "userId": "uuid",
      "email": "member@example.com",
      "username": "member1",
      "role": "owner"
    },
    {
      "userId": "uuid",
      "email": "viewer@example.com",
      "username": "viewer1",
      "role": "member"
    }
  ]
}
```

---

### 4.7 팀 멤버 초대

```http
POST /api/v1/projects/{projectId}/members/invite
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**
```json
{
  "email": "newmember@example.com"
}
```

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "message": "초대 이메일을 발송했습니다.",
    "email": "newmember@example.com"
  }
}
```

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 해당 이메일의 사용자 없음 | `USER_NOT_FOUND` | 404 |
| 이미 멤버인 경우 | `PROJECT_MEMBER_ALREADY_EXISTS` | 409 |

---

### 4.8 팀 멤버 제거

```http
DELETE /api/v1/projects/{projectId}/members/{targetUserId}
Authorization: Bearer {accessToken}
```

**Response** `204 No Content`

프로젝트 소유자(owner)는 자기 자신을 제거할 수 없다.

### 4.9 SBOM CycloneDX 내보내기 (Sprint 10 신규)

```http
GET /api/v1/projects/{projectId}/sbom/cyclonedx?sessionId={sessionId}
Authorization: Bearer {accessToken}
```

팀 멤버만 접근 가능. 지정한 분석 세션의 SBOM 컴포넌트를 CycloneDX 1.4 BOM JSON 포맷으로 내보낸다.

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "bomFormat": "CycloneDX",
    "specVersion": "1.4",
    "serialNumber": "urn:uuid:550e8400-e29b-41d4-a716-446655440000",
    "version": 1,
    "components": [
      {
        "type": "library",
        "bom-ref": "pkg:maven/org.springframework.boot:spring-boot-starter@3.2.0",
        "name": "org.springframework.boot:spring-boot-starter",
        "version": "3.2.0"
      }
    ],
    "vulnerabilities": [
      {
        "id": "CVE-2024-12345",
        "description": "취약점 설명",
        "affects": [{"ref": "pkg:maven/org.springframework.boot:spring-boot-starter@3.2.0"}],
        "ratings": [{"score": 9.8, "severity": "critical", "vector": "CVSS:3.1/AV:N/..."}]
      }
    ]
  }
}
```

- `serialNumber`: 매 요청마다 새 UUID 생성 (CycloneDX 명세 준수)
- CVE 매칭은 베스트에포트 — 일부 실패 시 해당 컴포넌트만 건너뜀

---

## 5. Analysis Sessions API

Base path: `/api/v1/analysis`  
인증: `Authorization: Bearer {accessToken}` 필수

### 5.1 분석 세션 시작

```http
POST /api/v1/analysis/sessions
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "workspaceRoot": "ws_abc123",
  "sourceType": "local",
  "scanMode": "audit"
}
```

또는 GitHub 소스인 경우:
```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "workspaceRoot": null,
  "sourceType": "github",
  "githubRepoUrl": "https://github.com/myorg/my-spring-app",
  "githubRef": "main",
  "scanMode": "pipeline"
}
```

`sourceType` 허용값: `local` | `github`  
`scanMode` 허용값: `audit` (종합 감사, 저비용 모델) | `pipeline` (고정밀 선별, 고비용 추론형 모델)
`workspaceRoot`는 `sourceType: local`일 때 Workspace API로 업로드한 `workspaceId`이다.

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "running",
    "createdAt": "2026-05-06T10:00:00Z"
  }
}
```

내부적으로 AI Engine `POST /agent/analyze`를 호출하고 백그라운드에서 실행한다.

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 프로젝트 접근 권한 없음 | `PROJECT_ACCESS_DENIED` | 403 |
| 이미 실행 중인 세션 존재 | `SESSION_ALREADY_RUNNING` | 409 |
| 월간 SAST 한도 초과 | `PLAN_SAST_LIMIT_EXCEEDED` | 422 |

---

### 5.2 세션 목록 조회

```http
GET /api/v1/analysis/sessions?projectId={uuid}&page=0&size=20
Authorization: Bearer {accessToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "sessionId": "uuid",
        "projectId": "uuid",
        "status": "completed",
        "totalFiles": 42,
        "scannedFiles": 42,
        "vulnCount": 7,
        "startedAt": "2026-05-06T10:00:00Z",
        "completedAt": "2026-05-06T10:05:30Z",
        "createdAt": "2026-05-06T10:00:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 3,
    "totalPages": 1,
    "last": true
  }
}
```

`status` 허용값: `running` | `completed` | `interrupted` | `cancelled` | `failed`

---

### 5.3 세션 단건 조회

```http
GET /api/v1/analysis/sessions/{sessionId}
Authorization: Bearer {accessToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "projectId": "uuid",
    "status": "completed",
    "totalFiles": 42,
    "scannedFiles": 42,
    "vulnCount": 7,
    "startedAt": "2026-05-06T10:00:00Z",
    "completedAt": "2026-05-06T10:05:30Z",
    "createdAt": "2026-05-06T10:00:00Z"
  }
}
```

---

### 5.4 세션 SSE 스트림 구독

```http
GET /api/v1/analysis/sessions/{sessionId}/stream
Authorization: Bearer {accessToken}
Accept: text/event-stream
```

**Response** `200 OK` — `Content-Type: text/event-stream`

이벤트 형식은 [6. SSE 스트림 명세](#6-sse-스트림-명세)를 참조한다.

> **주의**: 프론트엔드는 `EventSource`가 아닌 `fetch + ReadableStream`으로 구현한다.  
> `EventSource`는 `Authorization` 헤더를 지원하지 않기 때문이다.

---

### 5.5 세션 재개

```http
POST /api/v1/analysis/sessions/{sessionId}/resume
Authorization: Bearer {accessToken}
```

`interrupted` 상태의 세션을 LangGraph 체크포인트에서 재개한다.

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "status": "running",
    "message": "세션을 재개합니다."
  }
}
```

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| `interrupted` 상태가 아님 | `SESSION_NOT_RESUMABLE` | 422 |
| 세션 없음 | `SESSION_NOT_FOUND` | 404 |

---

### 5.6 세션 취소

```http
POST /api/v1/analysis/sessions/{sessionId}/cancel
Authorization: Bearer {accessToken}
```

`running` 상태의 세션에 취소 플래그를 설정한다.

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "status": "cancelled"
  }
}
```

---

## 6. SSE 스트림 명세

`GET /api/v1/analysis/sessions/{sessionId}/stream` 응답으로 전달되는 Server-Sent Events 형식이다.

### 6.1 SSE 메시지 포맷

```
data: {"type":"<eventType>","sessionId":"uuid","payload":{...}}\n\n
```

각 줄은 `data: ` 접두어로 시작하고, 이벤트 하나가 끝날 때 빈 줄이 2개(`\n\n`) 온다.

### 6.2 이벤트 타입 목록

#### `started` — 분석 시작

```json
{
  "type": "started",
  "sessionId": "uuid",
  "payload": {
    "message": "분석을 시작합니다.",
    "timestamp": "2026-05-06T10:00:00Z"
  }
}
```

#### `node_complete` — 파이프라인 노드 완료

```json
{
  "type": "node_complete",
  "sessionId": "uuid",
  "payload": {
    "node": "scan_files_node",
    "message": "파일 목록 수집 완료",
    "totalFiles": 42,
    "timestamp": "2026-05-06T10:00:05Z"
  }
}
```

`node` 허용값: `scan_files_node` | `sast_node` | `vuln_classifier` | `patch_node`

#### `progress` — 파일 처리 진행률

```json
{
  "type": "progress",
  "sessionId": "uuid",
  "payload": {
    "current": 15,
    "total": 42,
    "progressPercent": 35.7,
    "currentFile": "src/main/java/io/secureai/UserController.java",
    "timestamp": "2026-05-06T10:01:30Z"
  }
}
```

#### `vuln_found` — 취약점 발견

```json
{
  "type": "vuln_found",
  "sessionId": "uuid",
  "payload": {
    "vulnId": "uuid",
    "file": "src/main/java/io/secureai/UserController.java",
    "line": 42,
    "severity": "HIGH",
    "cweId": "CWE-89",
    "owaspId": "A03:2021",
    "message": "SQL Injection 취약점이 발견되었습니다.",
    "timestamp": "2026-05-06T10:01:45Z"
  }
}
```

`severity` 허용값: `CRITICAL` | `HIGH` | `MEDIUM` | `LOW` | `INFO`

#### `completed` — 분석 완료

```json
{
  "type": "completed",
  "sessionId": "uuid",
  "payload": {
    "totalFiles": 42,
    "scannedFiles": 42,
    "vulnCount": 7,
    "durationMs": 330000,
    "timestamp": "2026-05-06T10:05:30Z"
  }
}
```

#### `error` — 파이프라인 오류

```json
{
  "type": "error",
  "sessionId": "uuid",
  "payload": {
    "message": "파일 분석 중 오류가 발생했습니다.",
    "node": "sast_node",
    "recoverable": true,
    "timestamp": "2026-05-06T10:02:00Z"
  }
}
```

`recoverable: true`이면 개별 파일 오류로 분석이 계속된다 (전체 세션 실패가 아님).

### 6.3 SSE 연결 재시도

연결이 끊기면 프론트엔드 `useSse` 훅이 exponential backoff로 재연결한다.  
재연결 후 마지막 이벤트 ID 이후의 이벤트는 복구하지 않으며, 세션 상태를 `GET /sessions/{sessionId}`로 폴링하여 동기화한다.

---

## 7. Chat API

Base path: `/api/v1/analysis`  
인증: `Authorization: Bearer {accessToken}` 필수

### 7.1 분석 결과 스트리밍 채팅

```http
POST /api/v1/analysis/sessions/{sessionId}/chat
Authorization: Bearer {accessToken}
Content-Type: application/json
Accept: text/event-stream
```

**Request**
```json
{
  "message": "발견된 SQL Injection 취약점의 수정 방법을 자세히 설명해줘",
  "history": [
    {
      "role": "user",
      "content": "취약점 요약을 보여줘"
    },
    {
      "role": "assistant",
      "content": "이 프로젝트에서는 총 7개의 취약점이 발견되었습니다..."
    }
  ]
}
```

`history`는 이전 대화 맥락을 담는 배열이다. 첫 메시지이면 빈 배열 `[]`을 보낸다.

**Response** `200 OK` — `Content-Type: text/event-stream`

SSE 스트림으로 Claude AI의 응답을 실시간으로 전달한다.

#### Chat SSE 이벤트 타입

**`delta`** — 응답 토큰 단위 스트리밍
```json
{
  "type": "delta",
  "payload": {
    "content": "SQL Injection을 방어하려면 "
  }
}
```

**`done`** — 응답 완료
```json
{
  "type": "done",
  "payload": {
    "totalTokens": 312
  }
}
```

**`error`** — 오류
```json
{
  "type": "error",
  "payload": {
    "message": "AI 엔진과의 통신에 실패했습니다."
  }
}
```

**에러 케이스 (HTTP)**

| 상황 | 코드 | HTTP |
|------|------|------|
| 세션 없음 또는 접근 권한 없음 | `CHAT_SESSION_NOT_FOUND` | 404 |
| 세션이 `completed` 상태가 아님 | `CHAT_SESSION_NOT_READY` | 422 |

---

## 8. Patches API

인증: `Authorization: Bearer {accessToken}` 필수

### 8.1 패치 제안 목록 조회

```http
GET /api/v1/sessions/{sessionId}/patches
Authorization: Bearer {accessToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "patchId": "uuid",
      "vulnId": "uuid",
      "sessionId": "uuid",
      "vulnType": "SQL_INJECTION",
      "fileExtension": "java",
      "originalCode": "String query = \"SELECT * FROM users WHERE id = \" + userId;",
      "patchedCode": "String query = \"SELECT * FROM users WHERE id = ?\"; preparedStatement.setString(1, userId);",
      "explanation": "파라미터 바인딩으로 SQL Injection을 방어합니다.",
      "applied": false,
      "createdAt": "2026-05-06T10:05:00Z"
    }
  ]
}
```

---

### 8.2 패치 적용 표시

```http
POST /api/v1/patches/{patchId}/apply
Authorization: Bearer {accessToken}
```

패치를 실제로 코드에 적용하는 것이 아니라, `applied = true`로 마킹하는 API이다.  
실제 코드 변경은 사용자가 직접 수행한다.

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "patchId": "uuid",
    "applied": true,
    "appliedAt": "2026-05-06T11:00:00Z"
  }
}
```

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 패치 없음 또는 접근 권한 없음 | `PATCH_NOT_FOUND` | 404 |
| 이미 적용됨 | `PATCH_ALREADY_APPLIED` | 409 |

---

## 9. Workspace API (인증 불필요)

Base path: `/api/workspace`  
인증: 없음 (로컬 파일 업로드를 위한 임시 저장소)

> **보안 참고**: Workspace는 Redis에 24시간 TTL로 저장되는 임시 저장소다.  
> `workspaceId`를 알면 누구나 접근할 수 있으므로, 민감한 파일은 업로드하지 않아야 한다.

### 9.1 파일 업로드 (워크스페이스 생성)

```http
POST /api/workspace
Content-Type: application/json
```

**Request**
```json
{
  "projectName": "my-spring-app",
  "files": [
    {
      "path": "src/main/java/io/secureai/UserController.java",
      "content": "package io.secureai;\n\nimport org.springframework.web.bind.annotation.*;\n..."
    },
    {
      "path": "src/main/java/io/secureai/UserService.java",
      "content": "..."
    }
  ]
}
```

파일 내용은 UTF-8 인코딩 텍스트이다. 바이너리 파일은 지원하지 않는다.

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "workspaceId": "ws_a1b2c3d4e5f6",
    "projectName": "my-spring-app",
    "fileCount": 2,
    "ttlSeconds": 86400,
    "expiresAt": "2026-05-07T10:00:00Z"
  }
}
```

`workspaceId`를 분석 세션 시작 시 `workspaceRoot` 필드에 사용한다.

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 파일 수 초과 (최대 500개) | `WORKSPACE_FILE_LIMIT_EXCEEDED` | 400 |
| 단일 파일 크기 초과 (최대 1MB) | `WORKSPACE_FILE_TOO_LARGE` | 400 |
| 전체 크기 초과 (최대 100MB) | `WORKSPACE_TOTAL_SIZE_EXCEEDED` | 400 |

---

### 9.2 파일 트리 조회

```http
GET /api/workspace/{workspaceId}/tree
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "workspaceId": "ws_a1b2c3d4e5f6",
    "projectName": "my-spring-app",
    "tree": [
      {
        "path": "src/main/java/io/secureai/UserController.java",
        "type": "file",
        "size": 2048
      },
      {
        "path": "src/main/java/io/secureai/UserService.java",
        "type": "file",
        "size": 1536
      }
    ]
  }
}
```

---

### 9.3 파일 내용 조회

```http
GET /api/workspace/{workspaceId}/file?path={filePath}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "path": "src/main/java/io/secureai/UserController.java",
    "content": "package io.secureai;\n\nimport org.springframework.web.bind.annotation.*;\n...",
    "size": 2048
  }
}
```

**에러 케이스**

| 상황 | 코드 | HTTP |
|------|------|------|
| 워크스페이스 없음 (TTL 만료 포함) | `WORKSPACE_NOT_FOUND` | 404 |
| 파일 경로 없음 | `WORKSPACE_FILE_NOT_FOUND` | 404 |
| 경로 순회 시도 (`../` 등) | `WORKSPACE_PATH_TRAVERSAL` | 400 |

---

### 9.4 워크스페이스 메타 조회

```http
GET /api/workspace/{workspaceId}/meta
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "workspaceId": "ws_a1b2c3d4e5f6",
    "projectName": "my-spring-app",
    "fileCount": 2,
    "expiresAt": "2026-05-07T10:00:00Z"
  }
}
```

---

## 10. Progress API

Base path: `/api/v1/analysis`  
인증: `Authorization: Bearer {accessToken}` 필수

### 10.1 분석 진행률 요약 조회

```http
GET /api/v1/analysis/sessions/{sessionId}/progress
Authorization: Bearer {accessToken}
```

SSE를 연결하지 않고도 현재 진행 상태를 폴링으로 확인할 때 사용한다.

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "status": "running",
    "percentage": 71.4,
    "durationMs": 235000,
    "steps": [
      {
        "name": "scan_files_node",
        "label": "파일 목록 수집",
        "status": "completed",
        "completedAt": "2026-05-06T10:00:05Z"
      },
      {
        "name": "sast_node",
        "label": "SAST 분석",
        "status": "running",
        "current": 30,
        "total": 42
      },
      {
        "name": "vuln_classifier",
        "label": "취약점 분류",
        "status": "pending"
      },
      {
        "name": "patch_node",
        "label": "패치 생성",
        "status": "pending"
      }
    ]
  }
}
```

`step.status` 허용값: `pending` | `running` | `completed` | `failed`

---

## 11. AI Engine API (내부)

Base path: `http://ai_engine:8000`  
인증: `X-Internal-Key: {internalApiKey}` (Backend ↔ AI Engine 전용, 외부 노출 금지)

> 이 API는 Backend에서만 호출한다. 클라이언트(프론트엔드)가 직접 호출하면 안 된다.

### 11.1 분석 시작

```http
POST /agent/analyze
X-Internal-Key: {internalApiKey}
Content-Type: application/json
```

**Request**
```json
{
  "session_id": "uuid",
  "project_id": "uuid",
  "workspace_root": "ws_a1b2c3d4e5f6",
  "source_type": "local"
}
```

GitHub 소스인 경우:
```json
{
  "session_id": "uuid",
  "project_id": "uuid",
  "workspace_root": null,
  "source_type": "github",
  "github_owner": "myorg",
  "github_repo": "my-spring-app",
  "github_ref": "main",
  "github_token": "ghp_..."
}
```

**Response** `202 Accepted`
```json
{
  "session_id": "uuid",
  "status": "started"
}
```

---

### 11.2 세션 재개

```http
POST /agent/resume/{session_id}
X-Internal-Key: {internalApiKey}
```

LangGraph `agent_checkpoints` 테이블에서 마지막 체크포인트를 불러와 재개한다.

**Response** `200 OK`
```json
{
  "session_id": "uuid",
  "status": "resumed"
}
```

---

### 11.3 세션 취소

```http
POST /agent/cancel/{session_id}
X-Internal-Key: {internalApiKey}
```

AI Engine 내부의 cancel 플래그를 설정한다. 파이프라인은 다음 체크포인트에서 중단한다.

**Response** `200 OK`
```json
{
  "session_id": "uuid",
  "status": "cancelling"
}
```

---

### 11.4 채팅 (SSE 스트리밍)

```http
POST /agent/chat
X-Internal-Key: {internalApiKey}
Content-Type: application/json
Accept: text/event-stream
```

**Request**
```json
{
  "session_id": "uuid",
  "message": "발견된 취약점을 설명해줘",
  "history": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

**Response** `200 OK` — `Content-Type: text/event-stream`

이벤트 타입: `delta`, `done`, `error` (7.1절 Chat SSE 이벤트와 동일한 형식)

---

### 11.5 헬스체크

```http
GET /health
```

**Response** `200 OK`
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```

---

## 12. AI 검증 & DAST 샌드박스 API (신규)

Base path: `/api/v1/sandbox`  
인증: `Authorization: Bearer {accessToken}` 필수

### 12.1 단위 테스트 자동 생성 및 검증 (Hallucination 제어)

AI가 생성한 패치 코드가 기존 로직을 훼손하지 않는지 단위 테스트를 자동 생성하고 실행하여 검증한다.

```http
POST /api/v1/sessions/{sessionId}/patches/{patchId}/verify
Authorization: Bearer {accessToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "patchId": "uuid",
    "verified": true,
    "testResults": {
      "passed": 5,
      "failed": 0,
      "coverage": 95.5
    },
    "message": "패치 코드가 기존 비즈니스 로직을 통과했습니다."
  }
}
```

---

### 12.2 DAST 샌드박스 대기열 상태 확인 (자원 관리)

DAST 분석 요청이 몰릴 경우 호스트 자원 고갈을 막기 위해 큐잉된 상태를 조회한다.

```http
GET /api/v1/sandbox/queue/status
Authorization: Bearer {accessToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "activeContainers": 3,
    "maxContainers": 5,
    "queueLength": 2,
    "estimatedWaitTimeMs": 45000
  }
}
```

---

## 13. 토큰 사용량 & 대시보드 API (Enterprise)

### 13.1 팀별 대시보드 (Gamification, ROI, MTTR)

Base path: `/api/v1/teams`

```http
GET /api/v1/teams/{teamId}/dashboard
Authorization: Bearer {accessToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "teamId": "uuid",
    "month": "2026-05",
    "budget": {
      "monthlyBudgetUsd": 50.0,
      "costUsd": 4.5,
      "isAlertTriggered": false
    },
    "members": [
      {
        "userId": "uuid",
        "username": "dev1",
        "securityScore": 850,
        "patchedCount": 12,
        "tokenUsage": 120000
      }
    ],
    "metrics": {
      "averageMttrSeconds": 172800,
      "roi": {
        "timeSavedHours": 120,
        "costSavedUsd": 6000
      }
    }
  }
}
```

---

### 13.2 보안 문서 및 위젯 리포트 생성 (Export)

Base path: `/api/v1/projects`

```http
POST /api/v1/projects/{projectId}/reports/export
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request**
```json
{
  "reportType": "ISMS_P",
  "format": "pdf",
  "includeWidgets": ["roi_summary", "mttr_trend", "owasp_coverage"]
}
```

**Response** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "reportId": "uuid",
    "status": "processing",
    "downloadToken": "secure-random-token",
    "message": "위젯이 포함된 보안 리포트 생성을 시작했습니다."
  }
}
```

---

## 13.3 세션 ROI JSON 조회 (TASK-1003)

```http
GET /api/v1/reports/projects/{projectId}/sessions/{sessionId}/roi?hourlyRate=50.0
Authorization: Bearer {accessToken}
```

| 파라미터 | 위치 | 타입 | 설명 |
|---------|------|------|------|
| `projectId` | path | UUID | 프로젝트 ID |
| `sessionId` | path | UUID | 분석 세션 ID |
| `hourlyRate` | query | double | 시간당 인건비 단가 (기본값: 50.0, 0 이하면 기본값 적용) |

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "criticalCount": 3,
    "highCount": 5,
    "totalVulnCount": 12,
    "savedHours": 48.0,
    "savedCost": 2400.0,
    "hourlyRate": 50.0
  }
}
```

---

### 13.4 세션 ROI PDF 다운로드 (TASK-1003)

```http
GET /api/v1/reports/projects/{projectId}/sessions/{sessionId}/roi/pdf?hourlyRate=50.0
Authorization: Bearer {accessToken}
```

**Response** `200 OK`  
`Content-Type: application/pdf`  
`Content-Disposition: attachment; filename="roi-report-{sessionId}.pdf"`

---

## 14. 야간 자동 스캔 스케줄링 API (신규)

Base path: `/api/v1/projects`

### 14.1 스케줄 조회

```http
GET /api/v1/projects/{projectId}/schedule
Authorization: Bearer {accessToken}
```

프로젝트의 야간 스캔 스케줄 설정을 조회한다. 스케줄이 없으면 `404 Not Found`.

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "isActive": true,
    "lastScanAt": "2026-05-25T16:00:00Z",
    "scanHour": 1
  }
}
```

### 14.2 스케줄 생성/수정 (Upsert)

```http
PUT /api/v1/projects/{projectId}/schedule
Authorization: Bearer {accessToken}
Content-Type: application/json
```

스케줄이 없으면 생성, 있으면 업데이트한다. 팀 멤버만 접근 가능.

**Request**
```json
{
  "isActive": true,
  "scanHour": 1
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `isActive` | boolean | 아니오 | 스케줄 활성화 여부 (기본값: true) |
| `scanHour` | integer | 아니오 | KST 기준 스캔 시각 0~23 (기본값: 1 = KST 01:00) |

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "projectId": "uuid",
    "isActive": true,
    "lastScanAt": null,
    "scanHour": 1
  }
}
```

- 야간 스캔은 매일 KST 01:00(UTC 16:00) 자동 실행 (ShedLock으로 분산 환경 중복 실행 방지)
- `lastScanAt`: 마지막 스캔 완료 시각 (최초 등록 시 `null`)
- 변경 감지 로직: GitHub 프로젝트는 최신 세션 ID SHA 비교, 비GitHub 프로젝트는 30일 경과 여부로 재스캔 판단

---

## 14. 에러 코드 전체 목록

### 12.1 Auth 에러

| 코드 | HTTP | 설명 |
|------|------|------|
| `AUTH_EMAIL_ALREADY_EXISTS` | 409 | 이메일 중복 |
| `AUTH_USERNAME_ALREADY_EXISTS` | 409 | 유저명 중복 |
| `AUTH_PASSWORD_TOO_WEAK` | 400 | 비밀번호 규칙 미달 |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | 이메일 미인증 상태 로그인 시도 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 이메일/비밀번호 불일치 |
| `AUTH_TOKEN_INVALID` | 400 | 유효하지 않은 토큰 (이메일 인증, 비밀번호 재설정 등) |
| `AUTH_TOKEN_EXPIRED` | 401 | 만료된 refreshToken |
| `AUTH_OAUTH_STATE_INVALID` | 400 | GitHub OAuth CSRF state 불일치 **(Sprint 4 신규)** |
| `AUTH_OAUTH_CODE_INVALID` | 400 | GitHub OAuth code 거부 |

### 12.2 User 에러

| 코드 | HTTP | 설명 |
|------|------|------|
| `USER_NOT_FOUND` | 404 | 사용자 없음 |

### 12.3 Project 에러

| 코드 | HTTP | 설명 |
|------|------|------|
| `PROJECT_NOT_FOUND` | 404 | 프로젝트 없음 |
| `PROJECT_ACCESS_DENIED` | 403 | 프로젝트 접근 권한 없음 **(Sprint 4 신규)** |
| `PROJECT_NAME_DUPLICATE` | 409 | 프로젝트명 중복 |
| `PROJECT_INVALID_SOURCE_TYPE` | 400 | sourceType 유효하지 않음 |
| `PROJECT_MEMBER_ALREADY_EXISTS` | 409 | 이미 팀 멤버인 사용자 초대 |

### 12.4 Analysis Session 에러

| 코드 | HTTP | 설명 |
|------|------|------|
| `SESSION_NOT_FOUND` | 404 | 세션 없음 |
| `SESSION_ALREADY_RUNNING` | 409 | 이미 실행 중인 세션 존재 |
| `SESSION_NOT_RESUMABLE` | 422 | `interrupted` 상태가 아닌 세션 재개 시도 **(Sprint 4 신규)** |
| `PLAN_SAST_LIMIT_EXCEEDED` | 422 | 월간 SAST 분석 한도 초과 |

### 12.5 Chat 에러

| 코드 | HTTP | 설명 |
|------|------|------|
| `CHAT_SESSION_NOT_FOUND` | 404 | 채팅 대상 세션 없음 또는 접근 권한 없음 **(Sprint 4 신규)** |
| `CHAT_SESSION_NOT_READY` | 422 | 분석이 완료되지 않은 세션에 채팅 시도 |

### 12.6 Patch 에러

| 코드 | HTTP | 설명 |
|------|------|------|
| `PATCH_NOT_FOUND` | 404 | 패치 없음 또는 접근 권한 없음 |
| `PATCH_ALREADY_APPLIED` | 409 | 이미 적용된 패치 |

### 12.7 Workspace 에러

| 코드 | HTTP | 설명 |
|------|------|------|
| `WORKSPACE_NOT_FOUND` | 404 | 워크스페이스 없음 (TTL 만료 포함) |
| `WORKSPACE_FILE_NOT_FOUND` | 404 | 지정 경로의 파일 없음 |
| `WORKSPACE_PATH_TRAVERSAL` | 400 | 경로 순회 시도 감지 |
| `WORKSPACE_FILE_LIMIT_EXCEEDED` | 400 | 파일 수 한도 초과 |
| `WORKSPACE_FILE_TOO_LARGE` | 400 | 단일 파일 크기 초과 |
| `WORKSPACE_TOTAL_SIZE_EXCEEDED` | 400 | 전체 업로드 크기 초과 |

---

## 15. 변경 이력

| 버전 | 기준 스프린트 | 작성일 | 변경 내용 |
|------|-------------|--------|-----------|
| v1.0 | Sprint 1 완료 | 2026-04-12 | Auth, Users, Projects API 초안 |
| v2.0 | Sprint 2 완료 | 2026-04-28 | 분석 세션 확장 (resume, cancel), AI Engine API, 에러 코드 추가 |
| v3.0 | Sprint 4 + TASK-306 완료 | 2026-05-06 | Chat API 추가, Workspace API 추가, Patches API 추가, Progress API 추가, SSE 이벤트 명세 완성, 에러 코드 4종 신규 (`PROJECT_ACCESS_DENIED`, `SESSION_NOT_RESUMABLE`, `AUTH_OAUTH_STATE_INVALID`, `CHAT_SESSION_NOT_FOUND`) |
| v4.0 | Sprint 8 완료 (피드백 반영) | 2026-05-22 | AI 환각 방지(verify) API, DAST 샌드박스 상태조회 API, 토큰 사용량/비용 모니터링 API, 보안 문서 생성 API 추가 |
