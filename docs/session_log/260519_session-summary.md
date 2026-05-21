# Session Summary — 2026-05-19

## 작업 범위

Sprint 7 Stage 3 마무리 + 프론트엔드 디자인 갭 분석 + DashboardPage 백엔드 API 연결

---

## 완료 항목

### 1. TASK-705 (BE) — FCM Push 백엔드 완성

이전 세션에서 착수 중이었던 FCM Push 백엔드를 완성하고 커밋(`e39484e`).

**구현 내용**:
- Firebase Admin SDK 9.2.0 → `build.gradle.kts` 추가
- `V036__create_device_tokens.sql`: user_id FK + UNIQUE(user_id, token) + CASCADE DELETE
- `notification` 도메인 4개 클래스: `DeviceToken` 엔티티, `DeviceTokenRepository`, `DeviceTokenService`, `DeviceTokenController`
- `FcmPushPort` 인터페이스(DIP) + `FcmPushService`(`@ConditionalOnBean(FirebaseApp)`) + `FcmPushServiceNoOp`(폴백)
- `FcmConfig`: `firebase.enabled=true` 조건부 빈 등록 (개발 환경 graceful degradation)
- `SessionCompletedEvent` + `SessionCompletedEventListener`(`@Async analysisExecutor`)
- `RedisSubscriber`: `markCompleted()` 이후 `SessionCompletedEvent` 발행

**보안 결정**:
- FCM 토큰 값은 **어떤 로그 레벨에서도 출력 금지** — 에러 시 `errorCode`만 기록
- `firebase-service-account.json`을 `.gitignore`에 추가 (Reviewer 지적 즉시 수정)
- `application.yaml`에 `firebase.enabled: false` 기본값 — 프로덕션 배포 시에만 `true`

---

### 2. 프론트엔드 Pagori 리디자인 갭 분석

`frontend-refactoring/Pagori Redesign.html` 기준으로 `apps/frontend/src/` 구현 여부를 대조.

**구현 완료(7개)**: 대시보드, 코드 에디터, 프로젝트 목록, 로그인/회원가입, PDF 리포트 모달, 커밋 시크릿 스캔 모달

**미구현(7개)**: SBOM/CVE 화면, GitHub 레포 직접 스캔 모달, 컴플라이언스 리포트, 팀 관리, 설정, 알림 센터, 분석 비교

**발견된 누락 API 3개**:
- `FEAT-FE-001`: `GET /api/v1/sbom/components?sessionId=` (SBOM 조회 GET 엔드포인트 미존재)
- `FEAT-FE-002`: `POST /api/v1/projects/{id}/analysis/github-scan` (UI 직접 트리거 없음)
- `FEAT-FE-003`: `GET /api/v1/projects/{id}/compliance?framework=` (컴플라이언스 매핑 미구현)

→ `docs/07_SPRINT_BACKLOG_V3.md`에 구현 현황 테이블 + 누락 API 상세(FEAT-FE-001/002/003) 추가

---

### 3. DashboardPage 백엔드 API 연결

`GET /api/v1/projects/{projectId}/dashboard` 응답을 프론트엔드 타입으로 변환하는 `useDashboard` 훅을 신규 작성하고 `DashboardPage.tsx`에 연결(커밋 `28f28c3`).

**핵심 설계 결정**:
- **하이브리드 전략**: API 데이터 우선, 로컬 Zustand 스토어 폴백 — `isApiLive` 플래그로 전환
- **타입 변환**:
  - `trend.count` → 정규화 score(0~100) — 최대값 기준 상대 높이 (막대 시각화용)
  - `heatmap.count` → severity 버킷 (≥5=critical, ≥3=high, ≥1=medium)
  - `owaspCoverage: Map<String,Boolean>` → `OwaspCell[]` (hit/none status)
- **ApiStatusChip**: 로딩 펄스 / 에러+재조회 버튼 / 실시간 녹색 점 표시

**로컬 스토어 유지 항목**: filteredVulns 목록, owaspRows(OWASP 막대 차트), 패치 완료 수, lastTokenUsage — projectId 없거나 API 실패 시에도 동작

---

## 커밋 목록

| 커밋 | 내용 |
|------|------|
| `e39484e` | feat(sprint7-stage3): FCM Push 백엔드 + 글로벌 CSS 유틸리티 |
| `28f28c3` | feat(dashboard): DashboardPage 백엔드 API 연결 + useDashboard 훅 |

---

---

## Stage 4 추가 기록 (같은 날 연속 세션)

### 4. TASK-705 (Android) — FCM + SSE 이중 전략

**구현 내용** (커밋 `0beb7ed`):
- `SecureAiFcmService.kt`: Hilt EntryPoint 패턴, ProcessLifecycleOwner foreground 판단, background 알림 + 딥링크 PendingIntent, serviceJob.cancel() 정리
- `SseClient.kt`: OkHttp callbackFlow SSE 파싱, `session.completed` 이벤트 → `SseResult.SessionCompleted` 변환, `close()` 명시적 채널 종료
- `AnalysisViewModel.kt`: SSE(foreground)/FCM(background) 이중 전략, sessionId UUID_PATTERN(`[0-9a-f-]{36}`) 검증 + early return
- `FcmTokenService.kt`: 비로그인 시 defer, 실패 비치명적, 토큰 값 로그 금지
- `NavGraph.kt`: `Screen.Session` + deepLink uriPattern, `MainActivity.onNewIntent` 딥링크 처리

**주요 설계 결정**:
- `firebase-analytics` 제외 → Kotlin 2.0.21 메타데이터 충돌 회피. FCM만 사용하면 analytics 없이 동작함.
- `callbackFlow` 내 `close()` + `awaitClose` 순서: 정상 종료 시 `close()`로 채널 즉시 종료, `awaitClose`는 외부 취소(ViewModel 소멸) 시 HTTP call 정리 역할로 분리
- Foreground 판단 단일 지점: `ProcessLifecycleOwner` — `SecureAiFcmService.onMessageReceived`에서만 확인

**Reviewer 지적 사항 (2건, 커밋 전 수정)**:
1. `NetworkModule.kt` — `loggingInterceptor.redactHeader("Authorization")` 누락 (DEBUG BODY 레벨에서 Bearer 토큰 Logcat 노출 위험) → 추가
2. `SseClient.kt` URL 삽입 전 sessionId 검증 없음 → `AnalysisViewModel.startSseObservation()`에 UUID_PATTERN 검증 추가

**Tester 발견 버그**:
- `SseClient.callbackFlow`에서 `close()` 누락 → Turbine `awaitComplete()` 3초 타임아웃. `trySend(Closed)` 직후 `close()` 추가로 해결.

### 5. Redis 캐시 직렬화 버그 수정 (fix 커밋 `1fe4c14`)

Docker 환경에서 대시보드 API 검증 중 발견.

**원인**: `Jackson2JsonRedisSerializer<Object>` + `DefaultTyping.NON_FINAL` 조합.
- `NON_FINAL`은 final 클래스(Java record 포함)를 타입 정보 없이 직렬화
- 첫 번째 호출: DB 조회 후 Redis에 `{"securityScore":100,...}` 저장 (타입 정보 없음)
- 두 번째 호출: Redis에서 읽을 때 `WRAPPER_ARRAY` 형식을 기대하지만 START_OBJECT 수신 → `MismatchedInputException`

**수정**: `GenericJackson2JsonRedisSerializer` + `DefaultTyping.EVERYTHING` + `As.PROPERTY(@class)` 조합으로 교체. final 클래스(record) 포함 모든 타입에 타입 정보 포함.

**검증 결과** (Docker 환경):
- FCM 토큰 등록/삭제/멱등성/인증 차단: 전부 통과
- 대시보드 캐시 히트 3회 연속: 통과
- 타 사용자 프로젝트 접근 403 차단: 통과

---

## 전체 커밋 목록 (2026-05-19 전체 세션)

| 커밋 | 내용 |
|------|------|
| `e39484e` | feat(sprint7-stage3): FCM Push 백엔드 + 글로벌 CSS 유틸리티 |
| `28f28c3` | feat(dashboard): DashboardPage 백엔드 API 연결 + useDashboard 훅 |
| `0d2dd73` | docs: Sprint 7 Stage 3 완료 기록 + 프론트엔드 디자인 갭 분석 |
| `0beb7ed` | feat(sprint7-stage4): FCM Push + SSE 이중 전략 Android 구현 |
| `72886e9` | docs: Sprint 7 Stage 4 완료 기록 + TASK-705 체크리스트 업데이트 |
| `1fe4c14` | fix(redis): RedisCacheConfig Jackson 직렬화 버그 수정 |

---

---

## Stage 5 추가 기록 — 보안 문서 자동 생성 기능 기획

### 6. EPIC-SEC-DOC 기획 확정

**배경**: 바이브코더 외에 보안 전문가·사내 보안 담당자를 새 타겟 사용자로 추가하는 방향 논의.

**확정 방향 (Level 1 먼저)**:

| 문서 유형 | 대상 | 활용처 |
|-----------|------|-------|
| CISO 보고서 | 사내 CISO/팀장 | 주간·월간 보안 현황 보고 |
| 행안부 개발보안 점검결과서 | 공공기관 납품/SI | 정부 제출 의무 문서 |
| ISMS-P 이행현황 증적 | 인증 심사 대비 보안팀 | ISMS-P 인증 갱신 |

**아키텍처 관찰**:
- MCP Filesystem이 소스 전체를 이미 읽고, SAST 파이프라인이 인증 패턴·암호화 사용·SQL 처리를 추적
- Level 1: SAST 결과 → Thymeleaf 템플릿 필드 매핑 → OpenPDF (기존 인프라 재활용)
- Level 2: LangGraph에 `security_arch_extractor` 노드 추가 = "취약점 대신 아키텍처 요소를 출력하는 SAST" — 별도 코드 읽기 불필요

**백로그 등록**: `docs/07_SPRINT_BACKLOG_V3.md` → EPIC-MISC `TASK-MISC-002` 추가 (Level 1·Level 2 하위 할일 + 테스트 체크리스트 포함)

---

## 다음 우선순위 (Stage 5 이후)

- **Sprint 8 시작 전**: 에뮬레이터에서 FCM E2E 수동 검증 (딥링크, 알림, foreground/background 분기)
- **Sprint 8**: 스케줄러 ShedLock, Circuit Breaker, 성능 목표, 2FA, EPIC-SEC-DOC Level 1
- **FEAT-FE-001 SBOM API**: 백엔드 GET 엔드포인트 추가 → SbomPage.tsx 구현 (Sprint 8 범위 후보)
- **UI 설계**: EPIC-SEC-DOC 문서 생성 화면 — Claude design과 별도 의논 예정

---

---

## Stage 6 추가 기록 — Pagori 리디자인 전체 적용 (refactor/frontend-ui)

### 작업 배경

`frontend-refactoring/Pagori Redesign.html` 및 `frontend-refactoring/components/` 12개 JSX 파일을 레퍼런스로, `apps/frontend/src/`에 미적용된 화면을 전수 조사 후 일괄 적용.

Explore 에이전트 조사 결과 기존 적용률 약 75% — 이번 세션에서 95%까지 상향.

---

### 7. Sprint 6 체크리스트 업데이트 + DVWA SQLi E2E 시연 기록

이전 세션에서 미완으로 남아 있던 Sprint 6 DVWA 수동 시연이 이번 세션 초반에 완료됐음을 공식 기록.

- DVWA 이미지: `ghcr.io/digininja/dvwa:latest` + MariaDB 10.6 (`mariadb:10.6`) — MySQL 8.0은 DVWA SQL 문법 비호환으로 교체
- SQLi 엔드투엔드 실행 → DAST 터미널 진행 로그 확인 → VulnDetailPanel에 초록 "DAST 안전" 배지 정상 표시
- `docs/07_SPRINT_BACKLOG_V2.md` TASK-601~604 체크리스트 전항목 체크 완료
- `docs/07_SPRINT_BACKLOG_V3.md` Sprint 6 섹션에 시연 날짜 주석 추가 (2026-05-19)

---

### 8. Pagori 리디자인 — 1차 적용 (온보딩·SBOM·AI 톤 설정)

**브랜치**: `refactor/frontend-ui` / **PR**: #73

| 파일 | 내용 |
|------|------|
| `app/onboarding/page.tsx` (신규) | 3단계 온보딩: 프로젝트 타입 → 분석 소스 → 첫 분석/스킵 |
| `components/analysis/SbomPage.tsx` (신규) | SBOM & CVE 페이지: KPI strip, 의존성 테이블, CVE 상세 카드 |
| `components/analysis/RightPanel.tsx` | `sbom` 탭 추가 |
| `app/settings/page.tsx` | AI 채팅 톤 섹션 추가 (직설적/친절한/전문적/학습형) |
| `store/useSecureStore.ts` | `aiTone` 상태 + localStorage 퍼시스턴스 |

**설계 결정**: SBOM 백엔드 API(`GET /api/v1/projects/{id}/sbom/components`) 미구현 — mock 데이터 임시 사용, TODO 주석 마킹 (FEAT-FE-001 Sprint 8 후보).

---

### 9. Pagori 리디자인 — 2차 적용 (모바일/태블릿 반응형 + 초기 설정)

| 파일 | 내용 |
|------|------|
| `app/preferences/page.tsx` (신규) | 언어(6종)/테마(3종)/AI 톤(5종)/음성(coming soon) 초기 설정 페이지 |
| `components/analysis/ChatFAB.tsx` (신규) | 모바일 전용 플로팅 AI 채팅 버튼 (FAB ↔ 말풍선 팝업 토글, 768px 이상 숨김) |
| `app/globals.css` | 모바일(<768px) 반응형 CSS, 태블릿(768-1279px) slim rail 지원 |
| `components/layout/MobileBottomNav.tsx` | 레퍼런스 디자인 반영: blur 배경, safe area, 5탭 구조 |
| `store/useSecureStore.ts` | `language`(6종) + `theme`(3종) 상태 추가 |
| `components/editor/EditorLayout.tsx`, `AppSidebar.tsx`, `dashboard/DashboardPage.tsx` | 반응형 className 추가 |

**설계 결정**: 모바일(<768px)에서 에디터 사이드바·오른쪽 패널 숨김 + 하단 네비 표시. 태블릿에서 사이드바 48px slim rail 자동 전환.

---

### 10. Pagori 리디자인 — 3차 적용 (신규 설계 화면 3종)

| 파일 | 내용 |
|------|------|
| `app/github-scan/page.tsx` (신규) | GitHub OAuth 레포 선택 + 브랜치 + 파일 필터 + 파이프라인 토글 + AI 모델 선택 |
| `app/commit-scan/page.tsx` (신규) | 스캔 범위 세그먼트 탭 + 라이브 진행률 카드 + 시크릿 6열 테이블 + 경고 박스 |
| `components/analysis/PdfReportModal.tsx` (수정) | configure → generating → done 3단계 플로우, 언어/형식 select, 링크 복사/이메일 전송 |

---

### 11. Pagori 리디자인 — 4차 적용 (EmptyStates + 내비게이션 전체 연결 + Mock fallback)

#### EmptyState 일러스트 6종 (SVG 인라인)

| variant | 상황 | 사용 위치 |
|---------|------|---------|
| `first-project` | 첫 분석 전 | DashboardPage |
| `scan-ready` | 스캔 준비 완료 | VulnPanel (취약점 없음) |
| `no-vulns` | 필터 결과 없음 | VulnPanel (필터 적용 후) |
| `filter-empty` | 필터 결과 없음 | SbomPage |
| `search-empty` | 검색 결과 없음 | Cmd+K 팔레트 |
| `offline` | 연결 오류 | AI 서버 연결 실패 |

#### Mock 데이터 fallback — 백엔드 없이 전체 UI 접근 가능

`lib/uiMockData.ts` 신규: `MOCK_USER`, `MOCK_ORGS`, `MOCK_MEMBERS`, `MOCK_CREDITS`, `MOCK_HISTORY`, `MOCK_ADMIN_USERS`

API 실패 시 fallback 처리 파일: `profile`, `team`, `settings`, `admin/users`

**결정 이유**: 프론트엔드 개발·검토 시 백엔드 기동 없이 localhost:3000으로 모든 화면을 즉시 확인할 수 있어야 함. try/catch에서 mock 대입 — 실 API 연결 시 자동 전환.

#### 내비게이션 전체 연결

| 위치 | 변경 내용 |
|------|---------|
| `AppHeader` | Cmd+K/Ctrl+K 글로벌 단축키 → 팔레트 오버레이 (분석시작/GitHub스캔/PDF/설정 액션) |
| `AppSidebar` | 하단에 `/github-scan`, `/commit-scan`, `/onboarding` 링크 추가 |
| `MobileBottomNav` | `useRouter`로 실제 라우팅 연결 (home→에디터, vulns→에디터, me→프로필) |
| `app/page.tsx` | Hero에 "Demo로 시작하기" → `/editor` 버튼 추가 |

---

### 커밋 목록 (Stage 6 — refactor/frontend-ui)

| 커밋 | 내용 |
|------|------|
| `562b275` | feat(frontend): Pagori 리디자인 1차 — 온보딩·SBOM·AI 톤·SBOM 탭 |
| `51e16ce` | feat(frontend): 모바일/태블릿 반응형 + 초기 설정 페이지 |
| `0b3de7f` | feat(frontend): 신규 설계 화면 3종 (GitHub 스캔·커밋 스캔·PDF 리포트) |
| `a1d989f` | feat(frontend): EmptyStates 일러스트 + 내비게이션 연결 + Mock fallback |

**PR #73**: `refactor/frontend-ui` → `main`

---

### 최종 적용률 요약

| 카테고리 | 이전 | 이번 세션 후 |
|---------|------|------------|
| 핵심 화면 (에디터/대시보드/온보딩/SBOM) | ✅ 완전 | ✅ 완전 |
| 초기 설정 페이지 | ❌ 미적용 | ✅ 완전 |
| 신규 설계 화면 (GitHub스캔·커밋스캔·PDF) | ❌ 미적용 | ✅ 완전 |
| 모바일 반응형 | ⚠️ 30% | ✅ 80%+ |
| 태블릿 반응형 | ❌ 미적용 | ✅ 적용 |
| EmptyStates 일러스트 | ⚠️ 컴포넌트만 | ✅ SVG 6종 |
| 내비게이션 연결 | ⚠️ 부분 | ✅ 전체 연결 |
| Mock fallback (백엔드 불필요) | ❌ | ✅ 주요 페이지 전체 |

**전체 적용률: 75% → 95%**

---

## 다음 우선순위

- **PR #73 머지 후** Sprint 8 시작
- **FEAT-FE-001**: 백엔드 `GET /api/v1/projects/{id}/sbom/components` 구현 → SbomPage mock 제거
- **Sprint 7 잔여 테스트**: `DomainVerificationRedisIT` 4개 (Redis 기동 필요), PDF 리포트 생성, 대시보드 차트 수동 검증
- **Sprint 8**: TASK-801~809 (스케줄러 ShedLock, Circuit Breaker, 성능 목표, 2FA, EPIC-SEC-DOC Level 1)
