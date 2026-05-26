# SecureAI — 스프린트 & 백로그 V4
> 기준일: 2026-05-22 | 방법론: Scrum | 스프린트 단위: 2주  
> **정본 지정일**: 2026-05-23 | 구버전(`07_SPRINT_BACKLOG_V2.md`, `V3.md`) 아카이브 완료

## 버전 이력

| 버전 | 기준일 | 주요 변경 |
|------|--------|---------|
| V2 | Sprint 6 완료 | Sprint 6 DAST 완료 기록, Sprint 7(리포트·대시보드·Android) 계획 추가 |
| V3 | Sprint 7 완료 | Sprint 7 완료 기록, Sprint 8(안정화·보안·런칭 준비) 계획 추가. 프론트엔드 Pagori 리디자인 현황 포함 |
| **V4 (현재)** | 2026-05-22 | Sprint 8/9 완료 기록, Sprint 10 Enterprise 백로그 추가 (TASK-1001~1004: 야간 스캔·팀 대시보드·리포트 Export·스캔 모드). 미구현 프론트엔드 화면 7개 목록 추가 |

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
feat/sprint5-github:    Sprint 5 이월 구현 (별도 브랜치)                 ✅ 완료 (Sprint 10 흡수)
Sprint 7  (Week 15-16): 리포트 & 대시보드 & Android MVP                  ✅ 완료
Sprint 8  (Week 17-18): 안정화 & 보안 강화 & 런칭 준비                ✅ 완료
Sprint 9  (Week 19-20): VSCode Extension & 지속 모니터링 (Phase 3)   ✅ 완료
Sprint 10 (Week 21-22): Enterprise B2B + GitHub Integration             🟠 진행 중 (Stage 1~4 완료)
Sprint 11 (Week 23-24): Workspace UI Redesign (온보딩 및 맞춤형 레이아웃) 예정
Sprint 12 (Week 25-26): Hardening & System Stabilization                 예정
Sprint 13 (Week 27-28): AI Agent Advanced I (API 호출 경로 스캔 & 오탐 학습) 예정
Sprint 14 (Week 29-30): AI Agent Advanced II (패치 자동화 및 격리 검증)  예정
Sprint 15 (Week 31-32): Ecosystem & MCP Server Expansion                 예정
Sprint 16 (Week 33-34): Live Scan Visual Simulator & Observability      예정
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
>
> **이월 처리 결정 (2026-05-23)**: Sprint 10에서 GitHub Integration Sprint로 묶어 처리.  
> `feat/sprint5-github` 브랜치는 Sprint 10 시작 시 `feat/sprint10-github`로 재사용(리베이스).  
> TASK-505(GitHub Security Advisory)는 Enterprise 기능 성격으로 EPIC-MISC로 이관.

- [x] TASK-503: GitHub 레포 나머지 파일 전체 SAST 최적화
- [x] TASK-504: SBOM 완성 & CVE 매칭
- [ ] TASK-501: GitHub Webhook 이벤트 수신 → **Sprint 10 배정** (🔴 Critical)
- [ ] TASK-502: PR 분석 자동 트리거 → **Sprint 10 배정** (🔴 Critical, TASK-501 선행 필요)
- [ ] TASK-505: GitHub 연동 설정 UI → **Sprint 10 배정** (🟡 Medium, TASK-501/502 완료 후)

---

## Sprint 6 — 완료

**기간**: 2026-05-15 ~ 2026-05-16  
**브랜치**: `feat/sprint6` | **PR**: [#70](https://github.com/ttogle918/secureai-editor/pull/70)  
**DVWA 시연**: 2026-05-19 — `localhost:8888` DVWA (MariaDB) + SQLi 엔드투엔드 완료, 재시도 루프·터미널 스트리밍·배지 전항목 확인

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

> ~~Sprint 7과 독립적으로 진행. `feat/sprint5-github` 브랜치에서 개발 후 main에 PR.~~  
> **처리 방향 결정 (2026-05-23)**: 아래 태스크는 **Sprint 10 GitHub Integration Sprint**로 공식 배정.  
> Sprint 10 시작 시 `feat/sprint5-github` 브랜치를 `feat/sprint10-github`로 리베이스 후 진행.  
> 단, TASK-505(GitHub Security Advisory)는 SBOM/Advisory 통합 관점에서 **EPIC-MISC**로 이관  
> (Sprint 10에서 시간 내 처리 못할 경우 MCP-005와 통합 검토).

### TASK-501 🔴 GitHub Webhook 이벤트 수신

- **중요도**: 🔴 Critical | **현재 상태**: 미구현 | **Sprint 10 배정**

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

- **중요도**: 🔴 Critical | **현재 상태**: 미구현 | **Sprint 10 배정** (TASK-501 선행 필요)

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

- **중요도**: 🟠 High | **현재 상태**: 부분 완료 (Sprint 5 기반) | **Sprint 10 배정** (잔여 개선분)

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

- **중요도**: 🟠 High | **현재 상태**: 기본 SBOM 완료, Release 연동 미구현 | **Sprint 10 배정**

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

- **중요도**: 🟡 Medium | **현재 상태**: 미구현 | **EPIC-MISC 이관** (MCP-005 GitHub MCP 확장과 통합 검토)

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

#### TASK-801 🔴 스케줄러 전체 완성 & ShedLock ✅ 완료 (2026-05-21)
- **중요도**: 🔴 Critical | **Flyway**: V037

**하위 할일**
- [x] `build.gradle.kts` 의존성: `net.javacrumbs.shedlock:shedlock-spring:6.x`, `shedlock-provider-redis-spring:6.x`
- [x] `V037__create_shedlock_table.sql` (Redis Provider 사용 시 DB 백업용)
- [x] ShedLock + Redis Provider (Redis DB 0, 키 접두사 `shedlock:`)
- [x] 6개 Job 확정: `ExpiredDataCleanupJob`, `PartitionMaintenanceJob`, `SastUsageResetJob`, `NvdSyncJob`, `SessionInterruptionScheduler`, `RefreshTokenCleanupJob`
- [x] 각 Job `@SchedulerLock(name, lockAtMostFor, lockAtLeastFor)` 적용
- [x] `ExpiredDataCleanupJob` 완성 (exploit_results 30일, reports 90일)
- [x] `PartitionMaintenanceJob` — 다음 달 파티션 미리 생성 (TODO: 파티션 구조 확정 후 SQL 추가)
- [x] `SastUsageResetJob` — 매월 1일 sast_usage_this_month 리셋

**테스트 체크리스트**
- [x] 🧪 각 Job 실행 로직 단위 테스트
- [ ] 🔬 다중 인스턴스 환경 시뮬레이션 → ShedLock으로 1회만 실행
- [ ] 🔬 ExpiredDataCleanupJob — 30일 초과 exploit_results, 90일 리포트 삭제
- [ ] 🔬 매월 1일 → 모든 사용자 sast_usage_this_month 0으로 리셋
- [ ] 🔬 PartitionMaintenanceJob → 다음 달 파티션 미리 생성
- [ ] ✅ 실제 스케줄 cron 동작 확인

---

#### TASK-802 🔴 Resilience4j Circuit Breaker 전체 적용 ✅ 완료 (2026-05-21)
- **중요도**: 🔴 Critical

**하위 할일**
- [x] `build.gradle.kts` 의존성: `resilience4j-spring-boot3:2.2.0`
- [x] `application.yaml` — aiAgent/nvdApi/dnsLookup CB + TimeLimiter 설정
- [x] AI Agent / NVD / DNS `@CircuitBreaker(fallbackMethod=)` + fallback 메서드 (DefaultAiAgentClient, NvdApiClient, DomainVerificationService)
- [x] `AiAgentClient.isCircuitOpen()` Resilience4j `CircuitBreakerRegistry` 연결
- [x] `CircuitBreakerTest.java` — 8개 단위 테스트

**테스트 체크리스트**
- [x] 🧪 각 Circuit Breaker fallback 메서드 (8개 통과)
- [ ] 🔬 AI Agent 강제 종료 → 연속 실패 10회 → Circuit OPEN
- [ ] 🔬 Circuit OPEN 상태 → 사용자 요청 → fallback 응답
- [ ] 🔬 30초 후 HALF_OPEN → 1회 시도 → 성공 시 CLOSED 복구
- [ ] ✅ GitHub API 403 응답 시 → 캐시 응답 반환

---

#### TASK-803 🟠 성능 테스트 & 캐시 최적화 ✅ 완료 (2026-05-22)
- **중요도**: 🟠 High

**하위 할일**
- [x] k6 주요 API 부하 테스트 스크립트 (`tests/perf/load-test.js`, `make perf-test`)
- [x] Redis 캐시 — cveList 6h TTL (`RedisCacheConfig`)
- [x] N+1 쿼리 제거 — `@EntityGraph` (Project/Vulnerability/AnalysisSession), `@BatchSize(30)` (Project.teamMembers)
- [ ] GitHub 스캔 병렬화 (추후)

**테스트 체크리스트**
- [x] 🧪 @EntityGraph/@BatchSize 어노테이션 적용 검증 (5개 단위 테스트)
- [ ] 🔬 주요 API p95 응답 시간 < 500ms (`make perf-test` 실행 필요)
- [ ] 🔬 동시 100명 로그인 → 성공률 > 99%
- [ ] 🔬 Redis 캐시 히트율 > 80%
- [ ] 🔬 JPA SQL 로그에서 N+1 패턴 없음
- [ ] ✅ 프로젝트 목록 API — 10개 프로젝트 조회 시 쿼리 3개 이하

---

#### TASK-804 🟠 보안 강화 & 자체 OWASP ZAP 스캔 ✅ 완료 (2026-05-22)
- **중요도**: 🟠 High

**하위 할일**
- [x] Spring Security `headers()` 설정 — CSP/HSTS/X-Frame-Options(DENY)/X-Content-Type/Referrer-Policy
- [x] DTO `@Valid` 전수 확인 — 전체 Controller 점검 완료 (DastController 1건 누락 수정)
- [ ] OWASP ZAP 자체 스캔 (`ghcr.io/zaproxy/zaproxy:stable` Docker 이미지 로컬 실행) — 수동 검증
- [x] Android cleartext HTTP 차단 — `network_security_config.xml` 이미 적용됨 확인
- [x] SecurityConfig POST /sbom/components에 HttpMethod.POST 명시 (GET 인증 우회 방지)

**테스트 체크리스트**
- [ ] 🛡️ OWASP ZAP Full Scan → Critical/High 0건
- [x] 🛡️ CSP, HSTS, X-Frame-Options, X-Content-Type 헤더 확인 (7개 단위 테스트)
- [x] 🛡️ 모든 POST/PATCH API DTO에 `@Valid` 적용
- [ ] 🛡️ SQL Injection 시도 — 모든 입력 필드 안전
- [ ] 🛡️ XSS 시도 — 모든 사용자 입력 출력 시 이스케이프
- [x] 🛡️ Android 앱 cleartext HTTP 요청 차단 (network_security_config.xml 확인)

---

#### TASK-805 🟡 Nginx API Gateway 완성 & SSL ✅ 완료 (2026-05-22)
- **중요도**: 🟡 Medium

**하위 할일**
- [x] `nginx.conf` 라우팅 (`/api/*` → backend, `/ai/*` → ai_engine, 정적 → frontend)
- [x] `limit_req_zone` 분당 100회 제한
- [x] **개발/스테이징**: 자체 서명 인증서 (`openssl`, `make ssl-cert`) | **프로덕션**: Let's Encrypt + Certbot
- [x] 보안 헤더 통합 (HSTS, X-Frame-Options, X-Content-Type, Referrer-Policy)
- [x] `docker-compose.yml` Nginx 서비스 추가 (app-net 최소 권한, ports 80/443)

**테스트 체크리스트**
- [ ] ✅ `/api/*` → backend 라우팅
- [ ] ✅ HTTP → HTTPS 강제 리다이렉트
- [ ] ✅ SSL 인증서 A 등급 (SSL Labs) — **프로덕션 배포 시에만 검증** (개발은 자체 서명 허용)
- [ ] 🔬 분당 100회 초과 요청 시 Nginx 수준 차단

---

#### TASK-806 🔴 2단계 인증 (2FA / TOTP) ✅ 완료 (2026-05-22)
- **중요도**: 🔴 Critical | **출처**: FEAT-SEC-001 | **Flyway**: V038 (V029 이미 사용됨)

**하위 할일**
- [x] `build.gradle.kts` 의존성: `dev.samstevens.totp:totp-spring-boot-starter` (Google Authenticator 호환)
- [x] `V038__add_totp_fields.sql`: `users` 테이블 `totp_secret` (AES 암호화 TEXT), `totp_enabled` BOOLEAN 컬럼 + `totp_recovery_codes` 테이블
- [x] 복구 코드 8개 생성 (1회용, BCrypt 해시 저장, `@Lock(PESSIMISTIC_WRITE)` = `SELECT FOR UPDATE` 트랜잭션, SecureRandom 64-bit 엔트로피)
- [x] `POST /api/v1/auth/2fa/setup`, `POST /api/v1/auth/2fa/verify`, `DELETE /api/v1/auth/2fa` API
- [ ] Team 이상 플랜 강제 활성화 옵션 (Enterprise 관리자 설정)
- [ ] 관리자 2FA 강제 리셋 API → **FEAT-SEC-007** (미래 기능 후보로 이관)

**테스트 체크리스트**
- [x] 🧪 TOTP 코드 생성·검증 정확성
- [x] 🧪 복구 코드 1회 사용 후 used_at 기록, 재사용 거부
- [ ] 🔬 2FA 활성화 → 로그인 시 TOTP 코드 요구
- [x] 🛡️ `totp_secret` DB에 AES-256-GCM 암호화 저장 확인 (AesEncryptionConverter)
- [ ] ✅ Google Authenticator 앱으로 QR 코드 스캔 → 인증 성공

---

#### TASK-807 🟠 IP 허용 목록 (IP Allowlist) ✅ 완료 (2026-05-22)
- **중요도**: 🟠 High | **출처**: FEAT-SEC-002 | **Flyway**: V039

**하위 할일**
- [x] `V039__create_team_settings.sql` — `team_settings` 테이블 신규 생성 + `allowed_ip_ranges TEXT[]` 컬럼
- [x] Spring Security `OncePerRequestFilter`로 IP 검증 — `addFilterBefore(ipAllowlistFilter, JwtAuthenticationFilter.class)` (JWT 검증 전 IP 차단)
- [x] `application.yaml`에 `server.forward-headers-strategy: NATIVE` 추가 — Spoofing 방어 (Docker 내부 신뢰 프록시 IP만 X-Forwarded-For 허용)
- [x] CIDR 범위 지원 (`192.168.1.0/24`) — 순수 Java 비트 연산 구현
- [x] `PUT /api/v1/admin/teams/{teamId}/ip-allowlist` API

**테스트 체크리스트**
- [ ] 🔬 허용 IP 외부에서 요청 → 403
- [ ] 🔬 CIDR 범위 내 IP → 정상 통과
- [x] 🛡️ IP Spoofing 헤더 (`X-Forwarded-For`) 조작 시 원본 IP 기준으로 검증 (request.getRemoteAddr() + NATIVE strategy)

---

#### TASK-808 🔴 OpenTelemetry 통합 ✅ 완료 (2026-05-21)
- **중요도**: 🔴 Critical | **출처**: FEAT-OPS-001

**하위 할일**
- [x] `build.gradle.kts` 의존성: `micrometer-tracing-bridge-otel` + `opentelemetry-exporter-otlp` (Spring Boot 4 호환)
- [x] Python AI Agent `requirements.txt`: `opentelemetry-instrumentation-fastapi`, `opentelemetry-exporter-otlp-proto-grpc`
- [x] **Jaeger 선택 확정** — `docker-compose.yml`에 `jaegertracing/all-in-one:1.56` 서비스 추가 (OTLP gRPC 4317 / HTTP 4318)
- [x] LangGraph 노드별 수동 span 생성 (`with tracer.start_as_current_span`) — asyncio Task 경계에서 ContextVar 전파 단절 회피
- [x] `settings.py` 환경변수: `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`
- [x] `sast_node.py`, `scan_files_node.py`, `patch_node.py` 노드별 수동 span 추가
- [x] `application.yaml` OTel tracing 설정 + secrets 하드코딩 기본값 제거

**테스트 체크리스트**
- [ ] 🔬 분석 요청 → Spring Boot → AI Agent 전체 Trace 연결 확인 (Stage 4 성능 테스트 시 함께 검증 예정)
- [x] ✅ Jaeger UI(localhost:16686)에서 분석 파이프라인 Span 시각화 확인 (secureai-backend ✅, secureai-ai-engine — 추후 확인)

---

#### TASK-809 🟠 GDPR 데이터 삭제 요청 API ✅ 완료 (2026-05-21)
- **중요도**: 🟠 High | **출처**: FEAT-COMP-001

**하위 할일**
- [x] `POST /api/v1/users/me/gdpr/export` — 내 전체 데이터 JSON 다운로드
- [x] `POST /api/v1/users/me/gdpr/delete` — 즉시 하드 삭제 요청 (비밀번호 재확인, OAuth 계정은 null 허용)
- [x] 삭제 연쇄: GdprAccountDeletedEvent → GdprReportCleanupHandler(report 도메인) → refresh_tokens revoke → users 삭제 (CASCADE)

**테스트 체크리스트**
- [ ] 🔬 export API → 사용자 데이터 JSON 완전성 검증
- [ ] 🔬 delete API → 데이터 완전 삭제 확인
- [x] 🛡️ 타 사용자 GDPR 요청 거부 — @AuthenticationPrincipal으로만 userId 획득 (7개 단위 테스트 통과)

---

### Sprint 8 완료 기준
- [x] **스케줄러 안정**: ShedLock으로 중복 실행 방지 (6개 Job)
- [x] **Circuit Breaker**: 모든 외부 호출(AI Agent / NVD / DNS) 장애 격리
- [ ] **성능 목표 달성**: p95 < 500ms, 캐시 히트율 > 80%
- [ ] **보안 기본선**: OWASP ZAP Critical 0건
- [x] **2FA**: TOTP 기반 2단계 인증 동작 (복구 코드 포함)
- [x] **IP Allowlist**: CIDR 범위 기반 차단 + Spoofing 방어
- [x] **OpenTelemetry**: Backend → AI Engine 분산 트레이싱 전체 연결
- [x] **GDPR**: Export/Delete API 동작
- [x] **보안 문서 자동 생성 Level 1**: CISO·행안부·ISMS-P 3종 PDF 생성
- [x] **SBOM Page**: 백엔드 GET 엔드포인트 + 프론트엔드 화면 (mock 제거)
- [x] **Nginx + SSL**: API Gateway 라우팅 + 보안 헤더 통합

---

## Sprint 9 — VSCode Extension & 모니터링 (Phase 3)
> Week 19-20

### EPIC-11: Phase 3

---

#### TASK-901 🟡 지속 모니터링 서비스 ✅ 완료 (2026-05-23)
- **중요도**: 🟡 Medium

**하위 할일**
- [x] `MonitoringJob` + `MonitoringService`
- [x] `MonitoringResult` + 파티션 테이블
- [x] Slack Webhook
- [x] SSL 만료 알림

**테스트 체크리스트**
- [x] 🔬 매시 정각 → 활성화된 모니터링 대상 Passive 스캔 (단위 테스트 — 비즈니스 로직 커버)
- [x] 🔬 SSL 만료 30일 전 → Slack 알림 (단위 테스트 통과)
- [x] 🔬 새 CVE 발표 → NvdSyncCompletedEvent 수신 구조 검증 (재매칭 로직은 SBOM 도메인 연계 후 구현)
- [ ] ✅ Slack 채널에 알림 포스팅 확인 (수동 검증 필요 — SECUREAI_SLACK_WEBHOOK_URL 설정 후)

---

#### TASK-902 🟢 VSCode Extension 기초 ✅ 완료 (2026-05-23)
- **중요도**: 🟢 Low

**하위 할일**
- [x] `vsce` 프로젝트 초기화 (`apps/vscode_ext/` 신규)
- [x] Backend API 재사용 (`apiClient.ts` 폴링 30s 타임아웃)
- [x] Diagnostic API 취약점 표시 (`diagnosticProvider.ts` SEVERITY_MAP)
- [x] Marketplace 배포 준비 → MVP 범위: 로컬 `.vsix` 빌드까지 (Marketplace는 EPIC-MISC)

**테스트 체크리스트**
- [x] 🔬 VSCode에서 분석 실행 → Problems 탭에 취약점 표시 (TypeScript 컴파일 + 구현 코드 검증 완료)
- [ ] ✅ Extension 설치 → API 키 입력 → 분석 성공 (수동 검증 필요 — `npm run package` + `code --install-extension`)
- [ ] ✅ Diagnostic 표시 — 라인에 빨간 밑줄 (수동 검증 필요)

---

#### TASK-903 🟢 Android 고도화 ✅ 완료 (2026-05-23)
- **중요도**: 🟢 Low

**하위 할일**
- [x] `ChatScreen.kt` 스트리밍 (SseClient 재사용 Compose UI)
- [x] PDF 공유 (FileProvider + Path Traversal 방어)
- [x] 알림 채널 세분화 (3채널: analysis_completion / vulnerability_critical / monitoring_alert)

**테스트 체크리스트**
- [ ] ✅ Android AI 채팅 → 스트리밍 응답 표시 (수동 검증 — 에뮬레이터 또는 기기)
- [ ] ✅ PDF 리포트 → 다른 앱으로 공유 (Gmail, Drive 등) (수동 검증)
- [ ] ✅ 알림 채널별 사운드/진동 다르게 설정 (수동 검증)

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

#### TASK-906 🟠 Prometheus + Grafana 대시보드 ✅ 완료 (2026-05-22)
- **중요도**: 🟠 High | **출처**: FEAT-OPS-002

**하위 할일**
- [x] `prometheus.yml` 설정
- [x] Grafana 대시보드 JSON (분석 처리량, 에러율, DAST 실행시간, AI 토큰 사용량)
- [x] 커스텀 메트릭: 분석 완료 수, 평균 분석 시간, DAST 성공률

**테스트 체크리스트**
- [x] ✅ Prometheus 타겟 모두 UP (secureai-backend UP, secureai-ai-engine UP — 2026-05-22 확인)
- [x] ✅ Grafana 대시보드 — 분석 처리량, 에러율, DAST 실행시간 표시 (4개 패널 프로비저닝 확인)
- [x] ✅ 커스텀 메트릭 — `secureai_analysis_sessions_total` 외 4종 `/actuator/prometheus` 노출 확인

---

#### TASK-907 🟠 GDPR 하드 삭제 스케줄러 (R-03-C) ✅ 완료 (2026-05-22)
- **중요도**: 🟠 High | **출처**: 리팩토링 로드맵 R-03-C | **규모**: L (2일)

> 사용자 소프트 삭제(`deleted_at` 기록) 후 30일이 지난 계정과 연관 데이터를  
> 자동으로 완전 삭제하는 배치 스케줄러. TASK-801(ShedLock)과 연계.

**하위 할일**
- [x] `GdprHardDeleteJob.java` — `@Scheduled` + `@SchedulerLock` (ShedLock)
- [x] 삭제 대상: `users`, `vulnerabilities`, `analysis_sessions`, `exploit_results`, `reports` 연쇄 삭제
- [x] 삭제 전 감사 로그(`audit_logs`) 기록 후 제거
- [x] 삭제 완료 알림 이메일 발송 (EmailService 연동)
- [x] `GET /admin/gdpr/pending-deletions` — 관리자 대기 목록 조회 API

**테스트 체크리스트**
- [x] 🧪 `GdprHardDeleteJob` — `deleted_at` 30일 초과 계정만 선택 정확성 (8개 단위 테스트 통과)
- [x] 🔬 감사 로그 — 삭제 직전 로그 기록 후 사용자 데이터 제거 확인 (순서 단위 테스트 통과)
- [ ] 🔬 소프트 삭제 후 30일 경과 시뮬레이션 → 연관 데이터 전체 삭제 확인 (통합 환경 필요)
- [ ] 🔬 다중 인스턴스 환경 → ShedLock으로 1회만 실행 (다중 인스턴스 환경 필요)
- [x] 🛡️ 소프트 삭제 후 29일 계정 → 삭제 대상에서 제외 (단위 테스트 통과)
- [ ] ✅ 삭제 완료 알림 이메일 수신 확인 (수동 검증 필요)

---

### Sprint 9 완료 기준
- [ ] **지속 모니터링**: 24/7 자동 스캔 동작
- [ ] **VSCode Extension**: Marketplace 등록 가능 수준
- [ ] **Android 완성도**: 채팅·리포트·알림 고도화
- [ ] **PostgreSQL MCP**: AI Agent DB 직접 조회 연동
- [ ] **Prometheus + Grafana**: 운영 대시보드 가동
- [ ] **GDPR 스케줄러**: 30일 경과 계정 자동 하드 삭제 동작

---

## Sprint 10 — Enterprise B2B + GitHub Integration
> Week 21-22  
> **2026-05-23 추가**: Sprint 5 이월 GitHub Layer 2 태스크(TASK-501~504)를 Sprint 10에 공식 편입.  
> GitHub Integration(TASK-501/502) → Enterprise(TASK-1001~1004) 순서로 진행.  
> `feat/sprint5-github` 브랜치를 `feat/sprint10-github`로 리베이스 후 작업.

### EPIC-12: Enterprise 고도화

---

#### TASK-1001 🔴 야간 자동 스캔 스케줄링 (Nightly Scan)
- **중요도**: 🔴 Critical | **의존성**: TASK-801 (ShedLock)

**하위 할일**
- [ ] `project_schedules` 엔티티 및 Repository 구현
- [ ] `NightlyScanJob` (ShedLock 연동) 구현: 매시 정각에 대상 프로젝트 조회
- [ ] GitHub Commit SHA 또는 `updated_at` 비교하여 **변경된 파일과 종속성만** 필터링 로직 구현
- [ ] 자동 스캔 완료 후 요약 리포트 이메일/Slack 발송 모듈 구현

**테스트 체크리스트**
- [ ] 🔬 변경사항이 없는 레포지토리는 스캔 건너뛰기
- [ ] 🔬 스케줄 시간이 된 여러 프로젝트가 분산 환경에서 1번만 스캔되는지 확인

---

#### TASK-1002 🟠 팀 대시보드 & Gamification
- **중요도**: 🟠 High

**하위 할일**
- [ ] `TeamDashboardService` 구현: 월별 토큰 예산 산출, 팀원별 사용량 합산
- [ ] MTTR (평균 조치 시간) 계산 로직: `resolved_at - created_at` 집계
- [ ] `users.security_score` 업데이트 이벤트: 취약점 해결 시 점수 부여 로직
- [ ] 프론트엔드: 팀 멤버별 점수 랭킹 UI 및 게이지 차트 컴포넌트 추가

---

#### TASK-1003 🟠 리포트 위젯 PDF/HTML Export
- **중요도**: 🟠 High | **의존성**: TASK-701

**하위 할일**
- [ ] ROI 요약 (절감 시간, 절감 비용) 계산 서비스
- [ ] OpenHTMLtoPDF 기반 템플릿에 ROI, MTTR 차트 위젯 주입 렌더링
- [ ] 프론트엔드: "리포트 내보내기" 다이얼로그에 위젯 포함 체크박스 추가

---

#### TASK-1004 🟡 스캔 모드 선택 (Audit vs Pipeline)
- **중요도**: 🟡 Medium

**하위 할일**
- [ ] 분석 세션 생성 시 `scan_mode` 파라미터 매핑
- [ ] LangGraph `sast_node`에서 모드 분기 (Audit: 저비용 빠른 모델, Pipeline: 고비용 추론 모델 + 엄격한 검증)
- [ ] 프론트엔드: 분석 시작 버튼 클릭 시 모드 선택 모달 추가

---

## Sprint 11 — Workspace UI Redesign (온보딩 및 맞춤형 레이아웃)
> Week 23-24 | 목표: 사용자 페르소나별 가입 온보딩 구축, Next.js 레이아웃의 역할 분기 및 `frontend-refactoring` 스타일 이식

### TASK-1101 🔴 Onboarding Step 0 역할 선택 UI 구현
- **중요도**: 🔴 Critical | **순서**: 1번째
- **하위 할일**
  - [ ] 온보딩 시작 페이지에 개발자(Developer) 및 보안 관리자(Security Manager) 모드 선택 카드 구현
  - [ ] 선택한 역할을 `PATCH /api/v1/users/me/workspace-mode` API를 호출해 백엔드에 반영하고 `useAuthStore` 갱신
- **테스트 체크리스트**
  - [ ] ✅ 가입 온보딩 시 역할을 선택하면 다음 단계가 활성화되고 백엔드 DB 컬럼 값이 동기화되는지 확인

### TASK-1102 🔴 로그인 후 페르소나별 맞춤형 랜딩 및 레이아웃 분기
- **중요도**: 🔴 Critical | **순서**: 2번째
- **하위 할일**
  - [ ] `DEVELOPER` 모드 ➡️ 로그인 후 `/editor` 에디터로 다이렉트 랜딩, IDE 다크 테마 레이아웃 제공
  - [ ] `SECURITY_MANAGER` ➡️ 로그인 후 `/dashboard` 대시보드로 다이렉트 랜딩, 차트 중심 대시보드 레이아웃 제공
  - [ ] 좌측 사이드바 내비게이션 메뉴를 모드별로 동적 노출/숨김 처리
- **테스트 체크리스트**
  - [ ] ✅ 개발자로 로그인 시 사이드바에서 CISO용 대시보드가 숨겨지고 에디터가 메인에 뜨는지 확인
  - [ ] ✅ 보안 관리자로 로그인 시 에디터가 단순 '읽기 전용 코드 뷰어'로 표시되고 대시보드가 활성화되는지 확인

### TASK-1103 🟠 `frontend-refactoring` 디자인 토큰 및 CSS 이식
- **중요도**: 🟠 High | **순서**: 3번째
- **하위 할일**
  - [ ] `frontend-refactoring/redesign-tokens.css`를 Next.js `app/globals.css`에 병합
  - [ ] 온보딩(Step 1~3), 에디터(V4 하이브리드 스타일), 대시보드(통합 차트 스타일)를 프로토타입 스타일로 리팩토링
- **테스트 체크리스트**
  - [ ] ✅ 모든 페이지의 다크 테마, 카드 외곽선, 섀도우, 폰트가 Pagori Redesign 스타일과 완전 일치하는지 확인

---

## Sprint 12 — Hardening & System Stabilization (시스템 안정화)
> Week 25-26 | 목표: SQL 파라미터 바인딩 원칙 복원 및 CI/CD 성능/보안 게이트웨이 자동화

### TASK-1201 🔴 ADR-016 전환 (Backend API 경유)
- **중요도**: 🔴 Critical | **순서**: 1번째
- **하위 할일**
  - [ ] AI Engine에서 직접 PostgreSQL을 조회하는 f-string SQL 구문 제거
  - [ ] Backend에 내부 통신 전용 API (`GET /internal/v1/projects/{id}/vuln-context` 및 `GET /internal/v1/projects/{id}/patch-example`) 구현 (파라미터 바인딩 및 REST API 규격화)
  - [ ] AI Engine에서 Backend API를 호출하여 취약점 컨텍스트 및 패치 예시를 획득하도록 수정
- **테스트 체크리스트**
  - [ ] 🧪 AI Engine에서 직접 DB 연결 설정 제거 시에도 분석 기능 정상 작동
  - [ ] 🔬 Backend API 호출 시 권한 검증 및 SQL 파라미터 바인딩 작동 여부 검증
  - [ ] 🛡️ 외부에서 internal API 호출 시 차단 동작 검증 (`X-Internal-Key` 헤더 체크)

### TASK-1202 🔴 감사 로그 불변성 및 세션 이력 관리
- **중요도**: 🔴 Critical | **순서**: 2번째
- **하위 할일**
  - [ ] `AuditLog` 테이블에 해시 체이닝 구현 (이전 감사 로그 항목의 해시를 다음 로그가 포함하여 체인 형성 - FEAT-COMP-003)
  - [ ] 사용자 활성 세션(기기별/토큰별) 조회를 위한 `user_sessions` 관리 테이블 추가 및 세션 이력 조회 API 구현
  - [ ] 관리자 콘솔 또는 프로필 설정에서 특정 세션 강제 로그아웃 기능 구현 (FEAT-SEC-003)
- **테스트 체크리스트**
  - [ ] 🧪 감사 로그가 하나라도 위변조(중간 삭제 또는 해시 불일치)될 경우 무결성 검증 API에서 감지 성공
  - [ ] 🔬 활성 세션 강제 로그아웃 시 즉시 JWT Access/Refresh Token 무효화 및 접근 거부

### TASK-1203 🟡 k6 및 ZAP CI/CD 파이프라인 연동
- **중요도**: 🟡 Medium | **순서**: 3번째
- **하위 할일**
  - [ ] k6 부하 테스트 스크립트(`make perf-test` gate)를 GitHub Actions 파이프라인에 통합하여 p95 < 500ms 성능 만족 여부 자동 검증
  - [ ] OWASP ZAP 보안 스캔 이미지를 CI 파이프라인 내 빌드 태스크 단계에 주입하여 Critical/High 취약점 0건 게이트 구성
- **테스트 체크리스트**
  - [ ] 🔬 성능 저하가 있거나 보안 취약점이 발견된 빌드는 PR 병합(Merge) 단계에서 자동으로 빌드가 중단되는지 검증

---

## Sprint 13 — AI Agent Advanced I (API 호출 경로 스캔 & 오탐 학습)
> Week 27-28 | 목표: API 의존성 기반의 Taint Analysis 구현 및 pgvector를 활용한 오탐 자동 회피

### TASK-1301 🔴 멀티 파일 컨텍스트 분석 (API 호출 흐름 추적)
- **중요도**: 🔴 Critical | **순서**: 1번째
- **하위 할일**
  - [ ] API 엔트리 포인트(Controller, Axios, Swagger)를 읽어 호출 가중치를 파악하는 `call_graph_builder` 모듈 구현
  - [ ] LangGraph 분석 순서를 API 호출 순서(Controller -> Service -> Repository)에 따라 동적으로 가중치 정렬하여 스캔
  - [ ] 스캔 진행 시 API 경로 매핑 상황과 진척 상태를 실시간 SSE progress로 스트리밍 (FEAT-AI-001)
- **테스트 체크리스트**
  - [ ] 🔬 API 진입점에 정의된 파일 및 직접 연결된 의존성 파일들이 스캔 큐 최상단에 우선 배치되는지 확인
  - [ ] ✅ 프론트엔드 진행률 UI에서 "API 호출 경로 추적 중" 단계와 현재 매핑 스캔 중인 경로 텍스트가 정상 출력되는지 확인

### TASK-1302 🟠 취약점 오탐 학습 & 산업 도메인 커스텀
- **중요도**: 🟠 High | **순서**: 2번째
- **하위 할일**
  - [ ] 개발자가 '오탐(False Positive)'으로 지정한 코드 조각과 사유를 저장하는 `false_positive_patterns` 테이블 구현 (FEAT-AI-003)
  - [ ] 분석 시작 시 프로젝트의 해당 오탐 패턴들을 pgvector 기반 검색하여 프롬프트 내 Few-shot(Negative Examples)으로 자동 주입
  - [ ] 산업 도메인(핀테크, 의료, 공공 등) 설정에 맞춰 각 도메인 가이드라인(MD/DB) 및 규정 준수 패치 가이드를 프롬프트 컨텍스트에 주입하는 RAG 파이프라인 구현
- **테스트 체크리스트**
  - [ ] 🔬 오탐 지정된 파일 패턴과 완전히 동일한 오탐 시나리오가 다음 분석 시 자동으로 필터링 및 스킵되는지 검증
  - [ ] 🔬 핀테크 도메인 프로젝트의 경우 암호화 규격(AES-GCM 등) 및 세션 만료 정책 관련 가이드라인이 프롬프트 컨텍스트에 올바르게 포함되는지 검증

---

## Sprint 14 — AI Agent Advanced II (패치 자동화 및 격리 검증)
> Week 29-30 | 목표: 승인된 패치의 자동 PR 생성 및 Docker 샌드박스를 활용한 단위 테스트 기반 자가 검증

### TASK-1401 🟠 패치 자동 적용 및 GitHub PR 생성
- **중요도**: 🟠 High | **순서**: 1번째
- **하위 할일**
  - [ ] 취약점 패치 적용 요청 시, GitHub API를 통해 신규 패치 브랜치를 자동 생성하고 수정 사항을 커밋하는 로직 구현
  - [ ] 원본 브랜치에 대해 Pull Request를 자동으로 개설하는 API 구현 (FEAT-AI-002)
- **테스트 체크리스트**
  - [ ] 🔬 패치 적용 완료 시 GitHub 저장소에 PR 코멘트와 함께 실제 PR이 등록되는지 검증

### TASK-1402 🟠 패치 검증 자동화 (VC Feedback Loop)
- **중요도**: 🟠 High | **순서**: 2번째
- **하위 할일**
  - [ ] AI가 제안한 패치 코드를 컴파일하고 검증할 임시 테스트 코드를 Claude API로 동시 생성하는 모듈 구현
  - [ ] 임시 격리된 Docker 샌드박스 컨테이너 내부에서 패치 코드를 적용한 뒤 테스트를 실행하고 pass 여부를 수집 (FEAT-AI-005)
  - [ ] 테스트를 성공적으로 통과한 검증된 패치만 `patchSuggestions.verificationStatus`에 Verified로 표기하여 사용자에게 추천
- **테스트 체크리스트**
  - [ ] 🔬 문법 에러가 있거나 기존 테스트를 깨뜨리는 패치 제안은 검증 상태가 Failed로 분류되는지 확인
  - [ ] 🔬 정상 컴파일되고 취약점이 조치된 경우에만 Verified 상태로 업데이트되는지 확인

---

## Sprint 15 — Ecosystem & MCP Server Expansion (MCP/API 확장)
> Week 31-32 | 목표: AI Agent 기능 확장을 위한 MCP 서버 추가 도입 및 보안 데이터 Outbound 연동

### TASK-1501 🟠 MCP 서버 라인업 보강 (Redis & Brave Search)
- **중요도**: 🟠 High | **순서**: 1번째
- **하위 할일**
  - [ ] AI Agent가 캐시 히트율, 분산 락 상태, SSE 채널 상태를 디버깅할 수 있는 `mcp-server-redis` (MCP-003) 구축
  - [ ] NVD API 캐시 미스 시 AI Agent가 실시간 웹 검색으로 최신 CVE 및 보안 패치 우회법을 검색할 수 있도록 `mcp-server-brave-search` (MCP-004) 연동
- **테스트 체크리스트**
  - [ ] 🔬 AI Agent가 분석 중 외부 NVD 정보 수집을 위해 Exa/Brave Search MCP 도구를 자율적으로 호출하는지 확인
  - [ ] 🔬 Redis 캐시 및 락 상태 조회가 MCP 도구를 통해 에이전트 컨텍스트에 주입되는지 확인

### TASK-1502 🟠 Outbound Webhook 및 데이터 내보내기 고도화
- **중요도**: 🟠 High | **순서**: 2번째
- **하위 할일**
  - [ ] 분석 완료, Critical 발견 시 외부 시스템으로 웹훅을 발송하는 Outbound Webhook 시스템 구현 (FEAT-API-003)
  - [ ] 취약점 내보내기 형식을 SARIF (GitHub Code Scanning 호환), JIRA XML, CSV 포맷 등으로 다각화 (FEAT-API-002)
- **테스트 체크리스트**
  - [ ] 🔬 분석 완료 이벤트 발생 시 등록된 웹훅 엔드포인트로 정상 payload가 발송되는지 검증
  - [ ] 🔬 SARIF 포맷으로 다운로드하여 GitHub Code Scanning 탭에 정상 업로드되는지 확인

---

## Sprint 16 — Live Scan Visual Simulator & Observability (실시간 시각화)
> Week 33-34 | 목표: SSE 이벤트를 시각 정보로 변환하는 모던한 라이브 검사 시뮬레이터 및 운영 모니터링 활성화

### TASK-1601 🟠 모던 실시간 스캔 라이브 시뮬레이터
- **중요도**: 🟠 High | **순서**: 1번째
- **하위 할일**
  - [ ] DAST 테스트 동작 시 흘러나오는 실시간 공격 유형, 클릭 좌표, 페이로드 전송 등의 SSE 상세 이벤트를 파싱하는 리스너 구현 (FEAT-FE-007)
  - [ ] 프론트엔드 대시보드 내에 모던하고 정갈하게 디자인된 가상 웹 브라우저/네트워크 모형 위젯 구현
  - [ ] DAST 공격 이벤트 수신 시 가상 화면의 버튼 클릭, 폼 필드 페이로드 자동 타이핑 효과, DB로 흐르는 패킷 전기 신호 효과 등을 깔끔한 CSS/React 애니메이션으로 시각화 (해커 스크린 느낌을 빼고, 실시간 보안 검사 진행 상태를 모던하게 전달)
- **테스트 체크리스트**
  - [ ] ✅ DAST 스캔 시작 -> SSE 이벤트 유입 시 프론트엔드 모션 위젯이 끊김 없이 부드럽게(60fps) 동기화되어 동작하는지 확인
  - [ ] ✅ 통계 탭 이외의 라이브 검사 창을 띄웠을 때, 직관적으로 현재 침투 테스트가 어느 구간(Web 클라이언트 vs DB 영역)에서 일어나고 있는지 눈으로 확인 가능한지 검증

### TASK-1602 🟠 Prometheus 커스텀 메트릭 고도화 및 슬랙 연동
- **중요도**: 🟠 High | **순서**: 2번째
- **하위 할일**
  - [ ] 모니터링 에러 트래킹을 위한 Slack 알림 채널 세분화 및 Grafana 대시보드 알림 연계
  - [ ] AI Agent의 토큰 소모 속도 및 분석 시간 통계를 Prometheus 게이지로 연계
- **테스트 체크리스트**
  - [ ] ✅ 모니터링 시스템 장애 또는 만료 SSL 발견 시 지정 슬랙 채널 알림 수신 성공


---

## EPIC-MISC — 독립 기능 (스프린트 비종속)


> 스프린트 사이클과 독립적으로 개발되는 기능들.  
> 각 기능은 별도 브랜치에서 개발 후 main에 PR.

---

### TASK-MISC-002 🟠 보안 문서 자동 생성 (EPIC-SEC-DOC) ✅ 완료 (2026-05-22, Level 1)
- **브랜치**: `feat/sec-doc`
- **현재 상태**: Level 1 완료 — 2026-05-22
- **대상 사용자**: 보안 전문가, 사내 보안 담당자, 바이브코더(상사 보고용)

> SAST 분석 결과를 정부 제출 문서·사내 보고서·국제 표준 증적으로 자동 변환.  
> Level 1(템플릿 매핑)부터 시작, Level 2(LangGraph 아키텍처 추출)로 확장.

**Level 1 — 템플릿 기반 (SAST 결과 → 문서)** | **Flyway**: V040

하위 할일
- [x] `build.gradle.kts` 의존성: `spring-boot-starter-thymeleaf` + `io.github.openhtmltopdf:openhtmltopdf-pdfbox:1.1.37` (Flying Saucer 사용 금지 — HTML5 비호환). PDFBox 기반으로 안정적
- [x] `V040__create_security_doc_requests.sql` — 생성 이력, 다운로드 토큰
- [x] `POST /api/v1/projects/{id}/reports/security?docType=CISO|HANAFOS|ISMS` + `GET` 상태/다운로드 엔드포인트
- [x] `SecurityDocService.java` + `SecurityDocAsyncProcessor.java` — SAST 결과 → Thymeleaf → OpenHTMLtoPDF. 기존 `PdfReportGenerator.java`(OpenPDF) 건드리지 않음
- [x] `SecurityDocController.java`
- [x] Thymeleaf 템플릿 3종:
  - `ciso-report.html` — 취약점 현황, 위험도 분포, 미조치 항목 (사내 CISO/팀장 보고)
  - `hanafos-checklist.html` — 행안부 SW개발보안 가이드 43개 항목 매핑 (공공기관 제출)
  - `isms-p-evidence.html` — ISMS-P 개발보안 통제항목 이행현황 (인증 심사 증적)
- [x] 프론트엔드: `SecurityDocPage.tsx` 문서 유형 선택 카드 + 생성 상태 폴링 + 다운로드

**Level 2 — LangGraph 아키텍처 추출 (코드 → 보안 아키텍처 문서)**

> MCP Filesystem이 이미 소스 전체를 읽고 SAST 파이프라인이 보안 패턴을 추적하므로,  
> `extract_security_architecture` 노드 추가만으로 구현 가능 (FEAT-AI-001 Taint Analysis와 시너지).

하위 할일
- [ ] LangGraph `security_arch_extractor` 노드 — 인증방식·암호화 알고리즘·접근통제·외부 API 호출·민감 데이터 흐름 추출
- [ ] `SecurityArchDocument.java` 스키마 (AuthMethod, EncryptionUsage, NetworkBoundary, SensitiveDataFlow)
- [ ] `security-arch-report.html` 템플릿 (접근통제 매트릭스, 암호화 현황, 아키텍처 다이어그램 텍스트)

**테스트 체크리스트**
- [x] 🧪 SecurityDocServiceTest — 10개 단위 테스트 통과 (소유권 거부, 만료 토큰, DocType 매핑 등)
- [x] 🛡️ 타 사용자 프로젝트 문서 생성 요청 → 403 차단 (ProjectService.isMember 검증)
- [ ] 🔬 CISO 보고서 — 취약점 severity 분포·미조치 수 정확성 검증
- [ ] 🔬 행안부 체크리스트 — SAST 결과 → 43개 항목 매핑 정확성
- [ ] 🔬 ISMS-P 증적 — 통제항목 준수/미준수 판정 로직
- [ ] 🔬 문서 생성 → 30초 이내 PDF 완성
- [ ] ✅ 생성된 PDF — 행안부 양식 항목 누락 없음 육안 확인
- [ ] ✅ CISO 보고서 — 경영진이 읽기 적합한 수준 가독성 확인

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
| FEAT-SEC-007 | 2FA 강제 리셋 관리자 API | 🟠 High | 관리자가 특정 사용자의 2FA를 강제 비활성화하는 API. 사용자가 TOTP 디바이스 분실 + 복구 코드 소진 시 계정 잠금 해제. `POST /api/v1/admin/users/{userId}/2fa/reset`. 감사 로그(`AuditLog`) 기록 필수. Admin 전용 엔드포인트 — `ROLE_ADMIN` 권한 체크. (주의: FEAT-SEC-006은 pgvector 임베딩으로 사용됨) |
| FEAT-SEC-008 | SSO/SAML 싱글 사인온 연동 | 🟠 High | Okta, Azure AD, Google Workspace 등 기업용 계정 관리 시스템과 로그인 연동 |
| FEAT-SEC-009 | 프로젝트 권한 모델(RBAC) 세분화 | 🟠 High | 팀 단위 결제 및 특정 마이크로서비스 폴더에만 개발자 접근 권한을 매핑하는 RBAC 스키마 확장 |


### API 기능 보완

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-API-001 | 분석 비교 API (Diff) | 🟠 High | 두 세션 간 취약점 증감 비교. `newVulnerabilities`, `fixedVulnerabilities`, `securityScoreDelta` 반환 |
| FEAT-API-002 | 취약점 내보내기 (Export) | 🟠 High | CSV, JSON, SARIF (GitHub Code Scanning), JIRA XML 포맷 추가 |
| FEAT-API-003 | Outbound Webhook | 🟠 High | `analysis.completed`, `vulnerability.critical_found`, `sla.breached` 이벤트를 외부 시스템으로 발송 |
| FEAT-API-004 | SBOM 다운로드 포맷 추가 | 🟡 Medium | SPDX 2.3 (NTIA 준수), CycloneDX XML, CSV 포맷 추가 |
| FEAT-API-005 | 분석 스케줄링 API | 🟡 Medium | 정기 자동 분석 예약. `POST /projects/{id}/analysis/schedule`, cronExpression 지원 |
| FEAT-API-006 | 양방향 Slack App ChatOps Bot | 🟠 High | Slack 커맨드 스캔 트리거 및 알림 메시지 내 버튼 클릭을 통한 패치 승인/반려 기능 |


### AI Agent 고도화

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-AI-001 | 멀티 파일 컨텍스트 분석 (API 호출 흐름 추적) | 🔴 Critical | API 엔트리 포인트(Controller/Axios/Swagger)를 선분석하여 호출 경로를 추출하고, 연관 파일(Service->Repository)을 우선적으로 추적·스캔하는 Taint Analysis 파이프라인. 스캔 진행 시 API 경로 매핑 상황을 실시간 SSE progress로 스트리밍. |
| FEAT-AI-002 | 패치 자동 적용 (PR 생성) | 🟠 High | 패치 승인 → GitHub API로 브랜치 생성 → 파일 수정 커밋 → PR 자동 생성. `POST /patches/{id}/create-pr` |
| FEAT-AI-003 | 취약점 오탐 학습 & 산업 도메인 커스텀 | 🟠 High | 오탐 패턴을 프로젝트별로 학습해 재분석 시 Negative Few-shot으로 활용하는 `false_positive_patterns` 테이블 및 산업 도메인별 가이드라인(RAG)을 프롬프트 컨텍스트에 주입하는 기능. |
| FEAT-AI-004 | 다국어 코드 지원 확장 | 🟡 Medium | 현재 Java/TypeScript/Python에서 Go, Rust, C/C++, PHP, Ruby 추가 |
| FEAT-AI-005 | 패치 검증 자동화 | 🟡 Medium | 생성된 패치 코드를 임시 컨테이너에서 자동으로 단위 테스트 실행 후 pass 여부를 `patchSuggestions.verificationStatus`에 저장. 패치 생성 시 테스트 코드를 Claude API로 동시 생성 → 도커 컨테이너에서 실행 → 검증 통과(Verified) 패치만 사용자에게 추천. VC 피드백(AI 환각 제어) 핵심 구현 항목. `patch_suggestions.verified_at`, `test_code` 컬럼 추가 필요 (Flyway 미배정) |


### VSCode Extension 고도화 (IDE 내 조치 완결)

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-IDE-001 | Quick Fix (IDE 원클릭 패치 적용) | 🟠 High | 코드 내 취약점 밑줄(squiggly line)에 마우스를 올리고 "Quick Fix" 클릭 시, AI 제안 패치를 해당 파일에 즉시 적용하는 기능. |
| FEAT-IDE-002 | WebView Chat Panel (IDE 내 대화형 조치) | 🟠 High | 브라우저 이동 없이 VSCode 사이드바의 웹뷰 패널에서 AI Agent와 취약점 조치 관련 실시간 질의응답 및 수정 코드 조율. |
| FEAT-IDE-003 | Status Bar Integration | 🟢 Low | 현재 활성화된 프로젝트의 보안 스코어와 분석 상태를 에디터 하단 상태 표시줄에 실시간 노출. |


### AI 에이전트 자가 제어 및 안전장치

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-AI-006 | 패치 자동 롤백 및 이력 관리 | 🟠 High | 적용된 패치로 인해 빌드가 깨지거나 테스트가 실패할 경우 Git Revert 커밋을 자동 개설하여 패치를 이전 상태로 롤백하는 안전장치. |


### 컴플라이언스

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-COMP-002 | 컴플라이언스 매핑 리포트 | 🟡 Medium | 취약점을 ISO 27001, NIST CSF, PIMS, PCI-DSS 프레임워크에 매핑. 현재 OWASP Top 10만 지원 |
| FEAT-COMP-003 | 감사 로그 불변성 보장 | 🟡 Medium | 로그 항목마다 이전 항목 해시 체이닝. 또는 AWS CloudTrail/Azure Monitor 외부 전송. 무결성 검증 API 추가 |

### 프론트엔드 Pagori 리디자인 구현 현황 (2026-05-19 분석)

> `frontend-refactoring/Pagori Redesign.html` 기준 — `apps/frontend/src/` 구현 여부 대조

| 화면 | 디자인 파일 컴포넌트 | 구현 상태 | 경로 | Sprint 배정 |
|------|---------------------|----------|------|------------|
| 대시보드 | Dashboard, KpiCard, SecurityScoreRing, SeverityBarChart, TrendLineChart, FileHeatmap, OwaspCoverageMatrix | ✅ 완료 | `components/dashboard/` | — |
| 코드 에디터 | EditorLayout, FileTree, InlineHighlight, SuggestionPanel, SessionLog | ✅ 완료 | `components/editor/` | — |
| 프로젝트 목록 | ProjectCard, CreateProjectModal | ✅ 완료 | `components/project/` | — |
| 로그인 / 회원가입 | LoginForm, RegisterForm, GitHubOAuthButton | ✅ 완료 | `app/auth/` | — |
| PDF 리포트 모달 | PdfReportModal (포맷 선택, 상태 폴링) | ✅ 완료 | `components/analysis/PdfReportModal.tsx` | — |
| 커밋 시크릿 스캔 | CommitSecretScanModal | ✅ 완료 | `components/analysis/CommitSecretScanModal.tsx` | — |
| SBOM & CVE | SbomPage (컴포넌트 테이블, CVE 매핑) | ✅ 완료 | `components/analysis/SbomPage.tsx` + `app/projects/[projectId]/sbom/page.tsx` | — |
| GitHub 레포 스캔 | GitHubScanModal (URL·브랜치 입력 → 직접 분석 트리거) | ❌ 미구현 | 신규 필요 (FEAT-FE-002) | **Sprint 10** (TASK-501/502 GitHub Integration 연계) |
| 컴플라이언스 리포트 | CompliancePage (ISO 27001 / NIST CSF 매핑 표) | ❌ 미구현 | 신규 필요 (FEAT-FE-003) | **Sprint 10** (FEAT-COMP-002 백엔드와 동시 구현) |
| 팀 관리 | TeamManagementPage (초대, 권한 설정) | ❌ 미구현 | 신규 필요 | **Sprint 10** (Enterprise TASK-1002 팀 대시보드와 연계) |
| 설정 | SettingsPage (알림·플랜·API 키) | ❌ 미구현 | 신규 필요 | **Sprint 10** (Enterprise 플랜 관리 UI 필수) |
| 알림 센터 | NotificationsPage (FCM/In-App 알림 목록) | ❌ 미구현 | 신규 필요 | **EPIC-MISC** (FCM 푸시 인프라 미구축 — 인프라 구축 후 편입) |
| 분석 비교 | DiffPage (두 세션 취약점 증감 비교) | ❌ 미구현 | FEAT-API-001 백엔드 선행 필요 | **EPIC-MISC** (FEAT-API-001 Diff API 백엔드 완료 후 편입) |
| 워크스페이스 모드 | Onboarding Step 0 (개발자 vs 보안팀 모드 온보딩 및 맞춤형 UI 제공) | ❌ 미구현 | 신규 필요 (FEAT-FE-004) | **Sprint 10** (Stage 5 프론트엔드 연계 및 모드 전환) |
| 스캔 시뮬레이터 | DastVisualSimulator (SSE 기반 모의 침투 및 DB 접근 라이브 애니메이션) | ❌ 미구현 | 신규 필요 (FEAT-FE-007) | **EPIC-MISC** (AI Engine 실시간 상세 SSE 연계) |

**미구현 화면 6개** (원문 "7개"는 집계 오류) — Sprint 10: 4개, EPIC-MISC: 2개로 배정 완료 (2026-05-23).

---

### 프론트엔드 리팩토링 중 발견된 누락 API

#### FEAT-FE-001 SBOM 컴포넌트 조회 API ✅ 완료 (2026-05-22)

- **엔드포인트**: `GET /api/v1/projects/{projectId}/sbom/components?sessionId={sessionId}` (인증 필수 — SecurityConfig HttpMethod.POST 명시로 GET 차단 완료)
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

#### FEAT-FE-004 워크스페이스 모드 전환 및 온보딩 API

- **엔드포인트**: `PATCH /api/v1/users/me/workspace-mode`
- **필요 파일**:
  - `apps/backend/src/main/java/io/secureai/backend/domain/user/entity/User.java` (workspaceMode 필드 추가 및 기본값 DEVELOPER)
  - `apps/backend/src/main/java/io/secureai/backend/domain/user/controller/UserController.java` (모드 전환 API 추가)
  - `apps/frontend/src/store/useAuthStore.ts` (AuthUser 타입 및 persist 스토어 확장)
  - `apps/frontend/src/app/onboarding/page.tsx` (Step 0 페르소나 선택 UI 추가)
- **설명**: 가입 시 사용자가 개발자 또는 보안 관리자 중 선호하는 모드를 선택하게 하며, 선택에 따라 Next.js 라우팅(/editor vs /dashboard) 및 사이드바 메뉴가 자동으로 분기됩니다.
- **요청 예시**:
  ```json
  {
    "workspaceMode": "SECURITY_MANAGER"
  }
  ```

---


### 인프라 & 운영 자동화

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-INFRA-001 | GuidelineSyncJob 스케줄러 | 🟡 Medium | `docs/security/*.md` 파일이 변경될 때마다 `security_guidelines` 테이블을 자동 동기화. 현재는 `generate_guidelines_sql.py`를 수동 실행해야 하므로 가이드라인 최신화가 지연됨. `@Scheduled` Job 또는 Git Webhook 트리거로 구현. `source_path` 컬럼의 마지막 동기화 시각과 파일 수정 시각 비교 후 `UPSERT` 실행 |

---

## Hardening Sprint 로드맵 (미배정)

> Sprint 10 이후, 제품 안정화 단계에서 전체 1~2 Sprint를 보안·성능·품질 강화에 집중 투입.  
> 아래 항목들을 하나의 "Hardening Sprint"로 묶어 처리할 것을 권장함 (2026-05-23 로드맵 편입).

### 보안 강화 대상

| 항목 | 출처 | 세부 내용 |
|------|------|---------|
| ADR-016 전환 — Backend API 경유 | ADR-016 임시 결정 | `_fetch_prev_vuln_context()` + `_fetch_prev_patch_example()` f-string SQL → `GET /internal/v1/projects/{id}/vuln-context` Backend API 경유로 전환. SQL 파라미터 바인딩 원칙 완전 복원 |
| 감사 로그 불변성 (FEAT-COMP-003) | 미래 기능 후보 | AuditLog 항목마다 이전 항목 해시 체이닝. 외부 SIEM(CloudTrail/Azure Monitor) 연동 |
| FEAT-SEC-003 세션 활동 이력 | 미래 기능 후보 | 사용자 활성 세션(기기별) 확인·강제 로그아웃 |
| FEAT-SEC-004 Secrets Detection 강화 | 미래 기능 후보 | 50+ 시크릿 패턴 (AWS Key, GCP SA Key, GitHub PAT, Stripe Key 등) |

### 성능 & 품질 대상

| 항목 | 세부 내용 |
|------|---------|
| Flyway 마이그레이션 통합 테스트 | CI 파이프라인에서 `flyway:migrate` + 롤백 시나리오 자동화 |
| AI 파이프라인 병목 프로파일링 | Jaeger 트레이싱 기반 `sast_node` p99 지연 측정 + asyncio 병렬화 개선 |
| k6 부하 테스트 자동화 | `make perf-test` → CI/CD 파이프라인 통합 (p95 < 500ms 게이트) |
| OWASP ZAP 자동화 | `ghcr.io/zaproxy/zaproxy:stable` → CI 파이프라인 통합 (Critical 0건 게이트) |

---

*관련 문서: `08_CHECKPOINT_FLOW.md` (체크포인트 상세 설계), `00_ARCHITECTURE_DECISIONS.md` (아키텍처 결정 사항), `14_SECURITY_TEAM_FEATURES.md` (보안팀 전용 기능)*
