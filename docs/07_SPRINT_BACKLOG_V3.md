# SecureAI — 스프린트 & 백로그 V3
> 기준일: 2026-05-16 | 방법론: Scrum | 스프린트 단위: 2주  
> 변경사항 V2 → V3: `13_BACKLOG_ADDITIONS.md` 통합, EPIC-MISC 섹션 신설, feat/sprint5-github 브랜치 섹션 신설, 미래 기능 후보 정리

---

## 전체 로드맵

```
Sprint 0  (Week 01-02): 환경 세팅 & 인프라 기반                        ✅ 완료
Sprint 1  (Week 03-04): 인증 & 프로젝트 관리                           ✅ 완료
Sprint 2  (Week 05-06): AI Agent 기반 & MCP + 체크포인트 시스템          ✅ 완료
Sprint 3  (Week 07-08): SAST 파이프라인 & GitHub 레포 스캔               ✅ 완료
Sprint 4  (Week 09-10): 웹 에디터 UI & 실시간 SSE + 체크리스트 UI        ✅ 완료
Sprint 5  (Week 11-12): GitHub Layer 2 완성                            ✅ 완료 (일부 이월 → feat/sprint5-github)
Sprint 6  (Week 13-14): DAST 엔진 & Docker 샌드박스                     ✅ 완료 (PR #70)
feat/sprint5-github:    Sprint 5 이월 구현 (별도 브랜치)                 🟠 진행 중
Sprint 7  (Week 15-16): 리포트 & 대시보드 & Android MVP
Sprint 8  (Week 17-18): 안정화 & 보안 강화 & 런칭 준비
Sprint 9  (Week 19-20): VSCode Extension & 지속 모니터링 (Phase 3)
EPIC-MISC:              독립 기능 (스프린트 비종속)
```

---

## 테스트 표기 범례

- 🧪 **단위 테스트** — 각 개발자가 작성하는 자동화 테스트
- 🔬 **통합 테스트** — 여러 컴포넌트 조합 동작 검증
- ✅ **수동 검증** — 사람이 실제로 확인해야 하는 항목
- 🛡️ **보안 검증** — 보안 관점 확인 항목

---

## Sprint 0~5 — 완료 (요약)

> 상세 내용: `docs/sprints/sprint-0.md` ~ `docs/sprints/sprint-5.md` 참조

### Sprint 0 — 환경 세팅 & 인프라 기반 ✅ 완료

- [x] TASK-001: 모노레포 Git 초기화 및 디렉토리 구조 생성
- [x] TASK-002: Docker Compose 전체 서비스 구성
- [x] TASK-003: Spring Boot 프로젝트 초기화
- [x] TASK-004: Python AI Agent 서비스 초기화
- [x] TASK-005: MCP Server 초기화 (Node.js)
- [x] TASK-006: Next.js 프론트엔드 초기화
- [x] TASK-007: GitHub Actions CI 파이프라인 기본 설정

### Sprint 1 — 인증 & 프로젝트 관리 ✅ 완료

- [x] TASK-101: JWT 인증 시스템 구현
- [x] TASK-102: GitHub OAuth 연동
- [x] TASK-103: 플랜 체계 및 Rate Limit 구현
- [x] TASK-104: 프로젝트 CRUD API
- [x] TASK-105: 사용자 정보 API & 프론트엔드 인증 UI

### Sprint 2 — AI Agent 기반 & MCP + 체크포인트 시스템 ✅ 완료

- [x] TASK-201: LangGraph 보안 감사 그래프 구축
- [x] TASK-202: MCP Filesystem Tool → SAST 노드 연동
- [x] TASK-203: Spring Boot ↔ AI Agent HTTP 연동 & SSE 브릿지
- [x] TASK-204: 취약점 저장 파이프라인 & Spring 이벤트
- [x] TASK-205: 진행 로그 시스템 구축
- [x] TASK-206: LangGraph Checkpointer 통합
- [x] TASK-207: 중단 감지 및 재개 API

### Sprint 3 — SAST 파이프라인 완성 & GitHub 레포 스캔 ✅ 완료

- [x] TASK-301: 파일 배치 SAST — 전체 프로젝트 스캔
- [x] TASK-302: CWE/OWASP 분류 자동 매핑 & API 호출 체인 구성
- [x] TASK-303: GitHub 레포지토리 API 기반 코드 스캔 (일부 이월)
- [x] TASK-304: 패치 에이전트 구현
- [x] TASK-305: CVE 기초 데이터베이스 & SBOM 파서 인터페이스
- [x] TASK-306: 보안 지식 베이스(SKB) 구축 및 초기 동기화

### Sprint 4 — 웹 에디터 UI & 실시간 SSE + 체크리스트 UI ✅ 완료

- [x] TASK-401: Monaco 에디터 통합 & 취약점 인라인 하이라이팅
- [x] TASK-402: SSE 실시간 구독 & 취약점 실시간 표시
- [x] TASK-403: VSCode 스타일 에디터 레이아웃 & 파일 트리
- [x] TASK-404: 취약점 상세 패널 & AI 채팅 패널
- [x] TASK-405: AI 채팅 API 및 UI
- [x] TASK-406: 진행 체크리스트 MD 자동 생성 & UI
- [x] TASK-407: 로컬 폴더 열기 (showDirectoryPicker)
- [x] TASK-408: 크레딧 시스템 & BYOK & 모델 선택

### Sprint 5 — GitHub Layer 2 (일부 완료, 일부 이월) ✅/🟠

> TASK-501~505는 DAST와 의존성 없어 Sprint 6 이후로 이월.  
> `feat/sprint5-github` 브랜치에서 진행 중.

- [x] TASK-503: GitHub 레포 나머지 파일 전체 SAST 최적화
- [x] TASK-504: SBOM 완성 & CVE 매칭
- [ ] TASK-501: GitHub Webhook 이벤트 수신 (이월 → feat/sprint5-github)
- [ ] TASK-502: PR 분석 자동 트리거 (이월 → feat/sprint5-github)
- [ ] TASK-505: GitHub 연동 설정 UI (이월 → feat/sprint5-github)

---

## Sprint 6 — 완료

**기간**: 2026-05-15 ~ 2026-05-16  
**브랜치**: `feat/sprint6` | **PR**: [#70](https://github.com/ttogle918/secureai-editor/pull/70)

### TASK-601 🔴 Docker 샌드박스 DAST 컨테이너 ✅ 완료

**완료 내용**:
- `executors/` 5개 익스플로잇 (SQLi, XSS, IDOR, SSRF, Auth Bypass)
- `dast_runner.py` Strategy 패턴 `_EXECUTOR_MAP` dict
- `DockerSandboxManager.java`: docker-java 3.3.x, `DockerClientImpl.getInstance`
- `ContainerConfig.java`: record — networkMode="dast-isolated-net" 컴팩트 생성자 강제 검증
- `DockerClientConfig.java`: `@Bean DockerClient` — DIP 준수
- `ExploitResult.java`: `@Convert(AesEncryptionConverter)` on targetUrl/payload/responseSnippet
- `ScanStatus.java`: PENDING/RUNNING/SUCCESS/FAILED/TIMEOUT enum
- `V026__create_dast_results.sql`: UUID PK, AES 암호화 컬럼

### TASK-602 🔴 도메인 소유권 확인 & DAST Rate Limit ✅ 완료

**완료 내용**:
- `DomainVerificationService.java`: DNS TXT 조회 (JDK JNDI), Redis Rate Limit, 분산 락
- `DistributedLockService.java`: Redis SETNX TTL 300초
- `ScanTarget.java`: markVerified() / recordConsent() 도메인 메서드
- `V027__create_scan_targets.sql`: consent_ip INET, unique(project_id, domain)

**단위 테스트**: DistributedLockServiceTest 5개, DomainVerificationServiceTest 11개

### TASK-603 🔴 DAST 에이전트 (Python LangGraph) ✅ 완료

**완료 내용**:
- `dast_node.py`, `after_dast.py`, `notify_node.py`, `docker_tool.py`, `dast_graph_builder.py`
- `api/routes/dast.py`: POST /agent/dast/start + GET /agent/dast/logs/{session_id}
- `dast_payload.jinja2` DAST 페이로드 생성 프롬프트
- `DastController.java`, `DastExecutionService.java`, `ExploitResultPersister.java`, `DastResultHandler.java`

**단위 테스트**: Backend 42개 + Python 21개

### TASK-604 🟠 DAST 터미널 UI & 결과 표시 ✅ 완료

**완료 내용**:
- `useDastStream.ts` (신규): EventSource SSE 구독, UUID 패턴 검증 (경로 조작 방어)
- `DastTerminal.tsx`: ANSI 이스케이프 → React span 변환 (XSS 안전), 자동 스크롤
- `VulnDetailPanel.tsx`: EXPLOITED 빨간 배지 / DAST ✗ 회색 배지
- 프론트엔드 17개 테스트 전부 통과

### FEAT-SEC-006 pgvector 임베딩 ✅ 완료 (Sprint 6 추가 구현)

**완료 내용**:
- `V028__add_pgvector_embedding_to_guidelines.sql`: CREATE EXTENSION vector, embedding vector(384), IVFFlat 인덱스
- `embedding_service.py`: fastembed BAAI/bge-small-en-v1.5 Lazy Singleton
- `guidelines_client.py`: `search_guidelines_by_vuln_type()` 추가
- `sync_guidelines.py`: MD→DB 동기화 + 배치 임베딩

> **주의**: PostgreSQL에 pgvector 익스텐션 필요. postgres 이미지를 `pgvector/pgvector:pg15` 또는 `pgvector/pgvector:pg16`으로 변경 필요.

### AuditLog 활성화 (V030~V031) ✅ 완료

Flyway V030, V031 마이그레이션으로 AuditLog 테이블 활성화 완료.

---

## feat/sprint5-github 브랜치 — Sprint 5 이월 구현

> Sprint 7과 독립적으로 진행. `feat/sprint5-github` 브랜치에서 개발 후 main에 PR.

### TASK-501 🔴 GitHub Webhook 이벤트 수신

- **중요도**: 🔴 Critical | **현재 상태**: 미구현

**하위 할일**
- [ ] `list_commits.ts`, `get_commit_diff.ts` MCP Tool
- [ ] `mcp_github_tools.py` 커밋 Tool 래퍼
- [ ] 시크릿 탐지 프롬프트 + 전용 노드
- [ ] `CommitHistoryScanner.java` @Async 페이지네이션
- [ ] 병렬 처리 최적화

**테스트 체크리스트**
- [ ] 🧪 시크릿 패턴 정규식 정확성 (AWS Key, GitHub Token, JWT 등)
- [ ] 🔬 일부러 시크릿 커밋 후 삭제한 테스트 레포 → 삭제된 시크릿 탐지
- [ ] 🔬 100개 이상 커밋 레포 → 페이지네이션 처리 완료
- [ ] 🔬 GitHub API rate limit 도달 시 backoff 동작
- [ ] ✅ 실제 공개 레포의 최근 30개 커밋 스캔 → 결과 리포트 검토

---

### TASK-502 🟠 PR 분석 자동 트리거

- **중요도**: 🔴 Critical | **현재 상태**: 미구현

**하위 할일**
- [ ] `GitHubWebhookController.java` HMAC 검증
- [ ] `GitHubWebhookService.java` PR 처리
- [ ] 변경 파일(diff)만 선택 스캔
- [ ] `create_pr_comment.ts` MCP Tool
- [ ] `PrReviewHistory.java` + Flyway V015
- [ ] GitHub Check Run API 연동

**테스트 체크리스트**
- [ ] 🧪 HMAC-SHA256 검증 — 올바른 서명 통과, 잘못된 서명 거부
- [ ] 🔬 GitHub PR 생성 → Webhook 수신 → 자동 분석 시작
- [ ] 🔬 PR 변경 파일만 스캔 (전체 파일 X)
- [ ] 🔬 분석 완료 → GitHub PR에 보안 리뷰 코멘트 자동 등록
- [ ] 🔬 blockMergeOnCritical=true + Critical 발견 → Check Run failed
- [ ] 🛡️ 잘못된 HMAC 서명으로 Webhook 요청 → 400 반환
- [ ] ✅ 실제 GitHub 레포에 Webhook 등록 → PR 생성 → 코멘트 자동 등록 확인

---

### TASK-503 🟠 커밋 히스토리 시크릿 스캔

- **중요도**: 🟠 High | **현재 상태**: 부분 완료 (Sprint 5 기반)

**하위 할일**
- [ ] 파일 타입별 우선순위 정렬
- [ ] 파일 크기·바이너리 필터 강화
- [ ] asyncio.gather 병렬 처리
- [ ] 진행률 SSE 정확도 개선

**테스트 체크리스트**
- [ ] 🔬 100개 파일 레포 스캔 시간 < 15분
- [ ] 🔬 우선순위 — 코드 파일 먼저, 설정 파일 나중에
- [ ] ✅ 대형 레포 (500+ 파일) 스캔 → 메모리 사용량 모니터링

---

### TASK-504 🟡 SBOM GitHub Release 연동

- **중요도**: 🟠 High | **현재 상태**: 기본 SBOM 완료, Release 연동 미구현

**하위 할일**
- [ ] 의존성 파일 자동 감지
- [ ] SBOM 파서 4종 완성
- [ ] CVE 매칭 + Flyway V015
- [ ] CycloneDX JSON 내보내기

**테스트 체크리스트**
- [ ] 🔬 Spring Boot 레포 → pom.xml 파싱 → Spring Core CVE 매칭
- [ ] 🔬 CycloneDX JSON 형식 유효성 (schema validator 통과)
- [ ] 🔬 동일 패키지+버전 재분석 시 CVE 매칭 캐시 HIT
- [ ] ✅ 생성된 SBOM JSON → 외부 SBOM 뷰어로 열어 확인

---

### TASK-505 🟡 GitHub Security Advisory 조회

- **중요도**: 🟡 Medium | **현재 상태**: 미구현

**하위 할일**
- [ ] GitHub 설정 섹션
- [ ] `PrReviewHistory.tsx` 테이블
- [ ] 저장소 목록 드롭다운

**테스트 체크리스트**
- [ ] ✅ GitHub 저장소 목록 → 선택 → Webhook 자동 등록
- [ ] ✅ PR 리뷰 이력 테이블 정렬·필터 동작
- [ ] ✅ blockMergeOnCritical 토글 → 저장 후 재조회 시 유지

---

## Sprint 7 — 리포트 & 대시보드 & Android MVP
> Week 15-16 | 목표: PDF 리포트 + 대시보드 + Android 앱 MVP

### EPIC-8: 리포트 & 대시보드

---

#### TASK-701 🔴 PDF 리포트 생성 (iText7)
- **중요도**: 🔴 Critical | **순서**: 1번째

**하위 할일**
- [x] OpenPDF 의존성 + `ReportAsyncProcessor.java` @Async (LGPL — iText7 대신)
- [x] `Report.java` + Flyway V035 (V010 충돌 → V035로 변경)
- [x] `PdfReportGenerator.java` / `JsonReportGenerator.java`
- [x] `ReportService.java` + `ReportController.java`
- [x] 다운로드 토큰 + Path Traversal 방어
- [ ] 프론트엔드 UI (Stage 3)

**테스트 체크리스트**
- [x] 🧪 Template Method — PdfReportGenerator 섹션 순서 정확성
- [ ] 🔬 리포트 생성 → 30초 이내 완료
- [ ] 🔬 다운로드 토큰 만료 (24시간) → 접근 거부
- [ ] 🔬 90일 후 리포트 파일 자동 삭제
- [x] 🛡️ 다른 사용자 리포트 downloadToken 직접 접근 시 거부
- [ ] 🛡️ 공개 공유 링크 활성화 시만 인증 없이 접근 가능
- [ ] ✅ 생성된 PDF 파일 열어 취약점 목록, 패치 코드, 차트 확인
- [ ] ✅ JSON 리포트 → CycloneDX 호환 스키마 검증

---

#### TASK-702 🟠 대시보드 차트 완성
- **중요도**: 🟠 High | **순서**: 2번째

**하위 할일**
- [ ] SecurityScoreRing, SeverityBarChart, TrendLineChart, FileHeatmap, OwaspCoverageMatrix (Stage 3 FE)
- [x] `VulnerabilityQueryService` 집계 쿼리 (4개 위임 메서드 추가)
- [x] `GET /api/v1/projects/{id}/dashboard` 단일 엔드포인트 + Redis 캐시 5분
- [ ] `dashboard/page.tsx` 완성 (Stage 3 FE)

**테스트 체크리스트**
- [ ] 🔬 trend API — 7일간 일별 집계 정확성
- [ ] 🔬 대시보드 로딩 시간 < 2초 (Redis 캐시)
- [ ] ✅ SecurityScoreRing — 0, 50, 100 점수 각 시각화
- [ ] ✅ OWASP 매트릭스 A01~A10 → 색상 코딩 정확
- [ ] ✅ FileHeatmap → 취약점 많은 파일이 빨간색

---

### EPIC-9: Android MVP

---

#### TASK-703 🔴 Android 프로젝트 초기화 & 인증
- **중요도**: 🔴 Critical | **순서**: 3번째 병렬

**하위 할일**
- [x] Android 프로젝트 (Compose, Hilt, Room, Firebase)
- [x] `NetworkModule.kt` 인증서 피닝 + debug 예외
- [x] `TokenStorage.kt` EncryptedSharedPreferences + Android Keystore AES256_GCM
- [x] `LoginScreen.kt`, `RegisterScreen.kt`
- [x] `AuthViewModel.kt` + `AuthRepository.kt` (DIP 인터페이스)
- [x] `NavGraph.kt` + `RootDetector.kt`

**테스트 체크리스트**
- [x] 🧪 `TokenStorage` 암호화 저장·복원 정확성
- [x] 🧪 `AuthRepository` 로그인 성공/실패 분기
- [ ] 🔬 인증서 피닝 — 잘못된 인증서 서버 응답 시 연결 실패
- [ ] ✅ 실제 디바이스에서 로그인 성공 → 대시보드 진입
- [ ] 🛡️ APK 루팅 기기에서 실행 시 경고 (RootDetector)
- [x] 🛡️ 토큰이 평문으로 SharedPreferences에 저장되지 않음
- [ ] 🛡️ 네트워크 스니핑 도구로 API 통신 확인 시 TLS 암호화

---

#### TASK-704 🟠 Android 대시보드 & 취약점 목록
- **중요도**: 🟠 High | **순서**: 4번째

**하위 할일**
- [x] DashboardScreen, VulnListScreen, VulnDetailScreen
- [x] `SecurityScoreGauge.kt` Canvas
- [x] Room DB 엔티티 + DAO (VulnerabilityEntity, DashboardCacheEntity)
- [x] Repository (Remote + Room fallback) + ApiResponse 래퍼

**테스트 체크리스트**
- [x] 🧪 Room DAO — upsert/중복방지/stale 삭제 (VulnerabilityDaoContractTest 4개)
- [ ] 🔬 네트워크 끊김 → Room 캐시에서 마지막 데이터 표시
- [ ] ✅ 대시보드 → 취약점 목록 → 상세 네비게이션 흐름
- [ ] ✅ SecurityScoreGauge 애니메이션 부드러움

---

#### TASK-705 🟠 FCM Push & OkHttp SSE
- **중요도**: 🟠 High | **순서**: 5번째

**하위 할일**
- [x] Firebase 프로젝트 + google-services.json
- [x] `FcmPushService.java` Backend
- [x] `SecureAiFcmService.kt`
- [x] `SseClient.kt` Flow
- [x] `AnalysisViewModel.kt` 이중 처리

**테스트 체크리스트**
- [ ] 🔬 세션 완료 → Backend `SessionCompletedEvent` → FCM Push 발송
- [ ] 🔬 Android 앱 foreground — SSE 구독 동작
- [ ] 🔬 Android 앱 background — FCM Push 수신 → 알림 표시
- [ ] ✅ 앱 종료 상태에서 분석 완료 → Push 알림 수신
- [ ] ✅ 알림 클릭 → 앱 실행 → 해당 세션 화면 딥링크
- [ ] ✅ 앱 foreground → background 전환 시 SSE 해제, FCM만 동작

---

### Sprint 7 완료 기준
- [ ] **PDF 리포트**: 30초 내 생성, 다운로드 토큰 동작
- [ ] **대시보드**: 5개 차트 모두 완성, 2초 내 로딩
- [ ] **Android MVP**: 로그인 + 대시보드 + 취약점 목록 + 알림 동작
- [ ] **FCM + SSE 이중 전략**: foreground/background 모두 알림 정상

---

## Sprint 8 — 안정화 & 보안 강화
> Week 17-18

### EPIC-10: 안정화 & 보안 강화

---

#### TASK-801 🔴 스케줄러 전체 완성 & ShedLock
- **중요도**: 🔴 Critical

**하위 할일**
- [ ] ShedLock + Redis Provider
- [ ] 6개 Job `@SchedulerLock` 적용
- [ ] `ExpiredDataCleanupJob` 완성 (체크포인트 삭제 포함)
- [ ] `PartitionMaintenanceJob`
- [ ] `SastUsageResetJob`

**테스트 체크리스트**
- [ ] 🧪 각 Job 실행 로직 단위 테스트
- [ ] 🔬 다중 인스턴스 환경 시뮬레이션 → ShedLock으로 1회만 실행
- [ ] 🔬 ExpiredDataCleanupJob — 30일 초과 exploit_results, 90일 리포트, 24h 체크포인트 삭제
- [ ] 🔬 매월 1일 → 모든 사용자 sast_usage_this_month 0으로 리셋
- [ ] 🔬 PartitionMaintenanceJob → 다음 달 파티션 미리 생성
- [ ] ✅ 실제 스케줄 cron 동작 확인

---

#### TASK-802 🔴 Resilience4j Circuit Breaker 전체 적용
- **중요도**: 🔴 Critical

**하위 할일**
- [ ] `ResilienceConfig.java`
- [ ] AI Agent / GitHub / NVD fallback
- [ ] `CircuitBreakerTest.java`

**테스트 체크리스트**
- [ ] 🧪 각 Circuit Breaker fallback 메서드
- [ ] 🔬 AI Agent 강제 종료 → 연속 실패 10회 → Circuit OPEN
- [ ] 🔬 Circuit OPEN 상태 → 사용자 요청 → fallback 응답
- [ ] 🔬 30초 후 HALF_OPEN → 1회 시도 → 성공 시 CLOSED 복구
- [ ] ✅ GitHub API 403 응답 시 → 캐시 응답 반환

---

#### TASK-803 🟠 성능 테스트 & 캐시 최적화
- **중요도**: 🟠 High

**하위 할일**
- [ ] k6 주요 API 부하 테스트
- [ ] Redis 캐시 히트율 측정
- [ ] N+1 쿼리 제거
- [ ] GitHub 스캔 병렬화

**테스트 체크리스트**
- [ ] 🔬 주요 API p95 응답 시간 < 500ms
- [ ] 🔬 동시 100명 로그인 → 성공률 > 99%
- [ ] 🔬 Redis 캐시 히트율 > 80%
- [ ] 🔬 JPA SQL 로그에서 N+1 패턴 없음
- [ ] ✅ 프로젝트 목록 API — 10개 프로젝트 조회 시 쿼리 3개 이하

---

#### TASK-804 🟠 보안 강화 & 자체 OWASP ZAP 스캔
- **중요도**: 🟠 High

**하위 할일**
- [ ] Nginx 보안 헤더
- [ ] DTO `@Valid` 전수 확인
- [ ] OWASP ZAP 자체 스캔
- [ ] Android cleartext 차단

**테스트 체크리스트**
- [ ] 🛡️ OWASP ZAP Full Scan → Critical/High 0건
- [ ] 🛡️ CSP, HSTS, X-Frame-Options, X-Content-Type 헤더 확인
- [ ] 🛡️ 모든 POST/PATCH API DTO에 `@Valid` 적용
- [ ] 🛡️ SQL Injection 시도 — 모든 입력 필드 안전
- [ ] 🛡️ XSS 시도 — 모든 사용자 입력 출력 시 이스케이프
- [ ] 🛡️ Android 앱 cleartext HTTP 요청 차단

---

#### TASK-805 🟡 Nginx API Gateway 완성 & SSL
- **중요도**: 🟡 Medium

**하위 할일**
- [ ] `nginx.conf` 라우팅
- [ ] `limit_req_zone`
- [ ] Let's Encrypt
- [ ] 보안 헤더

**테스트 체크리스트**
- [ ] ✅ `/api/*` → backend 라우팅
- [ ] ✅ HTTP → HTTPS 강제 리다이렉트
- [ ] ✅ SSL 인증서 A 등급 (SSL Labs)
- [ ] 🔬 분당 100회 초과 요청 시 Nginx 수준 차단

---

#### TASK-806 🔴 2단계 인증 (2FA / TOTP)
- **중요도**: 🔴 Critical | **출처**: FEAT-SEC-001

**하위 할일**
- [ ] TOTP 라이브러리 (`dev.samstevens.totp`) 적용 — Google Authenticator 호환
- [ ] 복구 코드 8개 생성 (1회용, AES-256 암호화 저장)
- [ ] `V029__add_totp_fields.sql`: `users` 테이블 `totp_secret` (AES 암호화), `totp_enabled` 컬럼 + `totp_recovery_codes` 테이블
- [ ] `POST /auth/2fa/setup`, `POST /auth/2fa/verify`, `DELETE /auth/2fa` API
- [ ] Team 이상 플랜 강제 활성화 옵션 (Enterprise 관리자 설정)

**테스트 체크리스트**
- [ ] 🧪 TOTP 코드 생성·검증 정확성
- [ ] 🧪 복구 코드 1회 사용 후 used_at 기록, 재사용 거부
- [ ] 🔬 2FA 활성화 → 로그인 시 TOTP 코드 요구
- [ ] 🛡️ `totp_secret` DB에 AES-256 암호화 저장 확인
- [ ] ✅ Google Authenticator 앱으로 QR 코드 스캔 → 인증 성공

---

#### TASK-807 🟠 IP 허용 목록 (IP Allowlist)
- **중요도**: 🟠 High | **출처**: FEAT-SEC-002

**하위 할일**
- [ ] `team_settings` 테이블에 `allowed_ip_ranges CIDR[]` 컬럼 추가
- [ ] Spring Security `OncePerRequestFilter`로 IP 검증
- [ ] CIDR 범위 지원 (`192.168.1.0/24`)
- [ ] `PUT /admin/teams/{teamId}/ip-allowlist` API

**테스트 체크리스트**
- [ ] 🔬 허용 IP 외부에서 요청 → 403
- [ ] 🔬 CIDR 범위 내 IP → 정상 통과
- [ ] 🛡️ IP Spoofing 헤더 (`X-Forwarded-For`) 조작 시 원본 IP 기준으로 검증

---

#### TASK-808 🔴 OpenTelemetry 통합
- **중요도**: 🔴 Critical | **출처**: FEAT-OPS-001

**하위 할일**
- [ ] `opentelemetry-spring-boot-starter` 적용
- [ ] Python AI Agent OTel SDK 연동
- [ ] Jaeger 또는 Grafana Tempo로 트레이스 수집
- [ ] 분석 파이프라인 각 단계별 Span 생성

**테스트 체크리스트**
- [ ] 🔬 분석 요청 → Spring Boot → AI Agent 전체 Trace 연결 확인
- [ ] ✅ Jaeger/Tempo UI에서 분석 파이프라인 Span 시각화 확인

---

#### TASK-809 🟠 GDPR 데이터 삭제 요청 API
- **중요도**: 🟠 High | **출처**: FEAT-COMP-001

**하위 할일**
- [ ] `POST /users/me/gdpr/export` — 내 전체 데이터 JSON 다운로드
- [ ] `POST /users/me/gdpr/delete` — 즉시 하드 삭제 요청 (30일 유예 없이)
- [ ] 삭제 시 관련 분석 세션, 취약점, 리포트 연쇄 삭제

**테스트 체크리스트**
- [ ] 🔬 export API → 사용자 데이터 JSON 완전성 검증
- [ ] 🔬 delete API → 30일 내 데이터 완전 삭제 확인
- [ ] 🛡️ 타 사용자 GDPR 요청 거부 (인증 필수)

---

### Sprint 8 완료 기준
- [ ] **스케줄러 안정**: ShedLock으로 중복 실행 방지
- [ ] **Circuit Breaker**: 모든 외부 호출 장애 격리
- [ ] **성능 목표 달성**: p95 < 500ms, 캐시 히트율 > 80%
- [ ] **보안 기본선**: OWASP ZAP Critical 0건
- [ ] **2FA**: TOTP 기반 2단계 인증 동작
- [ ] **OpenTelemetry**: 분산 트레이싱 전체 연결

---

## Sprint 9 — VSCode Extension & 모니터링 (Phase 3)
> Week 19-20

### EPIC-11: Phase 3

---

#### TASK-901 🟡 지속 모니터링 서비스
- **중요도**: 🟡 Medium

**하위 할일**
- [ ] `MonitoringJob` + `MonitoringService`
- [ ] `MonitoringResult` + 파티션 테이블
- [ ] Slack Webhook
- [ ] SSL 만료 알림

**테스트 체크리스트**
- [ ] 🔬 매시 정각 → 활성화된 모니터링 대상 Passive 스캔
- [ ] 🔬 SSL 만료 30일 전 → Slack/이메일 알림
- [ ] 🔬 새 CVE 발표 → 영향 받는 프로젝트 자동 재점검
- [ ] ✅ Slack 채널에 알림 포스팅 확인

---

#### TASK-902 🟢 VSCode Extension 기초
- **중요도**: 🟢 Low

**하위 할일**
- [ ] `vsce` 프로젝트 초기화
- [ ] Backend API 재사용
- [ ] Diagnostic API 취약점 표시
- [ ] Marketplace 배포 준비

**테스트 체크리스트**
- [ ] 🔬 VSCode에서 분석 실행 → Problems 탭에 취약점 표시
- [ ] ✅ Extension 설치 → API 키 입력 → 분석 성공
- [ ] ✅ Diagnostic 표시 — 라인에 빨간 밑줄

---

#### TASK-903 🟢 Android 고도화
- **중요도**: 🟢 Low

**하위 할일**
- [ ] `ChatScreen.kt` 스트리밍
- [ ] PDF 공유 (FileProvider)
- [ ] 알림 채널 세분화

**테스트 체크리스트**
- [ ] ✅ Android AI 채팅 → 스트리밍 응답 표시
- [ ] ✅ PDF 리포트 → 다른 앱으로 공유 (Gmail, Drive 등)
- [ ] ✅ 알림 채널별 사운드/진동 다르게 설정

---

#### TASK-904 🔴 PostgreSQL MCP 서버 도입
- **중요도**: 🔴 Critical | **출처**: MCP-001

> AI Agent가 분석 세션 결과, 취약점 데이터를 직접 DB 조회해 컨텍스트로 활용.  
> Read-Only 계정으로 연결 (INSERT/UPDATE/DELETE 권한 제거).

**하위 할일**
- [ ] `claude_code_config.json`에 `mcp-server-postgres` 추가
- [ ] Read-Only 전용 PostgreSQL 계정 생성
- [ ] AI Agent 분석 노드에서 이전 동일 유형 취약점 참조 로직 추가
- [ ] Patch Agent 이전 패치 이력 조회 연동

**테스트 체크리스트**
- [ ] 🔬 MCP PostgreSQL로 SAST 결과 조회 → 이전 취약점 참조 확인
- [ ] 🛡️ Read-Only 계정에서 INSERT/UPDATE/DELETE 거부 확인

---

#### TASK-905 🔴 Docker MCP 서버 전환
- **중요도**: 🔴 Critical | **출처**: MCP-002

> Sprint 6에서 Java Docker SDK로 우회 구현 완료.  
> MCP 전환 시 AI Agent 주도 Docker 생명주기 제어 가능.

**하위 할일**
- [ ] `mcp-server-docker` 설정 추가
- [ ] `docker_tool.py` MCP 방식으로 전환 (SDK 우회 제거)
- [ ] 컨테이너 실시간 로그 스트리밍 → SSE 중계 개선

**테스트 체크리스트**
- [ ] 🔬 MCP Docker로 DAST 컨테이너 생성·실행·삭제 사이클 확인
- [ ] 🔬 컨테이너 실시간 로그 MCP 스트리밍 → SSE 전달 확인

---

#### TASK-906 🟠 Prometheus + Grafana 대시보드
- **중요도**: 🟠 High | **출처**: FEAT-OPS-002

**하위 할일**
- [ ] `prometheus.yml` 설정
- [ ] Grafana 대시보드 JSON (분석 처리량, 에러율, DAST 실행시간, AI 토큰 사용량)
- [ ] 커스텀 메트릭: 분석 완료 수, 평균 분석 시간, DAST 성공률

**테스트 체크리스트**
- [ ] ✅ Prometheus 타겟 모두 UP
- [ ] ✅ Grafana 대시보드 — 분석 처리량, 에러율, DAST 실행시간 표시
- [ ] ✅ 커스텀 메트릭 — 분석 세션 수, 취약점 발견 수 정상 집계

---

#### TASK-907 🟠 GDPR 하드 삭제 스케줄러 (R-03-C)
- **중요도**: 🟠 High | **출처**: 리팩토링 로드맵 R-03-C | **규모**: L (2일)

> 사용자 소프트 삭제(`deleted_at` 기록) 후 30일이 지난 계정과 연관 데이터를  
> 자동으로 완전 삭제하는 배치 스케줄러. TASK-801(ShedLock)과 연계.

**하위 할일**
- [ ] `GdprHardDeleteJob.java` — `@Scheduled` + `@SchedulerLock` (ShedLock)
- [ ] 삭제 대상: `users`, `vulnerabilities`, `analysis_sessions`, `exploit_results`, `reports` 연쇄 삭제
- [ ] 삭제 전 감사 로그(`audit_logs`) 기록 후 제거
- [ ] 삭제 완료 알림 이메일 발송 (EmailService 연동)
- [ ] `GET /admin/gdpr/pending-deletions` — 관리자 대기 목록 조회 API

**테스트 체크리스트**
- [ ] 🧪 `GdprHardDeleteJob` — `deleted_at` 30일 초과 계정만 선택 정확성
- [ ] 🔬 소프트 삭제 후 30일 경과 시뮬레이션 → 연관 데이터 전체 삭제 확인
- [ ] 🔬 다중 인스턴스 환경 → ShedLock으로 1회만 실행
- [ ] 🔬 감사 로그 — 삭제 직전 로그 기록 후 사용자 데이터 제거 확인
- [ ] 🛡️ 소프트 삭제 후 29일 계정 → 삭제 대상에서 제외
- [ ] ✅ 삭제 완료 알림 이메일 수신 확인

---

### Sprint 9 완료 기준
- [ ] **지속 모니터링**: 24/7 자동 스캔 동작
- [ ] **VSCode Extension**: Marketplace 등록 가능 수준
- [ ] **Android 완성도**: 채팅·리포트·알림 고도화
- [ ] **PostgreSQL MCP**: AI Agent DB 직접 조회 연동
- [ ] **Prometheus + Grafana**: 운영 대시보드 가동
- [ ] **GDPR 스케줄러**: 30일 경과 계정 자동 하드 삭제 동작

---

## EPIC-MISC — 독립 기능 (스프린트 비종속)

> 스프린트 사이클과 독립적으로 개발되는 기능들.  
> 각 기능은 별도 브랜치에서 개발 후 main에 PR.

---

### TASK-MISC-001 🟡 다국어 지원 (i18n)
- **브랜치**: `feat/i18n`
- **현재 상태**: 한국어/영어 번역 기능 구현 완료, main 미머지

**하위 할일**
- [x] displayLanguage 설정 UI
- [x] 취약점 설명 한국어 번역 (AI 번역)
- [x] 번역 캐시 localStorage 영속화
- [ ] 추가 번역 대상 확장
- [ ] main 브랜치 머지

**테스트 체크리스트**
- [ ] ✅ 언어 전환 시 UI 즉시 반영 확인
- [ ] ✅ 번역 캐시 새로고침 후 유지 확인

---

## 미래 기능 후보 (Future Backlog)

> 특정 Sprint에 배치되지 않은 항목들. 우선순위와 리소스에 따라 Sprint에 편입.

### MCP 서버 추가

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| MCP-003 | Redis MCP | 🟠 High | AI Agent가 캐시 히트율 확인, 분산 락 상태 조회, SSE 채널 상태 디버깅 |
| MCP-004 | Brave Search / Exa MCP | 🟠 High | AI Agent가 CVE 정보·보안 권고 실시간 검색. NVD API 캐시 미스 시 웹 검색으로 보완 |
| MCP-005 | GitHub MCP 확장 | 🟠 High | PR diff 직접 읽기 (토큰 절감), GitHub Security Advisory 조회, Dependabot Alert 교차 검증 |
| MCP-006 | Slack MCP | 🟡 Medium | Critical 취약점 발견 시 `#security-alerts` 채널 즉시 알림, 모니터링 결과 자동 발송 |
| MCP-007 | Filesystem MCP 확장 | 🟡 Medium | `.gitignore` 패턴 자동 반영, 샌드박스 경로 제한 강화, 바이너리 자동 스킵 |
| MCP-008 | Sentry MCP | 🟢 Low | 운영 에러 트래킹 데이터 AI Agent 조회 → 자동 버그 분류·취약점 연관성 확인 |

### 보안 강화

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-SEC-003 | 세션 활동 이력 조회 | 🟠 High | 사용자 활성 세션(기기별) 확인·강제 로그아웃. `user_sessions` 테이블, 동시 접속 기기 제한 |
| FEAT-SEC-004 | Secrets Detection 강화 | 🟠 High | 코드 업로드 시 시크릿 패턴 즉시 감지 (AWS키, GCP SA키, GitHub PAT, Stripe키 등 50+ 패턴) |
| FEAT-SEC-005 | 취약점 SLA 관리 | 🟡 Medium | 취약점 수정 기한 설정 및 초과 알림. Critical 3일, High 7일, Medium 30일, Low 90일 기본값 |

### API 기능 보완

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-API-001 | 분석 비교 API (Diff) | 🟠 High | 두 세션 간 취약점 증감 비교. `newVulnerabilities`, `fixedVulnerabilities`, `securityScoreDelta` 반환 |
| FEAT-API-002 | 취약점 내보내기 (Export) | 🟠 High | CSV, JSON, SARIF (GitHub Code Scanning), JIRA XML 포맷 추가 |
| FEAT-API-003 | Outbound Webhook | 🟠 High | `analysis.completed`, `vulnerability.critical_found`, `sla.breached` 이벤트를 외부 시스템으로 발송 |
| FEAT-API-004 | SBOM 다운로드 포맷 추가 | 🟡 Medium | SPDX 2.3 (NTIA 준수), CycloneDX XML, CSV 포맷 추가 |
| FEAT-API-005 | 분석 스케줄링 API | 🟡 Medium | 정기 자동 분석 예약. `POST /projects/{id}/analysis/schedule`, cronExpression 지원 |

### AI Agent 고도화

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-AI-001 | 멀티 파일 컨텍스트 분석 | 🔴 Critical | 파일 간 데이터 흐름 추적 (Taint Analysis). LangGraph에 `taint_analysis` 노드 추가, 파일 의존성 그래프 구축 |
| FEAT-AI-002 | 패치 자동 적용 (PR 생성) | 🟠 High | 패치 승인 → GitHub API로 브랜치 생성 → 파일 수정 커밋 → PR 자동 생성. `POST /patches/{id}/create-pr` |
| FEAT-AI-003 | 취약점 오탐(False Positive) 학습 | 🟠 High | 오탐 패턴을 프로젝트별로 학습해 재분석 시 동일 패턴 필터링. `false_positive_patterns` 테이블 |
| FEAT-AI-004 | 다국어 코드 지원 확장 | 🟡 Medium | 현재 Java/TypeScript/Python에서 Go, Rust, C/C++, PHP, Ruby 추가 |

### 컴플라이언스

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-COMP-002 | 컴플라이언스 매핑 리포트 | 🟡 Medium | 취약점을 ISO 27001, NIST CSF, PIMS, PCI-DSS 프레임워크에 매핑. 현재 OWASP Top 10만 지원 |
| FEAT-COMP-003 | 감사 로그 불변성 보장 | 🟡 Medium | 로그 항목마다 이전 항목 해시 체이닝. 또는 AWS CloudTrail/Azure Monitor 외부 전송. 무결성 검증 API 추가 |

### 프론트엔드 Pagori 리디자인 구현 현황 (2026-05-19 분석)

> `frontend-refactoring/Pagori Redesign.html` 기준 — `apps/frontend/src/` 구현 여부 대조

| 화면 | 디자인 파일 컴포넌트 | 구현 상태 | 경로 |
|------|---------------------|----------|------|
| 대시보드 | Dashboard, KpiCard, SecurityScoreRing, SeverityBarChart, TrendLineChart, FileHeatmap, OwaspCoverageMatrix | ✅ 완료 | `components/dashboard/` |
| 코드 에디터 | EditorLayout, FileTree, InlineHighlight, SuggestionPanel, SessionLog | ✅ 완료 | `components/editor/` |
| 프로젝트 목록 | ProjectCard, CreateProjectModal | ✅ 완료 | `components/project/` |
| 로그인 / 회원가입 | LoginForm, RegisterForm, GitHubOAuthButton | ✅ 완료 | `app/auth/` |
| PDF 리포트 모달 | PdfReportModal (포맷 선택, 상태 폴링) | ✅ 완료 | `components/analysis/PdfReportModal.tsx` |
| 커밋 시크릿 스캔 | CommitSecretScanModal | ✅ 완료 | `components/analysis/CommitSecretScanModal.tsx` |
| SBOM & CVE | SbomPage (컴포넌트 테이블, CVE 매핑) | ❌ 미구현 | 신규 필요 (FEAT-FE-001) |
| GitHub 레포 스캔 | GitHubScanModal (URL·브랜치 입력 → 직접 분석 트리거) | ❌ 미구현 | 신규 필요 (FEAT-FE-002) |
| 컴플라이언스 리포트 | CompliancePage (ISO 27001 / NIST CSF 매핑 표) | ❌ 미구현 | 신규 필요 (FEAT-FE-003) |
| 팀 관리 | TeamManagementPage (초대, 권한 설정) | ❌ 미구현 | 신규 필요 |
| 설정 | SettingsPage (알림·플랜·API 키) | ❌ 미구현 | 신규 필요 |
| 알림 센터 | NotificationsPage (FCM/In-App 알림 목록) | ❌ 미구현 | 신규 필요 |
| 분석 비교 | DiffPage (두 세션 취약점 증감 비교) | ❌ 미구현 | FEAT-API-001 백엔드 선행 필요 |

**미구현 화면 7개** — Sprint 8 이후 우선순위 결정 필요.

---

### 프론트엔드 리팩토링 중 발견된 누락 API

#### FEAT-FE-001 SBOM 컴포넌트 조회 API

- **엔드포인트**: `GET /api/v1/sbom/components?sessionId={sessionId}&projectId={projectId}`
- **필요 파일**:
  - `apps/backend/src/main/java/io/secureai/backend/domain/sbom/controller/SbomController.java` (GET 엔드포인트 추가)
  - `apps/backend/src/main/java/io/secureai/backend/domain/sbom/dto/SbomComponentResponse.java` (신규 DTO)
  - `apps/backend/src/main/java/io/secureai/backend/domain/sbom/repository/DependencyComponentRepository.java` (findBySessionId 메서드 추가)
  - `apps/frontend/src/components/analysis/SbomPage.tsx` (신규 — SBOM & CVE 화면)
- **설명**: 현재 SBOM 컨트롤러는 저장(POST)만 지원. 프론트엔드 SBOM 화면이 세션별 의존성 목록(이름, 버전, 생태계, CVE ID 목록)을 조회하려면 GET 엔드포인트 필요. CVE 상세는 기존 `/api/v1/cve/search?packageName=` 재활용 가능.
- **응답 예시**:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "name": "next-auth",
        "version": "4.22.1",
        "ecosystem": "npm",
        "license": "ISC",
        "cveIds": ["CVE-2024-22020"],
        "isDirect": true
      }
    ]
  }
  ```

#### FEAT-FE-002 GitHub 레포 스캔 트리거 API

- **엔드포인트**: `POST /api/v1/projects/{projectId}/analysis/github-scan`
- **필요 파일**:
  - `apps/backend/src/main/java/io/secureai/backend/domain/analysis/controller/GitHubWebhookController.java` (직접 스캔 트리거 엔드포인트 추가)
  - `apps/frontend/src/components/analysis/GitHubScanModal.tsx` (신규)
- **설명**: GitHub 레포 URL + 브랜치를 입력받아 분석 세션을 생성하고 AI Engine에 위임. 현재 `GitHubWebhookController`는 웹훅 이벤트만 처리하므로 UI에서 직접 트리거하는 엔드포인트 추가 필요.

#### FEAT-FE-003 컴플라이언스 매핑 리포트 API

- **엔드포인트**: `GET /api/v1/projects/{projectId}/compliance?framework=ISO27001`
- **필요 파일**:
  - `apps/backend/src/main/java/io/secureai/backend/domain/compliance/controller/ComplianceController.java` (신규)
  - `apps/backend/src/main/java/io/secureai/backend/domain/compliance/service/ComplianceMappingService.java` (신규)
  - `apps/frontend/src/components/compliance/CompliancePage.tsx` (신규)
- **설명**: Pagori 디자인에 ISO 27001·NIST CSF 컨트롤별 준수 여부 표가 존재하나 백엔드/프론트엔드 모두 미구현. 현재 OWASP Top 10 매핑만 지원. 지원 프레임워크: ISO 27001, NIST CSF, PCI-DSS, PIMS.
- **응답 예시**:
  ```json
  {
    "data": {
      "framework": "ISO27001",
      "controls": [
        { "controlId": "A.8.1", "name": "취약점 관리", "status": "compliant", "relatedVulnIds": [] },
        { "controlId": "A.12.6", "name": "기술적 취약점 관리", "status": "non_compliant", "relatedVulnIds": ["uuid1"] }
      ]
    }
  }
  ```

---

*관련 문서: `08_CHECKPOINT_FLOW.md` (체크포인트 상세 설계), `00_ARCHITECTURE_DECISIONS.md` (아키텍처 결정 사항), `14_SECURITY_TEAM_FEATURES.md` (보안팀 전용 기능)*
