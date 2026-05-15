# Admin Console + Organization/Cowork — 세션 로그
**날짜**: 2026-05-15  
**브랜치**: `feat/admin-cowork`  
**PR**: [#67](https://github.com/ttogle918/secureai-editor/pull/67)  
**상태**: PR 생성 완료 (머지 대기)

---

## 배경 및 의사결정

### 왜 Organization 계층을 도입했는가

스프린트 6 시작 전 "관리자 페이지, 사용자 페이지, 팀 협업(cowork) 페이지" 요청을 받았다.

**두 가지 Admin 역할이 존재한다는 것을 명확히 함**:
- **Super-Admin**: 플랫폼 전체 운영자 (사용자 관리, 크레딧 조정, 플랜 변경)
- **Team Admin**: 자기 팀(org) 내 사용량·멤버만 조회 가능

팀 협업을 구현하려면 `project_members` 테이블만으로는 부족하다. 여러 프로젝트를 묶는 **Organization** 계층이 없으면 Team Admin이 팀 단위 사용량을 집계할 수 없다. → Organization 도입을 결정했다.

**타이밍**: Sprint 6 전에 바로 구현. 이유: Organization 없이 Sprint 6 DAST를 구현하면 나중에 org_id FK를 projects 테이블에 추가할 때 대규모 마이그레이션이 필요하다.

---

## 구현 요약

### Stage 1 — ERD 마이그레이션 + 엔티티 (커밋 7cf3838)

| 마이그레이션 | 내용 |
|------------|------|
| V021 | `users.is_admin`, `avatar_url`, `bio`, `public_profile` 추가 |
| V022 | `organizations` 테이블 (soft-delete, owner FK, plan FK) |
| V023 | `org_members` 테이블 (role CHECK: owner/admin/member, UNIQUE(org_id, user_id)) |
| V024 | `projects.org_id` FK (ON DELETE SET NULL) |
| V025 | `team_invitations` (token UNIQUE, expires_at, CHECK: orgId XOR projectId) |

보안: `AdminGuard`, `OrgGuard` 빈 추가. `@PreAuthorize("@adminGuard.check(authentication)")` 패턴으로 메서드 수준 보안 적용.

### Stage 2 — Backend API (커밋 97d5c2c)

- **AdminController**: 사용자 목록 검색(JPQL), 플랜 변경, 크레딧 조정(0 하한 clamp), 활성화 토글. 자기 자신 수정 시 ADMIN_SELF_MODIFICATION_DENIED.
- **OrganizationController**: CRUD + 멤버 관리 + 초대 발송
- **InvitationController**: GET /{token} (permitAll), POST /{token}/accept (JWT)
- **SecurityConfig**: GET /api/v1/invitations/** 추가

### Stage 3A — Super-Admin FE (커밋 5e2738b)

- `AuthUser` 타입에 `isAdmin`, `avatarUrl`, `displayName` 추가
- `admin/layout.tsx`: `!user.isAdmin` 시 즉시 `/` 리다이렉트 (Guard pattern)
- `admin/users/page.tsx`: 검색·필터·드롭다운 액션 (플랜 변경, 크레딧, 활성화)
- `admin/plans/page.tsx`: 플랜 카드 요약 (API 없을 때 fallback 하드코딩)
- `AppHeader`: `isAdmin === true`일 때 오렌지 "Admin" 배지

### Stage 3B — Cowork FE (커밋 292d661)

- `Modal.tsx`: Escape/backdrop 닫기 공통 컴포넌트
- `team/page.tsx`: Org 카드 그리드 + 새 팀 만들기 모달 (slug 자동 생성)
- `team/[orgSlug]/page.tsx`: 팀 대시보드, 사용량은 Admin/Owner에게만 노출
- `team/[orgSlug]/members/page.tsx`: 멤버 테이블, 역할 드롭다운, 제거
- `invite/[token]/page.tsx`: 비인증 허용 → 미로그인 시 `/login?next=/invite/{token}`
- `AppHeader`: `/team` 링크 (Users 아이콘)

---

## Reviewer BLOCK 해소 (커밋 c8e7ab9)

Reviewer가 BLOCK 판정을 내린 4개 이슈:

### BLOCKER 1: /api/v1/internal/** 무인증 노출
**문제**: SecurityConfig에 `permitAll()`만 있고 X-Internal-Key 검증 없음.  
**수정**: `InternalKeyAuthFilter` 신설. `/api/v1/internal/**` 경로에서 `X-Internal-Key` 헤더를 `${secureai.internal-api-key}` 값과 비교. 불일치 시 즉시 401 반환.

### BLOCKER 2: /webhooks/** permitAll 범위 과도
**문제**: GET 포함 모든 /webhooks/** 가 인증 없이 접근 가능.  
**수정**: `HttpMethod.POST, "/webhooks/github"` 로 한정.

### BLOCKER 3: InvitationController → Repository 직접 주입
**문제**: Controller가 `TeamInvitationRepository`를 직접 주입하여 비즈니스 로직 수행.  
**수정**: `OrganizationService.getInvitationInfo(token)` 메서드를 추가하고 Controller는 Service만 호출.

### BLOCKER 4: OrganizationService의 cross-domain JdbcTemplate
**문제**: `OrganizationService`가 `analysis_sessions`, `vulnerabilities` 테이블을 직접 집계(SRP 위반 + 도메인 결합).  
**수정**: `OrgAnalyticsService` 신설하여 집계 로직 전담. `OrganizationService`는 `orgAnalyticsService.countXxx()` 위임만 수행.  
**참고**: JdbcTemplate은 인프라 레이어로 도메인 Repository 주입 금지 규칙과 별개다. 파라미터 바인딩(`?`)으로 SQL 인젝션 방지.

---

## 이월 항목

- `extractInstallationToken()` stub in `GitHubWebhookService` (feat/sprint5 브랜치) — GitHub App 인증 구현 필요
- `resolveProjectId()` stub in `GitHubWebhookService` — ProjectService 연동 필요
- `feat/sprint5` PR (PR #미확인) — admin-cowork와 별도로 머지 필요
- Team Admin 사용량 집계: `credit_transactions` 연동 후 `totalCreditsUsed` 구현
- 이메일 초대 발송: `EmailService.sendOrgInvitation()` 구현
