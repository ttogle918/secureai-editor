# Sprint 2 테스트 현황 & 미해결 항목

> 마지막 업데이트: 2026-04-27 (최종)
> 자동화 단위 테스트: **43 passed, 4 errors(Windows 로컬)** (`python -m pytest tests/agent/ tests/infrastructure/`)
> Docker 환경: 47 passed (WinError 10014 4건은 로컬 전용 이슈)
> Spring Boot 단위 테스트: **5 passed** (`AiAgentClientTest` 3 + `VulnerabilityServiceTest` 2)

---

## 전체 테스트 현황 요약

| TASK | 단위 테스트 | 통합 테스트 | 수동 검증 |
|------|------------|------------|----------|
| TASK-201 LangGraph 골격 | ✅ 16/16 통과 | ⏳ 보류 | ⏳ 보류 |
| TASK-202 MCP + SAST 노드 | ✅ 9/9 통과 | ⏳ 보류 | ⏳ 보류 |
| TASK-203 Spring ↔ Agent SSE | ✅ 6/6 Python + ✅ 3/3 Java CB | ⏳ 보류 | ⏳ 보류 |
| TASK-204 취약점 저장 파이프라인 | ✅ 10/10 Python + ✅ 2/2 Java Vuln | ⏳ 보류 | ⏳ 보류 |
| TASK-205 진행 로그 시스템 | ✅ 8/8 통과 | ⏳ 보류 | ⏳ 보류 |
| TASK-206 LangGraph Checkpointer | ✅ 4/4 로컬 + 9/9 Docker | ✅ 4/4 작성 (postgres 필요) | ⏳ 보류 |
| TASK-207 중단 감지 및 재개 API | ✅ 5/5 작성 (Java: 3 CB + 2 Vuln) | ⏳ 보류 | ⏳ 보류 |

---

## TASK-201 — LangGraph 보안 감사 그래프 구축

### ✅ 완료된 자동화 테스트 (16개)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `test_agent_state.py` | TypedDict 직렬화/역직렬화 | ✅ |
| `test_agent_state.py` | 빈 files_to_scan, sha256 기본값 등 | ✅ |
| `test_graph_builder.py` | 조건부 엣지 6개 (scan/cache/next) | ✅ |
| `test_graph_builder.py` | 그래프 컴파일 + 싱글턴 | ✅ |
| `test_graph_builder.py` | 파일 없음 dry-run → scan 후 END | ✅ |
| `test_graph_builder.py` | 파일 1개 dry-run → 모든 노드 순서대로 방문 | ✅ |

### ⏳ 수동 검증 보류

| 항목 | 선행 조건 |
|------|----------|
| LangSmith 대시보드에 실행 트레이스 표시 | `LANGCHAIN_TRACING_V2=true` + 유효한 `LANGCHAIN_API_KEY` + MCP 서버 빌드 완료 |

---

## TASK-202 — MCP Filesystem Tool → SAST 노드 연동

### ✅ 완료된 자동화 테스트 (9개)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `test_response_parser.py` | 정상 JSON 단일/복수 취약점 파싱 | ✅ |
| `test_response_parser.py` | 취약점 없는 JSON | ✅ |
| `test_response_parser.py` | 전문(preamble) 텍스트 포함 JSON 파싱 | ✅ |
| `test_response_parser.py` | 잘린 JSON 3단계 복구 | ✅ |
| `test_response_parser.py` | 완전 파싱 불가 → 빈 배열 반환 | ✅ |
| `test_response_parser.py` | 빈 문자열 → 빈 배열 | ✅ |
| `test_response_parser.py` | SHA-256 해시 일관성 + 다른 내용 시 다른 해시 | ✅ |

### ⏳ 통합 테스트 보류 (Docker + 실제 Claude API + MCP 서버 필요)

| 항목 | 선행 조건 |
|------|----------|
| 취약한 Java 파일 입력 → SQL Injection JSON 반환 확인 | MCP 서버(`/app/mcp_server/dist/index.js`) 빌드 완료 |
| 동일 파일 재분석 시 Claude 미호출 (캐시 히트) | Redis 실동작 + MCP 서버 |
| MCP 서버 다운 시 오류 적절히 처리 | MCP 서브프로세스 kill 시나리오 |
| MCP 경로 탈출 시도 차단 (보안) | MCP 서버 |

### ⏳ 수동 검증 보류

| 항목 | 방법 |
|------|------|
| `UserController.java` 취약 버전 분석 → CWE-89, A03 분류 | 실제 파일을 `/workspace`에 배치 후 분석 실행 |

---

## TASK-203 — Spring Boot ↔ AI Agent HTTP 연동 & SSE 브릿지

### ✅ 완료된 자동화 테스트 (6개, Docker 컨테이너 내 실행 가능)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `test_analyze_route.py` | _cancel_flags 상태 초기화 | ✅ |
| `test_analyze_route.py` | 파일 없음 → started + completed 이벤트 발행 | ✅ |
| `test_analyze_route.py` | 취소 플래그 → cancelled 이벤트, completed 없음 | ✅ |
| `test_analyze_route.py` | MCP 예외 → error 이벤트 발행 | ✅ |
| `test_analyze_route.py` | 완료 후 _cancel_flags에서 자동 제거 | ✅ |
| `test_analyze_route.py` | progress 이벤트에 파일명/인덱스 포함 | ✅ |

> ⚠️ 로컬 실행 불가 (FastAPI 미설치). Docker 컨테이너 내에서는 정상 실행:
> `docker exec secureai-ai-engine python -m pytest tests/`

### ✅ 완료된 Java Circuit Breaker 단위 테스트 (3개, 2026-04-27)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `AiAgentClientTest.java` | 연속 3회 실패 → `circuitOpen = true` | ✅ |
| `AiAgentClientTest.java` | OPEN 상태에서 즉시 `AI_AGENT_UNAVAILABLE` 반환, `RestClient` 미호출 | ✅ |
| `AiAgentClientTest.java` | 30초 경과 → HALF-OPEN → 성공 시 `circuitOpen = false` | ✅ |

### ⏳ 통합/E2E 테스트 보류

| 항목 | 선행 조건 |
|------|----------|
| 분석 요청 → AI Agent 시작 → Redis 이벤트 → SSE 수신 E2E | MCP 서버 빌드 완료 |
| AI Agent 다운 → Circuit Breaker OPEN → 30초 → HALF-OPEN | Docker 전체 스택 |
| SSE 연결 → 여러 이벤트 순차 수신 → 연결 종료 | 동일 |
| 2명 동일 프로젝트 SSE 구독 → 각자에게만 이벤트 전달 | 동일 |

### ⏳ 수동 검증 보류

| 항목 | 방법 |
|------|------|
| cURL로 SSE 스트림 구독 → 진행 이벤트 실시간 수신 | `curl -N http://localhost:8080/api/v1/analysis/sessions/{id}/stream` |

---

## TASK-204 — 취약점 저장 파이프라인 & Spring 이벤트

### ✅ 완료된 자동화 테스트 (10개)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `test_backend_api_client.py` | 동일 입력 → 동일 fingerprint | ✅ |
| `test_backend_api_client.py` | 라인/타입/파일 다르면 fingerprint 다름 | ✅ |
| `test_backend_api_client.py` | lineNumber=None → "0" 처리 | ✅ |
| `test_backend_api_client.py` | fingerprint는 64자 hex 문자열 | ✅ |
| `test_backend_api_client.py` | 빈 목록 전송 시 HTTP 호출 없이 0 반환 | ✅ |
| `test_backend_api_client.py` | 정상 HTTP 응답 → saved 카운트 반환 | ✅ |
| `test_backend_api_client.py` | HTTP 오류 → 0 반환 (세션 중단 없음) | ✅ |
| `test_backend_api_client.py` | payload 구조 (sessionId, projectId, filePath, vulnType 등) | ✅ |

### ✅ 완료된 Java VulnerabilityService 단위 테스트 (2개, 2026-04-27)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `VulnerabilityServiceTest.java` | 중복 fingerprint → `saveAll` 미호출, 이벤트 미발행 | ✅ |
| `VulnerabilityServiceTest.java` | 신규 취약점 → `VulnerabilityFoundEvent(sessionId, savedCount=1)` 발행 확인 | ✅ |

### ⏳ 통합/E2E 테스트 보류 → Sprint 3 이월

| 항목 | 선행 조건 |
|------|----------|
| 취약점 저장 → VulnerabilityFoundEvent → session vulnCount 컬럼 업데이트 | 실DB 연결 |
| 취약점 필터 API severity AND 조건 정확성 | 실DB 연결 |
| callChain JSONB GIN 인덱스 EXPLAIN 확인 | TASK-206 migration 완료 후 |
| 취약점 10개 동시 저장 → 집계 동기화 경쟁 조건 없음 | 실DB 연결 |

---

## TASK-205 — 진행 로그 시스템 구축

### ✅ 완료된 자동화 테스트 (8개)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `test_progress_log_client.py` | log_started 페이로드 (sessionId, stepName, stepOrder, status, target) | ✅ |
| `test_progress_log_client.py` | log_started target 파라미터 전달 | ✅ |
| `test_progress_log_client.py` | log_completed 페이로드 (status, target, detail) | ✅ |
| `test_progress_log_client.py` | log_completed detail=None 시 키 제외 | ✅ |
| `test_progress_log_client.py` | log_failed status="failed" 확인 | ✅ |
| `test_progress_log_client.py` | HTTP 오류 시 예외 전파 없음 (log_started) | ✅ |
| `test_progress_log_client.py` | HTTP 오류 시 예외 전파 없음 (log_completed) | ✅ |
| `test_progress_log_client.py` | 올바른 URL 경로 전송 확인 | ✅ |

### ⏳ 통합/E2E 테스트 보류

| 항목 | 선행 조건 |
|------|----------|
| 분석 실행 → progress-logs API 조회 → step 순서 확인 | 실DB 연결 + MCP 서버 |
| started → completed 상태 전환 및 durationMs 계산 정확성 | 실DB 연결 |
| UNIQUE 제약 — 동일 (session, step, target) 재시도 시 덮어쓰기 | 실DB 연결 |

---

## TASK-206 — LangGraph Checkpointer 통합

### ✅ 완료된 단위 테스트 (4개, 로컬)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `test_checkpointer.py` | get_checkpointer 초기값 None | ✅ |
| `test_checkpointer.py` | set_checkpointer → get_checkpointer 반환 | ✅ |
| `test_checkpointer.py` | 덮어쓰기 | ✅ |
| `test_checkpointer.py` | None으로 초기화 | ✅ |

### ✅ 완료된 단위 테스트 (3개, Docker 전용)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `test_analyze_route.py` | checkpointer 없을 때 resume → error 이벤트 | ✅ |
| `test_analyze_route.py` | checkpointer 있을 때 resume → started + completed | ✅ |
| `test_analyze_route.py` | resume 중 cancel flag → cancelled 이벤트 | ✅ |

### ✅ 완료된 통합 테스트 (4개, postgres 필요 — 미연결 시 자동 스킵)

| 파일 | 테스트 | 실행 |
|------|--------|------|
| `test_checkpointer_integration.py` | 그래프 완료 후 체크포인트 DB 저장 확인 | Docker |
| `test_checkpointer_integration.py` | thread_id 격리 — 두 세션 체크포인트 섞이지 않음 | Docker |
| `test_checkpointer_integration.py` | interrupt 후 재개 시 나머지 노드만 실행 (핵심) | Docker |
| `test_checkpointer_integration.py` | 완료된 스레드 재개 → 추가 실행 없음 | Docker |

> Docker 실행: `docker exec secureai-ai-engine python -m pytest tests/integration/ -v`

### 🐛 발견된 버그 및 수정 (2026-04-27)

| 버그 | 원인 | 수정 |
|------|------|------|
| postgres 없이 `tests/integration/` 실행 시 SKIP 대신 ERROR | `saver` fixture에서 `await instance.setup()`이 try-except 블록 밖에 위치 — `pool.open()` 성공 후 `setup()` 에서 30초 timeout 발생 시 미처리 | `setup()` 호출을 try-except 안으로 이동. `pool.wait(timeout=3)` 추가로 실제 연결 수립 확인 |
| 로컬 Windows 에서 `pool.open(timeout=5)` 이 postgres 미연결 상태에도 정상 반환 | psycopg-pool 3.x의 `open()` 이 백그라운드 태스크로 연결을 시도하여 즉시 반환 | `pool.wait(timeout=3)` 명시 추가 — 연결 미성립 시 빠르게 예외 발생 |

**로컬 실행 결과 (Docker 없음):**
- 수정 전: `4 errors` (30초 × 4 = 120초 소요)
- 수정 후: `4 skipped` (약 32초 소요)

### ⏳ 수동 검증 보류

| 항목 | 방법 |
|------|------|
| 10개 파일 분석 중 5번째에서 컨테이너 재시작 → 재개 시 6번째 파일부터 | `docker restart secureai-ai-engine` 후 `/agent/resume` 호출 |
| 체크포인트 DB 테이블 자동 생성 확인 | `docker exec secureai-postgres psql -U secureai -c '\dt checkpoints*'` |

---

## TASK-207 — 중단 감지 및 재개 API

### ✅ 구현 완료

| 파일 | 변경 내용 |
|------|----------|
| `AiAgentClient.java` | `resumeAnalysis()`, `isCircuitOpen()` 추가 |
| `AnalysisService.java` | `resumeSession()` 추가 (interrupted 상태 검증 → markRunning → agentClient.resumeAnalysis) |
| `AnalysisController.java` | `POST /api/v1/analysis/sessions/{id}/resume` 엔드포인트 추가 |
| `SessionInterruptionScheduler.java` | Circuit Breaker OPEN 감지 → 30초 주기로 실행 중 세션 interrupted 전환 |

### ✅ 완료된 단위 테스트 (5개)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `AiAgentClientTest.java` | 연속 3회 실패 → circuitOpen=true | ✅ |
| `AiAgentClientTest.java` | OPEN 상태에서 즉시 AI_AGENT_UNAVAILABLE | ✅ |
| `AiAgentClientTest.java` | 30초 경과 HALF-OPEN → 성공 시 circuitOpen=false | ✅ |
| `VulnerabilityServiceTest.java` | 중복 fingerprint → DB 저장 스킵 | ✅ |
| `VulnerabilityServiceTest.java` | 신규 취약점 → VulnerabilityFoundEvent 발행 확인 | ✅ |

### ❌ 미작성 단위 테스트 (TASK-207 AnalysisService 로직)

> AiAgentClientTest·VulnerabilityServiceTest는 이번 세션에서 완료되었으나,  
> TASK-207 바이어 자체의 `AnalysisService.resumeSession()` 검증 테스트는 미작성.

| 항목 | 파일 |
|------|------|
| 이미 완료된 세션 재개 시도 → `SESSION_NOT_RESUMABLE` (409) | `AnalysisServiceResumeTest.java` (미작성) |
| 다른 사용자의 세션 재개 시도 → `SESSION_NOT_FOUND` (404) | 동일 |

### ⏳ 통합/E2E 테스트 보류 → Sprint 3 이월

| 항목 | 선행 조건 |
|------|----------|
| AI Agent 컨테이너 강제 종료 → 30초 내 세션 status='interrupted' 전환 | Docker 전체 스택 |
| 중단 후 재개 → 마지막 체크포인트부터 재실행 → 최종 완료 | Docker 전체 스택 |

---

## Sprint 2 완료 기준 점검 (2026-04-27 최종)

### ✅ 달성된 항목

| 완료 기준 | 상태 | 비고 |
|----------|------|------|
| **AI 분석 동작**: 단일 파일 입력 → SAST → 취약점 JSON 반환 | ✅ 구현 완료 | MCP 서버 빌드 후 E2E 확인 필요 |
| **Circuit Breaker**: AI Agent 장애 시 서비스 전체 다운 없음 | ✅ 구현 + 단위 테스트 완료 | |
| **중단 재개 ⭐**: 분석 중단 → `agent_checkpoints` 보존 → 재개 API로 복구 | ✅ 구현 완료 | 통합 테스트는 Sprint 3 |
| **진행 로그 ⭐**: 모든 단계가 `analysis_progress_log`에 기록 | ✅ 구현 완료 | 통합 테스트는 Sprint 3 |
| **LangGraph 통합 테스트**: `tests/integration/` 4개 | ✅ 4/4 Docker 통과 | |

### ⏳ Sprint 3으로 이월된 항목

| 항목 | 이유 |
|------|------|
| MCP 서버 빌드 & E2E 통합 테스트 전체 | MCP Node.js 서버 빌드 미완료 |
| SSE 스트림 수동 검증 (cURL) | 전체 Docker 스택 필요 |
| LangSmith 대시보드 트레이스 확인 | `LANGSMITH_TRACING=true` + MCP 서버 필요 |
| 취약점 저장 통합 테스트 (실DB) | 실DB 연결 필요 |
| TASK-207 `AnalysisServiceResumeTest.java` 작성 | 미작성 |
| 체크포인트 24시간 만료 클린업 | `ExpiredDataCleanupJob` 미구현 (Sprint 3) |
| 세션 취소 엔드포인트 `POST /sessions/{id}/cancel` | Sprint 3 이월 |

### ⚠️ 알려진 이슈

| 이슈 | 영향 | 조치 |
|------|------|------|
| Windows 로컬 테스트 4개 ERROR (WinError 10014) | 로컬 전용 — Docker에서는 정상 | Docker에서만 실행할 것 |
| `docker compose build ai-engine` 미실행 | `psycopg[binary]` 컨테이너 재시작 후 소실 가능성 | 다음 세션 시작 시 반드시 재빌드 |

---

## 스프린트 종료 전 직접 수행해야 할 항목

### ✅ 완료됨 (2026-04-27)

- [x] **`AiAgentClientTest.java`** — Circuit Breaker 단위 테스트 3개 ✅
- [x] **`VulnerabilityServiceTest.java`** — 서비스 로직 단위 테스트 2개 ✅
- [x] **TASK-206 통합 테스트 4개** — Docker 4/4 passed ✅
- [x] **TASK-207 구현** — resume API + scheduler ✅

### 🟠 Sprint 3 우선순위 — MCP 서버 빌드 후 진행

- [ ] `docker compose build ai-engine` — psycopg[binary] 영구 적용
- [ ] MCP 서버 빌드 (`apps/mcp_server/` npm install + build)
- [ ] E2E 통합 테스트: 취약한 파일 분석 → 취약점 저장 → SSE 이벤트 수신
- [ ] `AnalysisServiceResumeTest.java` 작성 (SESSION_NOT_RESUMABLE, 403)
- [ ] SSE 스트림 수동 확인
  ```bash
  # 1. JWT 토큰 발급 (POST /api/v1/auth/login)
  # 2. 세션 생성 후
  curl -N -H "Authorization: Bearer {token}" \
    http://localhost:8080/api/v1/analysis/sessions/{sessionId}/stream
  ```

### 🟡 우선순위 낮음 — 수동 검증

- [ ] LangSmith 대시보드 트레이스 확인 (`.env`에서 `LANGSMITH_TRACING=true` 설정 후)
- [ ] 취약한 파일 실분석 → CWE 분류 정확성 육안 확인
- [ ] 취약점 10개 동시 저장 경쟁 조건 없음 (`siege` 또는 locust로 부하 테스트)

---

## Docker 컨테이너 내 전체 테스트 실행 방법

```bash
# AI Engine 전체 테스트 (FastAPI 포함)
docker exec secureai-ai-engine python -m pytest tests/ -v

# AI Engine 통합 테스트 (PostgreSQL 연결 필요)
docker exec secureai-ai-engine python -m pytest tests/integration/ -v

# 로컬 (FastAPI 미설치 환경) — 4개 WinError 무시
python -m pytest tests/agent/ tests/infrastructure/ -v
```
