# Sprint 11 — QA 통합 + Persona UX + 브랜치 머지 + 법적 컴플라이언스 + API 분석 계획
**기간**: 2026-05-28 ~ 2026-06-10 (Week 23-24)
**백로그 버전**: V5.4 (2026-05-29)
**계획 상태**: 최종 확정 (Dev 현실성 평가 반영, 2026-05-30) — **시작점 `/stage 1`**
**목표**:
1. ① `feat/frontend-ui` + `refactor/frontend-ui` → main 통합 (충돌 해소) — **✅ Stage 0 완료**
2. ② Persona 기반 온보딩/랜딩 백엔드 연동 (workspace_mode 도입)
3. ③ 디자인 시스템 통일 (Pagori 토큰)
4. ④ 법적 페이지 3종 (ToS · Privacy · Cookie) — GDPR/PIPA 준수
5. ⑤ Sprint 10 수동 검증 12건 일괄 청산 (이월 차단)
6. ⑥ API 중심 분석 계획 & 진행률 패널 (TASK-1106) — Sprint 13 AI Advanced MVP 선행

---

## 사전 발견 사항 (실측 정정 — Dev 평가 반영)

| 항목 | 백로그/PM 초안 명세 | 실측 상태 | 조치 |
|------|-----------|---------|------|
| `feat/sprint10` → main 머지 | TASK-1100 첫 번째 하위 할일 | 이미 완료 (`git log feat/sprint10 ^main` 0건) | TASK-1100에서 제외 |
| `feat/frontend-ui` (신규 브랜치) | 백로그 미기재 | 9커밋 ahead — V4 Hybrid UI 리팩터링 | TASK-1100에 흡수 |
| `refactor/frontend-ui` | "10커밋 앞서 있음" | 9커밋 ahead — Pagori 리디자인 | 충돌 해소 후 통합 |
| Flyway 최고 번호 | V047 | **V047까지 존재** (`feat/modify-bug` 머지로 `V047__extend_reports_format_check.sql` 확정) | Sprint 11 신규는 **V048**부터 |
| `onboarding/page.tsx` Step 0 | "워크스페이스 모드 선택 UI 추가" | **Step 0 UI 완성(842줄)되었으나 `handleModeNext()`가 Zustand에만 저장 — `PATCH /workspace-mode` 호출 없음** | TASK-1101에서 API 호출 결선 (아래 명세) |
| `StartAnalysisRequest` | "CreateSessionRequest.fileFilter 추가" | **클래스명은 `StartAnalysisRequest`(record), `CreateSessionRequest` 아님.** record라 컴포넌트 기본값 불가 | `fileFilter`를 **마지막 컴포넌트(nullable)** 로 추가 (아래 명세) |
| `AppSidebar.tsx` | "신규 생성 (SRP)" | **이미 존재** — 에디터 전용 파일트리 사이드바 | 신규 생성 아님. 역할 분기 위치 결정 필요 (S4) |
| `ProgressPanel.tsx` | "Progress Panel 컴포넌트" | **이미 존재(219줄)** — `useSecureStore.progressSteps` 평면 렌더러 | 전면 재작성 (API 그룹 아코디언) |
| Footer 컴포넌트 | "Footer 링크 추가" | **부재** — 신규 생성 필요 | TASK-1104에서 신규 (S5) |
| `app/legal/` 디렉토리 | 백로그 V5.2 추가 | 존재 안 함 | TASK-1104에서 신규 생성 |
| `useAuth.ts` `UserMeData` / `useAuthStore.ts` `AuthUser` | "useAuthStore 수정" | **두 타입 모두 `workspaceMode` 없음** | TASK-1101에서 둘 다 추가 (동기화 5곳, 아래) |
| Sprint 10 수동 검증 12건 | Sprint 10 완료 기록 | 체크리스트 전부 `[ ]` (코드 완료, 동작 검증 0건) | TASK-1105 Tester 전담 청산 |

---

## Flyway 번호 예약

| 번호 | 태스크 | 파일명 | 비고 |
|------|--------|--------|------|
| V048 | TASK-1101 | `V048__add_workspace_mode_to_users.sql` | `workspace_mode TEXT DEFAULT 'DEVELOPER'` + CHECK 제약 |
| V049 | TASK-1104 | `V049__add_legal_consent_to_users.sql` | `terms_accepted_at`, `privacy_accepted_at`, `marketing_opt_in BOOLEAN DEFAULT FALSE` |

> V047은 `feat/modify-bug` 머지로 리포트 format CHECK 제약(`V047__extend_reports_format_check.sql`)이 사용. Sprint 11 마이그레이션은 V048부터.

---

## Stage 0 — 브랜치 통합 및 충돌 해소 ✅ 완료 (2026-05-30)

| TASK | 제목 | 서비스 | 선행 | 상태 |
|------|------|--------|------|------|
| TASK-1100 | 브랜치 통합 및 충돌 해소 | frontend | — | ✅ 완료 |

**완료 내역 (2026-05-30)**:
- `feat/modify-bug` → main **fast-forward** 머지 (18커밋, 충돌 0). 리포트 회귀(트랜잭션 동기화) 선수정 후 머지.
- `refactor/frontend-ui` → main 통합: 충돌 16건을 Stage 0 전략(feat 우선)대로 전부 main 버전 채택 → 트리가 main과 동일. refactor의 모든 내용(Pagori 리디자인·preferences·uiMockData·MobileBottomNav·CI/테스트 수정)이 feat 라인에 이미 흡수 → **순변경 0**. 통합 이력 기록용 머지 커밋(`f55c716`)만 추가.
- 병합 완료 브랜치 `feat/frontend-ui`·`refactor/frontend-ui` 삭제.
- **잔여**: `make dev` 전체 기동 확인 = 사용자 수동 검증 항목.

---

## 실행 계획 (Stage 1 / Stage 2)

### Stage 1 — Persona 백엔드 + 디자인 + 법적 페이지 + 수동 검증 + API 분석 계획 (5-way 병렬)

선행: TASK-1100(✅). 공유 파일 0개 → 동시 진행 안전.

| TASK | 제목 | 서비스 | 에이전트 | 사이즈 |
|------|------|--------|---------|--------|
| TASK-1101 🔴 | Persona 온보딩 — 역할 선택 + 백엔드 연동 | backend + frontend | Dev + Tester | M |
| TASK-1103 🟠 | 디자인 시스템 통일 (Pagori 토큰) | frontend | Dev | S |
| TASK-1104 🔴 | 법적 페이지 3종 + 동의 컬럼 | backend + frontend | Dev + Tester | M |
| TASK-1105 🟠 | Sprint 10 수동 검증 청산 (12건) | tester | Tester | M |
| TASK-1106 🟠 | API 중심 분석 계획 & 진행률 패널 | ai_engine + backend + frontend | Dev + Tester | **L** |

**공유 파일 소유권 규칙 (유지)**:
- `globals.css` → **1103 단독 소유**
- `onboarding/page.tsx` → **1101 단독 소유**
- `AppSidebar.tsx` → **1102 단독 소유** (Stage 2)
- 1101(user 도메인) / 1104(legal·signup·V049) / 1106(analysis·ai_engine) → 서로 비충돌

### Stage 2 — 페르소나별 랜딩 & 사이드바 분기 (순차, TASK-1101 완료 후)

| TASK | 제목 | 서비스 | 에이전트 | 사이즈 |
|------|------|--------|---------|--------|
| TASK-1102 🔴 | 로그인 후 페르소나별 랜딩 및 사이드바 분기 | frontend | Dev + Tester | M |

**순차 강제 이유**: 1102는 `workspaceMode` 가 `GET /users/me` 응답 + `AuthUser` 타입에 존재해야 분기 가능 → **1101 완료가 절대 선행**.

---

## 용량 점검

- 사이즈 합계: S×1 (1103) + M×4 (1101·1104·1105·1102) + **L×1 (1106)**.
- **L = 1개** → L 2개 경계 미만. **과적 아님 → 스프린트 분할 불필요.**
- 단, 순서 가중 주의: Stage 1 5-way 병렬은 폭이 넓다. 1106(L)이 가장 무거우므로(8파일 연쇄 + ProgressPanel 전면 재작성 + store 신설) Stage 1 착수 즉시 가장 먼저 dev 슬롯에 배정 권고.
- 11개 태스크가 한 스프린트에 몰렸던 구 Sprint 12 사례와 달리, 본 스프린트는 6개(1100 완료 포함) — 분할 불필요.

---

## 태스크별 상세 구현 명세

> Dev·Reviewer가 추가 추론 없이 명세대로 구현·검증할 수 있도록 작성. 모호함은 여기서 모두 제거한다.

### TASK-1101 — Persona 온보딩 + 백엔드 연동 (M)

> **숨은 순서 의존성 (필수 보완 1)**: `onboarding/page.tsx` Step 0 UI는 완성됐으나 `handleModeNext()`가 Zustand에만 저장하고 API 호출이 없다. 또 `UserMeData`(useAuth.ts)·`AuthUser`(useAuthStore.ts) 어디에도 `workspaceMode`가 없다. 이 둘을 추가하지 않으면 **TASK-1102 착수 불가**.

- **변경 파일 (workspaceMode 동기화 5곳)**:
  1. `apps/backend/src/main/resources/db/migration/V048__add_workspace_mode_to_users.sql` (신규)
  2. `apps/backend/src/main/java/io/secureai/backend/domain/user/entity/User.java` — `workspaceMode` 필드 추가
  3. `apps/backend/src/main/java/io/secureai/backend/domain/user/dto/UserMeResponse.java` — 필드 + `from()` 매핑 추가
  4. `apps/frontend/src/hooks/useAuth.ts` — `UserMeData`에 `workspaceMode` 추가 + `loadUser()` `setUser` 매핑
  5. `apps/frontend/src/store/useAuthStore.ts` — `AuthUser`에 `workspaceMode` 추가
  - 추가 변경:
    - `apps/backend/.../domain/user/controller/UserController.java` — `PATCH /users/me/workspace-mode` 엔드포인트 신규
    - `apps/backend/.../domain/user/service/UserService.java` — `updateWorkspaceMode(userId, mode)` 추가
    - `apps/frontend/src/app/onboarding/page.tsx` — `handleModeNext()`에서 `PATCH` 호출 결선
- **인터페이스 시그니처**:
  - **S1**: `PATCH /api/v1/users/me/workspace-mode`
    - 요청 바디: `{ "workspaceMode": "DEVELOPER" | "SECURITY_MANAGER" | "BOTH" }` (필드명 = `workspaceMode`)
    - 응답: **200 + 표준 envelope `{ data: UserMeResponse }`** (갱신된 전체 me 반환 → 프론트가 store 갱신 단순화)
    - Controller 검증: `@Pattern(regexp = "^(DEVELOPER|SECURITY_MANAGER|BOTH)$")` + `@NotBlank`
  - **S2**: User 엔티티 타입 = **`String` + DB CHECK 제약** (엔티티는 `@Enumerated` 강제 안 함 — 마이그레이션 유연성·기존 String 컬럼 패턴 일관성). `@Column(length = 30, nullable = false) private String workspaceMode = "DEVELOPER";`
  - V048: `ALTER TABLE users ADD COLUMN workspace_mode TEXT NOT NULL DEFAULT 'DEVELOPER';` + `ALTER TABLE users ADD CONSTRAINT chk_workspace_mode CHECK (workspace_mode IN ('DEVELOPER','SECURITY_MANAGER','BOTH'));`
  - **S3**: 프론트 타입 — `UserMeData.workspaceMode?: 'DEVELOPER'|'SECURITY_MANAGER'|'BOTH'` (**optional `?`**), `AuthUser.workspaceMode: ...` 매핑 시 **null fallback = `'DEVELOPER'`**. (`u.workspaceMode ?? 'DEVELOPER'`)
- **핵심 로직**:
  1. 온보딩 Step 0에서 모드 선택 → `handleModeNext()` → `apiClient.patch('/users/me/workspace-mode', { workspaceMode })` → 성공 시 응답 `data`로 `setUser` 갱신 후 다음 스텝.
  2. 실패(4xx/5xx) → toast 에러, 스텝 비전진 (Zustand 단독 저장 회귀 제거).
  3. `UserMeResponse.from()`에 `.workspaceMode(user.getWorkspaceMode())` 추가.
- **예외/엣지**: 잘못된 모드 값 → 400 (Controller `@Pattern`). 미인증 → 401. `workspaceMode` null 사용자(레거시) → DB DEFAULT로 `DEVELOPER` 보장 + 프론트 fallback.
- **준수 규칙**: 입력 검증 Controller 레이어 한정(general.md), Service 재검증 금지. SQL 파라미터 바인딩(마이그레이션은 DDL이라 무관). 민감정보 로그 금지.
- **DoD**: V048 적용 / `PATCH` 유효하지 않은 값 400 / 온보딩 모드 선택 → DB 저장 확인 / `GET /users/me` 응답에 `workspaceMode` 포함 / `AuthUser`·`UserMeData` 타입 컴파일 통과.

### TASK-1103 — 디자인 시스템 통일 (Pagori 토큰) (S)

- **변경 파일**: `apps/frontend/src/app/globals.css` (토큰 최종 확정) + 주요 5개 페이지(에디터·대시보드·온보딩·설정·컴플라이언스) CSS 불일치 제거.
- **핵심 로직**: Pagori 토큰(색·간격·radius·hover/focus) 변수로 통일. 하드코딩 색상 → CSS 변수 치환. hover/focus 상태 일관성.
- **준수 규칙**: 매직 넘버/문자열 금지(general.md) — 색상값 토큰화.
- **DoD**: 5개 페이지 Pagori 토큰 일관성 시각 확인 / `globals.css` 외 store·로직 파일 미변경.

### TASK-1104 — 법적 페이지 3종 + 동의 컬럼 (M)

- **변경 파일 (신규/수정)**:
  - `apps/frontend/src/app/legal/terms/page.tsx` (신규)
  - `apps/frontend/src/app/legal/privacy/page.tsx` (신규)
  - `apps/frontend/src/app/legal/cookie/page.tsx` (신규)
  - `apps/frontend/src/components/layout/CookieConsentBanner.tsx` (신규)
  - `apps/frontend/src/components/layout/Footer.tsx` (**신규 — S5: Footer 부재**)
  - 회원가입 폼(`apps/frontend/src/app/(auth)/register` 경로의 폼 컴포넌트) — 동의 체크박스 3개
  - `apps/backend/.../db/migration/V049__add_legal_consent_to_users.sql` (신규)
  - `apps/backend/.../domain/user/entity/User.java` — 동의 시각 + marketing 필드
  - 회원가입 처리 Service/Controller — 동의 강제 검증 + 시각 set
- **인터페이스/스키마**:
  - **S5**: `Footer.tsx` 신규 → **루트 `app/layout.tsx`** 에 마운트 (전역 푸터). 3종 링크(`/legal/terms`, `/legal/privacy`, `/legal/cookie`).
  - **S6**: CookieConsentBanner 동의 저장 = **`localStorage` 키 `secureai-cookie-consent`** (값 `'all'` | `'essential'`). 재표시 조건: 키 부재 시에만 표시. GDPR — "필수만 허용" / "전체 허용" 2선택지 필수("거절" 단일 금지).
  - **S7**: V049에 **`marketing_opt_in BOOLEAN DEFAULT FALSE` 포함**(권장). 전체: `terms_accepted_at TIMESTAMP NULL`, `privacy_accepted_at TIMESTAMP NULL`, `marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE`.
  - 회원가입 요청: 기존 바디에 `termsAccepted: boolean`, `privacyAccepted: boolean`, `marketingOptIn?: boolean` 추가.
- **핵심 로직**:
  1. 회원가입 폼: ToS·Privacy 필수 체크박스 2 + 광고성 수신 선택 1.
  2. Controller 검증: `termsAccepted && privacyAccepted` 아니면 **400**.
  3. 회원가입 트랜잭션에서 `terms_accepted_at = now()`, `privacy_accepted_at = now()`, `marketing_opt_in = marketingOptIn` set.
  4. legal 페이지 = ko 정식 + en placeholder(Sprint 12 정식 번역).
- **예외/엣지**: 동의 미체크 회원가입 → 400(Controller). 동의 시각 NULL 금지(가입 시 강제 set).
- **준수 규칙**: 입력 검증 Controller 한정. 동의 시각 = 분쟁 증빙(보안 리스크 11).
- **DoD**: V049 적용 / 동의 미체크 회원가입 400 / Footer 3링크 동작 / `/legal/*` 3종 ko 렌더 / Cookie Banner 첫 방문 표시 + 거절 시 비필수 쿠키 미설정.

### TASK-1105 — Sprint 10 수동 검증 청산 (12건) (M)

- **변경 파일**: 검증 대상 소스 없음(Tester 전담). 발견 버그는 micro-task로 분리 후 Dev 즉시 수정.
- **핵심 로직**: Critical 4건(Webhook·Check Run·시크릿 스캔·야간 스캔) → High 4건 → Medium 4건 순. 이월 항목(k6 p95·OWASP ZAP·2FA QR·Nginx HTTPS·VSCode Ext·GDPR 30일) 포함.
- **예외/엣지**: GitHub Webhook PR 자동 분석은 `extractInstallationToken()` 스텁으로 동작 불가 — **Sprint 11 결함 아님**, Sprint 12 TASK-1201 의존으로 명시(이월 사유 승인).
- **DoD**: 12건 PASS 또는 발견 버그 수정 완료. PASS 불가 항목은 부채대장에 사유와 함께 기록.

### TASK-1106 — API 중심 분석 계획 & 진행률 패널 (L)

> **파급 과소평가 보완 (필수 보완 2)**: `fileFilter`는 8파일 연쇄 + ProgressPanel 전면 재작성 + store 상태 신설.

- **변경 파일 (8파일 연쇄 + Progress + store)**:
  1. `apps/ai_engine/agent/nodes/api_discovery_node.py` (**신규**)
  2. `apps/ai_engine/api/routes/analyze.py` — `AnalyzeRequest`에 `file_filter` 추가 + `api_plan` 이벤트 발행 + `scan_complete`에 `files` 포함
  3. `apps/ai_engine/agent/nodes/scan_files_node.py` — `file_filter` 지원 (필터 적용 후 `files_to_scan` 반환)
  4. `apps/ai_engine/agent/state.py` (`AgentState` TypedDict) — `file_filter`, `api_groups` 키 추가
  5. `apps/backend/.../domain/analysis/dto/StartAnalysisRequest.java` — `fileFilter` **마지막 컴포넌트(nullable)** 추가
  6. `apps/backend/.../domain/analysis/service/AiAgentClient.java` — `startAnalysis(...)` 시그니처에 `List<String> fileFilter` 추가
  7. `apps/backend/.../domain/analysis/service/DefaultAiAgentClient.java` — payload에 `file_filter` 전달
  8. `apps/backend/.../domain/analysis/service/AnalysisService.java` — `dispatchToAgent`에서 `request.fileFilter()` 전달
  9. `apps/frontend/src/components/ui/ProgressPanel.tsx` — **전면 재작성** (219줄 평면 렌더러 → API 그룹 아코디언)
  10. `apps/frontend/src/store/useSecureStore.ts` — **`apiGroups` 상태 신설** + 액션
  11. `apps/frontend/src/hooks/useSse.ts` — `api_plan` 이벤트 분기 추가 + `scan_complete` `files` 처리 (이벤트 union 타입은 line 37, dispatch는 `parsed.type` 분기)
- **`StartAnalysisRequest` record 제약 (필수 보완 3)**:
  - 현재 record 컴포넌트: `(projectId, workspaceRoot, sourceType, githubRepoUrl, githubRef, force, scanMode)`. `fileFilter`는 **`scanMode` 다음 마지막 위치**에 `List<String> fileFilter` 로 추가.
  - **positional 생성자 사용 테스트 컴파일 영향**: `apps/backend/src/test/.../domain/analysis/service/AnalysisServiceTest.java` 등 기존 호출부 확인 후 — **마지막 인자에 `null` 추가** 또는 보조 정적 팩토리. 컴파일 오류 0건 확인이 DoD.
- **인터페이스/스키마**:
  - **S8**: `api_discovery_node` 그래프 위치 = **`scan_files_node` 전(前)**. 실패 시 **skip-and-continue**(빈 `api_groups` 반환, 전체 세션 실패 금지 — general.md 파이프라인 규칙).
  - **S9**: `api_plan` SSE 이벤트 발행 = **`analyze.py` `_run_analysis`에서 scan(또는 discovery) 완료 직후 1회**. 페이로드 `{ type: 'api_plan', api_groups: [{name, url, files:[{path, line}]}] }`.
  - **S10**: `useSecureStore`에 `apiGroups: ApiGroup[]` + `setApiGroups` + 파일 상태 갱신 액션 추가. SSE 핸들러는 `useSse.ts`만 수정.
  - `fileFilter` null = 기존 전체 분석 동일(하위 호환). `scan_files_node`: filter 있으면 교집합만 `files_to_scan`.
- **api_discovery_node 파싱 명세**: Spring `@*Mapping` → URL+그룹 / FastAPI `@router.*` / Next.js `app/api/**/route.ts` / React `axios.get/post`(`api.ts`·`client.ts`). Prefix 그룹화: `*Controller` / `*Service` / `*ServiceImpl` / `*Repository` / `*Mapper`. import depth-1 추적(순환 참조 방어). **LLM 없이 정적 파싱만(비용 0)**. full call graph는 Sprint 13.
- **ProgressPanel 재작성 명세**: `api_plan` → API 그룹 아코디언 + 파일목록(pending) / `progress` → 파일별 상태(pending→analyzing→done/cached/failed) / 그룹별 진행률 바 / 파일 클릭 → Monaco Editor 열기 / 그룹 체크박스 "선택 분석" → `fileFilter` 포함 세션 재시작.
- **준수 규칙**: AI Engine 통신 `X-Internal-Key` 유지. 토큰 로그 금지. 개별 파일 오류 시 skip&log(전체 실패 금지). DTO 변경 시 record 불변성 유지.
- **DoD**: `api_discovery_node` 단위 테스트(Controller/Service/ServiceImpl/Repository 그룹화) 통과 / `StartAnalysisRequest` 변경 후 백엔드 `./gradlew test` 컴파일·통과 / Progress Panel API 그룹 렌더 / `fileFilter` null = 기존 동작 회귀 없음 / 선택 분석 세션 재시작 동작.

### TASK-1102 — 페르소나별 랜딩 & 사이드바 분기 (M, Stage 2) ✅ 완료 (2026-05-31, `7c6ce9e`)

> **구현 결과**: `/dashboard` 라우트는 없고 dashboard는 `viewMode`(editor↔dashboard, `/editor` 내 토글)임이 실측 확인됨 → 로그인/콜백에서 workspaceMode로 **viewMode** 설정(SECURITY_MANAGER→dashboard, 그 외→editor) 후 `/editor` 랜딩. AppHeader 페르소나 배지(개발자/보안 담당/통합), AppSidebar 보안 담당 시 취약점·SBOM 상단 강조. tsc 0에러 + 프론트 테스트 17건 통과.


- **변경 파일**: `apps/frontend/src/components/layout/AppSidebar.tsx`(기존 — 역할별 메뉴 분기 추가), 리다이렉트 로직(`AuthProvider`/레이아웃 마운트 지점), `app/layout.tsx`.
- **S4 결정**: `AppSidebar.tsx`는 **에디터 전용 파일트리 사이드바**다. 역할 분기는 거기 직접 넣지 않고 — **(권장 결정)** 역할별 글로벌 네비/리다이렉트는 `AppHeader` + 클라이언트 리다이렉트(`AuthProvider`의 `useEffect` + `router.replace`)로 처리하고, `AppSidebar`에는 역할에 따라 보일 메뉴 항목만 조건부 렌더. 미들웨어가 아닌 **클라이언트 측** 분기(persist 유지).
- **핵심 로직**: `workspaceMode` 기반 — DEVELOPER → `/editor`, SECURITY_MANAGER → `/dashboard`, BOTH → `/editor` + 헤더 모드 배지(클릭 전환). 잘못된 경로 접근 = 금지(403) 아닌 **toast 안내 + 자연스러운 리다이렉트**(실데이터 접근은 백엔드 `@PreAuthorize` 별도 통제).
- **DoD**: DEVELOPER→/editor, SECURITY_MANAGER→/dashboard, BOTH→/editor+배지 / 사이드바 역할별 메뉴 분기 / persist 유지.

---

## 전체 실행 순서 요약

| 순서 | TASK | 제목 | 선행 | 에이전트 | 사이즈 |
|------|------|------|------|---------|--------|
| 0 | TASK-1100 ✅ | 브랜치 통합 및 충돌 해소 | — | Dev | M |
| 1a | TASK-1101 | Persona 온보딩 + 백엔드 연동 | TASK-1100 | Dev + Tester | M |
| 1b | TASK-1103 | 디자인 시스템 통일 | TASK-1100 | Dev | S |
| 1c | TASK-1104 | 법적 페이지 3종 + 동의 컬럼 | TASK-1100 | Dev + Tester | M |
| 1d | TASK-1105 | Sprint 10 수동 검증 청산 | TASK-1100 | Tester | M |
| 1e | TASK-1106 | API 중심 분석 계획 & 진행률 패널 | TASK-1100 | Dev + Tester | L |
| 2 | TASK-1102 | 페르소나별 랜딩 & 사이드바 | TASK-1101 | Dev + Tester | M |

**병렬 실행 그룹**:
- **Stage 0 (✅ 완료)**: TASK-1100
- **Stage 1 (5-way 병렬)**: TASK-1101 + TASK-1103 + TASK-1104 + TASK-1105 + TASK-1106 (1106[L] 최우선 슬롯)
- **Stage 2 (순차)**: TASK-1102 (1101 완료 후)

---

## 이월 태스크 (Sprint 11 수용)

| 항목 | 출처 | Sprint 11 처리 |
|------|------|--------------|
| Sprint 10 완료 기준 12건 | Sprint 10 | TASK-1105 통합 (Tester 전담) |
| `make perf-test` k6 p95 < 500ms | Sprint 8 | TASK-1105 일부 |
| OWASP ZAP Critical 0건 | Sprint 8 | TASK-1105 일부 |
| 2FA QR Google Authenticator 검증 | Sprint 8 | TASK-1105 일부 (2FA 프론트 UI는 Sprint 12 TASK-1208b) |
| Nginx HTTP → HTTPS 리다이렉트 | Sprint 8 | TASK-1105 일부 |
| VSCode Extension 수동 설치 검증 | Sprint 9 | TASK-1105 일부 |
| GDPR 30일 시뮬레이션 통합 테스트 | Sprint 9 | TASK-1105 일부 |
| GitHub Webhook PR 자동 분석 검증 | Sprint 5/6 | **Sprint 12 이월** — TASK-1201(`extractInstallationToken`) 의존. Sprint 11 결함 아님 |

---

## 리스크 분석

### 의존성 리스크
1. **TASK-1101 숨은 순서 의존성**: workspaceMode 동기화 5곳 미완 시 TASK-1102 착수 불가. → 1101 DoD에 5곳 전부 명시.
2. **TASK-1106 파급(L)**: 8파일 연쇄 + ProgressPanel 전면 재작성 + store 신설. → Stage 1 최우선 슬롯 + record 마지막 인자 규칙으로 테스트 컴파일 보호.
3. **`StartAnalysisRequest` record**: 컴포넌트 기본값 불가 → `fileFilter` 마지막 nullable. 기존 positional 테스트 호출부 `null` 보강.

### 기술 복잡도 리스크
4. **워크스페이스 분기(1102)**: 미들웨어 아닌 클라이언트 측(`AuthProvider` useEffect + `router.replace`), persist 유지.
5. **CookieConsentBanner GDPR(1104)**: "필수만"/"전체" 2선택 필수 — "거절" 단일 금지.
6. **법적 페이지 ko/en(1104)**: ko 정식 + en placeholder(Sprint 12 정식 번역).

### 보안 리스크
7. **workspace_mode 검증(1101)**: Controller `@Pattern` + DB CHECK 이중. 누락 시 임의 값 저장 위험.
8. **사이드바 분기(1102)**: SECURITY_MANAGER의 `/editor` 직접 접근 → toast + 리다이렉트(데이터는 백엔드 `@PreAuthorize`).
9. **동의 시각(1104)**: `terms/privacy_accepted_at` = 분쟁 증빙. 가입 트랜잭션에서 강제 set.
10. **GitHub Webhook(1105)**: `extractInstallationToken()` 스텁으로 PR 자동 분석 검증 불가 — Sprint 11 결함 아님, Sprint 12 TASK-1201 의존.

---

## 완료 게이트

**완료 게이트 = 해당 스프린트 ✅(수동 검증) 잔여 0건** (또는 이월 사유 명시·승인). 미구현 기능의 ✅는 부채 아님.

| 마일스톤 | 기준 |
|---------|------|
| Stage 0 게이트 | ✅ 머지 + `./gradlew test` 통과 + 주요 5페이지 렌더 오류 0 |
| Stage 1 게이트 | (1101) V048 + `PATCH` 400 검증 + 온보딩→DB 저장 + me 응답 workspaceMode / (1103) 5페이지 토큰 일관성 / (1104) V049 + 동의 미체크 400 + Footer 3링크 + Cookie Banner / (1105) 12건 PASS 또는 버그 수정 / (1106) api_discovery_node 단위테스트 + Progress Panel 렌더 + record 변경 후 컴파일·테스트 통과 |
| Stage 2 게이트 | DEVELOPER→/editor, SECURITY_MANAGER→/dashboard, BOTH→/editor+배지 + 사이드바 분기 |
| Sprint 11 완료 | 3게이트 통과 + 수동 검증 부채대장 잔여 0건(또는 이월 승인) + 베타 배포 가능(GDPR/PIPA + UX 분기 + API 분석 계획 동작) + 세션 로그 작성 |

### 품질 게이트
- [ ] 회귀 없음: `./gradlew test` 전체 통과 (특히 `StartAnalysisRequest` record 변경 후)
- [ ] 수동 검증: Sprint 10 12건 PASS 또는 버그 수정 + 부채대장 갱신
- [ ] TASK-1106 단위 테스트: api_discovery_node 그룹화 검증
- [ ] 세션 로그: `docs/session_log/2026-06-{day}_*.md`

---

## 실행 명령어

```
/stage 1   — TASK-1101 + TASK-1103 + TASK-1104 + TASK-1105 + TASK-1106  ※ 5-way 병렬 (1106[L] 최우선 슬롯)
/stage 2   — TASK-1102 (랜딩 분기 + AppSidebar 역할 메뉴)
/done      — 세션 로그 작성 + 부채대장 갱신
```

> Stage 0(TASK-1100)은 ✅ 완료. **시작점은 `/stage 1`.**

**병행 권장 타이밍**:
- TASK-1106 ai_engine `api_discovery_node` → Stage 1 착수 즉시 (가장 무거움)
- TASK-1105 Critical 4건 → Stage 1 시작 직후 / 이월 수동검증(k6·ZAP·2FA QR·Nginx) → Stage 1 진행 중
- VSCode Extension + GDPR 30일 → Stage 2 진행 중

---

## PM · Dev 평가 요약

### PM 에이전트 (스테이지 설계)
- 백로그 V5.4 기준 7개 태스크(1100~1106)를 Stage 0(완료)/Stage 1(5-way 병렬)/Stage 2(순차)로 배치.
- 공유 파일 소유권 규칙(globals.css→1103, onboarding→1101, AppSidebar→1102) 확정 → 병렬 충돌 0.
- Sprint 10 수동 검증 이월 12건을 TASK-1105로 일괄 흡수 → 만성 이월 차단. 완료 게이트 = 부채대장 잔여 0건.
- 용량 점검: L=1개로 분할 불필요.

### Dev 에이전트 (현실성 평가) — 반영 결과
- **필수 보완 3건 전부 명세 반영**:
  1. TASK-1101 숨은 순서 의존성 → workspaceMode **동기화 5곳**(V048·User·UserMeResponse.from·UserMeData·AuthUser) 명시 + `handleModeNext()` API 결선 추가. (실측: 두 프론트 타입 모두 workspaceMode 부재 확인)
  2. TASK-1106 파급 → **8파일 연쇄 + ProgressPanel(219줄) 전면 재작성 + useSecureStore `apiGroups` 신설 + useSse.ts 분기** 명시. (실측 확인)
  3. `StartAnalysisRequest` record 제약 → `fileFilter` **마지막 nullable 컴포넌트**, 기존 positional 테스트 호출부 보강 명시. (실측: `CreateSessionRequest` 아닌 `StartAnalysisRequest` record, `scanMode` 마지막)
- **스펙 공백 10건(S1~S10) 결정 확정**: S1 필드명 workspaceMode + 200/UserMeResponse · S2 String+CHECK · S3 optional+'DEVELOPER' fallback · S4 AppSidebar는 메뉴 분기만/리다이렉트는 AuthProvider 클라이언트 측 · S5 Footer 신규+루트 layout · S6 localStorage `secureai-cookie-consent` · S7 marketing_opt_in 포함 · S8 discovery scan 전+skip-continue · S9 _run_analysis scan 완료 직후 발행 · S10 useSecureStore apiGroups+useSse.ts.
- **실측 정정**: AppSidebar·ProgressPanel 기존 파일 / Footer 부재 / StartAnalysisRequest record / Flyway V047까지 확정 → V048부터.
- **동의된 판단 유지**: Stage 구조, 사이즈, 소유권 규칙, Sprint5/6 Webhook 이월, 완료 게이트.

---

*Sprint 11 계획: 2026-05-27(V1) · 2026-05-28(V2) · 2026-05-29(V3 TASK-1106 신설) · 2026-05-30(V4 — Stage 0 완료 반영, Dev 현실성 평가 필수보완 3 + 스펙결정 10 반영, 실측 정정, 최종 확정)*
