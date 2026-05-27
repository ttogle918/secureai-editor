# Sprint 10 마무리 + 백로그 V5 세션 로그 (2026-05-26)

**브랜치**: `feat/sprint10`  
**작업 범위**: Sprint 10 Stage 5 완료 후 `/done` 실행 → 백로그 상태 진단 → V5 업데이트

---

## 주요 작업 순서

### 1. `/done` 실행 — 잔여 커밋 정리

Sprint 10 Stage 5 완료 후 `/done` 스킬 실행하여 미커밋 파일 검토.

**발견된 미커밋 파일 2개:**

| 파일 | 변경 내용 |
|------|---------|
| `apps/frontend/src/app/team/[orgSlug]/members/page.tsx` | `acceptedAt` 기반 상태 판별 로직 + 인라인 Toast 훅 개선. FEAT-FE-004 TeamManagementPage 완성 |
| `docs/07_SPRINT_BACKLOG_V4_260523.md` | Sprint 9 완료 표시, Sprint 10 진행 중 표시, Sprint 11~16 섹션 초안 추가 |

**추가 커밋:**
- `78adaa6` feat(frontend): Sprint 10 Stage 5 FEAT-FE-004 완성 + 백로그 업데이트
- `23088ef` docs(session): Sprint 10 Stage 4-5 세션 로그 작성

세션 로그 `260526_sprint10_stages4-5.md` 작성 완료.

---

### 2. 백로그 상태 진단 (사용자 요청)

`docs/07_SPRINT_BACKLOG_V4_260523.md`와 `docs/sprints/` 폴더 전체 검토.

#### 발견된 문제점

| # | 문제 | 근본 원인 | 영향도 |
|---|------|---------|-------|
| 1 | Sprint 10 체크박스 미반영 | TASK-1001~1004 하위 할일이 모두 `[ ]` 상태 — 실제로는 모두 완료됨 | 높음: 백로그 신뢰도 저하 |
| 2 | 로드맵 오류 | "Stage 1~4 완료"로 표기 — Stage 5도 완료됨 | 중간: 진행률 현황 오인 |
| 3 | Sprint 12 중복 | TASK-1201 ADR-016 전환이 Sprint 12에 기재 — 실제론 Sprint 9(TASK-904)에서 이미 완료됨 | 높음: 중복 계획 발생 |
| 4 | Sprint 11 백로그 얕음 | 3개 태스크뿐, 백엔드 선행 작업(Flyway, API) 미명세 | 중간: 스프린트 범위 모호 |
| 5 | Admin cowork 이월 항목 불일치 | `sprint-admin-cowork.md`에 기록된 이월 중 `sendOrgInvitation`은 실제 구현됨. `extractInstallationToken`/`resolveProjectId`는 여전히 스텁 | 높음: 기술 부채 추적 실패 |

---

### 3. 핵심 발견: `refactor/frontend-ui` 미머지 브랜치

git 리포지토리 상태 검토 결과 **미머지 브랜치 발견**.

#### 브랜치 상황

```
main (HEAD)
 ├── feat/sprint10 (+12 commits)  
 │   └── Sprint 10 Enterprise 기능
 └── refactor/frontend-ui (+10 commits, 10커밋/4200줄 앞서 있음)
     └── ⚠️ 미머지!
```

#### 포함된 구현 내용

| 파일 | 줄 수 | 내용 |
|------|------|------|
| `onboarding/page.tsx` | +842 | 온보딩 전체 UI + 폼 스테이트 |
| `preferences/page.tsx` | +561 | 선호도 설정 + 테마 전환 |
| `github-scan/page.tsx` | +597 | GitHub 스캔 페이지 개선 + 액션 UI |
| `commit-scan/page.tsx` | +423 | 커밋 스캔 페이지 개선 + 폼 필드 |
| `ChatFAB.tsx` | +317 | Chat 플로팅 액션 버튼 + 스타일링 |
| `settings/page.tsx` | +116 | 설정 페이지 개선 (Sprint 10의 `ScanModeDefaultSection`과 충돌 예상) |
| `globals.css` | 신규 | 디자인 토큰 추가 (색상, 타이포, 간격) |

**영향**: 이 브랜치가 이미 Sprint 10 리디자인의 상당 부분을 포함하고 있었음. Sprint 11 계획의 "frontend-refactoring 이식"이 실제론 이미 구현된 상태 → Sprint 11에서는 머지 충돌 해소 + 백엔드 연동이 실질 작업.

---

### 4. 백로그 V5 업데이트

기존 V4 파일에서 문제점을 반영하여 신규 파일 작성.

#### Sprint 10 완료 처리

**체크박스 반영:**
- TASK-1001 ~ TASK-1004 하위 할일 모두 `[x]` 체크
- FEAT-FE-003 (Settings) 완료 처리
- FEAT-FE-004 (TeamManagementPage) 완료 처리
- FEAT-FE-005 (Invite 모달) 완료 처리

**잔존 기술 부채 명시:**
```
⚠️ 기술 부채 (이월):
- Admin.sendOrgInvitation() ✅ 구현됨
- Admin.extractInstallationToken() 🔴 스텁 → Sprint 12에서 구현
- Admin.resolveProjectId() 🔴 스텁 → Sprint 12에서 구현
- GitHub API totalCreditsUsed 집계 → 스텁으로 0 반환 중 (Sprint 12)
```

#### Sprint 11 재정의 (3→4 태스크)

기존 3개 태스크에서 브랜치 통합을 위한 선행 작업 추가.

**TASK-1100 (신규) — 브랜치 통합 선행**
```
다음 릴리스 전 필수:
- feat/sprint10 → main PR 검토 + 머지
- refactor/frontend-ui → main 머지 (settings.tsx 충돌 해소 포함)
- 통합 후 e2e 회귀 테스트 (Cypress)
- 프론트엔드 수동 검증
```

**TASK-1101 (상세화) — workspace_mode 백엔드 구현**
```
상태 저장 및 라우팅 기반 제공:
- Flyway V048: users 테이블에 workspace_mode 컬럼 추가 (DEFAULT 'enterprise')
- PATCH /api/v1/users/me/workspace-mode API 명세
  - Request: { "mode": "personal" | "enterprise" }
  - Response: { "mode": "personal", "updatedAt": "..." }
- UserService.updateWorkspaceMode() 구현
- UserRepository.findByIdWithWorkspaceMode() 추가
```

**TASK-1102 (신규) — 페르소나 기반 라우팅**
```
AuthProvider + AppSidebar 조건부 메뉴 분기:
- AuthProvider: workspace_mode 읽기 후 Context 제공
- AppSidebar: mode === 'personal' ? PersonalMenu : EnterpriseMenu
- 메뉴 항목:
  - Personal: Scan, Reports, Settings, Chat
  - Enterprise: Scan, Team, Reports, Settings, Admin, Chat
```

**TASK-1103 (범위 조정) — frontend-refactoring 통합**
```
"이식" → "통합 후 잔존 불일치 제거":
- refactor/frontend-ui 머지 후 globals.css 테마 적용 검증
- 백엔드 settings 엔드포인트와 Frontend ScanModeDefaultSection 연동 확인
- 온보딩 플로우 → workspace_mode 선택 단계 추가 (TASK-1101과 연계)
```

#### Sprint 12 재정의

ADR-016 중복 제거 및 GitHub App 인증 완성 중심.

**TASK-1201 (변경) — GitHub App 인증 플로우 완성**
```
PR 자동분석의 핵심: GitHub 연동 완성

구현 항목:
1. Admin.extractInstallationToken()
   - GitHub App installation endpoint 구현
   - JWT 발급 → access token 교환
   - Token 암호화 저장

2. Admin.resolveProjectId()
   - 소유자 + 리포지토리명 → GitHub project ID 매핑
   - GraphQL API 호출

3. totalCreditsUsed 집계
   - GitHub Actions 사용량 조회
   - AI Engine 호출 횟수 합산
   - Dashboard 표시

결과: GitHub App 인증 완료 → PR 이벤트 수신 → 자동분석 실제 동작 가능
```

**TASK-1202 (신규) — 감사 로그 불변성 + k6/ZAP CI**
```
스프린트 12에서 추가할 고도화:
- AuditLog 테이블 타임스탬프 인덱스 강화
- k6 부하 테스트 CI/CD 연동
- OWASP ZAP Full Scan CI 포함
```

---

### 5. 이후 스프린트 방향 합의

#### 실행 순서 (최종 결정)

1. **현재**: 프론트엔드 UI 추가 변경 작업 진행 중
2. **직후**: Sprint 0~10 전체 수동 검증 + 버그 수정
3. **그 다음**: `refactor/frontend-ui` + `feat/sprint10` → main 머지
4. **최종**: Sprint 11 착수

#### 스프린트별 핵심 목표

| Sprint | 기간 | 핵심 목표 | 관련 EPIC |
|--------|------|---------|----------|
| **11** | 5/27~6/2 | 브랜치 통합 + workspace_mode 백엔드 + 페르소나 라우팅 + 디자인 통일 | EPIC-ORCH-001 |
| **12** | 6/3~6/9 | GitHub App 인증 완성 (PR 자동분석 실제 동작) + 감사 로그 불변성 + k6/ZAP CI | EPIC-ORCH-002 |
| **13** | 6/10~6/16 | AI Agent: API 호출 흐름 SAST 분석 + 오탐 학습 (pgvector) | EPIC-AI-001 |
| **14** | 6/17~6/23 | 패치 자동 PR 생성 + Docker 샌드박스 검증 | EPIC-PATCH-001 |
| **15** | 6/24~6/30 | SARIF 내보내기 + Outbound Webhook (Jira/Slack) | EPIC-INTEG-001 |
| **16** | 7/1~7/7 | DAST 실시간 시뮬레이터 + Prometheus 메트릭 고도화 | EPIC-OPS-001 |

#### 주요 선행 조건

```
Sprint 14 (패치 PR 생성) 
  ← 의존 ← Sprint 12 (GitHub App 인증 완성)
  
Sprint 15 (Webhook 통합)
  ← 의존 ← Sprint 14 (패치 PR 생성 성공)
  
Sprint 16 (DAST 시뮬레이터)
  ← 독립 (병렬 가능, Sprint 13과 동시 진행)
```

---

## 최종 커밋 목록 (2026-05-26)

| 커밋 | 내용 | 영향도 |
|------|------|--------|
| `78adaa6` | feat(frontend): Sprint 10 Stage 5 FEAT-FE-004 완성 + 백로그 업데이트 | 중간 |
| `23088ef` | docs(session): Sprint 10 Stage 4-5 세션 로그 작성 | 낮음 |
| (미정) | docs(backlog): V5 업데이트 — Sprint 10 완료 + Sprint 11/12 재정의 | 높음 |

---

## 아키텍처·설계 결정 사항

### 백로그 재구성 원칙

- **Sprint 11 (브랜치 통합)**
  - `refactor/frontend-ui` 미머지 상태가 Sprint 11 계획에 직접 영향 → TASK-1100으로 명시화
  - settings.tsx 충돌 해소: 기존 Sprint 10의 `ScanModeDefaultSection`과 refactor 브랜치의 개선된 `settings/page.tsx` 통합
  - workspace_mode는 백엔드 선행 구현 필요 → TASK-1101로 분리

- **Sprint 12 (GitHub App 인증)**
  - 스텁 함수(`extractInstallationToken`, `resolveProjectId`, `totalCreditsUsed`)를 명시적으로 기술 부채로 등재
  - PR 자동분석의 실제 동작이 Sprint 14(패치 PR)의 선행 조건임을 명확화
  - ADR-016(MCP SQL → Backend API) 중복 제거 (Sprint 9에서 이미 완료)

### 기술 부채 추적

```
✅ 완료 (Sprint 10):
  - Admin.sendOrgInvitation()
  - Frontend 리디자인 (refactor/frontend-ui 구현 완료, 미머지)

🔴 개발 중 (Sprint 12 대기):
  - Admin.extractInstallationToken() [스텁]
  - Admin.resolveProjectId() [스텁]
  - totalCreditsUsed 집계 [0으로 하드코딩]
```

---

## 다음 세션에서 할 것

### 우선순위 1: 프론트엔드 및 머지 준비
1. 프론트엔드 UI 추가 변경 완료
2. `feat/sprint10` → main PR 생성 (설명 포함: workspace_mode 기반, TeamManagement 추가)
3. `refactor/frontend-ui` → main PR 생성 (설명 포함: globals.css 통합, 설정 페이지 개선)

### 우선순위 2: 전체 검증 및 버그 수정
4. Sprint 0~10 전체 수동 검증 시나리오 스크립트 작성
5. E2E 테스트 실행 (Cypress): 온보딩 → 스캔 → 보고서 → 설정
6. 실패 항목 버그 수정 (이월 항목 포함)

### 우선순위 3: 브랜치 통합 및 Sprint 11 시작
7. PR 리뷰 + 머지 (충돌 해소 포함)
8. 통합 후 로컬 전체 빌드 + 기본 기능 검증
9. `/sprint 11` 착수 (TASK-1100~1103)

---

## 참고: 백로그 V5 파일 위치

- **생성 예정**: `docs/07_SPRINT_BACKLOG_V5_260526.md`
- **기존 파일**: `docs/07_SPRINT_BACKLOG_V4_260523.md` (아카이빙)
- **폴더**: `docs/sprints/` (Sprint 11~16 초안 포함)
