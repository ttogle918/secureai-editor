# Sprint 6 — DAST 엔진 & Docker 샌드박스
**기간**: 2026-05-15 ~ 2026-05-28 (Week 13–14)  
**목표**: Docker 샌드박스에서 5종 익스플로잇 실행, LangGraph DAST 에이전트, 실시간 터미널 UI

---

## 사전 발견 사항 (착수 전 보정)

| 항목 | 백로그 명세 | 실제 상태 | 조치 |
|------|-----------|---------|------|
| Flyway V008 | ExploitResult 테이블 | **이미 사용됨** (`create_analysis_progress_log`) | V026으로 변경 |
| Flyway V011 | ScanTarget 테이블 | **이미 사용됨** (`create_patch_suggestions`) | V027으로 변경 |
| DastTerminal.tsx | 신규 생성 | **이미 존재** (`components/analysis/DastTerminal.tsx`) | 기능 확장만 진행 |
| Sprint 5 이월 | TASK-501~505 GitHub 기능 | 미구현 (sprint-5.md 완료 기록 없음) | DAST는 독립적 → Sprint 6 진행 가능 |
| AI Engine Graph | DAST 노드 없음 | SAST 파이프라인만 존재 | 별도 DAST 그래프로 분리 구현 |

---

## 이월 태스크

Sprint 5 GitHub Layer 기능(TASK-501~505)은 DAST와 직접 의존성 없음.  
Sprint 6 완료 후 Sprint 7에서 처리 또는 병행.

---

## 실행 계획

### Stage 1 — Docker 인프라 + 보안 게이트 (병렬)

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-601-PY | Python 익스플로잇 실행기 | ai_engine | `executors/` 5종 + `dast_runner.py` | — |
| TASK-601-BE | Java Docker 샌드박스 관리 | backend | `DockerSandboxManager.java` + `ContainerConfig.java` + `ExploitResult.java` + V026 | — |
| TASK-602 | 도메인 소유권 확인 & Rate Limit | backend | `DomainVerificationService.java` + `ScanTarget.java` + V027 + `DistributedLockService.java` | — |

> **병렬 안전**: TASK-601-PY는 ai_engine/, TASK-601-BE와 TASK-602는 backend/ 내 서로 다른 패키지

---

### Stage 2 — DAST LangGraph 에이전트 + REST 연결

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-603-PY | DAST LangGraph 노드 구현 | ai_engine | `dast_node.py` + `notify_node.py` + `docker_tool.py` + `after_dast.py` + `dast_payload.jinja2` + `dast_graph_builder.py` | TASK-601-PY, TASK-601-BE |
| TASK-603-BE | DAST REST 컨트롤러 + 결과 핸들러 | backend | `DastController.java` + `DastResultHandler.java` | TASK-601-BE, TASK-602 |

> MCP-002 (Docker MCP): `docker_tool.py` 내에서 MCP 방식 또는 Docker SDK 직접 호출 선택 (로컬 개발은 SDK, 프로덕션은 MCP 전환 구조로 설계)

---

### Stage 3 — DAST 터미널 UI 확장

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-604 | DAST 터미널 UI + 결과 뱃지 | frontend | `DastTerminal.tsx` (확장) + 취약점 상세 DAST 섹션 + 익스플로잇 뱃지 | TASK-603 |

---

## 병렬 실행 그룹

```
Stage 1 (동시 시작 — 선행 의존성 없음)
├── TASK-601-PY : ai_engine executors + dast_runner.py
├── TASK-601-BE : backend DockerSandboxManager + V026
└── TASK-602    : backend DomainVerificationService + V027

           ↓ Stage 1 완료 후

Stage 2 (순차)
├── TASK-603-PY : ai_engine dast_node + notify_node + docker_tool + after_dast
└── TASK-603-BE : backend DastController + DastResultHandler
  (두 서비스 다른 파일이므로 병렬 가능, 단 603-PY가 603-BE API를 호출하므로 BE 선 완료 권장)

           ↓ Stage 2 완료 후

Stage 3 (순차)
└── TASK-604    : frontend DastTerminal.tsx 확장 + 뱃지
```

---

## 리스크 & 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| Docker 데몬 필요 (로컬 개발) | Stage 1 BE, Stage 2 통합 테스트 차단 | Docker Desktop 설치 확인 / CI에서 DinD 활용 |
| DVWA 수동 검증 환경 | M4 수동 테스트 차단 | `docker run -d -p 8888:80 dvwa/dvwa` 로 로컬 실행 |
| Flyway 번호 재정의 필요 | 스키마 충돌 | V026(ExploitResult), V027(ScanTarget) 사용 |
| Sprint 5 GitHub 미구현 | Webhook 트리거 없음 | DAST는 REST API 직접 트리거로 테스트 → Sprint 7에서 통합 |
| Docker 컨테이너 네트워크 격리 | 보안 핵심 요구사항 | `dast-isolated-net` 브리지 네트워크 강제 사용, host-network 비허용 확인 |

---

## 테스트 마일스톤

| # | 마일스톤 | 달성 기준 | TASK |
|---|---------|---------|------|
| M1 | Docker 샌드박스 동작 | 컨테이너 생성→실행→삭제 사이클 완료, 300초 타임아웃 동작 | TASK-601 |
| M2 | 도메인 소유권 게이트 | 미확인 도메인 403, 동시 요청 409, 4회 초과 429 | TASK-602 |
| M3 | DAST 에이전트 재시도 루프 | 취약점 → DAST 실행 → 실패 시 재시도 → 3회 후 포기 | TASK-603 |
| M4 ⭐ | DVWA 실제 시연 | DVWA SQL Injection → DAST 익스플로잇 성공 → 뱃지 표시 | TASK-603+604 |
| M5 | 보안 격리 검증 | 컨테이너 host 네트워크·Docker Socket 접근 차단 확인 | TASK-601 보안 |

---

## 완료 기준 (DoD)

```
[ ] 5종 익스플로잇 실행 (SQLi, XSS, IDOR, SSRF, Auth Bypass) ⭐
[ ] Docker 컨테이너 외부 접근 완벽 차단 (host-net, docker.sock) ⭐
[ ] 재시도 루프: 최대 3회 → dast_failed 처리
[ ] DastTerminal.tsx 실시간 SSE 스트리밍 + ANSI 컬러
[ ] 익스플로잇 성공 뱃지(빨간) / 실패 뱃지(회색) 표시
[ ] 단위·통합 테스트 모두 통과 (CI 그린)
```

---

## 구현 완료 기록

### Stage 1 완료 (2026-05-15)

**커밋**: `feat(dast): Sprint 6 Stage 1 — Docker 샌드박스 + 도메인 검증 + 익스플로잇 실행기`

#### TASK-601-PY: Python 익스플로잇 실행기
- `executors/sqli_executor.py`: httpx 비동기, DB 오류 문자열 탐지
- `executors/xss_executor.py`: XSS 반사형 페이로드 탐지
- `executors/idor_executor.py`: ID 조작 unauthorized 응답 탐지
- `executors/ssrf_executor.py`: `follow_redirects=False` SSRF 탐지
- `executors/auth_bypass_executor.py`: JWK alg=none / 빈 서명 JWT stdlib 전용
- `dast_runner.py`: Strategy 패턴 `_EXECUTOR_MAP` dict

#### TASK-601-BE: Java Docker 샌드박스
- `DockerSandboxManager.java`: docker-java 3.3.x 신규 API (`DockerClientImpl.getInstance`)
- `ContainerConfig.java`: record — networkMode="dast-isolated-net" 컴팩트 생성자 강제 검증
- `DockerClientConfig.java`: `@Bean DockerClient` — DIP 준수 (Reviewer 지적으로 추가)
- `ExploitResult.java`: `@Convert(AesEncryptionConverter)` on targetUrl/payload/responseSnippet
- `ScanStatus.java`: PENDING/RUNNING/SUCCESS/FAILED/TIMEOUT enum
- `V026__create_dast_results.sql`: UUID PK, AES 암호화 컬럼
- `V027__create_scan_targets.sql`: consent_ip INET, unique(project_id, domain)

#### TASK-602: 도메인 검증 + Rate Limit
- `DomainVerificationService.java`: DNS TXT 조회 (JDK JNDI, dnsjava 제거), Redis Rate Limit, 분산 락
- `DistributedLockService.java`: Redis SETNX TTL 300초
- `ScanTarget.java`: markVerified() / recordConsent() 도메인 메서드

**단위 테스트**: DistributedLockServiceTest 5개, DomainVerificationServiceTest 11개

---

### Stage 2 완료 (2026-05-16)

**커밋**: `feat(dast): Sprint 6 Stage 2 — DAST LangGraph 에이전트 + pgvector 임베딩 + REST 레이어`

#### TASK-603-PY: DAST LangGraph 에이전트
- `dast_node.py`: guidelines 로드 + docker_tool 호출
- `after_dast.py`: success→notify / retry_count<3→dast_node / else→notify 라우팅
- `notify_node.py`: Redis PUBLISH `secureai:dast:logs:{session_id}` SSE
- `docker_tool.py`: `POST /api/v1/internal/dast/execute` + X-Internal-Key
- `dast_graph_builder.py`: 싱글턴 LangGraph 그래프
- `api/routes/dast.py`: POST /agent/dast/start + GET /agent/dast/logs/{session_id}
- `dast_payload.jinja2`: DAST 페이로드 생성 프롬프트

#### TASK-603-BE: DAST REST 레이어
- `DastController.java`: Repository 직접 의존 제거 — Controller→Service→Repository 계층 준수 (Reviewer 지적)
- `DastExecutionService.java`: Shell Injection 수정 — 사용자 입력을 Docker 환경변수로 분리
  (`DAST_VULN_TYPE`, `DAST_ENDPOINT`, `DAST_TARGET_URL`, `DAST_PARAMS`)
- `ExploitResultPersister.java`: `@Transactional` self-invocation 방지를 위해 별도 `@Component`
- `DastResultHandler.java`: Redis PUBLISH 결과 브로드캐스트

#### FEAT-SEC-006: pgvector 임베딩
- `V028__add_pgvector_embedding_to_guidelines.sql`: CREATE EXTENSION vector, embedding vector(384), IVFFlat 코사인 인덱스
- `embedding_service.py`: fastembed BAAI/bge-small-en-v1.5 Lazy Singleton (API 키 불필요)
- `guidelines_client.py`: `search_guidelines_by_vuln_type()` 추가, 기존 `load_guidelines()` 시그니처 유지
- `sync_guidelines.py`: MD→DB 동기화 + 배치 임베딩 생성

**단위 테스트**: Backend 42개(DastControllerTest 7, DastExecutionServiceTest 8, DastResultHandlerTest 7, DistributedLockServiceTest 5, DomainVerificationServiceTest 11, ExploitResultPersisterTest 4) + Python 21개(test_dast_graph 15, test_dast_route 6)

**PR**: [#70](https://github.com/ttogle918/secureai-editor/pull/70)

---

### FEAT-SEC-006 Vector DB (pgvector) 완료
- Flyway V028: `CREATE EXTENSION IF NOT EXISTS vector` + `embedding vector(384)` 컬럼 추가
- `embedding_service.py`: fastembed BAAI/bge-small-en-v1.5 (384차원, ONNX, API 키 불필요)
- `guidelines_client.py`: `search_guidelines_by_vuln_type()` 추가 (기존 `load_guidelines` 유지)
- `sync_guidelines.py`: MD 파일 → DB 동기화 + 임베딩 생성 스크립트

**주의**: PostgreSQL에 pgvector 익스텐션 필요.
docker-compose.yml의 postgres 이미지를 `pgvector/pgvector:pg15` 또는 `pgvector/pgvector:pg16`으로 변경 필요.
