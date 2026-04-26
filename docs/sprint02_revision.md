# Sprint 2 테스트 현황 & 미해결 항목

> 마지막 업데이트: 2026-04-26
> 자동화 단위 테스트: **47 passed** (`python -m pytest tests/agent/ tests/infrastructure/`)

---

## 전체 테스트 현황 요약

| TASK | 단위 테스트 | 통합 테스트 | 수동 검증 |
|------|------------|------------|----------|
| TASK-201 LangGraph 골격 | ✅ 16/16 통과 | ⏳ 보류 | ⏳ 보류 |
| TASK-202 MCP + SAST 노드 | ✅ 9/9 통과 | ⏳ 보류 | ⏳ 보류 |
| TASK-203 Spring ↔ Agent SSE | ✅ 6/6 통과 (Docker 내) | ⏳ 보류 | ⏳ 보류 |
| TASK-204 취약점 저장 파이프라인 | ✅ 10/10 통과 | ⏳ 보류 | ⏳ 보류 |
| TASK-205 진행 로그 시스템 | ✅ 8/8 통과 | ⏳ 보류 | ⏳ 보류 |
| TASK-206 LangGraph Checkpointer | ✅ 4/4 로컬 + 9/9 Docker | ⏳ 보류 | ⏳ 보류 |

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

### ❌ 미작성 단위 테스트 (스프린트 종료 전 작성 필요)

| 항목 | 파일 위치 |
|------|----------|
| Circuit Breaker — 연속 3회 실패 시 OPEN 전환 | `tests/` (Java: `AiAgentClientTest.java`) |
| Circuit Breaker — OPEN 상태에서 즉시 예외 반환 | 동일 |
| Circuit Breaker — 30초 후 HALF-OPEN → 성공 시 CLOSED | 동일 |

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

### ❌ 미작성 단위 테스트 (스프린트 종료 전 작성 필요)

| 항목 | 파일 위치 |
|------|----------|
| 중복 fingerprint → DB 저장 스킵 동작 | `tests/` (Java: `VulnerabilityServiceTest.java`) |
| VulnerabilityFoundEvent → session.vulnCount 자동 증분 | 동일 |

### ⏳ 통합/E2E 테스트 보류

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

## 스프린트 종료 전 직접 수행해야 할 항목

### 🔴 우선순위 높음 — 자동화 테스트 작성

- [ ] **`AiAgentClientTest.java`** — Circuit Breaker 단위 테스트 3개
  - 연속 3회 실패 → `circuitOpen=true`
  - OPEN 상태에서 `AI_AGENT_UNAVAILABLE` 즉시 throw
  - 30초 경과 후 HALF-OPEN → 성공 시 `circuitOpen=false`
- [ ] **`VulnerabilityServiceTest.java`** — 서비스 로직 단위 테스트
  - 중복 fingerprint 스킵 (mock repository)
  - `VulnerabilityFoundEvent` 발행 확인

### 🟠 우선순위 보통 — Docker 통합 테스트 (MCP 빌드 후)

- [ ] `test_vuln_save_e2e` — 분석 실행 → 취약점 저장 → DB 확인
  ```bash
  # 취약한 Java 파일 /workspace에 배치 후
  docker exec secureai-ai-engine python -m pytest tests/ -k integration
  ```
- [ ] SSE 스트림 수동 확인
  ```bash
  # 1. 먼저 JWT 토큰 발급 (POST /api/v1/auth/login)
  # 2. 프로젝트/세션 생성
  # 3. SSE 구독
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

# 로컬 (FastAPI 미설치 환경)
python -m pytest tests/agent/ tests/infrastructure/ -v
```
