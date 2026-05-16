# [2026-05-16] 작업 세션 요약

**브랜치**: `feat/sprint6`
**작업 범위**: Sprint 6 Stage 1–2 완료 — DAST Docker 샌드박스 + LangGraph 에이전트 + pgvector 임베딩

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| Stage 1: Python 익스플로잇 실행기 5종 | `executors/{sqli,xss,idor,ssrf,auth_bypass}_executor.py`, `dast_runner.py` |
| Stage 1: Java Docker 샌드박스 | `DockerSandboxManager.java`, `ContainerConfig.java`, `DockerClientConfig.java` |
| Stage 1: 도메인 검증 + Rate Limit | `DomainVerificationService.java`, `DistributedLockService.java`, `ScanTarget.java` |
| Stage 1: 엔티티 + Flyway | `ExploitResult.java`, `ScanStatus.java`, V026, V027 |
| Stage 2: DAST LangGraph 그래프 | `dast_node.py`, `notify_node.py`, `docker_tool.py`, `after_dast.py`, `dast_graph_builder.py` |
| Stage 2: DAST REST 레이어 | `DastController.java`, `DastExecutionService.java`, `ExploitResultPersister.java`, `DastResultHandler.java` |
| Stage 2: pgvector 임베딩 (FEAT-SEC-006) | `embedding_service.py`, `guidelines_client.py` 수정, `sync_guidelines.py`, V028 |
| 단위 테스트 | Backend 42개 + Python 21개 (전부 통과) |
| PR 생성 | [PR #70](https://github.com/ttogle918/secureai-editor/pull/70) |

---

## 2. 의논 내용 & 결정 맥락

### Flyway 버전 번호 사전 보정
V008/V011이 이미 다른 마이그레이션에 사용 중임을 착수 전에 발견.
V026 (dast_results), V027 (scan_targets), V028 (pgvector) 로 조정했다.

### dnsjava 대신 JDK JNDI 선택
`org.xbill.dns:dnsjava:3.6.1`을 `repo.spring.io/release`에서 resolve 시 401 오류 발생.
외부 의존성 없이 JDK 내장 `InitialDirContext` + `com.sun.jndi.dns.DnsContextFactory`로 DNS TXT 조회를 구현했다.

### Docker Java SDK 3.3.x API 변경 대응
`DockerClientBuilder.getInstance(String)` 생성자가 3.3.x에서 제거됨.
`DockerClientImpl.getInstance(DefaultDockerClientConfig, ApacheDockerHttpClient)` 패턴으로 교체했다.

### DockerClient DIP 위반 → Reviewer 지적으로 수정
초기 구현에서 `DockerSandboxManager`가 `DockerClient`를 내부에서 직접 생성했음.
Reviewer가 DIP 위반으로 지적 → `DockerClientConfig.java` `@Configuration`으로 `@Bean` 추출,
`@RequiredArgsConstructor`로 주입하도록 변경했다.

### Shell Injection 취약점 → Reviewer 지적으로 수정
`DastExecutionService.buildCommand()`에서 `req.targetUrl()`을 `String.format`으로 Python
인라인 스크립트에 삽입했던 구조가 Shell Injection 위험을 내포함.
수정 방향: 정적 Python 스크립트에서 `os.environ`으로 읽도록 변경하고,
사용자 입력은 Docker 환경변수(`DAST_VULN_TYPE`, `DAST_ENDPOINT`, `DAST_TARGET_URL`, `DAST_PARAMS`)로 분리 전달.

### DastController Repository 직접 의존 → Reviewer 지적으로 수정
Controller가 `ExploitResultRepository`를 직접 주입하여 `getResults` 조회에 사용했음.
`DastExecutionService.getResultsBySessionId()`로 이동하고 Controller는 Service를 경유하도록 수정했다.

### pgvector 임베딩 — fastembed 선택 이유
OpenAI/Voyage 임베딩은 추가 API 키 필요. fastembed는 ONNX 기반으로 API 키 없이
로컬에서 실행 가능한 `BAAI/bge-small-en-v1.5` (384차원)를 사용한다.
기존 `load_guidelines(target_stack)` 시그니처를 유지하면서 `search_guidelines_by_vuln_type()`을
additive하게 추가하여 SAST 파이프라인에 영향을 주지 않았다.

### Mockito strict mode 대응 (lenient 스텁)
`@BeforeEach`에서 `redisTemplate.opsForValue()` 스텁이 일부 테스트에서 불필요해
`UnnecessaryStubbingException` 발생. `lenient().when()` 패턴으로 해결했다.

---

## 3. 버그 수정 / 특이사항

| 버그 | 원인 | 해결 |
|------|------|------|
| `awaitStatusCode(Duration)` 컴파일 오류 | `WaitContainerResultCallback`은 Duration 미지원 | `awaitStatusCode(long, TimeUnit.SECONDS)` 로 변경 |
| `ExploitResult.status`가 String 타입 | 초기 구현 누락 | `@Enumerated(EnumType.STRING) ScanStatus status` 로 수정 |
| `targetUrl`, `payload`, `responseSnippet` 미암호화 | Reviewer ADR-009 지적 | `@Convert(converter = AesEncryptionConverter.class)` 추가 |
| `DastResultHandlerTest` XML 파싱 오류 (Windows BOM) | PowerShell XML 파싱 이슈 | Bash `grep`으로 우회, 실제 테스트는 정상 통과 |

---

## 4. 테스트 검증 결과 (이번 세션 실행)

### TASK-601 — Docker 샌드박스 (Docker CLI 검증)

| 상태 | 항목 | 방법 |
|------|------|------|
| [x] 🔬 | Docker 컨테이너 생성→실행→삭제 사이클 완료 | Docker CLI (`docker run --rm alpine echo ok`) |
| [x] 🛡️ | host 네트워크 접근 차단 (`--internal` 플래그) | `docker network inspect dast-isolated-net` → `"Internal": true` 확인 |
| [x] 🛡️ | Docker Socket 접근 차단 (`securityOpt: no-new-privileges`) | ContainerConfig 코드 리뷰 (`withVolumes()` 없음 확인) |
| [x] 🔬 | 300초 초과 컨테이너 강제 종료 (시뮬레이션) | `awaitStatusCode(300, SECONDS)` + `removeContainerCmd` 코드 검증 |
| [ ] 🔬 | 메모리 512MB 초과 → OOMKilled | `make infra` + 실제 DAST 컨테이너 실행 필요 |
| [x] 🛡️ | AES-256-GCM 암호화 저장 확인 | DB 직접 조회 — `target_url`이 Base64(IV+암호문) 형태로 저장, 평문 미포함 확인 |
| [x] ✅ | 동시 3개 컨테이너 격리 확인 | dast-isolated-net에서 3개 컨테이너 동시 실행 → ping 8.8.8.8 `Network unreachable` 모두 확인 |

### TASK-602 — 도메인 검증 + Rate Limit (실제 Redis 통합 테스트)

| 상태 | 항목 | 방법 |
|------|------|------|
| [x] 🔬 | 미확인 도메인 DAST → 403 | 단위 테스트 (`DomainVerificationServiceTest`) 통과 + 코드 검증 |
| [x] 🔬 | 1시간 내 3회 허용, 4번째 → 429 | `DomainVerificationRedisIT` 실제 Redis 통합 테스트 통과 |
| [x] 🔬 | 동시 DAST 2회 → 409 (분산 락) | `DomainVerificationRedisIT` 실제 Redis 통합 테스트 통과 |
| [x] 🛡️ | 면책 동의 미체크 → ConsentRequiredException (Rate Limit 카운터 미증가) | `DomainVerificationRedisIT` 실제 Redis 통합 테스트 통과 |
| [x] 🛡️ | consent_ip 로그 미출력 확인 | `DomainVerificationService.java` 코드 리뷰 — `consentIp` 로그 없음 확인 |

### 비고

- **TestContainers on Windows**: `//./pipe/docker_cli` 400 오류로 TestContainers 우회 → 실행 중 Redis(`localhost:6379`) 직접 연결 방식으로 재구현
- **redis 통합 테스트 실행 조건**: `make infra` (Redis 6379 포트 활성화) + `REDIS_PASSWORD` 환경변수 필요
- **OOMKilled**: Docker Desktop Windows(WSL2) cgroup 메모리 강제 종료 미지원 — Linux 프로덕션 환경에서만 동작. `withMemory()` 코드 검증 완료.
- **추가 버그 수정 (이번 검증 세션)**:
  - `GitHubWebhookService.webhookMac`: Spring Boot 4/Spring 6에서 null 반환 Bean 미등록 처리 → `@Nullable` 주입으로 수정
  - `AesEncryptionConverter`: `byte[]` 반환 → TEXT 컬럼 타입 불일치 → `String`(Base64) 반환으로 수정
  - `ExploitResultPersister.saveInitial()`: `UUID.randomUUID()` FK 위반 → `DastExecuteRequest`에 `sessionId` 추가
  - `V029` 마이그레이션: `dast_results`, `scan_targets` 에 `updated_at` 컬럼 추가 (`BaseTimeEntity` 호환)
  - `docker_tool.py`: `/api/internal/dast/execute` → `/api/v1/internal/dast/execute` 경로 수정 + `sessionId` 전달

---

## 5. Stage 3 완료 (이번 세션 추가)

### TASK-604 — DAST 터미널 UI & 결과 표시

| 항목 | 주요 파일 |
|------|---------|
| SSE 구독 훅 | `apps/frontend/src/hooks/useDastStream.ts` (신규) |
| 터미널 재작성 | `apps/frontend/src/components/analysis/DastTerminal.tsx` |
| 익스플로잇 배지 | `apps/frontend/src/components/analysis/VulnDetailPanel.tsx` |
| 스토어 확장 | `apps/frontend/src/store/useSecureStore.ts` |
| props 제거 | `apps/frontend/src/components/editor/EditorLayout.tsx` |
| 테스트 버그 수정 | `apps/frontend/src/hooks/__tests__/useSse.test.ts` |

**커밋**: `feat(frontend): DAST 터미널 SSE 스트리밍 + ANSI 컬러 + 익스플로잇 배지 추가`

### 이번 세션 결정 맥락

#### UUID 검증 추가 (Reviewer 지적)
`setDastSessionId`에 임의 문자열 유입 시 EventSource URL 경로 조작 가능성.
`/^[0-9a-f]{8}-[0-9a-f]{4}-...$/i` 패턴으로 UUID 형식 사전 검증 후 연결.

#### persist에서 런타임 상태 제외
`dastLogs`, `dastSessionId`, `dastExploitResults`는 localStorage 영속화 대상에서 제외.
DAST 실행 상태는 세션 간 공유 불필요 — partialize 목록에서 명시적으로 누락.

#### ANSI 파싱 방식 선택
`dangerouslySetInnerHTML` 대신 React span 엘리먼트 배열로 변환.
외부 라이브러리(`ansi-to-react` 등) 없이 30줄 인라인 함수로 구현.
XSS 안전 + 번들 크기 영향 없음.

## 6. 스프린트 외 추가 작업 (백로그 의논 세션)

### AuditLog 활성화

| 항목 | 주요 파일 |
|------|---------|
| AOP 활성화 + DB 저장 | `global/aop/AuditLogAspect.java` |
| @AfterThrowing 추가 | `global/aop/AuditLogAspect.java` |
| 엔티티 + 마이그레이션 | `AuditLogEntry.java`, `V030~V031` |
| DAST 보안 액션 추가 | `DastController.java` → `@AuditLog(DAST_START)` |
| 단위 테스트 | `AuditLogAspectTest.java` 10개 |

**결정 맥락**:
- `@AfterThrowing` 추가 이유: 실패한 DAST 시도(동의 없음, 도메인 미소유)도 감사 로그 필요. 성공/실패를 `outcome` 컬럼(V031)으로 구분.
- 감사 로그 저장 실패가 원 요청을 실패시키면 안 됨 → try-catch 격리, Reviewer FAIL 지적으로 `log.info`를 try 블록 안으로 이동.
- `actor_id` FK 없음: 사용자 탈퇴 후에도 감사 로그 보존이 컴플라이언스 요건.

### 백로그 V3 통합

| 항목 | 결과 |
|------|------|
| `07_SPRINT_BACKLOG_V3.md` 신설 | V2 + `13_BACKLOG_ADDITIONS.md` 통합 |
| EPIC-MISC 섹션 | `TASK-MISC-001` i18n 등록 (feat/i18n 브랜치) |
| feat/sprint5-github 섹션 | TASK-501~505 별도 브랜치 진행 명시 |
| Sprint 8~9 확장 | TASK-806~809, TASK-904~906 추가 |
| 삭제 | `07_SPRINT_BACKLOG.md`(V1), `13_BACKLOG_ADDITIONS.md` |

**결정 맥락**:
- TASK-501~505: Sprint 7에 편입하면 용량 과부하 → `feat/sprint5-github` 브랜치로 독립 진행
- i18n: `feat/i18n` 브랜치에 커밋 있으나 백로그 미등록 → `EPIC-MISC` 신설로 공식화
- `14_SECURITY_TEAM_FEATURES.md`: 제품 스펙 문서이므로 삭제 대상 제외, 유지

## 7. 다음 세션에서 할 것

- [ ] **DVWA 시연 (M4)**: `docker run -d -p 8888:80 dvwa/dvwa` + 실제 DAST 엔드투엔드 시연
- [ ] **PR #70 merge**: feat/sprint6 → main (사용자가 직접 수행)
- [ ] **Sprint 7 계획**: `/sprint 7` — PDF 리포트 + 대시보드 + Android MVP
- [ ] **feat/sprint5-github 브랜치**: TASK-501~505 개발 착수 (Sprint 7과 병행 또는 이후)

### 수동 검증 체크리스트 (인프라 필요)
```
make infra
docker network create --internal dast-isolated-net
# DVWA 실행: docker run -d -p 8888:80 dvwa/dvwa
# DAST 터미널 실시간 스트리밍 확인
# ANSI 컬러 렌더링 확인
# 익스플로잇 성공/실패 배지 확인
# AuditLog: make infra 후 로그인 → audit_logs 테이블 행 생성 확인
```
