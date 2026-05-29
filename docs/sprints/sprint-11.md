# Sprint 11 — QA 통합 + Persona UX + 브랜치 머지 + 법적 컴플라이언스 + API 분석 계획
**기간**: 2026-05-28 ~ 2026-06-10 (Week 23-24)  
**백로그 버전**: V5.4 (2026-05-29)  
**목표**:
1. ① `feat/frontend-ui` + `refactor/frontend-ui` → main 통합 (충돌 해소)
2. ② Persona 기반 온보딩/랜딩 백엔드 연동 (workspace_mode 도입)
3. ③ 디자인 시스템 통일 (Pagori 토큰)
4. ④ 법적 페이지 3종 (ToS · Privacy · Cookie) — GDPR/PIPA 준수
5. ⑤ Sprint 10 수동 검증 12건 일괄 청산 (이월 차단)
6. ⑥ API 중심 분석 계획 & 진행률 패널 (TASK-1106) — Sprint 13 AI Advanced MVP 선행

---

## 사전 발견 사항 (PM 착수 전 보정)

| 항목 | 백로그 명세 | 실제 상태 | 조치 |
|------|-----------|---------|------|
| `feat/sprint10` → main 머지 | TASK-1100 첫 번째 하위 할일 | **이미 완료** — `git log feat/sprint10 ^main` 0건 | TASK-1100에서 제외. `feat/frontend-ui` + `refactor/frontend-ui` 머지만 남음 |
| `feat/frontend-ui` (신규 브랜치) | 백로그 미기재 | **9커밋 ahead** — V4 Hybrid UI 리팩터링 (에디터·온보딩·컴플라이언스·SBOM 등 전 페이지 API 주석 + V4 토큰 적용) | TASK-1100 하위 할일에 추가. refactor/frontend-ui 충돌 해소 시 함께 처리 |
| `refactor/frontend-ui` 커밋 수 | 백로그 "10커밋 앞서 있음" | **9커밋 ahead** — Pagori 리디자인 Stage 1~6 | 당초 예상대로 충돌 해소 후 머지 |
| 잠재 충돌 파일 | `settings/page.tsx` 예상 | `onboarding/page.tsx`, `settings/page.tsx`, `sbom/page.tsx` 등 양쪽에서 수정됨 | Stage 0에서 파일별 충돌 전략 확정 |
| Flyway 최고 번호 | V047 (Sprint 10) | **V047까지 존재** — `feat/modify-bug` 머지로 `V047__extend_reports_format_check.sql` 확정 (2026-05-30) | Sprint 11 신규 마이그레이션은 **V048**부터 시작 |
| `onboarding/page.tsx` 버전 | refactor 브랜치 버전 유지 권장 | feat/frontend-ui에 Step 0 워크스페이스 모드 선택 추가(842줄), refactor에 Pagori 리디자인 적용 | **feat/frontend-ui 버전 우선** — Step 0 UI가 TASK-1101 직접 대상 |
| 법적 페이지 디렉토리 | 백로그 V5.2 추가 | `apps/frontend/src/app/legal/` 존재 안 함 | TASK-1104에서 신규 생성 |
| Sprint 10 수동 검증 12건 | Sprint 10 완료 기록 | 체크리스트 전부 `[ ]` 상태 (코드는 완료, 동작 검증 0건) | TASK-1105에서 Tester 전담 일괄 검증 |

---

## Flyway 번호 예약

| 번호 | 태스크 | 파일명 | 비고 |
|------|--------|--------|------|
| V048 | TASK-1101 | `V048__add_workspace_mode_to_users.sql` | `users.workspace_mode TEXT DEFAULT 'DEVELOPER'` |
| V049 | TASK-1104 | `V049__add_legal_consent_to_users.sql` | `terms_accepted_at TIMESTAMP`, `privacy_accepted_at TIMESTAMP` |

> 참고: V047은 `feat/modify-bug` 머지로 리포트 format CHECK 제약(`V047__extend_reports_format_check.sql`)이 사용. Sprint 11 마이그레이션은 V048부터. (백로그 V4와 동일)

---

## Stage 0 — 사전 결정 사항 (착수 전 확정)

> 코드 구현 없음. 아래 항목 결정 후 Stage 1 진입.

| # | 항목 | 내용 | 권장 결정 |
|---|------|------|---------|
| 1 | **충돌 파일 우선순위** | feat/frontend-ui ↔ refactor/frontend-ui 양쪽 수정 파일 | feat/frontend-ui 버전 기반 → refactor 브랜치의 Pagori 토큰만 수동 통합. `settings/ScanModeDefaultSection` 유지 필수 |
| 2 | **머지 순서** | 두 브랜치 머지 순서 | feat/frontend-ui 먼저 (현재 HEAD). 이후 refactor/frontend-ui cherry-pick |
| 3 | **workspaceMode 값** | TASK-1101 API 값 | `DEVELOPER \| SECURITY_MANAGER \| BOTH` 3종 확정 |
| 4 | **랜딩 분기 기준** | TASK-1102 BOTH 처리 | BOTH → `/editor` (개발 중심) + 헤더 모드 배지 |
| 5 | **AppSidebar 위치** | 컴포넌트 분리 여부 | 별도 `AppSidebar.tsx` 신규 생성 (SRP) |
| 6 | **디자인 통일 범위** | TASK-1103 범위 | 주요 5개 페이지(에디터·대시보드·온보딩·설정·컴플라이언스) 우선 |
| 7 | **법적 페이지 다국어** | TASK-1104 ko/en 동시 vs 단계적 | **ko 우선 + en 영어 placeholder** → Sprint 12에서 정식 번역 |
| 8 | **회원가입 동의 UX** | TASK-1104 — 체크박스 vs 모달 동의 | 체크박스 2개 (필수: ToS + Privacy) + 광고성 정보 수신 동의 1개 (선택) |
| 9 | **Sprint 10 수동검증 분류** | TASK-1105 — 어떤 항목 먼저 | Critical 4건(Webhook·Check Run·시크릿 스캔·야간 스캔) → High 4건 → Medium 4건 |

---

## 실행 계획

### Stage 0 — 브랜치 통합 및 충돌 해소 (Critical, 전체 선행) ✅ 완료 (2026-05-30)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| TASK-1100 ✅ | 브랜치 통합 및 충돌 해소 | frontend | `feat/modify-bug`(리포트+V4 프론트) → main FF 머지, `refactor/frontend-ui` → main 통합 | Stage 0 #1~#2 | feat/sprint10은 이미 main 포함 — 제외 |

**완료 내역 (2026-05-30)**:
- `feat/modify-bug` → main **fast-forward** 머지 (18커밋, 충돌 0). 리포트 회귀(트랜잭션 동기화) 선수정 후 머지.
- `refactor/frontend-ui` → main 통합: 충돌 16건을 Stage 0 전략(feat 우선)대로 전부 main 버전 채택 → **해소 결과 트리가 main과 동일**. refactor의 모든 내용(Pagori 리디자인·preferences·uiMockData·MobileBottomNav·CI/테스트 수정)이 feat 라인에 이미 흡수돼 있어 **순변경 0**. 통합 이력 기록용 머지 커밋(`f55c716`)만 추가.
- 병합 완료 브랜치 `feat/frontend-ui`·`refactor/frontend-ui` 삭제.
- **잔여**: `make dev` 전체 기동 확인은 사용자 수동 검증 항목으로 남음.

**순차 강제 이유**: TASK-1100 완료 전까지 main 코드베이스 불확정 → 이후 모든 개발 파일 경로 미정.

---

### Stage 1 — Persona 백엔드 + 디자인 통일 + 법적 페이지 + 수동 검증 (Critical + High, TASK-1100 완료 후 4-way 병렬)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| **TASK-1101** 🔴 | Persona 온보딩 — 역할 선택 + 백엔드 연동 | backend + frontend | `V048__add_workspace_mode_to_users.sql`, `User.java`, `UserController.java` (`PATCH /users/me/workspace-mode`), `UserMeResponse.java`, `useAuthStore.ts`, `onboarding/page.tsx` | TASK-1100 | Controller `@Pattern(DEVELOPER\|SECURITY_MANAGER\|BOTH)` 필수. `workspaceMode?` 선택적 필드로 추가 (회귀 방지) |
| **TASK-1103** 🟠 | 디자인 시스템 통일 (Pagori 토큰) | frontend | `globals.css` 토큰 최종 확정, 5개 페이지 CSS 불일치 제거, hover/focus 상태 일관성 | TASK-1100 | `globals.css`만 공유 — TASK-1101과 충돌 시 1101 우선 |
| **TASK-1104** 🔴 | 법적 페이지 3종 (ToS · Privacy · Cookie) | backend + frontend | `app/legal/terms/page.tsx`, `app/legal/privacy/page.tsx`, `app/legal/cookie/page.tsx`, `CookieConsentBanner.tsx`, `V049__add_legal_consent_to_users.sql`, 회원가입 폼 동의 체크박스, Footer 링크 | TASK-1100 | ko 우선 + en placeholder. 동의 미체크 시 회원가입 400. 푸터에 3종 링크 추가 |
| **TASK-1105** 🟠 | Sprint 10 수동 검증 청산 (12건) | tester (수동 검증) | (검증 대상 파일 없음 — 발견 버그는 Sprint 11 잔여 시간에 즉시 수정) | TASK-1100 | Tester 전담. 발견 버그는 별도 micro-task로 분리 |

**병렬 안전 조건**:
- 1101: 백엔드(domain/user/*) + onboarding.tsx — 독립
- 1103: globals.css + 5개 페이지 CSS — 독립
- 1104: app/legal/* 신규 + 회원가입 폼 + V049 — 독립
- 1105: 수동 검증 + 런타임 버그 수정 — 독립 (Tester 전담)
- **공유 파일 0개** → 동시 진행 안전

---

### Stage 2 — 페르소나별 랜딩 & 사이드바 분기 (Critical, Stage 1 TASK-1101 완료 후)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| **TASK-1102** 🔴 | 로그인 후 페르소나별 랜딩 및 사이드바 분기 | frontend | `AuthProvider.tsx` (workspaceMode 기반 리다이렉트), `AppSidebar.tsx` (신규 — 역할별 메뉴), `layout.tsx` (AppSidebar 마운트 + 경로별 안내) | TASK-1101 (workspaceMode API 완성 필수) | 금지(403) 아닌 안내(toast) 방식. BOTH → /editor + 헤더 배지 |

**순차 강제 이유**: TASK-1102는 `workspaceMode` API 응답에 의존 → TASK-1101 완료 후만 진행 가능.

---

### Stage 3 — API 중심 분석 계획 & 진행률 패널 (High, TASK-1100 완료 후 독립 진행)

| TASK | 제목 | 서비스 | 파일 | 선행 | 비고 |
|------|------|--------|------|------|------|
| **TASK-1106** 🟠 | API 중심 분석 계획 & 진행률 패널 | ai_engine + backend + frontend | `api_discovery_node.py` (신규), `analyze.py`, `scan_files_node.py`, `CreateSessionRequest.java`, Progress Panel 컴포넌트 | TASK-1100 | Stage 1/2와 병렬 진행 가능 — 공유 파일 없음 |

**병렬 안전 조건**: TASK-1106은 ai_engine + backend analysis 도메인 + frontend ProgressPanel만 건드림 → TASK-1101~1105와 공유 파일 없음 → Stage 1 착수와 동시에 병렬 진행 가능.

**설계 요점**:
- `api_discovery_node`: LLM 없이 정적 파싱만 (비용 0). 파싱 prefix: `*Controller` / `*Service` / `*ServiceImpl` / `*Repository` / `*Mapper`
- import depth-1 추적으로 연관 파일 자동 포함 (full call graph는 Sprint 13 AI Advanced I)
- `fileFilter` null = 기존 전체 분석 동일 동작 (하위 호환 유지)
- 새 Redis 이벤트 타입: `api_plan` (api_groups 전체), `scan_complete`에 `files` 목록 추가

**하위 할일**:
- [ ] **[AI Engine]** `apps/ai_engine/agent/nodes/api_discovery_node.py` 신설
  - Spring Boot `@*Mapping` 어노테이션 파싱 → URL + 그룹명
  - FastAPI `@router.*` 데코레이터 파싱
  - Next.js `app/api/**/route.ts` 경로 → URL 도출
  - React/TS: `axios.js` / `api.ts` / `client.ts` 내 `axios.get/post` 호출 파싱
  - Prefix 그룹화: `*Controller` / `*Service` / `*ServiceImpl` / `*Repository` / `*Mapper`
  - import depth-1 추적 (순환 참조 방어)
  - 출력: `api_groups: [{name, url, files: [{path, line}]}]`
- [ ] **[AI Engine]** `analyze.py`: `api_plan` Redis 이벤트 추가 + `scan_complete`에 `files` 포함
- [ ] **[AI Engine]** `scan_files_node.py`: `fileFilter` 지원 추가
- [ ] **[Backend]** `CreateSessionRequest.java`: `fileFilter: List<String>` 옵션 필드 + AI Engine 전달
- [ ] **[Frontend]** Progress Panel 개편:
  - `api_plan` → API 그룹 아코디언 + 파일 목록 (pending 상태)
  - `progress` → 파일별 상태 업데이트 (pending → analyzing → done/cached/failed)
  - 그룹별 진행률 바 (완료/전체)
  - 파일 클릭 → Monaco Editor 열기
  - "선택 분석" 모드: 그룹 체크박스 → fileFilter 포함 세션 재시작

---

## 전체 실행 순서 요약

| 순서 | TASK | 제목 | 선행 | 에이전트 | 우선순위 |
|------|------|------|------|---------|---------|
| 0 | TASK-1100 | 브랜치 통합 및 충돌 해소 | — | Dev | 🔴 Critical |
| 1a | TASK-1101 | Persona 온보딩 + 백엔드 연동 | TASK-1100 | Dev + Tester | 🔴 Critical |
| 1b | TASK-1103 | 디자인 시스템 통일 | TASK-1100 | Dev | 🟠 High |
| 1c | TASK-1104 | 법적 페이지 3종 + 동의 컬럼 | TASK-1100 | Dev | 🔴 Critical |
| 1d | TASK-1105 | Sprint 10 수동 검증 청산 | TASK-1100 | Tester | 🟠 High |
| 1e | TASK-1106 | API 중심 분석 계획 & 진행률 패널 | TASK-1100 | Dev + Tester | 🟠 High |
| 2 | TASK-1102 | 페르소나별 랜딩 & 사이드바 | TASK-1101 | Dev + Tester | 🔴 Critical |

**병렬 실행 그룹**:
- **Stage 0 (순차)**: TASK-1100 단독
- **Stage 1 (TASK-1100 후, 5-way 병렬)**: TASK-1101 + TASK-1103 + TASK-1104 + TASK-1105 + TASK-1106
- **Stage 2 (TASK-1101 후, 순차)**: TASK-1102

---

## 이월 태스크

| 항목 | 출처 | Sprint 11 처리 |
|------|------|--------------|
| Sprint 10 완료 기준 12건 (Webhook · Check Run · 시크릿 스캔 · 야간 스캔 · 팀 대시보드 · ROI · 스캔 모드 · CompliancePage · TeamManagementPage · SettingsPage · 이월 수동검증 4건) | Sprint 10 | **TASK-1105에 통합** (Tester 전담) |
| `make perf-test` k6 p95 < 500ms | Sprint 8 이월 | TASK-1105 일부 |
| OWASP ZAP Critical 0건 | Sprint 8 이월 | TASK-1105 일부 |
| 2FA QR Google Authenticator 수동 검증 | Sprint 8 이월 | TASK-1105 일부 (단, 2FA 프론트엔드 UI 자체는 Sprint 12 TASK-1208b) |
| Nginx HTTP → HTTPS 리다이렉트 | Sprint 8 이월 | TASK-1105 일부 |
| VSCode Extension 수동 설치 검증 | Sprint 9 이월 | TASK-1105 일부 |
| GDPR 30일 시뮬레이션 통합 테스트 | Sprint 9 이월 | TASK-1105 일부 |

---

## 리스크 분석

### 의존성 리스크

1. **브랜치 충돌 복잡도 (TASK-1100)**: feat/frontend-ui(9커밋) ↔ refactor/frontend-ui(9커밋) 양쪽 동일 파일군 수정. 3-way merge보다 파일별 수동 통합 권장
2. **`useAuthStore.ts` 동시 수정 (1101 + 1103)**: 스토어는 1101 전담, 1103은 CSS만
3. **`GET /users/me` 응답 변경 (1101)**: `workspaceMode?` 선택적 필드로 추가 → 기존 컴포넌트 회귀 없음
4. **AppSidebar.tsx 신규 (1102)**: Stage 0 #5에서 기존 layout.tsx 네비게이션 위치 확인 후 분리 결정

### 기술 복잡도 리스크

5. **workspaceMode 분기 미들웨어 (1102)**: 서버 측 미들웨어 vs 클라이언트 리다이렉트 → **클라이언트 측** (AuthProvider `useEffect` + `router.replace`)
6. **BOTH 역할 UX (1102)**: 헤더 배지 클릭으로 즉시 전환, persist 유지
7. **법적 페이지 ko/en 동시 (1104)**: ko 우선 → en은 Sprint 12 정식 번역 (영문 placeholder만)
8. **CookieConsentBanner GDPR 준수 (1104)**: "필수만 허용" / "전체 허용" 선택지 필수 — "거절" 단일 옵션 안 됨

### 보안 리스크

9. **workspace_mode Controller 검증 (1101)**: `@Pattern(regexp = "^(DEVELOPER|SECURITY_MANAGER|BOTH)$")` 누락 시 임의 값 DB 저장 위험
10. **사이드바 분기 (1102)**: SECURITY_MANAGER가 `/editor` 직접 URL 접근 시 → toast 안내 + 자연스러운 리다이렉트 (실제 데이터 접근은 백엔드 `@PreAuthorize`로 별도 통제)
11. **동의 시각 저장 (1104)**: `terms_accepted_at`, `privacy_accepted_at` 시각이 분쟁 시 증빙. NULL 허용 X — 회원가입 트랜잭션에서 강제 set
12. **Sprint 10 수동검증 GitHub Webhook (1105)**: Webhook 동작 검증 시 `extractInstallationToken()` 스텁 때문에 PR 자동 분석은 동작 안 함 — Sprint 12 TASK-1201 의존성. **이 한계는 Sprint 11 결함이 아니며 Sprint 12 우선 처리로 명시**

---

## 스프린트 테스트 마일스톤

| 마일스톤 | 기준 |
|---------|------|
| **Stage 0 게이트** | feat/frontend-ui → main 머지 + refactor/frontend-ui 충돌 해소 + `./gradlew test` 통과 + 주요 페이지 5개 렌더링 오류 없음 |
| **Stage 1 게이트** | (1101) V048 적용 + `PATCH /workspace-mode` 유효하지 않은 값 400 + 온보딩 역할 선택 → DB 저장 / (1103) 5개 페이지 Pagori 토큰 일관성 / (1104) V049 적용 + 동의 체크 미체크 시 회원가입 400 + Footer 3개 링크 동작 + Cookie Banner 표시 / (1105) Sprint 10 검증 12건 PASS 또는 발견 버그 수정 완료 / (1106) api_discovery_node 단위 테스트 통과 + Progress Panel API 그룹 렌더링 확인 |
| **Stage 2 게이트** | DEVELOPER → `/editor` 랜딩, SECURITY_MANAGER → `/dashboard` 랜딩, BOTH → `/editor` + 헤더 배지 표시. 사이드바 역할별 메뉴 분기 |
| **Sprint 11 완료** | 위 3개 게이트 모두 통과 + 베타 배포 가능 상태 (GDPR/PIPA 준수 + 핵심 UX 분기 완성 + API 중심 분석 계획 화면 동작) |

---

## Sprint 11 완료 기준

### 기능 완료
- [x] **브랜치 통합**: feat/frontend-ui + refactor/frontend-ui → main 충돌 해소 머지 완료 (2026-05-30, `f55c716`)
- [ ] **V048 마이그레이션**: `users.workspace_mode` 컬럼 추가
- [ ] **V049 마이그레이션**: `users.terms_accepted_at`, `privacy_accepted_at` 컬럼 추가
- [ ] **workspace-mode API**: `PATCH /api/v1/users/me/workspace-mode` 구현 + `@Pattern` 검증
- [ ] **Persona 온보딩**: 역할 선택 → DB 저장 → 로그인 후 `workspaceMode` 응답 포함
- [ ] **랜딩 분기**: DEVELOPER → `/editor`, SECURITY_MANAGER → `/dashboard`, BOTH → `/editor` + 배지
- [ ] **AppSidebar**: 역할별 메뉴 분기 완성
- [ ] **디자인 통일**: 주요 5개 페이지 Pagori 토큰 일관성
- [ ] **법적 페이지**: `/legal/terms`, `/legal/privacy`, `/legal/cookie` 3종 ko 동작 + Footer 링크
- [ ] **동의 체크박스**: 회원가입 폼에 ToS/Privacy 필수 + 선택 광고성 정보 수신 동의
- [ ] **Cookie Banner**: 첫 방문 시 배너 표시 + 거절 시 비필수 쿠키 미설정
- [ ] **api_discovery_node**: Spring Boot / FastAPI / Next.js / React SPA 4종 파싱 + prefix 그룹화 (`*ServiceImpl` 포함)
- [ ] **api_plan 이벤트**: 분석 시작 직후 SSE로 전체 API 그룹 + 파일 목록 수신
- [ ] **Progress Panel**: API 그룹별 아코디언 + 파일별 상태 아이콘 + 그룹 진행률 바
- [ ] **선택 분석**: API 그룹 체크박스 → fileFilter 포함 세션 재시작
- [ ] **파일 클릭 네비게이션**: Progress Panel 파일 클릭 → Monaco Editor 해당 파일 열기

### 품질 게이트
- [ ] **회귀 없음**: `./gradlew test` 전체 통과
- [ ] **수동 검증**: Sprint 10 완료 기준 12건 검증 PASS 또는 발견 버그 수정 완료
- [ ] **TASK-1106 단위 테스트**: `api_discovery_node` Controller/Service/ServiceImpl/Repository 그룹화 검증
- [ ] **세션 로그**: `docs/session_log/2026-06-{day}_*.md` 작성

---

## 실행 명령어

```
/stage 0   — TASK-1100 (브랜치 통합 + 충돌 해소)
/stage 1   — TASK-1101 + TASK-1103 + TASK-1104 + TASK-1105 + TASK-1106  ※ 5-way 병렬
/stage 2   — TASK-1102 (랜딩 분기 + AppSidebar)
/done      — 세션 로그 작성
```

**병행 권장 타이밍**:
- TASK-1105 수동검증 Critical 4건 → `/stage 1` 시작 직후
- TASK-1106 ai_discovery_node → Stage 1 착수와 동시 (ai_engine 독립 영역)
- TASK-1105 이월 수동검증 (k6/ZAP/2FA QR/Nginx HTTPS) → Stage 1 진행 중
- VSCode Extension + GDPR 30일 시뮬레이션 → Stage 2 진행 중

---

## 에이전트 평가 요약

### PM 에이전트 (스테이지 설계)
- Sprint 11 백로그 V5.4 기준 7개 태스크(TASK-1100~1106) 3개 스테이지 배치
- Critical 4개 + High 3개 — Critical 우선 처리 보장
- Stage 1을 5-way 병렬로 확장 — TASK-1106 ai_engine 독립 영역으로 충돌 0
- Stage 0 사전 결정 9건으로 착수 후 결정 지연 방지
- Sprint 10 수동 검증 이월 12건을 TASK-1105로 일괄 흡수 — 만성 이월 차단
- TASK-1106: Sprint 13 AI Advanced I MVP 선행 — api_discovery_node 정적 파싱으로 비용 0, import depth-1로 full call graph는 Sprint 13에서 완성

### Dev 에이전트 (현실성 평가)
- **계획 수정 사항 (V5.3 동기화)**:
  1. V047은 `feat/modify-bug` 리포트 마이그레이션이 사용 → workspace_mode/legal_consent를 V048/V049로 재배정
  2. Sprint 10 수동검증 12건 미실시 → TASK-1105 신설로 청산
  3. 법적 페이지 GDPR 준수 누락 → TASK-1104 신설 (베타 배포 전 필수)
- **GitHub Webhook 검증 한계**: `extractInstallationToken()` 스텁으로 PR 자동 분석 검증 불가 — TASK-1105에서 제한 명시. Sprint 12 TASK-1201 해소 의존.

### Reviewer 에이전트 (게이트 검증 항목)
- Stage 0 종료 시점에 main 브랜치 빌드/테스트 회귀 0건 확인
- Stage 1 종료 시점에 V048 + V049 마이그레이션 적용 확인 + Controller `@Pattern` 검증 코드 존재
- Stage 2 종료 시점에 클라이언트 리다이렉트 vs 미들웨어 결정 준수 + persist 동작 확인

---

*Sprint 11 계획 작성일: 2026-05-27 (V1) · 갱신: 2026-05-28 (V2 — 백로그 V5.3 반영, TASK-1104/1105 본문 통합, Flyway 번호 재배정) · 2026-05-29 (V3 — TASK-1106 API 중심 분석 계획 & 진행률 패널 신설, Stage 3 추가, 백로그 V5.4)*
