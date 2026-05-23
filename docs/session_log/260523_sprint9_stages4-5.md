# Sprint 9 Stage 4~5 세션 로그 (2026-05-23)

**브랜치**: `feat/sprint9`  
**작업 범위**: Stage 4 (TASK-901) → Stage 5 (TASK-902 ∥ TASK-903)

---

## 주요 작업 순서

### 1. Stage 4 — 지속 모니터링 서비스 (TASK-901)

#### Dev 구현

신규 `domain/monitoring/` 도메인 전체 구현.

| 파일 | 내용 |
|------|------|
| `V043__create_monitoring_results.sql` | `monitoring_results` PARTITION BY RANGE(checked_at) 마스터 테이블 + `monitoring_results_2026_05` 첫 달 파티션 |
| `MonitoringResult.java` | 파티션 엔티티. `BaseTimeEntity` 미상속 — `checkedAt`이 파티션 키이므로 독립 필드 |
| `MonitoringStatus.java` | `UP / DOWN / SSL_EXPIRING / SSL_EXPIRED` enum |
| `SslCertChecker.java` | `javax.net.ssl.HttpsURLConnection` 기반 X.509 만료일 파싱, 5s 타임아웃 |
| `MonitoringService.java` | HTTPS 헬스체크 + SSL 판정 + Slack 알림. WebClient TCP 연결 타임아웃(`HttpClient` + `ReactorClientHttpConnector`) 적용 |
| `MonitoringJob.java` | `@Scheduled(cron="0 0 * * * *")` + `@SchedulerLock(name="monitoringJob", lockAtMostFor="PT50M")` |
| `MonitoringPartitionJob.java` | 매월 1일 다음 달 파티션 생성. DDL 전 정규식 화이트리스트 검증 |
| `MonitoringCveReMatchListener.java` | `@EventListener NvdSyncCompletedEvent` 구독 (SBOM 연계 후 구현 예정) |
| `NvdSyncCompletedEvent.java` | CVE 동기화 완료 ApplicationEvent 레코드 |
| `SlackNotificationPort.java` | `sendSslExpiryAlert` + `sendMonitoringDownAlert` 인터페이스 |
| `SlackWebhookAdapter.java` | `@ConditionalOnProperty(name="secureai.slack.webhook-url")` WebClient 구현체 |
| `SlackNotificationNoOp.java` | Webhook URL 미설정 시 no-op fallback |
| `MonitoringMetrics.java` | `secureai_monitoring_job_runs_total` Counter |

**수정 파일**: `NvdSyncJob.java`(이벤트 발행 추가), `ScanTargetRepository.java`(`findByVerifiedTrue()` 추가), `application.yaml`(`secureai.slack.webhook-url`), `build.gradle.kts`(`spring-boot-starter-webflux`)

#### Reviewer FAIL → 수정 사항

| # | 지적 | 수정 |
|---|------|------|
| 1 | `MonitoringPartitionJob` DDL String 포맷 검증 미비 | `PARTITION_NAME_PATTERN` + `DATE_PATTERN` 정규식 화이트리스트 검증 추가 |
| 2 | status 매직 문자열 산재 (`"DOWN"`, `"UP"` 등) | `MonitoringStatus` enum 추출, `@Enumerated(EnumType.STRING)` 적용 |
| 3 | `MonitoringService`에 NVD 이벤트 핸들러 혼재 (SRP 위반) | `MonitoringCveReMatchListener` 별도 컴포넌트 분리 |
| 4 | WebClient `.block()` 타임아웃만 설정 — TCP 연결 타임아웃 미설정 | `HttpClient.create().option(CONNECT_TIMEOUT_MILLIS, 5000).responseTimeout(10s)` 추가 |

#### 단위 테스트 결과

| 테스트 | 결과 |
|--------|------|
| `MonitoringServiceTest` 5개 (verified 필터, HTTP UP/DOWN, SSL 알림, skip&log) | ✅ |
| `MonitoringCveReMatchListenerTest` 1개 (이벤트 수신 예외 없음) | ✅ |
| 회귀: CVE 4개, Notification 9개 | ✅ |

**커밋**: `5303b4d` `feat(sprint9/stage4): 지속 모니터링 서비스 HTTPS 헬스체크 + SSL 알림 + CVE 재매칭 (TASK-901)`

---

### 2. Stage 5 — VSCode Extension MVP + Android 고도화 (TASK-902 ∥ TASK-903)

TASK-902와 TASK-903는 독립 디렉토리(`apps/vscode_ext/` vs `apps/android/`)로 병렬 실행.  
TASK-903 Dev 에이전트 첫 번째 실행에서 소켓 연결 오류 발생 → 재실행으로 해소.

#### TASK-902 VSCode Extension MVP

신규 `apps/vscode_ext/` 디렉토리.

| 파일 | 내용 |
|------|------|
| `package.json` | `publisher: "secureai-local"`, `engines.vscode: "^1.85.0"`, `@vscode/vsce` devDep |
| `src/extension.ts` | `secureai.setToken`(SecretStorage 저장), `secureai.analyze`(withProgress 진행 표시) |
| `src/apiClient.ts` | Backend SAST API 폴링. `POLL_TIMEOUT_MS = 30_000` 타임아웃. JWT는 `Authorization` 헤더에만 사용 — 로그 완전 차단. URL은 `process.env['SECUREAI_API_URL']` 환경변수 우선 |
| `src/diagnosticProvider.ts` | `SEVERITY_MAP` 테이블 기반 `vscode.DiagnosticSeverity` 변환. 파일별 Diagnostic 그룹화 |
| `.vscodeignore`, `.gitignore`, `README.md` | 빌드 제외 설정 + 로컬 설치 절차 문서 |

TypeScript 컴파일(`npm run compile`) 성공, `out/` 6개 파일 생성 확인.

**Reviewer 판정**: PASS (필수 수정 없음)

#### TASK-903 Android 고도화

일부 파일(NotificationChannelConfig.kt, ChatScreen/ViewModel, SecureAiFcmService 채널 분기)은 첫 번째(실패) 에이전트 실행 중 이미 생성됨. 두 번째 실행에서 나머지 구현 완료.

| 파일 | 내용 |
|------|------|
| `NotificationChannelConfig.kt` | 3채널 분리: `analysis_completion`(기본음) / `vulnerability_critical`(TYPE_NOTIFICATION, IMPORTANCE_HIGH) / `monitoring_alert`(진동만) |
| `SecureAiApplication.kt` | `NotificationChannelConfig.createAll(this)` 추가 |
| `SecureAiFcmService.kt` | `resolveChannelId(type)` — `message.data["type"]`에 따라 3채널 분기 |
| `ChatScreen.kt` + `ChatViewModel.kt` | `SseClient.observeSession()` Flow 수집 → Compose LazyColumn 스트리밍. UUID 형식 검증 |
| `SharePdfIntent.kt` | `FileProvider.getUriForFile()` 경유. Path Traversal 방어: `canonicalFile + File.separator` 경계 검증 |
| `AndroidManifest.xml` | `FileProvider` 추가 (`exported=false`, `grantUriPermissions=true`) |
| `file_provider_paths.xml` | `reports/` 경로만 허용 |
| `NavGraph.kt` | `Screen.Chat` + `chat/{sessionId}` composable 라우트 등록 |

**Reviewer 판정**: PASS (필수 수정 없음, WARNING 2건: UUID 패턴 강화 + VSCode configuration 기여 권고)

**커밋**: `9b7cf5d` `feat(sprint9/stage5): VSCode Extension MVP + Android 고도화 (TASK-902, TASK-903)`

---

## 최종 커밋 목록 (2026-05-23)

| 커밋 | 내용 |
|------|------|
| `5303b4d` | feat(sprint9/stage4): 지속 모니터링 서비스 (TASK-901) |
| `23a66a3` | docs: Stage 4 체크리스트 업데이트 |
| `9b7cf5d` | feat(sprint9/stage5): VSCode Extension + Android 고도화 (TASK-902, TASK-903) |
| `ff6963b` | docs: Stage 5 체크리스트 업데이트 |

---

## 아키텍처 결정 사항

- **MonitoringPartitionJob 도메인 분리**: 기존 `PartitionMaintenanceJob`에 monitoring Repository를 직접 주입하면 도메인 간 의존 규칙 위반 → monitoring 도메인 자체 Job으로 분리 (설계 원칙 준수)
- **ScanTargetRepository 직접 주입 허용**: `MonitoringService`가 `dast` 도메인의 `ScanTargetRepository`를 직접 주입. SSRF 방어를 위한 화이트리스트 조회(`findByVerifiedTrue()`)가 인프라 Job 성격이므로 예외 케이스로 수용 (Reviewer 조건부 PASS)
- **MonitoringCveReMatchListener 분리**: `MonitoringService`에 이벤트 핸들러 혼재는 SRP 위반 → 별도 `@Component`로 분리. CVE 재매칭 로직은 SBOM 도메인 연계 후 구현 예정
- **SlackWebhookAdapter ConditionalOnProperty**: Webhook URL 미설정 환경(개발, CI)에서 NoOp으로 자동 대체 — 설정 누락으로 인한 빈 생성 오류 방지
- **VSCode Extension MVP 범위**: Marketplace 배포 메타데이터(publisher 계정, 서명)는 EPIC-MISC로 분리. 로컬 `.vsix` 빌드·설치 성공까지만 이번 스프린트 범위

---

## 잔여 수동 검증 항목

| 항목 | 관련 TASK |
|------|----------|
| Slack 채널 알림 포스팅 확인 (`SECUREAI_SLACK_WEBHOOK_URL` 설정 후) | TASK-901 |
| MonitoringJob 매시 정각 발화 + DB 저장 확인 | TASK-901 |
| Prometheus `secureai_monitoring_job_runs_total` 증가 확인 | TASK-901 |
| VSCode Extension `.vsix` 빌드 + 설치 + Diagnostic 표시 | TASK-902 |
| Android 스트리밍 응답 표시 (에뮬레이터/기기) | TASK-903 |
| Android PDF 공유 Intent 동작 | TASK-903 |
| Android 알림 채널 3개 확인 | TASK-903 |
| (이월) k6 부하 테스트 `make perf-test` | TASK-803 |
| (이월) OWASP ZAP Full Scan | TASK-804 |
| (이월) 2FA QR 스캔 | TASK-806 |
| (이월) Nginx HTTP→HTTPS 리다이렉트 | TASK-805 |
| (이월) GDPR 하드 삭제 30일 시뮬레이션 + 이메일 수신 | TASK-907 |
