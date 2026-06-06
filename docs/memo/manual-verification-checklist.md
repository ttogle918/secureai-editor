# 수동 검증 체크리스트 (Sprint 11 종료용)

> 작성: 2026-06-06 · 목적: 코드/테스트로 못 잡는 **브라우저 시각·사람 손** 검증 항목 청산 → Sprint 11 공식 종료.
> 자동/런타임 검증이 끝난 항목은 부채대장(`docs/sprints/sprint-11-task-1105-verification.md`) 참조. 여기 있는 건 **사람이 눈/손으로 확인**할 잔여분.

---

## 0. 사전 준비

- [ ] 스택 기동: `docker compose up -d` (backend 8080 · ai_engine · nginx · postgres · redis …)
- [ ] 프론트: `cd apps/frontend && npm run dev` → http://localhost:3000
- [ ] 로그인 계정 (택1)
  - **`devtest@secureai.test` / `Test1234`** — team1 owner(초대 UI 검증용), 데이터 적음
  - **`ttogle918@gmail.com`** (본인) — 데이터 풍부: dvwa-source(203 취약점)·backend·frontend 등
- 참고 ID
  - dvwa-source projectId: `ee604167-2b86-42cb-8da3-a7453cdd6cb9` (취약점 203, owner=ttogle918)
  - 조직 slug: `team1` (owner=devtest)
- ⚠️ **Anthropic 크레딧 고갈** 상태 — 신규 분석은 대부분 실패함. **분석 실행이 필요한 항목은 크레딧 충전 후** 진행하거나, 기존 분석 데이터(위 프로젝트)로 확인.

PASS 표기: 각 항목 `[ ]` → 확인되면 `[x]`. 문제 발견 시 "결과" 칸에 메모하고 버그면 별도 이슈/태스크화.

---

## A. TASK-1105 잔여 — Sprint 10 기능 시각확인 (4건)

### A-1. SettingsPage
- [ ] 경로: `/settings` (로그인 후)
- 봐야 할 것: **API 키(BYOK)** · AI 모델 · **스캔 모드 기본값** · 크레딧 · PR 리뷰 이력 · 언어 섹션이 모두 렌더되는가
- 결과:

### A-2. 스캔 모드 선택 UI (Audit/Pipeline)
- [ ] 경로: `/github-scan` (또는 분석 시작 다이얼로그)
- 봐야 할 것: **모델 / 스캔 깊이(Audit ↔ Pipeline)** 선택 컨트롤이 보이고 토글되는가
- 결과:

### A-3. CompliancePage (ISO27001 / NIST CSF 매핑)
- [ ] 경로: `/projects/ee604167-2b86-42cb-8da3-a7453cdd6cb9/compliance` (ttogle918 로그인)
- 봐야 할 것: **ISO 27001 / NIST CSF / OWASP ASVS / PCI-DSS 4탭** + 통제 항목 매트릭스 + 도넛 링이 dvwa 취약점 기준으로 채워지는가, **내보내기** 버튼
- 결과:

### A-4. 팀 대시보드 + 리포트 ROI Export(PDF)
- [ ] 경로: `/editor` → 대시보드 뷰 → **Executive(경영진) 토글**
- 봐야 할 것: **토큰예산·MTTR·보안점수** 위젯 + **ROI 리포트 PDF 다운로드** 버튼 클릭 시 PDF가 받아지고 ROI/MTTR 포함되는가
- (보안담당 모드 필요 시) 헤더 배지로 모드 전환 또는 DB `users.workspace_mode='SECURITY_MANAGER'`
- 결과:

---

## B. TASK-1105 잔여 — 사람/외부 장비 (2건)

### B-1. VSCode Extension 수동 설치
- [ ] `apps/vscode_ext` VSIX 빌드/설치 후 VSCode에서 동작 확인 (스캔 트리거·결과 표시)
- 결과:

### B-2. 2FA QR — (이미 완료 ✅)
- [x] 사용자가 폰 Google Authenticator로 스캔·확인 완료 (2026-06-06)

---

## C. Sprint 11 자체 기능 시각확인 (코드 완료, 육안 미확인)

### C-1. 페르소나별 랜딩
- [ ] 로그인 직후 착지: **DEVELOPER → `/editor`** / **SECURITY_MANAGER → 대시보드 뷰**
- (모드 전환: 헤더 배지 또는 온보딩) — 헤더 모드 배지가 권위 소스(authUser.workspaceMode)와 일치하는가
- 결과:

### C-2. 온보딩 — 워크스페이스 모드 저장
- [ ] 경로: `/onboarding` Step 0 → 개발자/보안담당 카드 선택 → 저장
- 봐야 할 것: 선택이 **DB에 저장**(재로그인 후 유지) + 헤더 배지 반영. (PATCH /workspace-mode 호출됨)
- 결과:

### C-3. 회원가입 동의 차단
- [ ] 경로: `/register` → 이용약관/개인정보 **체크 안 하고** 가입 시도
- 봐야 할 것: **가입 차단(400/에러 메시지)**, 동의 후엔 정상 가입
- 결과:

### C-4. Legal 페이지 3종 + 쿠키 배너
- [ ] `/legal/terms` · `/legal/privacy` · `/legal/cookie` 한국어 정식 렌더
- [ ] 첫 방문 시 **쿠키 배너**("필수만 허용"/"전체 허용" 2선택) 표시, 선택 후 재방문 시 미표시
- 결과:

### C-5. Progress 아코디언 (분석 진행률)
- [ ] `/editor`에서 분석 실행 시 진행률이 **API 그룹별 아코디언**으로 표시
- ⚠️ **현재 UI 진행률 바 문제 별도 처리 중** (데이터는 정상). 이 항목은 UI 작업 후 재확인 권장.
- 결과:

---

## D. (별도 기능) 계획/stage + 실시간 스캔 — 참고

> 이번 세션 신규 기능. Sprint 11 종료 조건은 아님. UI 미해결분은 사용자가 별도 작업에서 처리 예정.

- [ ] 분석 시 ProgressPanel에 **Stage 계획 목록**(Stage 1/N) 표시 + 현재 stage 강조
- [ ] **"지금 {파일} 스캔 중…"** 실시간 표시 + 진행바 증가
- 비고: 데이터 레이어(SSE 이벤트)는 라이브 캡처로 정상 확증(stage_started/completed·done current/total). **프론트 렌더링 이슈는 미해결** — 별도 처리.

---

## 완료 게이트

- [ ] A(4) + B-1 + C(5) 전부 PASS 또는 결과 기록
- [ ] 발견 버그는 micro-task로 분리 후 수정
- → 모두 충족 시 **Sprint 11 공식 종료**, 부채대장 잔여 0 갱신.

**이월(승인됨, 게이트 제외)**: OWASP ZAP(→TASK-1203b, Sprint 12) · GitHub Webhook PR자동분석/Check Run(→TASK-1201, Sprint 12).
</content>
