# SecureAI — REST API 설계서 v2.0 (Sprint 2 추가 API)
> 기준: Sprint 2 완료 (`feat/task206-checkpointer`)  
> 이전 버전: `02_API_DESIGN.md` (Sprint 1 설계안 — Auth, User, Project 기준)  
> 변경 요약: 분석 세션 API 확장(resume, cancel), 내부 API 2종 추가, AI Engine API 추가

---

## 목차

1. [분석 세션 API — Sprint 2 확장](#1-분석-세션-api--sprint-2-확장)
2. [취약점 API](#2-취약점-api)
3. [진행 로그 API](#3-진행-로그-api)
4. [내부 통신 API (Backend ↔ AI Engine)](#4-내부-통신-api-backend--ai-engine)
5. [AI Engine API](#5-ai-engine-api)
6. [Sprint 2 에러 코드](#6-sprint-2-에러-코드)

---

## 1. 분석 세션 API — Sprint 2 확장

Base path: `/api/v1/analysis`  
인증: `Authorization: Bearer {accessToken}`

### 1.1 분석 세션 시작

```http
POST /api/v1/analysis/sessions
```

**Request**
```json
{
  "projectId": "uuid",
  "workspaceRoot": "/workspace"
}
```

**Response** `201 Created`
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "projectId": "uuid",
    "status": "running",
    "createdAt": "2026-04-28T10:00:00Z"
  }
}
```

내부적으로 AI Engine `POST /agent/analyze` 호출 후 백그라운드 실행.

---

### 1.2 세션 목록 조회

```http
GET /api/v1/analysis/sessions?projectId={uuid}&page=0&size=20&sort=createdAt,desc
```

**Response** `200 OK` — 페이지네이션 포함

---

### 1.3 세션 단건 조회

```http
GET /api/v1/analysis/sessions/{sessionId}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "sessionId": "uuid",
    "status": "completed | running | interrupted | cancelled | failed",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### 1.4 SSE 실시간 스트림 구독

```http
GET /api/v1/analysis/sessions/{sessionId}/stream
Accept: text/event-stream
```

AI Engine이 Redis Pub/Sub으로 발행하는 이벤트를 SSE로 클라이언트에 전달.

**이벤트 타입**

| type | 설명 | 주요 필드 |
|------|------|----------|
| `started` | 분석 시작 | `session_id` |
| `scan_complete` | 파일 목록 완료 | `total` |
| `progress` | 파일별 진행 | `node`, `file`, `current`, `total`, `cache_hit?` |
| `completed` | 분석 완료 | `vuln_count`, `results[]` |
| `cancelled` | 취소됨 | — |
| `error` | 오류 | `message` |

---

### 1.5 세션 재개 (Sprint 2 신규)

```http
POST /api/v1/analysis/sessions/{sessionId}/resume
```

**전제 조건**: 세션 상태가 `interrupted`이어야 함.  
내부적으로 AI Engine `POST /agent/resume/{session_id}` 호출.

**Response** `200 OK`
```json
{
  "success": true,
  "data": { "sessionId": "uuid", "status": "running" }
}
```

**에러 케이스**

| 조건 | 코드 | errorCode |
|------|------|-----------|
| 세션 없음 / 다른 유저 세션 | 404 | `SESSION_NOT_FOUND` |
| 상태가 `interrupted`가 아님 | 409 | `SESSION_NOT_RESUMABLE` |

---

### 1.6 세션 취소

```http
POST /api/v1/analysis/sessions/{sessionId}/cancel
```

**Response** `204 No Content`

---

## 2. 취약점 API

### 2.1 세션 취약점 목록

```http
GET /api/v1/vulnerabilities?sessionId={uuid}&severity=HIGH&page=0&size=20
```

**Response** `200 OK` — 페이지네이션 포함  
`severity` 필터: `CRITICAL | HIGH | MEDIUM | LOW | INFO` (선택)

---

### 2.2 취약점 단건 조회

```http
GET /api/v1/vulnerabilities/{vulnId}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sessionId": "uuid",
    "filePath": "src/main/java/...",
    "lineNumber": 42,
    "severity": "HIGH",
    "title": "SQL Injection",
    "description": "...",
    "fingerprint": "sha256-hash",
    "createdAt": "..."
  }
}
```

---

## 3. 진행 로그 API

### 3.1 세션 진행 로그 조회

```http
GET /api/v1/analysis/sessions/{sessionId}/progress-logs
Authorization: Bearer {accessToken}
```

**Response** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sessionId": "uuid",
      "node": "sast_node",
      "message": "Scanning src/main/App.java",
      "createdAt": "..."
    }
  ]
}
```

---

## 4. 내부 통신 API (Backend ↔ AI Engine)

인증: `X-Internal-Key: {INTERNAL_API_KEY}` 헤더 필수.  
외부 클라이언트 접근 불가 (SecurityConfig에서 `/api/v1/internal/**` 별도 검증).

### 4.1 취약점 저장 (AI Engine → Backend)

```http
POST /api/v1/internal/vulnerabilities
X-Internal-Key: {key}
```

**Request**
```json
{
  "sessionId": "uuid",
  "vulnerabilities": [
    {
      "filePath": "src/...",
      "lineNumber": 42,
      "severity": "HIGH",
      "title": "SQL Injection",
      "description": "...",
      "fingerprint": "sha256-..."
    }
  ]
}
```

**Response** `201 Created`
```json
{ "success": true, "data": { "saved": 3 } }
```

중복 fingerprint는 자동 스킵 (idempotent).

---

### 4.2 진행 로그 저장 (AI Engine → Backend) — Sprint 2 신규

```http
POST /api/v1/internal/progress-logs
X-Internal-Key: {key}
```

**Request**
```json
{
  "sessionId": "uuid",
  "node": "sast_node",
  "message": "Scanning src/main/App.java"
}
```

**Response** `201 Created`

---

## 5. AI Engine API

Base URL: `http://ai_engine:8000` (compose 내부) / `http://localhost:8000` (로컬)  
인증: `X-Internal-Key` 헤더 (InternalKeyAuthMiddleware)

### 5.1 분석 시작

```http
POST /agent/analyze
```

**Request**
```json
{
  "session_id": "uuid-string",
  "project_id": "uuid-string",
  "workspace_root": "/workspace"
}
```

**Response** `202 Accepted`
```json
{ "session_id": "...", "status": "accepted" }
```

백그라운드 태스크로 실행. 진행 상황은 Redis `secureai:progress:{session_id}` 채널로 발행.

---

### 5.2 세션 재개 (체크포인터에서 복원) — Sprint 2 신규

```http
POST /agent/resume/{session_id}
```

**Response** `202 Accepted`
```json
{ "session_id": "...", "status": "accepted" }
```

LangGraph `AsyncPostgresSaver`에서 마지막 체크포인트를 복원하여 나머지 노드를 실행.  
체크포인터가 초기화되지 않은 경우 `error` 이벤트를 Redis에 발행.

---

### 5.3 분석 취소

```http
POST /agent/cancel/{session_id}
```

**Response** `204 No Content`  
취소 플래그를 설정 → 다음 노드 진입 시 중단.

---

### 5.4 헬스체크

```http
GET /health
```

**Response** `200 OK`
```json
{ "status": "healthy", "service": "SecureAI Engine" }
```

---

## 6. Sprint 2 에러 코드

| errorCode | HTTP | 설명 |
|-----------|------|------|
| `SESSION_NOT_FOUND` | 404 | 세션 없음 또는 다른 유저 소유 |
| `SESSION_NOT_RESUMABLE` | 409 | 상태가 `interrupted`가 아니어서 재개 불가 |
| `AI_AGENT_UNAVAILABLE` | 503 | AI Engine Circuit Breaker OPEN 상태 |
| `PROJECT_NOT_FOUND` | 404 | 프로젝트 없음 또는 접근 권한 없음 |

### Circuit Breaker (AiAgentClient)

AI Engine 호출 실패 3회 연속 시 Circuit Breaker OPEN.  
OPEN 상태: 30초 후 HALF-OPEN → 성공 시 CLOSED.  
`SessionInterruptionScheduler`가 30초마다 폴링 → OPEN이면 `running` 세션을 `interrupted`로 전환.

---

## 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2026-04-19 | v1.0 | 최초 작성 (Auth, User, Project API 설계) |
| 2026-04-28 | v2.0 | Sprint 2: resume/cancel 세션 API, 내부 API 2종, AI Engine API, Circuit Breaker 에러 코드 추가 |
