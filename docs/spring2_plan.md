# Sprint 2 구현 계획서
> 기준일: 2026-04-25 | 목표: LangGraph 파이프라인 + PostgresSaver 중단·재개 기능 완성

---

## 전체 실행 순서 & 의존 관계

```
TASK-201 (LangGraph 그래프 골격)
  └─► TASK-202 (MCP + SAST 노드)
        └─► TASK-203 (Spring ↔ Agent HTTP + SSE)
              ├─► TASK-204 (취약점 저장 파이프라인)
              ├─► TASK-205 (진행 로그 시스템)
              └─► TASK-206 (Checkpointer 통합)
                    └─► TASK-207 (중단 감지 & 재개 API)
```

TASK-203 백엔드 작업(엔티티·DB)은 TASK-202와 병렬로 진행 가능.

---

## TASK-201 — LangGraph 보안 감사 그래프 구축

### 목적
LangGraph 기반 보안 감사 그래프의 뼈대를 구성한다. 실제 분석 로직(MCP 연동)은 TASK-202에서 채운다.

### 파일 구조
```
apps/ai_engine/
└── agent/
    ├── __init__.py
    ├── agent_state.py          # TypedDict 상태 정의
    ├── security_audit_graph.py # 노드 함수 모음
    └── graph_builder.py        # 컴파일 & 싱글턴 캐싱
```

### AgentState 설계
```python
class AgentState(TypedDict):
    session_id: str
    project_id: str
    workspace_root: str
    files_to_scan: list[str]         # 전체 스캔 대상 파일 목록
    current_file_index: int           # 현재 처리 중인 파일 인덱스
    cache_hit: bool                   # 캐시 히트 여부 (cache_check_node 출력)
    sast_results: list[dict]          # 누적 SAST 결과
    status: str                       # running / completed / error
    error_message: str | None
```

### 노드 & 엣지
```
[START]
  ↓
scan_files_node        ← workspace 파일 목록 수집, files_to_scan 채움
  ↓ (파일 없으면 END)
cache_check_node       ← 현재 파일 SHA-256 → Redis 캐시 조회
  ↓
(조건) cache_hit?
  ├─ Yes → next_file_node
  └─ No  → sast_node
              ↓
           next_file_node ← 인덱스 증가
              ↓
           (조건) 파일 남았나?
              ├─ Yes → cache_check_node (루프)
              └─ No  → aggregate_node → [END]
```

조건부 엣지 3개:
1. `route_after_scan`: files_to_scan 비었으면 END, 아니면 cache_check
2. `route_after_cache`: cache_hit=True면 next_file, False면 sast
3. `route_after_next`: 파일 남았으면 cache_check, 없으면 aggregate

### graph_builder.py 전략
- `get_graph()` 모듈 레벨 함수로 싱글턴 반환 (모듈 변수에 캐싱)
- TASK-206에서 `compile(checkpointer=...)` 인자만 추가하면 되도록 인터페이스 설계

### LangSmith 연결
- `infrastructure/langsmith_tracer.py`가 이미 설정되어 있음
- `main.py` 상단에서 `configure_langsmith()` 호출 유지

### 테스트 전략
- `tests/agent/test_agent_state.py`: TypedDict 직렬화/역직렬화
- `tests/agent/test_graph_builder.py`: 빈 AgentState dry-run, 노드 순서 확인

---

## TASK-202 — MCP Filesystem Tool → SAST 노드 연동

### 목적
MCP Server(Node.js stdio)와 연결하여 파일을 읽고, Claude API로 SAST 분석 후 결과를 파싱한다.

### 파일 구조
```
apps/ai_engine/
└── agent/
    ├── nodes/
    │   ├── __init__.py
    │   ├── scan_files_node.py
    │   ├── cache_check_node.py
    │   ├── sast_node.py
    │   ├── next_file_node.py
    │   └── aggregate_node.py
    ├── tools/
    │   ├── __init__.py
    │   └── mcp_filesystem_tools.py  # MCP Tool 래퍼 3개
    ├── mcp_client.py                # stdio subprocess 연결
    ├── claude_client.py             # Anthropic SDK 래퍼
    └── response_parser.py           # JSON 복구 파서
```

### MCP Client 전략
- `mcp_client.py`: `langchain_mcp_adapters` 또는 직접 subprocess stdio 통신
- `MultiServerMCPClient`를 사용해 stdio 프로세스 관리
- Tool 3개: `read_file`, `list_directory`, `search_files`

### Claude Client 전략
- `claude_client.py`: Anthropic SDK `messages.create` 래퍼
- 시스템 프롬프트에 SAST 분석 지시 + JSON 출력 형식 명시
- 프롬프트 캐싱(`cache_control`) 적용으로 토큰 절감

### SAST 프롬프트 설계
```
당신은 보안 전문가입니다. 주어진 소스 파일을 분석하여 보안 취약점을 찾으세요.
다음 JSON 형식으로만 응답하세요:
{
  "vulnerabilities": [
    {
      "type": "SQL_INJECTION",
      "severity": "HIGH",
      "cwe": "CWE-89",
      "owasp": "A03",
      "line": 42,
      "description": "...",
      "code_snippet": "..."
    }
  ]
}
```

### response_parser.py 전략
- 정상 JSON: `json.loads()` 직접 파싱
- 잘린 JSON: `json-repair` 라이브러리 또는 직접 복구 로직
- 파싱 실패 시 빈 vulnerabilities 반환 + 오류 로그

### 캐시 전략 (cache_check_node)
- Redis key: `secureai:sast:cache:{file_sha256}`
- TTL: 7일 (파일 변경 없으면 재분석 불필요)
- SHA-256 계산: `hashlib.sha256(content.encode()).hexdigest()`

---

## TASK-203 — Spring Boot ↔ AI Agent HTTP 연동 & SSE 브릿지

### 목적
Backend가 AI Agent에 분석 요청을 보내고, 진행 이벤트를 Redis → SSE로 클라이언트에 전달한다.

### 파일 구조 (Backend)
```
apps/backend/src/main/java/io/secureai/backend/
└── domain/
    └── analysis/
        ├── entity/
        │   └── AnalysisSession.java
        ├── repository/
        │   └── AnalysisSessionRepository.java
        ├── service/
        │   ├── AnalysisService.java
        │   ├── AiAgentClient.java       # Resilience4j Circuit Breaker
        │   ├── RedisPublisher.java
        │   ├── RedisSubscriber.java
        │   └── SseEmitterService.java
        ├── controller/
        │   └── AnalysisController.java
        ├── dto/
        │   ├── StartAnalysisRequest.java
        │   ├── AnalysisSessionResponse.java
        │   └── ProgressEvent.java
        └── event/
            └── (TASK-204에서 추가)
```

### Flyway V006 — analysis_sessions 테이블
```sql
CREATE TABLE analysis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/running/completed/error/interrupted/cancelled
    total_files INT DEFAULT 0,
    scanned_files INT DEFAULT 0,
    vuln_count INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### AiAgentClient 전략
- Resilience4j Circuit Breaker 적용
- `POST http://ai-agent:8001/agent/analyze` 호출
- failureRateThreshold=50, slowCallDurationThreshold=30s
- fallback: SESSION_STATUS를 'interrupted'로 업데이트

### Redis Pub/Sub 채널
- 발행(AI Agent → Backend): `secureai:progress:{session_id}`
- Backend `RedisSubscriber`가 구독 → SSE로 포워딩

### SSE 엔드포인트
- `GET /api/v1/analysis/sessions/{id}/stream`
- `SseEmitterService`: sessionId별 SseEmitter 관리 (ConcurrentHashMap)
- 타임아웃: 30분, 완료/에러 시 `emitter.complete()`

### AI Agent 라우트 (TASK-203용)
```
apps/ai_engine/api/routes/analyze.py
POST /agent/analyze
Body: { session_id, project_id, workspace_root, files }
→ BackgroundTask로 그래프 실행
```

---

## TASK-204 — 취약점 저장 파이프라인 & Spring 이벤트

### 목적
AI Agent가 발견한 취약점을 Backend DB에 저장하고, 세션 집계를 자동 업데이트한다.

### Flyway V007 — vulnerabilities 테이블
```sql
CREATE TABLE vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES analysis_sessions(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    file_path TEXT NOT NULL,
    line_number INT,
    vuln_type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) NOT NULL,        -- LOW/MEDIUM/HIGH/CRITICAL
    cwe VARCHAR(20),
    owasp VARCHAR(10),
    description TEXT,
    code_snippet TEXT,
    call_chain JSONB DEFAULT '[]',
    fingerprint VARCHAR(64) NOT NULL,     -- SHA-256, UNIQUE per session
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(session_id, fingerprint)
);
CREATE INDEX idx_vuln_session ON vulnerabilities(session_id);
CREATE INDEX idx_vuln_project ON vulnerabilities(project_id);
CREATE INDEX idx_vuln_call_chain ON vulnerabilities USING GIN(call_chain);
```

### 지문(Fingerprint) 생성 전략
```python
# AI Agent측
fingerprint = sha256(f"{file_path}:{line_number}:{vuln_type}".encode()).hexdigest()
```

### Spring 이벤트 흐름
```
VulnerabilityService.save()
  → publishEvent(VulnerabilityFoundEvent)
  → VulnerabilityFoundEventListener
    → AnalysisSessionRepository.incrementVulnCount()
```

### AI Agent Backend Client
```
apps/ai_engine/infrastructure/backend_api_client.py
POST /api/v1/internal/vulnerabilities
Header: X-Internal-Key: {INTERNAL_API_KEY}
```

### Backend 내부 엔드포인트
```
POST /api/v1/internal/vulnerabilities
→ VulnerabilityService.saveFromAgent()
→ 중복 fingerprint → UPSERT 무시 (onConflictDoNothing)
```

---

## TASK-205 — 진행 로그 시스템 구축

### 목적
분석 각 단계의 시작·완료·소요 시간을 DB에 기록하여 디버깅과 모니터링을 지원한다.

### Flyway V023 — analysis_progress_log 테이블
```sql
CREATE TABLE analysis_progress_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES analysis_sessions(id),
    step_name VARCHAR(50) NOT NULL,
    step_order INT NOT NULL,
    target VARCHAR(500),                   -- 분석 대상 (파일 경로 등)
    status VARCHAR(20) NOT NULL,           -- started / completed / failed
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INT GENERATED ALWAYS AS (
        EXTRACT(MILLISECONDS FROM (completed_at - started_at))::INT
    ) STORED,
    detail JSONB,
    UNIQUE(session_id, step_name, target)
);
CREATE INDEX idx_progress_session ON analysis_progress_log(session_id, step_order);
```

### Backend 내부 엔드포인트
```
POST /api/v1/internal/progress-log
Body: { session_id, step_name, step_order, target, status, detail }
```

### AI Agent Progress Client
```
apps/ai_engine/infrastructure/progress_log_client.py
- log_start(session_id, step_name, step_order, target)
- log_complete(session_id, step_name, target, detail)
- log_failed(session_id, step_name, target, error)
```

### 각 노드에서 호출
```python
# sast_node.py 예시
await progress_client.log_start(state["session_id"], "sast_analysis", idx, file_path)
result = await run_sast(file_path)
await progress_client.log_complete(state["session_id"], "sast_analysis", file_path, {"vuln_count": len(result)})
```

---

## TASK-206 — LangGraph Checkpointer 통합

### 목적
`PostgresSaver`로 그래프 상태를 자동 저장하여 AI Agent 재시작 후에도 마지막 체크포인트부터 재개 가능.

### 의존성 추가
```
# requirements.txt에 추가
langgraph-checkpoint-postgres==2.0.x
psycopg[binary,pool]==3.x.x
```

### PostgresSaver 설정 전략
- `graph_builder.py`에서 싱글턴 `AsyncPostgresSaver` 초기화
- connection string: `POSTGRES_URL` 환경변수
- `lifespan`에서 `checkpointer.setup()` 호출 (테이블 자동 생성)

### 그래프 컴파일 변경
```python
# graph_builder.py
async def get_graph(checkpointer=None):
    graph = builder.compile(checkpointer=checkpointer)
    return graph
```

### 분석 실행 시 config 전달
```python
config = {"configurable": {"thread_id": session_id}}
async for event in graph.astream(initial_state, config):
    ...
```

### 재개 엔드포인트 (AI Agent)
```
POST /agent/resume/{session_id}
→ graph.astream(None, config)  # None = 체크포인트에서 재개
```

### 체크포인트 DB 구성
- LangGraph가 자동으로 `checkpoints`, `checkpoint_blobs`, `checkpoint_writes` 테이블 생성
- 별도 Flyway 마이그레이션 불필요 (`checkpointer.setup()` 처리)

---

## TASK-207 — 중단 감지 및 재개 API

### 목적
AI Agent 장애를 자동 감지하여 세션을 'interrupted'로 전환하고, 사용자가 재개 버튼으로 복구할 수 있게 한다.

### Backend 엔드포인트 추가
```
POST /api/v1/analysis/sessions/{id}/resume
POST /api/v1/analysis/sessions/{id}/cancel
```

### 중단 감지 전략
- `AiAgentClient`의 Circuit Breaker OPEN 이벤트 → `@EventListener(CircuitBreakerOnOpenEvent)`
- 또는 분석 시작 후 N분 내 완료 이벤트 없으면 스케줄러가 'interrupted'로 전환
- `@Scheduled(fixedDelay = 60_000)` — RUNNING 상태 15분 초과 세션 감지

### 재개 흐름
```
사용자 → POST /sessions/{id}/resume
  → AnalysisService.resumeSession()
    → 세션 status 검증 (interrupted만 가능)
    → AiAgentClient.resumeSession(sessionId) 호출
      → AI Agent POST /agent/resume/{session_id}
        → graph.astream(None, config)  ← 마지막 체크포인트부터
    → 세션 status = 'running'
    → progress_log에 'session_resumed' 기록
```

### ErrorCode 추가
```java
SESSION_NOT_RESUMABLE(HttpStatus.CONFLICT, "재개할 수 없는 상태의 세션입니다."),
SESSION_CANCELLED(HttpStatus.CONFLICT, "이미 취소된 세션입니다."),
```

### 만료 정리 (ExpiredDataCleanupJob)
- 완료/취소 세션의 체크포인트: 24시간 후 삭제
- 중단 세션의 체크포인트: 7일 후 삭제
- `@Scheduled` 또는 별도 클리너 구현

---

## 공통 구현 원칙

### 환경변수 추가 목록
```
# AI Engine
POSTGRES_URL=postgresql://secureai:secureai@postgres:5432/secureai
BACKEND_INTERNAL_URL=http://backend:8080
INTERNAL_API_KEY=<shared-secret>

# Backend
AI_AGENT_URL=http://ai-engine:8001
INTERNAL_API_KEY=<shared-secret>
```

### 내부 API 보안
- AI Engine → Backend: `X-Internal-Key` 헤더 (기존 `InternalKeyAuthMiddleware`)
- Backend → AI Engine: `X-Internal-Key` 헤더

### 오류 처리 원칙
- AI Agent 노드 오류: 로그 기록 후 해당 파일 스킵, 다음 파일 계속
- 치명적 오류(DB 연결 등): 세션 status='error', Circuit Breaker 통보

---

## 작업 순서 요약

| 순서 | TASK | 주요 파일 |
|------|------|-----------|
| 1 | TASK-201 | `agent/agent_state.py`, `security_audit_graph.py`, `graph_builder.py` |
| 2 | TASK-202 | `agent/nodes/*.py`, `mcp_client.py`, `claude_client.py`, `response_parser.py` |
| 3a | TASK-203 (BE) | `AnalysisSession.java`, V006, `AnalysisController.java`, SSE |
| 3b | TASK-203 (AI) | `api/routes/analyze.py` |
| 4 | TASK-204 | `Vulnerability.java`, V007, `VulnerabilityController.java`, `backend_api_client.py` |
| 5 | TASK-205 | `AnalysisProgressLog.java`, V023, `progress_log_client.py` |
| 6 | TASK-206 | `PostgresSaver` 통합, `POST /agent/resume` |
| 7 | TASK-207 | `resumeSession()`, 중단 감지 스케줄러, `ErrorCode` 추가 |
