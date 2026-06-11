# 🐛 SecureAI Bug Tracker & Feature Backlog

> 마지막 업데이트: 2026-06-11  
> 이 파일은 발견된 버그와 미구현 기능을 추적합니다.  
> 해결 시 `[ ]` → `[x]`로 변경하고 날짜와 커밋 해시를 기록하세요.

---

## 🔴 Critical Bugs (서비스 장애 수준)

| # | 상태 | 제목 | 발견일 | 담당 |
|---|------|------|--------|------|
| B-001 | 🔴 OPEN | SAST 진행률 0%로 고정 (SSE 이벤트 미반영) | 2026-06-11 | Frontend |
| B-002 | 🔴 OPEN | 홈(`/`) 이동 시 로그인 상태 초기화 | 2026-06-11 | Frontend |
| B-003 | 🟡 PARTIAL | Vuln 중복 저장 Race Condition (uk_vuln_session_fp) | 2026-06-11 | Backend ✅ 코드수정완료, 재배포필요 |

---

## 🟡 Known Bugs (기능 오작동)

### B-001 · SAST 진행률 0% 고정
- **증상**: 분석 시작 후 헤더의 진행 바가 `SAST 0/1`에서 움직이지 않음
- **원인**: SSE 연결은 살아있으나(`🟢`) `progressSteps` Zustand store에 이벤트가 쌓이지 않음
- **추정 원인**:
  - SSE 이벤트 파싱 형식 불일치 (`event: progress` vs `data: {...}`)
  - `addProgressStep` 액션이 올바른 타입으로 호출 안 됨
- **확인 필요 파일**:
  - `apps/frontend/src/components/layout/AppHeader.tsx` — SSE 이벤트 핸들러
  - `apps/backend/.../controller/ProgressLogController.java` — SSE 발행 형식
- **해결 방향**: 백엔드 SSE 이벤트 형식과 프론트 파서 비교, `console.log` 추가로 수신 여부 확인

---

### B-002 · 홈(`/`) 이동 시 로그인 상태 초기화
- **증상**: `/editor`에서 로그인 중 `localhost:3000` 이동 시 네비바가 `로그인` 버튼으로 표시됨
- **원인**: `AuthRedirect` 컴포넌트가 `initAuth()` 호출 → `/auth/refresh` 실패 시 `storeLogout()` 발동 → `user` 초기화
- **수정 내용** (2026-06-11): `AuthRedirect`에서 `initAuth()` 제거, `isMounted` 패턴 적용
- **현재 상태**: HMR 적용됐으나 여전히 재현됨 — 추가 조사 필요
- **추가 가설**:
  - `useAuth` hook의 `onUnauthorized` 핸들러가 홈에서도 등록되어 간섭
  - Zustand `persist`의 rehydration 타이밍 문제
  - Next.js 서버 컴포넌트와 클라이언트 hydration mismatch

---

### B-003 · 취약점 중복 저장 Race Condition ✅ 코드 수정 완료
- **증상**: `ERROR: duplicate key value violates unique constraint "uk_vuln_session_fp"`
- **원인**: AI 엔진 병렬 분석 시 두 스레드가 동시에 `existsBy` 체크 통과 후 동시 insert
- **수정**: `VulnerabilityService.saveFromAgent()` — `DataIntegrityViolationException` catch 후 개별 재시도
- **파일**: `apps/backend/.../service/VulnerabilityService.java`
- **재배포**: ✅ 2026-06-11 완료

---

## 🔵 Feature Backlog (미구현 기능)

### F-001 · 로그인 유지 / 자동 로그인
- **요청일**: 2026-06-11
- **내용**: 로그인 페이지에 "로그인 유지" 체크박스 추가
- **구현 방향**:
  - 프론트: `remember=true` 파라미터를 `/auth/login` 요청에 포함
  - 백엔드: `remember=true` 시 Refresh Token 만료를 30일로 연장 (기본 7일)
  - 분석 완료 후 작업 예정

---

### F-002 · SSO 로그인 (구글 / 네이버 / 카카오 / 깃허브)
- **요청일**: 2026-06-11
- **내용**: OAuth2 소셜 로그인 연동
- **구현 방향**:
  - 백엔드: Spring Security OAuth2 Client 설정 (`application-oauth.yml`)
  - 각 플랫폼 앱 등록 및 Client ID/Secret 발급 필요
  - 프론트: 로그인 페이지에 소셜 로그인 버튼 추가
  - 현재 GitHub 연결 UI는 존재 (설정 페이지), OAuth 로그인은 별도 구현 필요
- **우선순위**: 중간 (분석 기능 안정화 후)

---

### F-003 · 분석 전 계획 사전 승인 (Pre-analysis Plan)
- **요청일**: 2026-06-11
- **내용**: 분석 시작 전 어떤 파일들을 분석할지 계획을 보여주고 사용자 허가 후 진행
- **구현 방향**:
  - AI Engine: `/agent/plan` 엔드포인트 추가 — 파일 목록, 예상 시간, 예상 비용 반환
  - 프론트: 분석 시작 클릭 시 → 모달에 계획 표시 → "승인" 버튼 → 실제 분석 시작
  - 체크리스트 MD 파일 생성: `.secureai/analysis-plan-{sessionId}.md`

---

### F-004 · 분석 중단 및 재개 (Checkpoint Resume)
- **요청일**: 2026-06-11
- **내용**: 분석 중 끊겨도 사용자가 확인하고 이어갈 수 있는 체크리스트 형식
- **구현 방향**:
  - 각 파일 분석 완료 시 `progress_logs` 테이블에 상태 기록 (현재 로그만)
  - 프론트: "분석 이어하기" 버튼 → 미완료 파일만 재분석
  - `.secureai/checkpoint-{sessionId}.md` 파일 자동 생성 (Markdown 체크리스트)
  ```markdown
  ## 분석 진행 상황 — session: xxx
  - [x] src/main/java/.../AuthController.java (3 vulns)
  - [x] src/main/java/.../VulnerabilityService.java (2 vulns)
  - [ ] src/main/java/.../DastController.java ← 여기서 중단됨
  ```

---

### F-005 · SBOM 실데이터 연동
- **요청일**: 2026-06-11
- **현황**: `SbomPage.tsx`가 Mock 데이터 사용 중
- **구현 방향**:
  - DB에서 이 프로젝트의 패키지 버전 정보 조회 (`sbom_components` 테이블)
  - 없으면 → `build.gradle` / `package.json` 파싱 후 DB 저장
  - 비용 절감을 위해 AI 분석 대신 정적 파싱 우선, CVE 매칭은 NVD API 사용
  - 단기: DB에 Mock 데이터 seed로 UI 완성 후, 실 파싱 연동

---

### F-006 · 분석 제외 파일 필터링 검증
- **요청일**: 2026-06-11
- **현황**: 분석 시간이 너무 길어 불필요한 파일도 분석 중인지 의심
- **확인 필요**:
  - AI Engine의 파일 필터링 로직 (`apps/ai_engine/...`)
  - 현재 제외 대상: `test/`, `*.md`, `build/`, `node_modules/` 등
  - 현재 세션(`fe972770`) 분석 파일 수 확인 필요
- **개선 방향**:
  - 분석 제외 패턴을 `.secureaiignore` 파일로 사용자 커스터마이징 허용
  - 파일 크기 임계값 설정 (예: 50KB 이상 skip)

---

### F-007 · 단계별 취약점 코드 뷰어
- **요청일**: 2026-06-11
- **내용**: 한 단계(파일) 분석 완료 시 사용자가 해당 코드와 취약점 원인 확인
- **구현 방향**:
  - 분석 완료 알림 → 우측 패널에 해당 파일 취약점 하이라이트
  - Monaco Editor에 해당 파일 + 취약점 줄 자동 포커스

---

## 📋 분석 현황 (2026-06-11 기준)

```
현재 세션: fe972770-188d-417c-9a00-c3081f4c5f54
상태: RUNNING
저장된 취약점: ~389개 (증가 중)
분석 시작: 21:00경 (약 50분 경과)
```

---

## 📝 변경 이력

| 날짜 | 변경 내용 | 작업자 |
|------|-----------|--------|
| 2026-06-11 | BUG_TRACKER.md 최초 생성 | AI |
| 2026-06-11 | B-003 VulnerabilityService Race Condition 수정 | AI |
| 2026-06-11 | useLoadLatestResults running 세션 복원 수정 | AI |
| 2026-06-11 | AnalysisProgressStrip 백그라운드 분석 배너 추가 | AI |
| 2026-06-11 | LandingNav 로그인 상태 반영 (isMounted 패턴) | AI |
