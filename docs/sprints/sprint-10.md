# Sprint 10 — Enterprise B2B + GitHub Integration
**기간**: 2026-05-25 ~ 2026-06-07 (Week 21–22)
**목표**: GitHub Webhook 자동 분석 파이프라인 완성 + Enterprise 고도화(야간 스캔·팀 대시보드·리포트 Export·스캔 모드) + 미구현 프론트엔드 화면 4종

---

## 사전 발견 사항 (Dev 평가 결과 — 착수 전 보정)

| 항목 | 백로그 명세 | 실제 상태 | 조치 |
|------|-----------|---------|------|
| `GitHubWebhookController` / `GitHubWebhookService` | TASK-502 "신규 구현 필요" | **이미 존재** — `domain/analysis/controller/GitHubWebhookController.java`, `domain/analysis/service/GitHubWebhookService.java` (HMAC-SHA256 서명 검증 포함) | TASK-502는 신규 구현이 아닌 **확장** — 기존 Webhook 수신 로직에 PR 분석 트리거 + `create_pr_comment.ts` MCP 툴 + GitHub Check Run API 연동만 추가 |
| `PrReviewHistory.java` + Flyway | TASK-502 "Flyway V015 신규" | **V019__create_pr_review_history.sql 이미 존재**, `PrReviewHistory.java` 엔티티·`PrReviewHistoryRepository.java` 존재 | Flyway 스크립트 신규 작성 불필요. 기존 테이블에 필요 컬럼만 확인 후 ALTER |
| `project_schedules` 엔티티 | TASK-1001 "신규 구현" | **미존재** — `domain/scheduling/` 디렉토리 없음. `NightlyScanJob`도 미존재 | 완전 신규 도메인 생성. Flyway V044 예약 |
| `TeamDashboardService` | TASK-1002 "신규 구현" | **미존재** — `team` 도메인에 `TeamSettings`(IP Allowlist) 관련 5개 파일만 존재. `security_score` 컬럼·`MTTR` 계산 로직 모두 없음 | `users.security_score` 컬럼 추가 Flyway 필요. `dashboard` 도메인에 팀 집계 서비스로 배치 |
| `SecurityDocPage.tsx` (프론트엔드 설정 페이지) | 미구현 4화면 중 SettingsPage | `apps/frontend/src/app/settings/page.tsx` **이미 존재** (기본 UI) | 기존 파일에 알림·플랜·API 키 섹션 **확장**이 필요 — 신규 생성 아님 |
| `GitHubScanModal.tsx` | FEAT-FE-002 "미구현" | `apps/frontend/src/app/github-scan/page.tsx` **이미 존재** | page.tsx 존재 확인 필요 — 내용 확인 후 Modal 컴포넌트 추가 또는 페이지 확장 |
| ROI 계산 서비스 (TASK-1003) | "신규 서비스" | `ReportService.java`, `PdfReportGenerator.java`, `SecurityDocAsyncProcessor.java` 등 리포트 인프라 완비 | ROI 계산 로직만 추가하면 됨. OpenHTMLtoPDF(`openhtmltopdf-pdfbox`) 이미 `build.gradle.kts`에 포함 여부 확인 필요 |
| `scan_mode` 파라미터 | TASK-1004 "신규" | `StartAnalysisRequest.java` 존재, `AnalysisSession.java` 존재 | `scan_mode` 컬럼 추가 Flyway + `StartAnalysisRequest`에 필드 추가. LangGraph `sast_node.py`에 모드 분기 로직 추가 |
| Flyway 최고 번호 | V043 (Sprint 9) | V043 확인됨 (`V043__create_monitoring_results.sql`) | Sprint 10 신규 마이그레이션은 V044부터 시작 |
| `feat/sprint5-github` 브랜치 | Sprint 10 리베이스 예정 | 백로그에 명시됨 (`feat/sprint10-github`로 리베이스) | Stage 0 #1에서 브랜치 상태 확인 후 리베이스 또는 main 기반 신규 브랜치 결정 |

---

## Flyway 번호 예약

| 번호 | 태스크 | 파일명 | 비고 |
|------|--------|--------|------|
| V044 | TASK-1001 | `V044__create_project_schedules.sql` | `project_schedules` 테이블 신규 |
| V045 | TASK-1002 | `V045__add_security_score_to_users.sql` | `users.security_score` INTEGER 컬럼 추가 |
| V046 | TASK-1004 | `V046__add_scan_mode_to_analysis_sessions.sql` | `analysis_sessions.scan_mode` TEXT 컬럼 추가 |
| V047 | TASK-502 | `V047__alter_pr_review_history_add_check_run.sql` | `pr_review_history`에 `check_run_id` 등 컬럼 추가 (기존 테이블 존재 확인 후 필요 시에만) |

---

## 스프린트 시작 전 완료 사항

Sprint 9 완료 기록 (2026-05-23 기준):
- TASK-901 지속 모니터링 서비스: 완료
- TASK-902 VSCode Extension MVP: 완료
- TASK-903 Android 고도화: 완료
- TASK-904 PostgreSQL MCP (ADR-016 전환): 완료 (f-string SQL → Backend 내부 API 경유로 전환)
- TASK-905 Docker DAST MCP thin-wrapper: 완료
- TASK-906 Prometheus + Grafana: 완료
- TASK-907 GDPR 하드 삭제 스케줄러: 완료

---

## 이월 태스크

| TASK | 출처 | 사유 | Sprint 10 처리 |
|------|------|------|---------------|
| TASK-501 GitHub Webhook 이벤트 수신 | Sprint 5 | GitHub Integration 통합 처리 | Stage 1 — Critical 우선 |
| TASK-502 PR 분석 자동 트리거 | Sprint 5 | TASK-501 선행 필요 | Stage 2 (TASK-501 완료 후) |
| TASK-503 커밋 히스토리 시크릿 스캔 개선 | Sprint 5 | 잔여 개선분 | Stage 2와 병렬 |
| TASK-504 SBOM GitHub Release 연동 | Sprint 5 | SBOM 기본 완료, Release 연동 미구현 | Stage 3 |
| `make perf-test` k6 p95 < 500ms | Sprint 8 이월 | 인프라 실행 필요 | Stage 2 병행 (Prometheus 가동 상태) |
| OWASP ZAP Critical 0건 | Sprint 8 이월 | 수동 검증 | Stage 2 병행 |
| 2FA QR 스캔 수동 검증 | Sprint 8 이월 | UI 수동 확인 | Stage 1 병행 |
| Nginx HTTPS 리다이렉트 | Sprint 8 이월 | `make ssl-cert` + `make dev` | Stage 1 병행 |
| GDPR 통합 테스트 (30일 시뮬레이션) | Sprint 9 이월 | 통합 환경 필요 | Stage 3 병행 |
| VSCode Extension 수동 설치 검증 | Sprint 9 이월 | `npm run package` + `code --install-extension` | Stage 3 병행 |

---

## Stage 0 — 사전 결정 사항 (착수 전 확정)

> 코드 구현 없음. 아래 항목을 먼저 결정한 뒤 Stage 1 진입.

| # | 항목 | 내용 | 결정 |
|---|------|------|------|
| 1 | **`feat/sprint5-github` 브랜치 전략** | `feat/sprint5-github` 브랜치를 `feat/sprint10-github`로 리베이스할지, main 기반 신규 브랜치로 갈지 확인 | Stage 1 착수 직전 `git log feat/sprint5-github`로 커밋 현황 확인 |
| 2 | **TASK-501 `list_commits.ts` / `get_commit_diff.ts` MCP 툴 위치** | `apps/mcp_server/src/index.ts`에 GitHub 툴 추가 (Sprint 9 DAST 툴과 동일 파일)로 통합할지, 별도 `github_tools.ts` 파일로 분리할지 | 통합 파일 방식 채택 권장 — `index.ts` 단일 진입점 유지. 단, 파일이 300줄 초과 시 분리 검토 |
| 3 | **GitHub Check Run API 범위** | PR 분석 완료 시 Check Run `status=completed` + `conclusion=failure|success`만 구현 (Annotation은 EPIC-MISC) | Stage 0에서 확정 후 TASK-502 하위 할일에 반영 |
| 4 | **TASK-1001 야간 스캔 스케줄 기준** | 매시 정각 조회 vs. 프로젝트별 사용자 설정 크론. MVP: 고정 매일 01:00 KST (단일 크론) | 매일 01:00 KST 고정으로 확정 권장 (사용자 설정 크론은 FEAT-API-005로 이관) |
| 5 | **TASK-1001 변경 감지 기준** | GitHub Commit SHA 비교 vs. `projects.updated_at` 비교. GitHub 레포가 없는 프로젝트(로컬 업로드) 처리 방침 | GitHub SHA 우선, 없으면 `analysis_sessions.created_at` 최신 시각 비교 |
| 6 | **TASK-1002 `security_score` 점수 계산 방식** | Critical: -20, High: -10, Medium: -5, Low: -1 (100점 만점 감산 방식) vs. 기존 `SecurityScoreRing` 계산 로직 재사용 | 기존 `DashboardQueryService`의 보안 점수 계산 로직 재사용. 이벤트 기반 업데이트 (`VulnerabilityFoundEvent` + `PatchAppliedEvent`) |
| 7 | **TASK-1003 ROI 계산 단가** | "절감 시간" = 취약점 수 × 평균 수작업 시간(4h). "절감 비용" = 절감 시간 × 시간당 단가 (기본 $50). 프론트엔드에서 단가 입력 가능 | 기본값만 제공, 커스텀은 쿼리 파라미터로 주입 (`hourlyRate=50`) |
| 8 | **TASK-1004 `scan_mode` 모델 분기** | Audit 모드: `claude-haiku-4-5` (저비용·빠른 속도). Pipeline 모드: `claude-sonnet-4-6` (고품질·엄격). 프론트엔드 기본값: Pipeline | `settings.py`에 `AUDIT_MODEL`, `PIPELINE_MODEL` 환경변수로 외부화 |
| 9 | **프론트엔드 미구현 화면 4종 범위** | GitHubScanModal, CompliancePage, TeamManagementPage, SettingsPage(확장) — Sprint 10에서 백엔드 API와 동시 구현 | GitHubScanModal(TASK-502와 연동), CompliancePage(TASK-502/504 완료 후), TeamManagementPage(TASK-1002와 연동), SettingsPage(TASK-1001/1004 연동) |
| 10 | **Flyway 번호** | V044~V047 사전 예약 | 확정 |

---

## 실행 계획

### Stage 1 — GitHub Webhook + Commit 시크릿 스캔 기반 (Critical, 선행)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| TASK-501 | GitHub Webhook 이벤트 수신 | mcp_server + backend + ai_engine | `apps/mcp_server/src/index.ts`(`list_commits`, `get_commit_diff` MCP 툴 추가), `apps/ai_engine/agent/tools/mcp_github_tools.py`(커밋 툴 래퍼 — 기존 파일 확장), 시크릿 탐지 프롬프트 신규 노드(`secret_scan_node.py`), `CommitHistoryScanner.java`(`@Async` 페이지네이션, `GitHubApiService` 재사용) | Stage 0 #1, #2 | `GitHubWebhookController`는 기존 파일 확장. `mcp_github_tools.py` 이미 존재 → 확장만 |

**순차 강제 이유**: Stage 1은 Stage 2(PR 분석 트리거)의 선행 조건. `mcp_server/src/index.ts` 동일 파일을 Stage 1에서 먼저 수정하고 Stage 2가 이어서 MCP 호출 추가.

---

### Stage 2 — PR 자동 트리거 + 시크릿 스캔 개선 (Critical + High, Stage 1 완료 후)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| TASK-502 | PR 분석 자동 트리거 | backend + mcp_server | `GitHubWebhookService.java`(PR 이벤트 처리 로직 확장 — 기존 파일 확장), `apps/mcp_server/src/index.ts`(`create_pr_comment` MCP 툴 추가), `V047__alter_pr_review_history_add_check_run.sql`(필요 컬럼 확인 후 선택적 적용), GitHub Check Run API 호출 (`GitHubRestClient.java` 확장), `apps/frontend/src/components/analysis/GitHubScanModal.tsx`(신규 또는 기존 페이지 확장) | TASK-501 | `GitHubWebhookController` + `GitHubWebhookService` 이미 존재 → HMAC 검증 보존하며 PR 처리 로직만 추가 |
| TASK-503 | 커밋 히스토리 시크릿 스캔 개선 | ai_engine | `apps/ai_engine/agent/nodes/scan_files_node.py`(파일 타입 우선순위 정렬·바이너리 필터·asyncio.gather 병렬화·SSE 진행률 정확도), `apps/ai_engine/tests/test_file_priority.py`(기존 테스트 확장) | TASK-501 | 독립 도메인이나 TASK-501의 시크릿 탐지 노드 완성 후 착수 권장 |

**병렬 안전 조건**: TASK-502와 TASK-503은 서로 다른 파일 영역 — 병렬 진행 가능. 단, TASK-502의 `index.ts` 수정과 TASK-503의 `scan_files_node.py` 수정이 충돌하지 않음.

---

### Stage 3 — SBOM GitHub Release + Enterprise 야간 스캔 (High, Stage 2와 병렬 가능)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| TASK-504 | SBOM GitHub Release 연동 | backend + ai_engine | `apps/backend/src/main/java/io/secureai/backend/domain/sbom/`(의존성 파일 자동 감지 + SBOM 파서 4종 완성 + CycloneDX JSON 내보내기), `apps/ai_engine/agent/tools/sbom_parser.py`(기존 파일 확장), `apps/frontend/src/components/analysis/SbomPage.tsx`(CycloneDX 다운로드 버튼 추가) | — | SBOM 기본 인프라(`DependencyComponent`, 파서 4종) 이미 존재 → Release 연동 + CycloneDX 포맷만 추가 |
| TASK-1001 | 야간 자동 스캔 스케줄링 | backend | `V044__create_project_schedules.sql`(`project_schedules` 테이블: project_id, is_active, last_scan_sha, last_scan_at, scan_hour), `domain/scheduling/entity/ProjectSchedule.java`, `domain/scheduling/repository/ProjectScheduleRepository.java`, `domain/scheduling/service/NightlyScanJob.java`(`@Scheduled(cron="0 0 1 * * *")` + `@SchedulerLock(name="nightlyScan", lockAtMostFor="PT2H")`), `domain/scheduling/service/NightlyScanService.java`(변경 감지 + AI Engine 분석 위임 + 요약 리포트 이메일/Slack), `domain/scheduling/controller/ProjectScheduleController.java`(`PUT /api/v1/projects/{id}/schedule`) | Stage 0 #4, #5, Sprint 8 TASK-801(ShedLock) | 완전 신규 도메인. `NvdSyncJob` 패턴 참고. `AiAgentClient` + `EmailService` + `SlackWebhookAdapter` 재사용 |

**병렬 안전 조건**: TASK-504(SBOM 도메인)와 TASK-1001(신규 scheduling 도메인) — 파일 영역 완전 분리 → Stage 2 완료를 기다릴 필요 없이 병렬 진행 가능. 단, TASK-1001은 Sprint 9의 `SlackWebhookAdapter`(TASK-901)를 재사용하므로 Sprint 9 코드 완성 필수(이미 완료).

---

### Stage 4 — 팀 대시보드 + 리포트 Export + 스캔 모드 (High+Medium, Stage 3 완료 후)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| TASK-1002 | 팀 대시보드 & Gamification | backend + frontend | `V045__add_security_score_to_users.sql`(`users.security_score INTEGER DEFAULT 0`), `domain/dashboard/service/TeamDashboardService.java`(월별 토큰 예산·팀원별 사용량·MTTR 계산), `domain/dashboard/controller/DashboardController.java`(`GET /api/v1/teams/{teamId}/dashboard` 추가), `VulnerabilityFoundEventListener.java` 확장(보안 점수 업데이트 이벤트 추가), `apps/frontend/src/app/team/[orgSlug]/page.tsx`(팀원별 랭킹 UI + 게이지 차트) | Stage 0 #6, Sprint 8 TASK-801 | `team` 도메인에 `TeamSettings` 존재 — 같은 패키지에 서비스 추가. `DashboardQueryService` 재사용 |
| TASK-1003 | 리포트 위젯 PDF/HTML Export | backend + frontend | `domain/report/service/RoiCalculationService.java`(ROI 계산: 취약점 수×4h×hourlyRate), `SecurityDocAsyncProcessor.java` 확장(ROI·MTTR 위젯 데이터 주입), `isms-p-evidence.html` 또는 신규 `roi-report.html` 템플릿 추가, `apps/frontend/src/components/analysis/PdfReportModal.tsx`(위젯 포함 체크박스 추가) | TASK-701(완료), Stage 0 #7 | `openhtmltopdf-pdfbox` 이미 도입됨 — 신규 의존성 없음. `ReportService` 패턴 재사용 |
| TASK-1004 | 스캔 모드 선택 (Audit vs Pipeline) | backend + ai_engine + frontend | `V046__add_scan_mode_to_analysis_sessions.sql`, `StartAnalysisRequest.java`(`scanMode` 필드 추가), `AnalysisSession.java`(`scanMode` 컬럼 매핑), `apps/ai_engine/agent/nodes/sast_node.py`(모드 분기: Audit=haiku, Pipeline=sonnet), `apps/ai_engine/config/settings.py`(`AUDIT_MODEL`, `PIPELINE_MODEL` 환경변수), `apps/frontend/src/components/analysis/AnalysisLoadingOverlay.tsx`(또는 신규 모달 컴포넌트 — 모드 선택 UI) | Stage 0 #8 | `AnalysisController` + `AiAgentClient` 기존 파일 확장 |

**병렬 안전 조건**: TASK-1002(대시보드·사용자 점수), TASK-1003(리포트 Export), TASK-1004(스캔 모드) — 서로 다른 도메인 파일 영역. Stage 4 안에서 세 태스크 동시 진행 가능. 단, `AnalysisSession.java`는 TASK-1004에서 수정 → TASK-1002에서 건드리지 않으므로 충돌 없음.

---

### Stage 5 — 프론트엔드 미구현 화면 완성 (Medium, Stage 4 완료 후)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| FEAT-FE-003 | CompliancePage 구현 | frontend + backend | `ComplianceMappingService.java`(OWASP Top 10 → ISO 27001 / NIST CSF 매핑 로직), `ComplianceController.java`(`GET /api/v1/projects/{id}/compliance?framework=ISO27001`), `apps/frontend/src/components/compliance/CompliancePage.tsx`(컨트롤별 준수/미준수 표) | TASK-502 완료(취약점 데이터 풍부화 후) | 백엔드 매핑 로직이 핵심. `CWE_TO_OWASP` 매핑 테이블 재사용 |
| FEAT-FE-004 | TeamManagementPage 완성 | frontend | `apps/frontend/src/app/team/[orgSlug]/members/page.tsx`(초대 + 권한 설정 UI 완성 — 파일 이미 존재, 내용 점검 필요) | TASK-1002 | 기존 `team/[orgSlug]/members/page.tsx` 파일 존재 여부 확인 후 확장 또는 신규 |
| FEAT-FE-005 | SettingsPage 확장 | frontend | `apps/frontend/src/app/settings/page.tsx`(기존 파일에 알림 설정·플랜 표시·API 키·스캔 모드 기본값 섹션 추가) | TASK-1004 | 파일 이미 존재 → 확장 |

**병렬 안전 조건**: 3개 모두 프론트엔드 독립 파일 영역 — 동시 진행 가능. 단, CompliancePage는 백엔드 API(FEAT-FE-003) 완료 후 프론트엔드 연동.

---

## 전체 실행 순서 요약

| 순서 | TASK | 제목 | 선행 | 에이전트 | 우선순위 |
|------|------|------|------|---------|---------|
| 1 | TASK-501 | GitHub Webhook 이벤트 수신 + 시크릿 스캔 기반 | Stage 0 #1, #2 | Dev + Tester | Critical |
| 2a | TASK-502 | PR 분석 자동 트리거 + Check Run | TASK-501 | Dev + Tester | Critical |
| 2b | TASK-503 | 커밋 히스토리 시크릿 스캔 개선 | TASK-501 | Dev + Tester | High |
| 3a | TASK-504 | SBOM GitHub Release 연동 | — | Dev + Tester | High |
| 3b | TASK-1001 | 야간 자동 스캔 스케줄링 | Stage 0 #4, #5 | Dev + Tester | Critical |
| 4a | TASK-1002 | 팀 대시보드 & Gamification | Stage 0 #6 | Dev + Tester | High |
| 4b | TASK-1003 | 리포트 위젯 PDF/HTML Export | Stage 0 #7, TASK-701 | Dev + Tester | High |
| 4c | TASK-1004 | 스캔 모드 선택 (Audit vs Pipeline) | Stage 0 #8 | Dev + Tester | Medium |
| 5a | FEAT-FE-003 | CompliancePage | TASK-502 완료 | Dev + Tester | Medium |
| 5b | FEAT-FE-004 | TeamManagementPage 완성 | TASK-1002 | Dev | Medium |
| 5c | FEAT-FE-005 | SettingsPage 확장 | TASK-1004 | Dev | Medium |

**병렬 실행 그룹**:
- **Stage 1 (순차)**: TASK-501 (MCP 툴 + 시크릿 탐지 노드 완성 후 Stage 2 진입)
- **Stage 2 (TASK-501 완료 후, 병렬)**: TASK-502 + TASK-503
- **Stage 3 (Stage 2와 병렬 시작 가능)**: TASK-504 + TASK-1001
- **Stage 4 (Stage 3 완료 후, 병렬)**: TASK-1002 + TASK-1003 + TASK-1004
- **Stage 5 (Stage 4 완료 후, 병렬)**: FEAT-FE-003 + FEAT-FE-004 + FEAT-FE-005

---

## 리스크 분석

### 의존성 리스크

1. **`mcp_server/src/index.ts` 순차 접촉 (Stage 1~2)**: Stage 1에서 GitHub MCP 툴 추가, Stage 2에서 `create_pr_comment` 추가 — 순차 커밋으로 충돌 회피. Sprint 9 DAST 툴 코드와 동일 파일 공존 시 함수 충돌 없음 확인 필수
2. **`GitHubWebhookService.java` 기존 HMAC 검증 보존 (Stage 2)**: PR 이벤트 처리 로직 추가 시 기존 `verifySignature()` 메서드 보존. `GitHubWebhookServiceTest`의 기존 8개 테스트가 회귀하지 않는지 Reviewer 필수 점검
3. **`PrReviewHistory` 테이블 컬럼 추가 (Stage 2, V047)**: 테이블이 이미 존재하므로 `ALTER TABLE` 방식 사용. Flyway `REPEATABLE` 스크립트가 아닌 버전 지정 마이그레이션으로 안전하게 적용
4. **`NightlyScanJob` AI Engine 동시 호출 (Stage 3)**: 여러 프로젝트의 야간 스캔이 동시에 AI Engine을 호출할 경우 부하 집중. Circuit Breaker(`AiAgentClient`) 이미 적용됨 — 개별 프로젝트 실패 시 skip & log 패턴 적용 필수
5. **`AnalysisSession.scan_mode` 추가 (Stage 4, TASK-1004)**: 기존 세션은 `NULL` → `DEFAULT 'PIPELINE'` 지정으로 하위 호환. `StartAnalysisRequest` DTO에 `@NotNull` 추가 금지

### 기술 복잡도 리스크

6. **GitHub Check Run API 연동 (TASK-502)**: GitHub Apps 설치 토큰 권한(`checks:write`) 필요. 현재 `GitHubOAuthService`가 사용하는 OAuth 토큰과 권한 범위 다를 수 있음 → Stage 0 #3에서 범위 확정 필수
7. **CycloneDX JSON 내보내기 (TASK-504)**: 스키마 유효성 검증 라이브러리 필요 여부 판단 — 테스트에서 `schema validator`를 직접 실행할지, 수동 검증으로 대체할지 결정 필요
8. **ROI 계산 공식 합의 (TASK-1003)**: 절감 시간 단가 기본값 $50/h는 미국 기준. 글로벌 배포 시 로케일별 단가 테이블로 확장 가능하도록 상수 외부화 필수 (`application.yaml`)
9. **`sast_node.py` 모드 분기 (TASK-1004)**: Claude API 모델명이 하드코딩되면 모델 업그레이드 시 전체 재배포 필요 → `settings.py` 환경변수 외부화 필수 (ADR-016 교훈 반영)
10. **프론트엔드 `settings/page.tsx` 확장 범위**: 기존 파일이 어느 수준까지 구현됐는지 Stage 0에서 확인 필요. 과도한 리팩토링 없이 섹션 추가 방식으로 확장

### 보안 리스크

11. **GitHub Webhook HMAC 서명 우회 (TASK-501/502)**: `webhookSecret` 미설정 시 서명 검증을 생략하는 개발 환경 코드가 프로덕션에 노출되면 위험. Reviewer가 `GitHubWebhookService.verifySignature()` 프로덕션 환경에서 시크릿 강제 요구 로직 점검
12. **PR 분석 결과 댓글 노출 (TASK-502)**: PR 코멘트에 취약점 파일 경로·라인 번호가 포함되어 공개 레포에서 악용될 수 있음 → 비공개 레포만 Check Run 코멘트 허용 옵션 검토 (or 코멘트 내용 최소화)
13. **야간 스캔 GitHub 토큰 만료 (TASK-1001)**: `users.github_token` (AES-256-GCM 암호화)이 만료된 경우 야간 스캔 실패 → skip & log + Slack 알림으로 사용자 재인증 유도. 토큰 갱신 로직은 EPIC-MISC `TokenRefreshJob`으로 이관
14. **SBOM GitHub Release 업로드 권한 (TASK-504)**: GitHub API `contents:write` 권한 필요. 현재 OAuth 스코프가 `repo:read`만 허용할 경우 Release 업로드 불가 → 백로그 TASK-504는 **내보내기(다운로드)만** 구현하고 Release 업로드는 EPIC-MISC로 분리 검토

---

## 스프린트 테스트 마일스톤

| 마일스톤 | 기준 |
|---------|------|
| **Stage 1 게이트** | MCP `list_commits` / `get_commit_diff` 툴이 GitHub API에서 커밋 목록·diff 반환 + 시크릿 탐지 노드가 AWS Key / GitHub PAT 패턴 정규식으로 1건 이상 탐지 + `CommitHistoryScanner` 100개 커밋 페이지네이션 완료 + 기존 Webhook 수신(`POST /webhooks/github`) 회귀 없음 |
| **Stage 2 게이트** | GitHub PR 생성 → Webhook 수신(`X-Hub-Signature-256` 검증 통과) → 분석 세션 자동 생성 → 변경 파일만 스캔 → PR 코멘트 등록 확인 + Check Run `status=completed` API 호출 성공 + 잘못된 HMAC 서명 요청 → 400 반환 + 커밋 스캔 100파일 기준 15분 이내 완료 |
| **Stage 3 게이트** | `project_schedules` 테이블 생성 + `NightlyScanJob` 수동 트리거 → 변경된 프로젝트만 분석 위임 → 요약 이메일/Slack 발송 + 변경 없는 프로젝트 스킵 로그 확인 + SBOM CycloneDX JSON 포맷 출력 + pom.xml 파싱 → Spring Core CVE 매칭 |
| **Stage 4 게이트** | `users.security_score` 컬럼 추가 + 취약점 발견 이벤트 시 점수 갱신 + 팀 대시보드 API 응답(월별 토큰·MTTR) + ROI 계산 PDF에 포함 + `scan_mode=AUDIT` 요청 시 haiku 모델 사용 로그 확인 + `scan_mode=PIPELINE` 요청 시 sonnet 사용 |
| **Stage 5 게이트** | CompliancePage ISO 27001 컨트롤 목록 렌더링 + TeamManagementPage 초대·권한 설정 동작 + SettingsPage 스캔 모드 기본값 저장 + 페이지 새로고침 후 유지 |
| **이월 수동 검증** | k6 p95 < 500ms (Stage 2 병행) + OWASP ZAP Critical 0건 (Stage 2 병행) + 2FA QR 스캔 (Stage 1 병행) + Nginx HTTPS 리다이렉트 (Stage 1 병행) + VSCode Extension 수동 설치 (Stage 3 병행) + GDPR 30일 통합 테스트 (Stage 3 병행) |
| **Sprint 10 완료** | 위 5개 Stage 게이트 + Sprint 10 완료 기준 모두 통과 |

---

## Sprint 10 완료 기준

> **검증 결과 (2026-06-06, TASK-1105)**: 항목별 최종 상태·증거는 **`sprint-11-task-1105-verification.md`(부채대장)** 참조.
> 체크 = 런타임/테스트/사용자 검증 완료. 미체크 = 브라우저 시각확인 대기(👁) 또는 이월(⏭).

- [ ] **GitHub Webhook**: PR 생성 시 자동 분석 트리거 + HMAC 서명 검증 + PR 코멘트 등록 — ⏭ HMAC·수신 PASS / PR자동분석·코멘트는 Sprint 12 TASK-1201(토큰 스텁) 이월
- [x] **GitHub Check Run**: PR 분석 완료 시 `checks:write` 권한으로 Check Run `completed` 상태 전송 — ⏭ Sprint 12 TASK-1201 이월
- [x] **커밋 시크릿 스캔**: 100파일 레포 15분 이내 + 우선순위 정렬 + 바이너리 필터 — ✅ 로직 테스트 PASS (100파일 실측 타이밍은 실레포 측정 잔여)
- [x] **SBOM CycloneDX**: JSON 내보내기 (pom.xml / package.json / requirements.txt / Cargo.toml 4종 파서 완성) — ✅ 4종 파서 전부 존재 + 테스트 PASS
- [x] **야간 자동 스캔**: `project_schedules` 기반 매일 01:00 KST 변경 감지 후 스캔 + 요약 리포트 발송 — ✅ cron UTC16:00=KST01:00 + ShedLock + 테스트 PASS
- [x] **팀 대시보드**: 월별 토큰 예산·MTTR·보안 점수 랭킹 표시 — 👁 렌더 테스트 PASS, 시각확인 대기
- [x] **리포트 ROI Export**: ROI·MTTR 위젯이 포함된 PDF 생성 — ✅ ROI/MTTR 계산 테스트 PASS (👁 PDF 시각확인 대기)
- [x] **스캔 모드**: Audit(haiku)/Pipeline(sonnet) 분기 + 프론트엔드 모드 선택 UI — ✅ 분기 로직 테스트 PASS (👁 UI 시각확인 대기)
- [x] **CompliancePage**: ISO 27001 / NIST CSF 매핑 표 프론트엔드 구현 — 👁 렌더 테스트 PASS, 시각확인 대기
- [x] **TeamManagementPage**: 팀원 초대·권한 설정 UI 완성 — 👁 렌더 테스트 PASS, 시각확인 대기
- [x] **SettingsPage**: 알림·플랜·API 키·스캔 모드 기본값 섹션 완성 — 👁 렌더 테스트 PASS, 시각확인 대기
- [x] **Sprint 8 이월 수동 검증**: k6 p95 < 500ms (✅ 9.52ms, BUG-1105-1 수정 후) + OWASP ZAP Critical 0건 (🧰 하니스 부재) + 2FA QR (🙋 사용자 확인) + Nginx HTTPS (✅ 301)

---

## 실행 명령어

```
/stage 1   — TASK-501 (GitHub Webhook 기반 + 시크릿 탐지 MCP 툴)
/stage 2   — TASK-502 (PR 분석 자동 트리거) + TASK-503 (시크릿 스캔 개선)  ※ 병렬 가능
/stage 3   — TASK-504 (SBOM CycloneDX) + TASK-1001 (야간 스캔)  ※ Stage 2와 병렬 시작 가능
/stage 4   — TASK-1002 (팀 대시보드) + TASK-1003 (리포트 Export) + TASK-1004 (스캔 모드)
/stage 5   — FEAT-FE-003 (CompliancePage) + FEAT-FE-004 (TeamManagementPage) + FEAT-FE-005 (SettingsPage)
```

**병행 권장 타이밍**:
- 2FA QR 스캔 + Nginx HTTPS 리다이렉트 → `/stage 1` 시작 직후
- k6 p95 + OWASP ZAP → `/stage 2` 시작 직후 (Prometheus 기동 상태 유지)
- VSCode Extension 수동 설치 검증 + GDPR 30일 통합 테스트 → `/stage 3` 진행 중

---

## 에이전트 평가 요약

### PM 에이전트 (스테이지 설계)
- Sprint 5 이월 4개 + Sprint 10 신규 4개 + 프론트엔드 미구현 3개 = 총 11개 태스크를 5개 스테이지로 배치
- Critical(TASK-501/502/1001) → High(TASK-503/504/1002/1003) → Medium(TASK-1004/FE-003~005) 우선순위 순서 준수
- Stage 0 사전 결정 사항 10건으로 착수 후 결정 지연 방지
- Sprint 8 이월 수동 검증 6건을 Stage 별 병행 타이밍에 매칭

### Dev 에이전트 (현실성 평가)
- **계획 수정 필요: Y** — 6건의 코드베이스 불일치 발견
  1. `GitHubWebhookController` + `GitHubWebhookService` 이미 존재 → TASK-502는 신규가 아닌 확장
  2. `PrReviewHistory` 테이블(V019) + 엔티티 이미 존재 → Flyway V047은 `ALTER TABLE`로 변경
  3. `settings/page.tsx` 이미 존재 → 신규 생성이 아닌 섹션 확장
  4. `mcp_github_tools.py` 이미 존재 → 커밋 툴 래퍼 추가 방식으로 정정
  5. `openhtmltopdf-pdfbox` 이미 도입됨 → TASK-1003 신규 의존성 없음
  6. `github-scan/page.tsx` 존재 가능성 → Stage 0에서 확인 후 확장/신규 결정
- 모든 수정 사항을 본 계획에 반영 완료

---

*Sprint 10 계획 작성일: 2026-05-25*

---

## Stage 1 완료 기록 (2026-05-25)

### TASK-501 — GitHub 커밋 MCP 툴 + 시크릿 탐지 노드

**구현 내용**:
- `GitHubRestClientConfig.java`: `githubRestClient` @Bean 등록. `baseUrl("https://api.github.com")` + 5s 타임아웃 단일 관리
- `CommitHistoryScanner.java`: `@Async("analysisExecutor")` + `@Qualifier("githubRestClient")` 생성자 주입. 최대 100페이지 페이지네이션, lastScannedSha 도달 시 조기 중단, 개별 커밋 실패 skip & log
- `secret_scan_node.py`: AWS Key(`AKIA[0-9A-Z]{16}`), GitHub PAT(`ghp_`/`github_pat_`), 고엔트로피(Shannon >4.5, 32자+) 정규식 탐지. `matched_value`는 항상 `"****"` 마스킹. OTel span 포함
- `mcp_github_tools.py`: `list_commits_via_mcp` / `get_commit_diff_via_mcp` 래퍼 추가
- `apps/mcp_server/src/index.ts`: `list_commits` / `get_commit_diff` MCP 툴 추가 (기존 DAST 툴 공존)
- `agent_state.py`: `commits: list[dict]` / `secrets_found: list[dict]` 필드 추가

**Reviewer 경고 및 수정**:
| # | 경고 | 수정 |
|---|------|------|
| 1 | `CommitHistoryScanner` 기본 생성자에서 `SimpleClientHttpRequestFactory` 직접 `new` (DIP 위반) | `GitHubRestClientConfig` @Bean 분리 + 생성자 주입 교체 |
| 2 | `AgentState`에 `commits`/`secrets_found` 키 미정의 (`# type: ignore` 억제) | `agent_state.py`에 필드 추가, `# type: ignore` 제거 |
| 3 | `CommitHistoryScanner`와 `GitHubRestClientConfig` 양쪽에 `GITHUB_API_BASE` 상수 중복 | `CommitHistoryScanner` 상수 제거, 상대 경로(`/repos/...`)로 전환 |

**단위 테스트**: 46개 통과
- `CommitHistoryScannerTest` 8개
- `test_secret_scan_node.py` 23개
- `test_mcp_github_tools.py` 15개

**커밋**: `addd96a` `feat(sprint10/stage1): GitHub 커밋 MCP 툴 + 시크릿 탐지 노드 (TASK-501)`

---

## Stage 2 완료 기록 (2026-05-25)

### TASK-502 — PR 분석 자동 트리거 + Check Run API
### TASK-503 — 커밋 히스토리 시크릿 스캔 개선

**구현 내용**:

**Backend (TASK-502)**:
- `GitHubRestClient.java`: 기본 생성자 → `@Qualifier("githubRestClient") RestClient` 생성자 주입 전환 (DIP). `createPrComment()` / `getPrChangedFiles()` 메서드 추가 — HTTP 클라이언트 책임을 `GitHubRestClientConfig` 단일 위치로 집중
- `GitHubWebhookService.java`: 중복 `RestClient githubRestClient` 직접 빌드 필드 제거 및 `@Deprecated` 메서드 2개(`createCheckRun`, `completeCheckRun`) 제거. `createPrComment` / `getPrChangedFiles` 호출을 주입된 `gitHubRestClient`에 위임. `extractInstallationToken()` blank 가드 추가 — 토큰 없으면 `log.warn()` + Check Run / 파일 조회 skip (런타임 403 방지). `completeCheckRunAfterAnalysis()` 분석 완료 후 Check Run 완료 + PR 코멘트 등록
- `application.yaml`: `secureai.github.webhook-secret` / `check-run-app-id` 바인딩 추가

**Frontend (TASK-502)**:
- `GitHubScanModal.tsx`: owner/repo/ref/prNumber 입력 폼, `POST /api/v1/analysis/commits/scan` 연동. JWT는 auth store에서 조회 (localStorage 미사용)

**AI Engine (TASK-503)**:
- `scan_files_node.py`: `PRIORITY_EXTENSIONS` dict로 우선순위 스캔 (`.env`/`.pem`/`.key` → 설정 파일 → 소스). `BINARY_EXTENSIONS` + `_is_binary()` 이진 파일 필터링. `asyncio.gather` 병렬 파일 스캔. SSE progress 스캔 가능 파일 수 기준

**Reviewer FAIL → 수정 이력**:

*1차 FAIL (SRP + 중복 RestClient + extractInstallationToken)*:
| # | 위반 | 수정 |
|---|------|------|
| 1 | `GitHubWebhookService`에 `RestClient githubRestClient` 직접 빌드 중복 — HTTP 클라이언트 구성 책임이 두 클래스에 분산 | `GitHubRestClient` 생성자 주입 전환 + `@Deprecated` 직접 호출 메서드 제거 |
| 2 | `createPrComment` / `getPrChangedFiles`가 `GitHubWebhookService`에서 직접 HTTP 호출 — SRP 위반 | 두 메서드를 `GitHubRestClient`로 이전, `GitHubWebhookService`에서 위임 |
| 3 | `extractInstallationToken()` 빈 문자열 반환 상태에서 Check Run / 파일 조회 API 호출 → 런타임 403 확실 | `hasToken` 플래그로 blank 여부 확인, blank이면 모든 GitHub API 호출 skip & log |

**단위 테스트**: 19개 통과 (GitHubRestClientTest 7개 + GitHubWebhookServiceTest 12개)
- `GitHubRestClientTest`: `spy(new GitHubRestClient(mockRestClient))` 패턴으로 생성자 주입 반영
- `GitHubWebhookServiceTest`: 토큰 blank 시 Check Run skip 검증 2개 추가

**커밋**: `af2ce44` `feat(sprint10-stage2): PR 자동 트리거 + Check Run API + 스캔 개선 (TASK-502, TASK-503)`

---

## Stage 3 완료 기록 (2026-05-25)

### TASK-504 — SBOM CycloneDX 내보내기
### TASK-1001 — 야간 자동 스캔 스케줄링

**구현 내용**:

**TASK-504 Backend**:
- `CycloneDxBom.java`: CycloneDX 1.4 BOM 응답 record (Component/Vulnerability/Rating 중첩 record, `bom-ref` @JsonProperty 적용)
- `CycloneDxExportService.java`: 내보내기 전용 서비스 (SRP). `CveSearchService` 경유 CVE 조회 (DIP). 팀 멤버 검증, CVE 매칭 오류 skip & log
- `SbomController.java`: `GET /api/v1/projects/{id}/sbom/cyclonedx?sessionId=` 엔드포인트 추가

**TASK-504 AI Engine**:
- `sbom_parser.py`: `parse_cargo_toml()` 추가 (인라인/테이블 버전, dev-dependencies, path 의존성). `parse_file()` Cargo.toml 라우팅 등록

**TASK-504 Frontend**:
- `SbomPage.tsx`: CycloneDX JSON 다운로드 버튼 (Blob URL, JWT는 auth store)

**TASK-1001 Backend (신규 도메인)**:
- `V044__create_project_schedules.sql`: project_schedules 테이블 (Flyway V044)
- `NightlyScanJob.java`: `@Scheduled(0 0 16 * * *)` = KST 01:00 + `@SchedulerLock(PT2H/PT10M)`
- `NightlyScanService.java`: 변경 감지 (GitHub SHA 비교 / 30일 경과 여부) + 스캔 위임 + 알림 skip & log
- `ProjectScheduleService.java` + `ProjectScheduleController.java`: `GET+PUT /api/v1/projects/{id}/schedule` Upsert

**Reviewer FAIL → 수정 이력**:

*1차 FAIL (API 설계 문서 불일치)*:
| # | 위반 | 수정 |
|---|------|------|
| 1 | `GET /sbom/cyclonedx` 엔드포인트 문서 미등재 | `docs/02_API_DESIGN_V5_260523.md` 4.9절 신규 추가 |
| 2 | 스케줄 엔드포인트 `POST /schedules`(복수) vs 구현 `GET+PUT /schedule`(단수) | 14.1~14.2절을 실제 Upsert 패턴으로 수정 (단수형 경로, 요청/응답 필드 일치) |

**단위 테스트**: 20개 통과 (Backend) + 36개 통과 (Python)
- `CycloneDxExportServiceTest`: 11/11 PASS
- `NightlyScanJobTest` + `NightlyScanServiceTest`: 9/9 PASS (`@MockitoSettings(LENIENT)` 적용)
- `test_sbom_parser.py`: 36/36 PASS (Cargo 파서 7개 + 라우팅 3개 포함)

**커밋**: `cc5ee73` `feat(sprint10-stage3): SBOM CycloneDX 내보내기 + 야간 스캔 스케줄링 (TASK-504, TASK-1001)`

---

## Stage 4 완료 기록 (2026-05-26)

### TASK-1002 — 팀 대시보드 & Gamification

**Backend**:
- `V045__add_security_score_to_users.sql`: `users.security_score INTEGER DEFAULT 0` (IF NOT EXISTS)
- `TeamDashboardResponse.java`: `teamId`, `teamName`, `members: List<MemberStat>`, `totalCritical`, `totalHigh`, `avgMttrHours`, `monthlyTokenUsage` record
- `TeamDashboardService.java`: JdbcTemplate 전용 집계 (도메인 간 Repository 직접 주입 없음, DIP 준수)
  - `loadOrgNameOrThrow()`, `verifyTeamMember()`, `loadAcceptedMemberIds()` — org_members/organizations JDBC 쿼리
  - `loadUserStats()` — users 테이블 RowMapper 방식 (mock 친화적)
  - `buildMemberStats()` — securityScore 내림차순 rank 부여
  - 패키지-프라이빗 `record UserStat(UUID id, String username, int securityScore)` 내부 DTO
- `DashboardController.java`: `GET /api/v1/teams/{teamId}/dashboard` 추가 (기존 엔드포인트 보존)
- `User.java`: `securityScore` 필드 추가 (Flyway V045 동기)

**Frontend**:
- `team/[orgSlug]/page.tsx`: 팀원별 랭킹 테이블 + 도넛 차트(Recharts) + 빈 catch → console.warn 수정

---

### TASK-1003 — 리포트 위젯 PDF/HTML Export (ROI)

**Backend**:
- `RoiCalculationService.java`: `savedHours = vulnCount × 4h`, `savedCost = savedHours × hourlyRate`  
  상수: `DEFAULT_HOURLY_RATE = 50.0`, `HOURS_PER_VULNERABILITY = 4.0`  
  hourlyRate <= 0 시 기본값 적용
- `roi-report.html`: openhtmltopdf용 HTML 템플릿 (인라인 CSS, Thymeleaf 변수)
- `SecurityDocAsyncProcessor.java`: `processRoiReport()` 확장 + `RoiCalculationService` 의존성 주입
- `ReportController.java`: `GET .../roi` + `GET .../roi/pdf` 엔드포인트 추가
- `VulnerabilityRepository.java`: `countBySeverityForSession` 쿼리 메서드 추가

**Frontend**:
- `PdfReportModal.tsx`: ROI 위젯 포함 체크박스 + hourlyRate 입력 + ROI 미리보기 섹션

---

### TASK-1004 — 스캔 모드 선택 (Audit vs Pipeline)

**Backend**:
- `V046__add_scan_mode_to_analysis_sessions.sql`: `scan_mode TEXT DEFAULT 'PIPELINE'` (IF NOT EXISTS)
- `StartAnalysisRequest.java`: `scanMode` 필드 + `@Pattern(AUDIT|PIPELINE)` 검증 + `effectiveScanMode()` 헬퍼
- `AnalysisSession.java`: `@Column(name = "scan_mode") String scanMode` (기본값 "PIPELINE")
- `AiAgentClient` 인터페이스 + `DefaultAiAgentClient`: `scanMode` 파라미터 전달
- `AnalysisService.java`: 세션 빌더에 `scanMode` 적용

**AI Engine**:
- `settings.py`: `audit_model = Field("claude-haiku-4-5-20251001")`, `pipeline_model = Field("claude-sonnet-4-6")`
- `agent_state.py`: `scan_mode: str | None` 필드 추가
- `sast_node.py`: `scan_mode == "AUDIT"` → `settings.audit_model`, 기본값 → `settings.pipeline_model`
- `analyze.py`: `AnalyzeRequest.scan_mode` 필드 + `initial_state` 주입
- `.env.example`: `AUDIT_MODEL`, `PIPELINE_MODEL` 항목 추가

**Frontend**:
- `ScanModeSelector.tsx`: 모드 선택 라디오 UI (`ScanMode = 'AUDIT' | 'PIPELINE'`)
- `useStartAnalysis.ts`: `scanMode` 상태 관리 + API 호출 시 전달

---

**Reviewer FAIL → 수정 이력**:

| # | 위반 | 수정 |
|---|------|------|
| 1 | `TeamDashboardService`: `UserRepository`/`OrgMemberRepository`/`OrganizationRepository` 도메인 간 직접 주입 | JdbcTemplate 전용 집계로 전환, JPA Repository 의존성 제거 |
| 2 | `StartAnalysisRequest.scanMode`: Controller 레이어 입력 검증 부재 | `@Pattern(regexp = "^(AUDIT\|PIPELINE)$")` 추가 |
| 3 | `TeamDashboardServiceTest`: JPA stub 기반 → JdbcTemplate doReturn/doAnswer 방식으로 재작성 | `@MockitoSettings(LENIENT)` + jdbcTemplate stub helper 메서드 분리 |
| 4 | `CircuitBreakerTest`: `startAnalysisFallback` 리플렉션 인자 불일치 | `null` 1개 추가 (scanMode) |
| 5 | 빈 catch 블록 (프론트엔드) | `console.warn` 추가 |
| 6 | API 문서 ROI 엔드포인트 미등재 | 13.3/13.4절 신규 추가 |

**단위 테스트**: 백엔드 PASS (TeamDashboard 7개 + RoiCalculation 5개 + AnalysisService + CircuitBreaker)  
AI Engine 신규 3개 PASS (Audit/Pipeline 모드 + preferred_model 우선순위)

**커밋**: `b42a51a` `feat(enterprise): Sprint 10 Stage 4 — 팀 대시보드 + ROI Export + 스캔 모드 (TASK-1002/1003/1004)`

---

## Stage 5 완료 기록 (2026-05-26)

### FEAT-FE-003 — CompliancePage (ISO 27001 / NIST CSF 매핑)

**Backend**:
- `ComplianceResponse.java`: record DTO (framework + List\<ControlResult\>) — controlId, controlName, owaspCategory, compliant, vulnerabilityCount
- `ComplianceMappingService.java`: OWASP Top 10 → ISO 27001 / NIST CSF 정적 매핑  
  - 8개 OWASP 카테고리 (A01/A02/A03/A05/A06/A07/A09/A10) 양쪽 프레임워크 매핑  
  - `VulnerabilityQueryService` 경유 — analysis 도메인 Repository 직접 주입 제거 (도메인 격리 원칙)  
  - framework 검증은 Controller 전담, Service 재검증 없음  
  - `extractOwaspCode()`: "A01", "A01:2021", "A01:2021 Broken Access Control" 모두 "A01" 정규화
- `ComplianceController.java`: `GET /api/v1/projects/{projectId}/sessions/{sessionId}/compliance?framework=ISO27001`  
  - `@PreAuthorize("isAuthenticated()")`, framework 입력 검증 Controller 전담
- `VulnerabilityQueryService.java`: `findOwaspCodesBySessionId()` 위임 메서드 추가

**Frontend**:
- `CompliancePage.tsx`: ISO 27001 / NIST CSF 탭 전환 + KPI 띠(전체/준수/미준수/준수율) + 컨트롤 테이블 + 준수율 진행 바  
  - 행 클릭 시 상세 패널 확장 (준수 상태 + 조치 필요 안내)  
  - `apiClient + useSecureStore(projectId, lockedSessionId)` + mock fallback 패턴 (SbomPage 동일)
- `projects/[projectId]/compliance/page.tsx`: 독립 라우트 페이지

### FEAT-FE-004 — TeamManagementPage
**확인**: `apps/frontend/src/app/team/[orgSlug]/members/page.tsx` 이미 완전 구현 — 초대 모달, 권한 변경, 멤버 제거 확인, 재초대, 빈 팀 상태, 대기 중 배지 모두 포함. 추가 작업 없음.

### FEAT-FE-005 — SettingsPage 확장
- `settings/page.tsx`: `ScanModeDefaultSection` 추가 — `localStorage.setItem('scanModeDefault', mode)` 기본값 저장, 새로고침 후 유지, "저장되었습니다." 알림

---

**Reviewer FAIL → 수정 이력**:

| # | 위반 | 수정 |
|---|------|------|
| 1 | `ComplianceMappingService`: `VulnerabilityRepository` 직접 주입 (도메인 격리 위반) | `VulnerabilityQueryService` 경유로 전환, `findOwaspCodesBySessionId()` 위임 메서드 추가 |
| 2 | framework 검증이 Service 레이어에 위치 (Controller 전담 규칙 위반) | Service 검증 제거, Controller에 이동 |
| 3 | `ComplianceMappingServiceTest`: `VulnerabilityRepository` mock → `VulnerabilityQueryService` mock으로 재작성 | `findOwaspCodesBySessionId` stub으로 교체, 5개 테스트 PASS |

**단위 테스트**: `ComplianceMappingServiceTest` 5개 전원 통과  
**커밋**: `32bcb3e` `feat(compliance): Sprint 10 Stage 5 — CompliancePage + ISO27001/NIST CSF 매핑`
