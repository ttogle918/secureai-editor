# Sprint 9 — VSCode Extension & 모니터링 (Phase 3)
**기간**: 2026-05-23 ~ 2026-06-05 (Week 19–20)
**목표**: MCP 인프라 전환(PostgreSQL + Docker)으로 AI Agent 자율성 강화 → 운영 관측성(Prometheus + Grafana) → 규정 준수 자동화(GDPR 하드 삭제) → 지속 모니터링 서비스 → 클라이언트 확장(VSCode Extension + Android 고도화)

---

## 사전 발견 사항 (Dev 평가 결과 — 착수 전 보정)

| 항목 | 백로그 명세 | 실제 상태 | 조치 |
|------|-----------|---------|------|
| MCP 설정 파일 | TASK-904/905 `claude_code_config.json` | **파일 미존재** — AI Agent는 `apps/ai_engine/agents/utils/mcp_client.py`의 `MultiServerMCPClient` 사용 | 수정 대상을 `mcp_client.py`로 정정 |
| PostgreSQL MCP 패키지 | `@modelcontextprotocol/server-postgres` | **npm 공식 패키지 존재 여부 미확인** | Stage 0 #1에서 `npm info` 검증 필수. 미존재 시 `apps/mcp_server/src/`에 자체 툴 추가 |
| Docker MCP 패키지 | `@modelcontextprotocol/server-docker` | **동일 — 존재 여부 미확인** | Stage 0 #2에서 검증 필수. 미존재 시 자체 구현 |
| `docker_tool.py` 구조 | "SDK 우회 제거" | 실제는 **Backend `/api/v1/internal/dast/execute` HTTP 호출 클라이언트** (httpx) | TASK-905는 단순 SDK 교체가 아니라 AI Engine → Backend HTTP → Docker SDK 경로를 AI Engine → MCP → Docker 직결로 바꾸는 **아키텍처 차원 변경** |
| Prometheus 의존성 | TASK-906 미명시 | **`micrometer-registry-prometheus` (backend), `prometheus-fastapi-instrumentator` (ai_engine) 모두 부재** → `/actuator/prometheus` 404 | TASK-906 첫 번째 하위 할일로 의존성 추가 명시 |
| GDPR 소프트 삭제 API | TASK-907 "30일 경과 하드 삭제" | `GdprService.deleteAccount()`가 **즉시 하드 삭제** 수행 중. `User.deletedAt` 컬럼은 있으나 사용 안 됨 | TASK-907 하위 할일 0번째에 `GdprService` 소프트 삭제 전환 선행 작업 추가 |
| `NotificationPort` 위치 | Stage 0 #7 신규 인터페이스 | `apps/backend/.../domain/notification/`에 `FcmPushPort.java`가 이미 존재 | 신규 도메인이 아닌 **기존 `notification` 도메인 확장** — `FcmPushPort`와 같은 위치에 `SlackNotificationPort` 추가 |
| `ChatScreen.kt` | TASK-903 "스트리밍" | **현재 파일 미존재** — `AnalysisViewModel.kt`와 `SseClient.kt`는 존재 | TASK-903은 신규 파일 생성 (Manifest `FileProvider` 선언 + `res/xml/file_provider_paths.xml` 추가 포함) |
| VSCode Extension 메타데이터 | TASK-902 vsce 초기화 | `vsce` → 현재 `@vscode/vsce`로 명칭 변경. `publisher` ID, `engines.vscode` 등 manifest 필수 필드 미정 | **MVP 범위 축소**: 로컬 `.vsix` 빌드·설치 성공까지. Marketplace 배포 메타데이터는 후속 EPIC-MISC로 분리 |
| `audit_logs` 스키마 | V042 "감사 로그 확장" | V030에서 이미 생성됨. 신규 테이블인지 컬럼 추가인지 불명 | V042는 **기존 `audit_logs`에 `action_type` enum에 `GDPR_HARD_DELETE` 값 확인 + `monitoring_results` 파티션 마스터 테이블 신규 생성**으로 정정 |
| `MonitoringJob` 스캔 방식 | TASK-901 "Passive 스캔" | 능동 컨테이너 실행 vs HTTP 헬스체크 미정 | **HTTP 헬스체크 + SSL X.509 파싱 + CVE 매칭 재실행**으로 한정. DAST 컨테이너 실행은 사용자 명시적 요청에만 (보안 + 비용 고려) |

---

## Flyway 번호 예약 (사전 확정으로 병렬 충돌 방지)

| 번호 | 태스크 | 파일명 | 비고 |
|------|--------|--------|------|
| V041 | TASK-904 | `V041__create_mcp_readonly_user.sql` | PostgreSQL Read-Only 계정 (`secureai_mcp_ro`) + `ALTER DEFAULT PRIVILEGES` |
| V042 | TASK-907 | `V042__add_gdpr_hard_delete_audit_action.sql` | `audit_logs.action_type`에 `GDPR_HARD_DELETE` 코드 사용 보장 (필요 시 enum/check 확장) |
| V043 | TASK-901 | `V043__create_monitoring_results.sql` | MonitoringResult 파티션 마스터 + 첫 달 파티션 |

---

## 스프린트 시작 전 완료 사항 (2026-05-22)

### PR #74 머지 대기 — Sprint 8 전체
- `feat/sprint8` → `main` PR #74 머지 후 Sprint 9 착수
- Sprint 8 자동 테스트: 332개 통과 (DomainVerificationRedisIT 4건은 인프라 의존, 코드 결함 아님)
- Sprint 8 잔여 수동 검증은 Sprint 9 진행과 병행 (`make perf-test`, OWASP ZAP, 2FA QR, Nginx HTTPS)

---

## 이월 태스크

| TASK | 출처 | 사유 | Sprint 9 처리 |
|------|------|------|---------------|
| 코드 이월 | Sprint 8 | 모든 코드 작업 완료 | — |
| `make perf-test` k6 (TASK-803) | Sprint 8 | 인프라 실행 필요 (수동) | Stage 2와 병행 (Prometheus 기동 후 효과적) |
| OWASP ZAP 스캔 (TASK-804) | Sprint 8 | 인프라 실행 필요 (수동) | Stage 2와 병행 |
| 2FA QR 스캔 수동 검증 (TASK-806) | Sprint 8 | UI 수동 확인 | Stage 3와 병행 |
| 보안 문서 PDF E2E (TASK-MISC-002) | Sprint 8 | 통합 환경 검증 | Stage 3와 병행 |
| Nginx HTTPS 리다이렉트 (TASK-805) | Sprint 8 | `make ssl-cert` + `make dev` | Stage 4와 병행 |
| FCM E2E 에뮬레이터 수동 검증 (TASK-705) | Sprint 7 | 사용자 수동 작업 | 전 스테이지와 병행 가능 |

---

## Stage 0 — 사전 결정 사항 (착수 전 확정)

> 코드 구현 없음. 아래 항목을 먼저 결정한 뒤 Stage 1 진입.

| # | 항목 | 내용 | 결정 |
|---|------|------|------|
| 1 | **PostgreSQL MCP 패키지 검증** | `npm info @modelcontextprotocol/server-postgres` 실행 → 존재 시 채택, 미존재 시 `apps/mcp_server/src/postgres_readonly.ts` 자체 구현 | Stage 1 착수 직전 검증 |
| 2 | **Docker MCP 패키지 검증** | `npm info @modelcontextprotocol/server-docker` 실행 → 존재 시 채택, 미존재 시 자체 구현 | Stage 1 착수 직전 검증 |
| 3 | **Read-Only PostgreSQL 계정명** | `secureai_mcp_ro` (Flyway V041) | ✅ 확정 |
| 4 | **MCP 설정 파일 위치** | `apps/ai_engine/agents/utils/mcp_client.py`의 `MultiServerMCPClient` 등록 블록 | ✅ 확정 |
| 5 | **TASK-905 아키텍처 결정** | Option A: AI Engine → MCP → Docker 직결 (Backend 경로 우회) / Option B: AI Engine → MCP → Backend → Docker (HTTP 유지, MCP는 thin wrapper) | **Option B 채택** — Backend의 `DastExecutionService` 권한·격리 정책 유지, DAST 권한 모델 변경 없음. MCP는 Backend HTTP를 호출하는 thin wrapper로만 사용 |
| 6 | **Prometheus 스크레이프 대상** | backend (`/actuator/prometheus`), ai_engine (`/metrics`), mcp_server (선택) — 최초 2개 필수 | ✅ 확정 |
| 7 | **Grafana 대시보드 프로비저닝** | JSON 파일 마운트 (`grafana/provisioning/dashboards/`) — git 버전 관리 | ✅ 확정 |
| 8 | **커스텀 메트릭 이름 컨벤션** | `secureai_analysis_sessions_total`, `secureai_analysis_duration_seconds`, `secureai_dast_success_total`, `secureai_monitoring_job_runs_total` | ✅ 확정 |
| 9 | **`NotificationPort` 위치** | 기존 `notification` 도메인에 `SlackNotificationPort` 인터페이스 + `SlackWebhookAdapter` 구현체 추가 (FcmPushPort와 동일 패키지) | ✅ 확정 |
| 10 | **MonitoringJob 스캔 방식** | HTTPS 헬스체크 + SSL X.509 만료일 파싱 + 등록 SBOM CVE 재매칭. **DAST 컨테이너 실행은 포함하지 않음** | ✅ 확정 |
| 11 | **GDPR 소프트 삭제 전환** | 기존 `POST /api/v1/users/me/gdpr/delete` 동작을 `deleted_at` 기록 + 비활성화로 변경. 즉시 하드 삭제 코드 제거 | ✅ 확정 — TASK-907 0번 하위 할일로 명시 |
| 12 | **VSCode Extension MVP 범위** | 로컬 `.vsix` 빌드 + VSCode `Install from VSIX` 설치 + Diagnostic 표시까지. Marketplace 배포 메타데이터는 EPIC-MISC로 분리 | ✅ 확정 |
| 13 | **OWASP ZAP 실행 환경** | `ghcr.io/zaproxy/zaproxy:stable` 로컬 Docker (Sprint 8 잔여 검증) | ✅ 확정 |
| 14 | **Flyway 번호 예약** | V041~V043 사전 예약 | ✅ 확정 |

---

## 실행 계획

### Stage 1 — MCP 인프라 전환 (순차 강제: `mcp_client.py` 공유)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| TASK-904 | PostgreSQL MCP 서버 도입 | ai_engine + (mcp_server 조건부) | `mcp_client.py`(MCP 서버 등록 — `postgres_ro`), `V041__create_mcp_readonly_user.sql`(`CREATE USER` + `GRANT SELECT` + `ALTER DEFAULT PRIVILEGES REVOKE INSERT,UPDATE,DELETE`), `apps/ai_engine/agents/sast/sast_node.py`(이전 동일 유형 취약점 조회 → state 주입), `apps/ai_engine/agents/patch/patch_node.py`(과거 패치 이력 조회), `.env.example`(`POSTGRES_MCP_URL` 추가), 조건부 `apps/mcp_server/src/postgres_readonly.ts`(Stage 0 #1 결과에 따라) | Stage 0 #1, #3, #4 |  |
| TASK-905 | Docker MCP 서버 전환 | ai_engine | `mcp_client.py`(MCP 서버 등록 — `docker_dast`), `apps/ai_engine/agents/dast/docker_tool.py`(Backend HTTP 호출을 MCP 도구 호출로 교체, Option B thin wrapper), SSE 로그 중계 개선 | Stage 0 #2, #5, TASK-904 |  |

**순차 강제 이유**:
- `mcp_client.py` 동일 파일 수정 → TASK-904가 먼저 PostgreSQL MCP 등록 블록을 추가하고, TASK-905가 이어서 Docker MCP 블록 추가 (Stage 0 #1·#2 검증 결과 반영)
- Sprint 8 TASK-808 OTel `tracer.start_as_current_span("sast_node")` 블록이 `sast_node.py`에 존재 → TASK-904 수정 시 span 내부에 MCP 호출 삽입하여 자동 보존 (별도 보존 작업 불필요)

**구성 근거**: Critical 등급 두 태스크를 첫 스테이지로 배치하는 이유는 MCP 전환이 AI Agent 아키텍처의 핵심 변경이기 때문이다. Stage 0 #5에서 Option B(thin wrapper)를 선택하여 Backend `DastExecutionService` 권한 모델을 유지하고, MCP는 호출 경로 추상화에만 사용한다. 이로써 ADR-005 DAST 격리 정책(`dast-isolated-net`) 변경 없이 MCP 전환이 가능하다.

**Reviewer 게이트**: Read-Only 계정에 불필요한 권한 부재(`pg_roles` 점검) + Docker MCP가 격리 네트워크 설정 파라미터를 우회하지 않는지 검증.

---

### Stage 2 — 운영 관측성 (High, 독립)

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-906 | Prometheus + Grafana 대시보드 | docker-compose + backend + ai_engine | **(0)** `build.gradle.kts`(`io.micrometer:micrometer-registry-prometheus`), `requirements.txt`(`prometheus-fastapi-instrumentator`), **(1)** `docker-compose.yml`(prom/prometheus + grafana/grafana 서비스, app-net), `prometheus.yml`(3 타겟: backend/ai_engine/mcp_server), `grafana/provisioning/datasources/prometheus.yaml`, `grafana/provisioning/dashboards/secureai.json`(4 패널: 분석 처리량·에러율·DAST 실행시간·AI 토큰), **(2)** backend `AnalysisService`/`DastExecutionService`에 `MeterRegistry` 커스텀 메트릭 4종 등록, **(3)** ai_engine `main.py`에 `Instrumentator().instrument(app).expose(app)` + LangGraph 노드 token usage 메트릭 | Stage 0 #6, #7, #8 |

**병렬 안전 조건**:
- Stage 1 종료 후 진입 권장 — Stage 1이 `docker-compose.yml`을 건드리지 않으므로 충돌은 없으나, MCP 서버가 Prometheus 타겟 후보가 되는 경우 Stage 1 커밋 확인 후 타겟 목록 확정
- Sprint 8 TASK-806 Micrometer Actuator endpoint(`/actuator/prometheus`)가 의존성 추가 즉시 활성화됨
- Stage 3와 병렬 가능 (파일 영역 분리)

**구성 근거**: Sprint 8 Jaeger(분산 트레이싱) 위에 Prometheus + Grafana를 도입하여 트레이스·메트릭·로그 3계층 관측성 완성. 첫 번째 하위 할일을 `build.gradle.kts` 의존성 추가로 명시한 이유는 Dev 평가에서 누락 시 전체 스테이지가 동작하지 않음을 확인했기 때문이다.

**이월 수동 검증 병행**: `make perf-test` k6 부하 테스트 및 OWASP ZAP 스캔을 Stage 2와 병행. Prometheus가 올라온 시점에 k6 결과를 Grafana에서 시각화하면 효과적.

---

### Stage 3 — GDPR 하드 삭제 스케줄러 (High, Stage 2와 병렬)

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-907 | GDPR 하드 삭제 스케줄러 | backend | **(0)** `GdprService.deleteAccount()` 소프트 삭제 전환 (`User.deletedAt = OffsetDateTime.now()` + refresh_tokens revoke + 즉시 삭제 코드 제거) + `GdprServiceTest` 수정, **(1)** `V042__add_gdpr_hard_delete_audit_action.sql`(필요 시 `audit_logs.action_type` enum 확장), **(2)** `GdprHardDeleteJob.java`(`@Scheduled(cron="0 0 4 * * *")` + `@SchedulerLock(name="gdprHardDelete", lockAtMostFor="PT30M", lockAtLeastFor="PT5M")`), **(3)** `GdprHardDeleteService.java`(배치 50건 단위, 감사 로그 선행 기록, 5개 테이블 연쇄 삭제, 개별 사용자 실패 시 skip & log), **(4)** `EmailService` 연동(삭제 완료 알림), **(5)** `GdprController.java` 확장(`GET /admin/gdpr/pending-deletions` — 페이지네이션) | Sprint 8 TASK-809(GDPR 소프트), TASK-801(ShedLock 인프라) |

**병렬 안전 조건**:
- Stage 2(`docker-compose.yml`, `prometheus.yml`)와 파일 영역 완전 분리 → Stage 2와 병렬 가능
- `GdprController.java`는 Sprint 8에서 생성됨 → 기존 파일에 admin 엔드포인트만 추가
- ShedLock `@SchedulerLock` 패턴은 Sprint 8 6개 Job과 동일 (`ExpiredDataCleanupJob` 참고)
- 0번 하위 할일(`GdprService` 소프트 삭제 전환)을 먼저 완료해야 하드 삭제 Job의 조회 대상이 존재함

**구성 근거**: TASK-907을 Stage 2와 병렬로 배치한 이유는 의존성이 완전히 다른 도메인(관측성 vs GDPR)이고 파일 충돌이 없기 때문이다. 단, 0번 하위 할일(소프트 삭제 전환)이 누락되면 하드 삭제 Job의 조회 대상이 0건이 되므로, Reviewer가 소프트 삭제 전환 완결성을 우선 점검해야 한다.

**Reviewer 게이트**: 삭제 트랜잭션 범위(배치 50건) + 감사 로그 선행 기록 순서 + 개별 실패 시 전체 Job 실패 금지 패턴 + 29일 경계 조건 단위 테스트.

**이월 수동 검증 병행**: 2FA QR 스캔 + 보안 문서 PDF E2E.

---

### Stage 4 — 지속 모니터링 서비스 (Medium, Stage 2 완료 후)

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-901 | 지속 모니터링 서비스 | backend | `V043__create_monitoring_results.sql`(파티션 마스터 + 첫 달 파티션, `MonitoringPartitionJob` 분리), `apps/backend/.../domain/monitoring/MonitoringJob.java`(`@Scheduled(cron="0 0 * * * *")` + `@SchedulerLock`), `MonitoringService.java`(HTTPS 헬스체크 + `SslCertChecker` + CVE 재매칭 호출), `MonitoringResult.java`(파티션 엔티티), `SslCertChecker.java`(`java.security.cert.X509Certificate` 파싱), `MonitoringPartitionJob.java`(매월 다음 달 파티션 생성), `notification` 도메인 확장: `SlackNotificationPort.java`(인터페이스), `SlackWebhookAdapter.java`(WebClient 구현), CVE 재매칭은 기존 `NvdSyncJob` 완료 이벤트(`NvdSyncCompletedEvent`)를 구독하여 트리거 | Stage 0 #9, #10, Stage 2(Prometheus 메트릭 발행), Sprint 8 TASK-801(ShedLock) |

**병렬 안전 조건**:
- 신규 도메인 `domain/monitoring/` — 기존 코드 영향 없음
- `NotificationPort`가 아닌 **기존 `notification` 도메인 확장** (Dev 평가 반영) — `FcmPushPort.java` 같은 패키지에 `SlackNotificationPort` 추가
- `MonitoringPartitionJob`을 별도로 분리한 이유: 기존 `PartitionMaintenanceJob`에 monitoring Repository를 직접 주입하면 도메인 간 의존 규칙(`general.md`) 위반 → 모니터링 도메인 자체 Job으로 분리
- ADR-008에 따라 모니터링은 Team/Enterprise 플랜 전용 → `@PreAuthorize` 플랜 체크 적용

**구성 근거**: TASK-901을 Stage 4로 배치한 이유는 Prometheus(Stage 2)가 먼저 올라와야 모니터링 Job 실행 횟수 메트릭(`secureai_monitoring_job_runs_total`)을 즉시 시각화·검증할 수 있기 때문이다. 단, 의존성 자체는 약함 — Stage 2가 지연되면 Stage 4 단독 진행 가능.

**스캔 방식 한정**: Dev 평가에 따라 능동 컨테이너 실행 제외. HTTPS 헬스체크 + X.509 파싱 + CVE 재매칭만 수행 → DAST 인프라 의존 없음.

**이월 수동 검증 병행**: Nginx HTTPS 리다이렉트.

---

### Stage 5 — 클라이언트 확장 (Low, 병렬)

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-902 | VSCode Extension 기초 (MVP 범위 한정) | 신규 `apps/vscode_ext/` | `apps/vscode_ext/package.json`(`@vscode/vsce` devDep, `publisher: "secureai-local"`, `engines.vscode: "^1.85.0"`, `activationEvents`, `contributes.commands`), `tsconfig.json`, `src/extension.ts`(`activate`/`deactivate`), `src/diagnosticProvider.ts`(`vscode.languages.createDiagnosticCollection`), `src/apiClient.ts`(Backend SAST API 호출, JWT 토큰 입력 명령), `.vscodeignore`, `README.md`(로컬 설치 절차), 빌드 산출물 `secureai-0.1.0.vsix` | Stage 1 완료(Backend API 안정화) |
| TASK-903 | Android 고도화 | `apps/android/` | `ChatScreen.kt`(신규 — `SseClient.kt` 재사용, Compose Flow 스트리밍), `AndroidManifest.xml`(`FileProvider` 선언), `res/xml/file_provider_paths.xml`(공유 경로 정의), `SharePdfIntent.kt`(PDF `Intent.ACTION_SEND` + `FileProvider.getUriForFile`), `NotificationChannelConfig.kt`(`analysis_completion`, `vulnerability_critical`, `monitoring_alert` 3개 채널 분리) | — |

**병렬 안전 조건**:
- TASK-902(`apps/vscode_ext/`) vs TASK-903(`apps/android/`) — 신규/독립 디렉토리 완전 분리
- TASK-902는 Stage 1 완료 후 착수 권장 — Backend API 응답 형식이 MCP 전환으로 변경될 가능성이 있으므로 안정화 후 클라이언트 작성
- TASK-903는 다른 서비스와 완전 독립 → Stage 1~4와 병렬 가능. 인력 여건에 따라 조정

**구성 근거**: Low 우선순위 태스크 2개를 마지막 스테이지로 배치. VSCode Extension MVP 범위를 **로컬 `.vsix` 빌드·설치 성공**까지로 한정하여 Marketplace 메타데이터(publisher 계정·서명 등) 부담 제거.

---

## 전체 실행 순서 요약

| 순서 | TASK | 제목 | 선행 | 에이전트 | 우선순위 |
|------|------|------|------|---------|---------|
| 1a | TASK-904 | PostgreSQL MCP 서버 도입 | Stage 0 #1,#3,#4 | Dev + Tester | 🔴 Critical |
| 1b | TASK-905 | Docker MCP 서버 전환 | Stage 0 #2,#5, TASK-904 | Dev + Tester | 🔴 Critical |
| 2 | TASK-906 | Prometheus + Grafana 대시보드 | Stage 0 #6,#7,#8 | Dev + Tester | 🟠 High |
| 3 | TASK-907 | GDPR 하드 삭제 스케줄러 | Sprint 8 (TASK-809, TASK-801) | Dev + Tester | 🟠 High |
| 4 | TASK-901 | 지속 모니터링 서비스 | Stage 2, Stage 0 #9,#10 | Dev + Tester | 🟡 Medium |
| 5a | TASK-902 | VSCode Extension 기초 (MVP) | Stage 1 완료 | Dev + Tester | 🟢 Low |
| 5b | TASK-903 | Android 고도화 | — | Dev + Tester | 🟢 Low |

**병렬 실행 그룹**:
- **Stage 1 (순차)**: TASK-904 → TASK-905 (`mcp_client.py` 공유)
- **Stage 2 + Stage 3 (병렬)**: TASK-906 ∥ TASK-907 (파일 영역 분리)
- **Stage 4 (Stage 2 완료 후)**: TASK-901
- **Stage 5 (병렬)**: TASK-902 ∥ TASK-903

---

## 리스크 분석

### 의존성 리스크

1. **`mcp_client.py` 순차 강제 (Stage 1)**: TASK-904와 TASK-905가 동일 파일 수정 → 순차 실행으로 충돌 회피. Stage 0 #1·#2 검증 결과(공식 패키지 존재 여부)에 따라 등록 블록 형태가 달라짐
2. **`sast_node.py` + `patch_node.py` OTel span 보존 (Stage 1)**: Sprint 8 TASK-808에서 추가된 `with tracer.start_as_current_span` 블록 내부에 MCP 호출을 삽입 → 자동 보존. Reviewer가 span 시작·종료 순서 점검 필수
3. **`GdprController.java` 확장 (Stage 3)**: Sprint 8에서 생성된 파일에 admin 엔드포인트 추가. 기존 사용자 엔드포인트(`/me/gdpr/*`)와 admin 엔드포인트(`/admin/gdpr/*`) 경로 명확 분리 + `@PreAuthorize("hasRole('ADMIN')")` 적용
4. **`docker-compose.yml` Stage 2 전용**: Stage 1에서 수정 없음 확인 후 Stage 2 착수. MCP 서버가 별도 컨테이너로 추가될 경우 Prometheus 타겟에 반영
5. **`application.yaml` 다중 접촉**: TASK-906(Prometheus 노출 설정), TASK-901(MonitoringJob cron) 동일 파일 수정. Stage 2 → Stage 4 순차 진행으로 자연스럽게 회피

### 기술 복잡도 리스크

6. **MCP 패키지 존재 검증 (Stage 0 #1·#2)**: 공식 패키지가 없으면 Stage 1 일정이 1~2일 추가 소요됨. Stage 0 진입 즉시 `npm info` 검증 후 분기 결정
7. **TASK-905 Option B thin wrapper 아키텍처**: AI Engine → MCP → Backend HTTP → Docker SDK 경로 유지. MCP를 단순 호출 경로 추상화로만 사용하여 DAST 권한 모델 변경 회피
8. **PostgreSQL MCP Read-Only 권한 (TASK-904)**: `GRANT SELECT ON ALL TABLES` + `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM secureai_mcp_ro` 모두 필수. 신규 테이블에도 자동 적용 보장
9. **Prometheus FastAPI 메트릭 엔드포인트 (TASK-906)**: `prometheus-fastapi-instrumentator` 라이브러리가 `requirements.txt`에 없음 → Stage 2 첫 하위 할일로 추가. AI 토큰 사용량은 Claude API 응답 헤더에서 수동 수집 → Counter로 발행
10. **GDPR 소프트 삭제 전환 (TASK-907 #0)**: 기존 즉시 하드 삭제 API 사용자가 있을 경우 동작 변경됨. 변경 사항을 `CHANGELOG.md`에 명시 + API 문서 갱신. 단위 테스트 `GdprServiceTest` 수정 필수
11. **GDPR 연쇄 삭제 트랜잭션 범위 (TASK-907 #3)**: `users`, `vulnerabilities`, `analysis_sessions`, `exploit_results`, `reports` 5개 테이블 연쇄 삭제 → 배치 50건 단위 트랜잭션 + 개별 사용자 실패 시 skip & log (전체 Job 실패 금지 — `general.md` 규칙)
12. **MonitoringJob SSL 파싱 + CVE 재매칭 (TASK-901)**: HTTPS 연결 타임아웃이 짧을 경우 매시 스캔에서 네트워크 오류 누적 가능 → 개별 대상 실패 시 skip & log. CVE 재매칭은 `NvdSyncJob` 완료 이벤트를 ApplicationEvent로 구독
13. **VSCode Extension 빌드 환경 (TASK-902)**: 모노레포 루트 `package.json` workspace 설정 검토. `@vscode/vsce` 글로벌 설치 대신 devDep로 처리하여 재현성 확보

### 보안 리스크

14. **MCP PostgreSQL 연결 정보 노출 (TASK-904)**: `mcp_client.py`에 DB 연결 문자열 직접 기입 금지 → `os.getenv("POSTGRES_MCP_URL")` 환경변수 참조. `.env`만 저장하고 `.env.example`에는 placeholder
15. **Docker MCP 소켓 노출 (TASK-905, Option B 채택으로 완화)**: Option B에서는 AI Engine이 `/var/run/docker.sock`에 직접 접근하지 않고 Backend HTTP를 거치므로 Sprint 6에서 확정된 격리 정책 그대로 유지. Option A 채택 시에는 AppArmor/Seccomp 추가 필요했음 (회피됨)
16. **GDPR 하드 삭제 29일 경계 (TASK-907)**: `deleted_at + 30 days <= NOW()` 쿼리에서 타임존 불일치 → DB 타임존 UTC 통일 확인 + 단위 테스트에서 29일 23시간 59분 / 30일 0분 경계값 명시 검증
17. **MonitoringJob 외부 URL 호출 (TASK-901)**: SSRF 위험 → `ScanTarget.markVerified()` 도메인 소유권 확인이 통과된 도메인만 모니터링 대상으로 등록 (Sprint 6 인프라 재사용)

---

## 스프린트 테스트 마일스톤

| 마일스톤 | 기준 |
|---------|------|
| **Stage 1 게이트** | MCP PostgreSQL로 SAST 이전 취약점 참조 응답 확인 + Read-Only 계정 `INSERT` 거부 (psql 직접 시도) + MCP Docker로 DAST 컨테이너 생성·실행·삭제 전체 사이클 1회 성공 + `docker_tool.py`에서 직접 httpx 호출 코드 0줄 잔존 (모두 MCP 경유) + Sprint 8 OTel span이 `sast_node.py`에서 정상 작동 |
| **Stage 2 게이트** | Prometheus UI `http://localhost:9090/targets` 전체 UP + Grafana 대시보드 4개 패널 표시 + `secureai_analysis_sessions_total` 카운터가 분석 1회 실행 후 증가 |
| **Stage 3 게이트** | `GdprService.deleteAccount()` 호출 후 `User.deletedAt` 기록 확인 + `GdprHardDeleteJob` 단위 테스트: 30일 초과 계정 선택 정확성 + 29일 계정 제외 + ShedLock 다중 인스턴스 1회 실행 + 감사 로그 기록 순서(삭제 전 로그 → 삭제) + 삭제 완료 이메일 발송 |
| **Stage 4 게이트** | 매시 MonitoringJob 수동 트리거 → HTTPS 헬스체크 + SSL 만료일 파싱 결과 `monitoring_results` 저장 + SSL 만료 30일 전 알림 시뮬레이션(만료일 조작) → Slack Webhook 포스팅 확인 + Prometheus에서 `secureai_monitoring_job_runs_total` 증가 |
| **Stage 5 게이트** | VSCode Extension `.vsix` 빌드 성공 + `code --install-extension secureai-0.1.0.vsix` 설치 + 명령 팔레트에서 "SecureAI: Analyze" 실행 → Problems 탭에 취약점 1건 이상 + Android 스트리밍 응답 표시 + PDF 공유 Intent 동작 |
| **Sprint 8 이월 수동 검증** | `make perf-test` k6 p95 < 500ms (Stage 2 병행) + OWASP ZAP Critical 0건 (Stage 2 병행) + 2FA QR 스캔 성공 (Stage 3 병행) + 보안 문서 PDF E2E (Stage 3 병행) + Nginx HTTPS 리다이렉트 (Stage 4 병행) |
| **Sprint 9 완료** | 위 5개 게이트 + Sprint 9 완료 기준 모두 통과 |

---

## Sprint 9 완료 기준

- [ ] **PostgreSQL MCP**: AI Agent가 이전 동일 유형 취약점을 DB에서 직접 조회하여 분석 컨텍스트로 활용 (Read-Only 권한 격리 확인)
- [ ] **Docker MCP**: DAST 컨테이너 생명주기가 MCP 경유로 호출 (Option B thin wrapper), `docker_tool.py` 직접 httpx 호출 코드 제거
- [ ] **Prometheus + Grafana**: 3개 서비스 타겟 UP + 커스텀 메트릭 4종 대시보드 표시
- [ ] **GDPR 소프트→하드 삭제 분리**: 사용자 즉시 삭제 → 소프트 삭제로 전환 + 30일 경과 시 자동 하드 삭제 + 감사 로그 기록
- [ ] **지속 모니터링**: 매시 HTTPS 헬스체크 + SSL 만료 30일 전 Slack 알림 + CVE 재매칭 동작
- [ ] **VSCode Extension MVP**: `.vsix` 패키지 빌드 + 로컬 설치 성공 + Diagnostic 표시
- [ ] **Android 고도화**: 채팅 스트리밍·PDF 공유·알림 채널 3종 분리 완료
- [ ] **Sprint 8 이월 수동 검증**: k6 p95 < 500ms + OWASP ZAP Critical 0건 + 2FA QR + Nginx HTTPS + 보안 문서 PDF E2E

---

## 실행 명령어

```
/stage 1   — TASK-904 (PostgreSQL MCP) → TASK-905 (Docker MCP) 순차
/stage 2   — TASK-906 (Prometheus + Grafana)
/stage 3   — TASK-907 (GDPR 소프트 삭제 전환 → 하드 삭제 스케줄러)  ※ Stage 2와 병렬 가능
/stage 4   — TASK-901 (지속 모니터링 서비스)
/stage 5   — TASK-902 (VSCode Extension MVP) + TASK-903 (Android 고도화)
```

**병행 권장 타이밍**:
- `make perf-test` k6 + OWASP ZAP → `/stage 2` 시작 직후 (Prometheus 기동 후)
- 2FA QR 스캔 + 보안 문서 PDF E2E → `/stage 3` 진행 중
- Nginx HTTPS 리다이렉트 → `/stage 4` 진행 중

---

## 에이전트 평가 요약

### PM 에이전트 (스테이지 설계)
- 7개 태스크를 5개 스테이지로 배치, Critical → High → Medium → Low 순서
- Stage 0 사전 결정 사항 14건 명시로 착수 후 결정 지연 방지
- 이월 수동 검증을 스테이지별 병행 타이밍에 매칭

### Dev 에이전트 (현실성 평가)
- **계획 수정 필요: Y** — 6건의 중대한 실제 코드 베이스 불일치 발견
  1. `claude_code_config.json` 미존재 → `mcp_client.py` 사용
  2. MCP 공식 패키지 존재 미확인 → Stage 0 검증 추가
  3. `docker_tool.py`는 SDK가 아닌 Backend HTTP 호출 → Option B thin wrapper로 아키텍처 결정
  4. Prometheus 의존성 부재 → 첫 하위 할일로 명시
  5. `GdprService` 즉시 하드 삭제 → 소프트 삭제 전환 선행 작업 추가
  6. `ChatScreen.kt` 미존재 + VSCode publisher ID 미정 → 신규 파일·MVP 범위 명시
- 모든 수정 사항을 본 계획에 반영 완료

---

*Sprint 9 계획 작성일: 2026-05-22 (Sprint 8 종료 직후, PR #74 머지 대기)*

---

## Stage 1 완료 기록 (2026-05-22)

### TASK-904 — PostgreSQL MCP 서버 도입

**구현 내용**:
- `mcp_client.py`: `contextlib.AsyncExitStack` 기반 멀티서버 MCP 세션 관리. `MultiServerMCPClient.__aenter__` 가 복수 서버에서 `NotImplementedError` 발생하는 한계를 AsyncExitStack으로 우회.
- `settings.py`: `postgres_mcp_url` 필드 추가 — 비어 있으면 PostgreSQL MCP 서버 미기동, 분석 계속.
- `sast_node.py`: `_fetch_prev_vuln_context()` 추가. UUID 검증 (`str(_uuid.UUID(...))`) 후 f-string SQL 조립 — `@modelcontextprotocol/server-postgres` 의 `query` 툴이 파라미터 바인딩 미지원이므로.
- `patch_node.py`: `_fetch_prev_patch_example()` 추가 + OTel span 스코프 수정 (실제 작업이 `with tracer.start_as_current_span()` 블록 내부에 있어야 DB 조회 시간도 트레이싱에 포함됨).
- `V041__create_mcp_readonly_user.sql`: `secureai_mcp_ro` 읽기 전용 계정 생성, `GRANT SELECT`, `ALTER DEFAULT PRIVILEGES REVOKE INSERT,UPDATE,DELETE`.
- `application.yaml`: `spring.flyway.placeholders.mcp-ro-password` 추가.
- `.env.example`: `POSTGRES_MCP_URL`, `MCP_RO_PASSWORD` 추가.

**Stage 0 검증 결과**:
- `@modelcontextprotocol/server-postgres` v0.6.2 → npm 공식 패키지 존재 → `npx -y` 채택 (자체 구현 불필요).
- `@modelcontextprotocol/server-docker` → npm 미존재 → `mcp-server-docker` v1.0.0 채택 (TASK-905).

### TASK-905 — Docker DAST MCP thin-wrapper 구현

**구현 내용**:
- `apps/mcp_server/src/dast/dast_backend.ts`: `run_dast_in_sandbox` MCP 툴. Backend `/api/v1/internal/dast/execute` HTTP 내부 호출. AbortController 350초 타임아웃. `targetUrl`, `params`, `INTERNAL_API_KEY` 로그 출력 금지.
- `apps/mcp_server/src/index.ts`: 툴 등록 (ListTools + CallTool handler).
- `dast_node.py`: `_execute_dast()` 추가 — MCP `run_dast_in_sandbox` 툴 우선 시도, 미등록 시 httpx fallback (`run_dast_in_sandbox`).
- 기존 `filesystem` 서버 env에 `BACKEND_INTERNAL_URL`, `INTERNAL_API_KEY` 주입 — 별도 Docker MCP 서버 프로세스 불필요, 단일 `index.js`에서 파일시스템 + DAST 툴 통합 처리.

### 자동 테스트 결과

- `tests/agent/test_mcp_postgres_tools.py` — 11개 통과
- `tests/agent/test_dast_mcp_tool.py` — 10개 통과

### Reviewer 경고 및 수정

| # | 경고 | 수정 |
|---|------|------|
| 1 | `patch_node.py` OTel span 스코프 이탈 | 실제 작업을 `with` 블록 내부로 이동 |
| 2 | `_fetch_prev_patch_example()` 빈 except | `logger.debug()` 추가 |
| 3 | `dast_backend.ts` `errText` 선언 후 미사용 | 에러 메시지에 `errText` 포함 |
| 4 | `sast_node.py` `project_id` f-string SQL 직접 주입 | `str(_uuid.UUID(str(project_id)))` 검증 추가 |

**커밋**: `938ac29` `feat(sprint9/stage1): PostgreSQL MCP + Docker DAST MCP 연동 (TASK-904, TASK-905)`

---

## Stage 2 완료 기록 (2026-05-22)

### TASK-906 — Prometheus + Grafana 대시보드

**구현 내용**:
- `build.gradle.kts`: `io.micrometer:micrometer-registry-prometheus` 추가 → `/actuator/prometheus` 자동 노출
- `application.yaml`: `management.endpoints.web.exposure.include`에 `prometheus` 추가
- `AnalysisMetrics.java`: `infrastructure.metrics` 레이어 전용 컴포넌트 — `secureai_analysis_sessions_total`, `secureai_analysis_errors_total`, `secureai_dast_success_total`, `secureai_ai_tokens_total` Counter 4종
- `AnalysisService.java`: `AnalysisMetrics` 주입, 세션 시작/실패 계측
- `DastExecutionService.java`: `MeterRegistry` 주입, `secureai_dast_duration_seconds` Timer 히스토그램
- `requirements.txt`: `prometheus-fastapi-instrumentator==7.1.0` 추가
- `main.py`: `Instrumentator().instrument(app).expose(app)` 등록
- `internal_key_auth.py`: `_OPEN_PATHS`에 `"/metrics"` 추가 (Prometheus 스크레이핑 인증 면제)
- `docker-compose.yml`: ai_engine `ports: "8000:8000"` → `expose: "8000"` (외부 직접 접근 차단), prometheus/grafana 서비스 추가
- `prometheus.yml`: backend(`:8080/actuator/prometheus`), ai_engine(`:8000/metrics`) 스크레이프 설정
- `grafana/provisioning/`: Prometheus 데이터소스 + 대시보드 프로비저닝 (4개 패널)
- `.env.example`: `GF_SECURITY_ADMIN_PASSWORD=changeme_in_production` 추가

**Reviewer 경고 및 수정**:
| # | 경고 | 수정 |
|---|------|------|
| 1 | `GF_SECURITY_ADMIN_PASSWORD=admin` 하드코딩 | `${GF_SECURITY_ADMIN_PASSWORD:?}` 환경변수화 + `.env.example` 추가 |
| 2 | `/metrics` 인증 차단으로 Prometheus 수집 불가 | `_OPEN_PATHS`에 `/metrics` 추가 + ai_engine 포트 `expose` 전환 |

**단위 테스트**: 5개 통과
- `AnalysisMetricsTest` 3개
- `DastExecutionServiceTest` Timer 등록 테스트 1개
- `test_sast_node.py` 2개

**커밋**: `4992551` `feat(sprint9/stage2): Prometheus + Grafana 운영 대시보드 (TASK-906)`
