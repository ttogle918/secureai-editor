# 페이지 인벤토리 & UI 리팩터링 매핑

> 작성일: 2026-05-27  
> 기준: `apps/frontend/src/app/` (현재 구현) ↔ `frontend-refactoring/components/` (새 레퍼런스)

---

## 1. 현재 페이지 목록

| # | 경로 | 파일 | 역할 | 레퍼런스 컴포넌트 |
|---|------|------|------|----------------|
| 1 | `/` | `app/page.tsx` | 마케팅 랜딩 페이지 (Nav · Hero · Features · Pricing · Stats · Footer) | — (별도 레퍼런스 없음) |
| 2 | `/login` | `app/(auth)/login/page.tsx` | 이메일/GitHub OAuth 로그인 폼 | `MissingScreens` 내 Auth 섹션 |
| 3 | `/register` | `app/(auth)/register/page.tsx` | 회원가입 폼 (이메일·사용자명·비밀번호 확인) | `MissingScreens` 내 Auth 섹션 |
| 4 | `/auth/callback` | `app/auth/callback/page.tsx` | GitHub OAuth 콜백 처리 — code → access token 교환 후 `/editor` 리다이렉트 | — (비UI 라우트) |
| 5 | `/auth/verify-email` | `app/auth/verify-email/page.tsx` | 이메일 인증 토큰 처리 → 성공/실패 메시지 표시 | — (비UI 라우트) |
| 6 | `/onboarding` | `app/onboarding/page.tsx` | 최초 가입 후 3단계 플로우: 프로젝트 생성 → 분석 소스 선택 → 첫 분석 시작 | `Onboarding.jsx` + `WorkspaceMode.jsx` |
| 7 | `/preferences` | `app/preferences/page.tsx` | 초기 설정: UI 언어 · 테마 · AI 말투 · AI 음성(예정) | `PreferencesSetup.jsx` |
| 8 | `/editor` | `app/editor/page.tsx` | **코어 워크스페이스** — 파일 트리 · Monaco 에디터 · 취약점 패널 · AI 채팅 · DAST · 대시보드 | `EditorV4Hybrid.jsx` + `DashboardCombined.jsx` + `DastSimulator.jsx` + `ApiFlowProgress.jsx` + `FalsePositiveModal.jsx` + `SecurityCodeViewer.jsx` |
| 9 | `/github-scan` | `app/github-scan/page.tsx` | GitHub 레포 스캔 설정 — 레포 선택 · 브랜치 · 모델 · 스캔 깊이 | `MissingScreens.jsx` → `GithubScanFlow` |
| 10 | `/commit-scan` | `app/commit-scan/page.tsx` | 커밋 시크릿 스캔 결과 — 범위 선택 · 실시간 진행 · 시크릿 발견 목록 | `MissingScreens.jsx` → `CommitSecretScan` |
| 11 | `/projects/[projectId]/compliance` | `app/projects/[projectId]/compliance/page.tsx` | 컴플라이언스 프레임워크 매핑 (ISO 27001 / NIST CSF / OWASP ASVS / PCI-DSS) | `ComplianceReport.jsx` |
| 12 | `/projects/[projectId]/sbom` | `app/projects/[projectId]/sbom/page.tsx` | SBOM 컴포넌트 조회 · CVE 상세 · 의존성 트리 | `SbomCve.jsx` |
| 13 | `/settings` | `app/settings/page.tsx` | 설정 — API 키(BYOK) · AI 모델 · 크레딧 · PR 리뷰 이력 · 스캔 모드 · 언어 | `SettingsSecurity.jsx` + `EnterpriseBilling.jsx` (API Key 관리) |
| 14 | `/profile` | `app/profile/page.tsx` | 내 프로필 — 계정 정보 · 플랜 · 월간 SAST 사용량 · GitHub 연결 여부 | `EnterpriseAdmin.jsx` → `MemberActivityDetail` |
| 15 | `/team` | `app/team/page.tsx` | 내가 속한 조직(Organization) 목록 · 새 조직 생성 | `EnterpriseAdmin.jsx` → `OrgAdminDashboard` |
| 16 | `/team/[orgSlug]` | `app/team/[orgSlug]/page.tsx` | 조직 상세 대시보드 — 취약점 현황 파이차트 · 멤버 수 · 역할 | `EnterpriseAdmin.jsx` → `OrgAdminDashboard` |
| 17 | `/team/[orgSlug]/members` | `app/team/[orgSlug]/members/page.tsx` | 조직 멤버 관리 — 역할 변경 · 초대 · 강퇴 | `EnterpriseAdmin.jsx` → `TeamInviteModal` |
| 18 | `/invite/[token]` | `app/invite/[token]/page.tsx` | 팀 초대 링크 수락/거절 처리 | `EnterpriseAdmin.jsx` → `TeamInviteModal` |
| 19 | `/admin/users` | `app/admin/users/page.tsx` | **슈퍼 어드민** — 전체 사용자 목록 · 검색 · 페이지네이션 · 플랜/크레딧 확인 | `EnterpriseAdmin.jsx` → `MasterAdminDashboard` |
| 20 | `/admin/plans` | `app/admin/plans/page.tsx` | **슈퍼 어드민** — 플랜 목록 · 기능 플래그(DAST 허용 등) 일람 | `EnterpriseAdmin.jsx` → `MasterAdminDashboard` |

---

## 2. 레퍼런스 컴포넌트 → 페이지 매핑

| 레퍼런스 파일 | 적용 대상 페이지 | 주요 변경 포인트 |
|-------------|----------------|----------------|
| `EditorV4Hybrid.jsx` | `/editor` | Collapsible 사이드바 · Floating AI 채팅 버블 · 오른쪽 클릭 컨텍스트 메뉴 · @멘션 자동완성 · DAST 상태 컬럼 · 멀티 선택 벌크 액션 |
| `DashboardCombined.jsx` | `/editor` (대시보드 뷰) | Analyst ↔ Executive 뷰 토글 · 날짜 범위 필터 · PDF 다운로드 · workspaceMode(보안 관리자) SLA + ISO27001 위젯 |
| `DastSimulator.jsx` | `/editor` (DAST 패널) | DAST 시뮬레이터 UI |
| `ApiFlowProgress.jsx` | `/editor` (보안 관리자 모드) | API 호출 흐름 차트 (코드 편집기 대체) |
| `FalsePositiveModal.jsx` | `/editor` (취약점 패널) | 오탐 마킹 모달 |
| `SecurityCodeViewer.jsx` | `/editor` (보안 관리자 모드) | 읽기 전용 코드 뷰어 |
| `Onboarding.jsx` | `/onboarding` | Step 0 추가 (워크스페이스 모드 선택) · 팀 초대 UI · AI 추천 필터 |
| `WorkspaceMode.jsx` | `/onboarding` + `/editor` | 개발자 vs 보안 관리자 모드 선택 카드 · 헤더 모드 배지 |
| `PreferencesSetup.jsx` | `/preferences` | 언어 · AI 말투 · AI 음성(Coming soon) |
| `MissingScreens.jsx` | `/github-scan`, `/commit-scan` | GitHub 스캔 플로우, 커밋 시크릿 스캔 |
| `ComplianceReport.jsx` | `/projects/[id]/compliance` | 4개 프레임워크 탭 · 통제 항목 매트릭스 테이블 · 내보내기 |
| `SbomCve.jsx` | `/projects/[id]/sbom` | KPI 스트립 · 의존성 테이블 · CVE 상세 카드 |
| `SettingsSecurity.jsx` | `/settings` (보안 섹션) | 2FA(TOTP) 활성화 · QR 코드 · 복구 코드 · IP 허용목록 |
| `EnterpriseBilling.jsx` | `/settings` (결제/API 섹션) | 월 인보이스 · BYOK vs Pagori-managed 키 모드 전환 |
| `EnterpriseAdmin.jsx` | `/admin/*`, `/team/*`, `/profile` | 회사 인증 · 팀 초대 · 조직 관리자 대시 · 멤버 상세 · Master 어드민 |
| `EnterpriseLogs.jsx` | `/admin/*` (미구현) | Master 이상 알림 트리거 로그 · 멤버 토큰 사용 이력 · 감사 로그 내보내기 |
| `EnterpriseChannels.jsx` | `/settings` (미구현) | Slack/Teams/Discord 채널 매핑 · 알림 센터 풀 페이지 |
| `EnterprisePolicies.jsx` | `/admin/*` (미구현) | 기업 보안 정책 관리 |
| `EnterpriseScale.jsx` | 랜딩 or 어드민 (미구현) | 기업용 스케일/요금 안내 |
| `EnterpriseLaunch.jsx` | 랜딩 or 온보딩 (미구현) | 기업용 런치 소개 화면 |
| `EmptyStates.jsx` | 공통 | 빈 상태 일러스트/메시지 |
| `ResponsiveScreens.jsx` | 공통 | 모바일/반응형 레이아웃 |

---

## 3. 리팩터링 우선순위 (완료 현황)

> ✅ = 완료 · 📌 = 부분(API 주석만) · ⏳ = 미반영

| 순서 | 페이지 | 상태 | 작업 내용 |
|------|--------|------|-----------|
| 1 | `/editor` | ✅ | V4 Hybrid: SlimRail, ChatFAB 3-state, VulnPanel 다중선택/컨텍스트메뉴, AnalysisProgressStrip |
| 2 | `/onboarding` | ✅ | Step 0 추가(워크스페이스 모드 카드), 4단계 플로우, API 주석 |
| 3 | `/projects/[id]/compliance` | ✅ | V4 재설계: 4-탭, 섹션 그루핑, StatusBadge 4상태, 도넛 링, 필터 칩, 감사 풋터 |
| 4 | `/projects/[id]/sbom` | ✅ | 뒤로가기 버튼, API 주석 4개 (기존 UI 우수) |
| 5 | `/settings` | 📌 | API 주석 추가, 2FA TODO 플레이스홀더 (Sprint 11에서 전체 구현) |
| 6 | `/github-scan`, `/commit-scan` | 📌 | API 주석 추가 (기존 UI V4 이미 구현됨) |
| 7 | `/team/*`, `/admin/*` | 📌 | API 주석 추가 (기존 UI 우수) |
| 8 | `/preferences` | ✅ | V4 토큰 이미 사용, API 없음 — 현행 유지 |
| 9 | `/login`, `/register` | 📌 | API 주석 추가 (useAuth hook 경유) |

### 미구현 (Sprint 11+ 예정)
- `EnterpriseLogs.jsx` → `/admin/*` 감사 로그 페이지
- `EnterpriseChannels.jsx` → `/settings` 알림 채널 탭
- `EnterprisePolicies.jsx` → `/admin/*` 정책 관리
- `SettingsSecurity.jsx` 2FA(TOTP) 섹션 전체 구현 (QR 코드 + 6-digit 입력 + 복구 코드)
