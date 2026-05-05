# Sprint 4 실행계획 — 프론트엔드 SAST 분석 UI (2026-05-05 ~ 2026-05-18)

## 1. 태스크 목록 (우선순위 순)

### TASK-401: Monaco Editor 통합 (우선순위: P1, 5일)
**목표**: Next.js 프론트엔드에서 실시간 파일 편집기 구현

| # | 항목 | 예상시간 | 담당 |
|---|------|--------|------|
| 401-1 | Monaco Editor SSR 호환성 검증 (dynamic import, worker 분리) | 4h | FE |
| 401-2 | `/editor` 페이지 라우트 생성 + 레이아웃 스켈레톤 | 3h | FE |
| 401-3 | `editor-store.ts` Zustand 상태 관리 (파일 선택, 내용, 스크롤 위치) | 3h | FE |
| 401-4 | Monaco 마운트 + 테마(light/dark) + 언어 감지 (확장자별) | 4h | FE |
| 401-5 | 파일 저장 버튼 + 로컬 변경 추적 (unsaved indicator) | 2h | FE |
| 401-6 | 키보드 단축키 (Ctrl+S 저장, Ctrl+D 닫기) | 2h | FE |

**테스트 체크리스트:**
- 🧪 Monaco 컴포넌트 마운트 단위 테스트 (Jest)
- ✅ 편집기 열기 → 내용 표시 → 저장 플로우
- ✅ 다크모드 전환 시 에디터 테마 변경
- ✅ Python/Java 파일 언어 감지 확인
- ✅ 긴 파일(>1MB) 성능 확인

---

### TASK-402: SSE 실시간 취약점 스트리밍 (우선순위: P1, 4일)
**목표**: 분석 중 Real-time 취약점 발견 푸시 구현

| # | 항목 | 예상시간 | 담당 |
|---|------|--------|------|
| 402-1 | Spring Boot SSE Controller 엔드포인트 (`/api/analysis/{id}/stream`) | 3h | BE |
| 402-2 | SseEmitter 레지스트리 + 연결 타임아웃 처리 | 2h | BE |
| 402-3 | AI Engine → Backend 취약점 발견 시 SSE 푸시 (CircuitBreaker 적용) | 3h | BE |
| 402-4 | 프론트엔드: EventSource 연결 + vulnerability-list 실시간 갱신 | 4h | FE |
| 402-5 | 연결 끊김 시 자동 재연결 + exponential backoff | 2h | FE |

**테스트 체크리스트:**
- 🧪 SSE 연결 JUnit5 통합 테스트 (TestContainers)
- 🧪 취약점 발견 이벤트 전송 mock으로 검증 (Jest)
- ✅ 분석 중 취약점이 실시간으로 표시되는지 수동 확인
- ✅ 네트워크 끊김 후 자동 재연결 동작
- 🛡️ EventSource 클라이언트 메모리 누수 없음 (cleanup 검증)

---

### TASK-403: VSCode 레이아웃 & 파일 트리 (우선순위: P1, 4일)
**목표**: VSCode 스타일 3컬럼 레이아웃 + 파일 탐색기

| # | 항목 | 예상시간 | 담당 |
|---|------|--------|------|
| 403-1 | 3컬럼 레이아웃 (파일트리 / 에디터 / 취약점상세) CSS Grid 또는 Flex | 3h | FE |
| 403-2 | 파일 트리 컴포넌트 (Tree + 폴더 축소/확대) | 3h | FE |
| 403-3 | 파일 트리 상태 관리 (확장된 폴더 목록, 선택 파일) | 2h | FE |
| 403-4 | 분할 조정 바(Resizable 라이브러리 또는 custom) | 3h | FE |
| 403-5 | 반응형 모바일 대응 (1컬럼 폴더, 수평 스크롤) | 2h | FE |

**테스트 체크리스트:**
- 🧪 파일 트리 렌더링 Jest 단위 테스트
- ✅ 폴더 축소/확대 클릭 동작
- ✅ 파일 선택 시 에디터에 표시
- ✅ 분할 바 드래그로 컬럼 너비 조절
- ✅ 모바일 환경 폴더 보이기/숨기기 버튼

---

### TASK-404: 취약점 상세 패널 (우선순위: P2, 3일)
**목표**: 우측 패널에서 취약점 정보 + 패치 제안 표시

| # | 항목 | 예상시간 | 담당 |
|---|------|--------|------|
| 404-1 | 취약점 상세 스키마 (type, severity, CWE, line, snippet) | 2h | BE |
| 404-2 | 패치 제안 연동 (patch_suggestions 테이블 → API 응답) | 2h | BE |
| 404-3 | 우측 패널 컴포넌트 (Accordion 스타일 섹션) | 3h | FE |
| 404-4 | 원본 코드 ↔ 패치 코드 Diff 뷰어 (react-diff-viewer) | 3h | FE |
| 404-5 | "패치 적용" 버튼 + 폴더 구조 변경 사항 미리보기 | 2h | FE |

**테스트 체크리스트:**
- 🧪 취약점 상세 API 응답 JUnit5 테스트
- 🧪 Diff 컴포넌트 렌더링 Jest 테스트
- ✅ SQL Injection 취약점 선택 → 상세 패널에 설명/패치 표시
- ✅ Diff 뷰어 스크롤 및 하이라이트 동작
- ✅ "패치 적용" 클릭 → 파일 트리/에디터 즉시 반영

---

### TASK-405: AI 채팅 API (우선순위: P2, 4일)
**목표**: 취약점 관련 질문에 AI 응답 기능

| # | 항목 | 예상시간 | 담당 |
|---|------|--------|------|
| 405-1 | Spring Boot API 엔드포인트 (`/api/analysis/{id}/chat`) — 질문 + 세션ID 입력 | 2h | BE |
| 405-2 | FastAPI `POST /chat` 라우트 + LangGraph 호출 (multi-turn 상태 유지) | 2h | AI |
| 405-3 | AI Engine 응답 streaming (SSE 또는 JSON 청크) | 2h | AI |
| 405-4 | 프론트엔드 채팅 창 (message list + input field + send button) | 3h | FE |

**테스트 체크리스트:**
- 🧪 Chat API JUnit5 통합 테스트 (mock AI Engine)
- 🧪 FastAPI LangGraph 라우트 pytest 테스트
- 🧪 채팅 메시지 렌더링 Jest 테스트
- ✅ 취약점 선택 → "이 패치 뭐하는 거?" 질문 → AI 응답 확인
- ✅ 다중 턴 대화 상태 유지 (이전 맥락 반영)

---

### TASK-406: 진행률 체크리스트 Markdown (우선순위: P0, 3일)
**목표**: 분석 진행 상황을 체크리스트로 시각화

| # | 항목 | 예상시간 | 담당 |
|---|------|--------|------|
| 406-1 | Backend API 진행률 조회 (`/api/analysis/{id}/progress`) | 2h | BE |
| 406-2 | 응답 형식: `{ total: 10, completed: 5, status: [...] }` (파일별 SAST/DAST 진행률) | 1h | BE |
| 406-3 | 프론트엔드 진행률 패널 컴포넌트 (progress bar + file list) | 3h | FE |
| 406-4 | Markdown 렌더러 (progress → 체크리스트 마크다운으로 변환) | 2h | FE |
| 406-5 | 체크리스트 다운로드 버튼 (`.md` 파일 클라이언트 다운로드) | 1h | FE |
| 406-6 | 실시간 갱신 (SSE 취약점 수신 시 progress 자동 업데이트) | 2h | FE |
| 406-7 | Zustand persist strategy (새로고침 후 진행률 유지) | 1h | FE |

**테스트 체크리스트:**
- 🧪 Progress API JUnit5 테스트
- 🧪 Markdown 생성 로직 pytest 테스트
- 🧪 진행률 컴포넌트 렌더링 Jest 테스트
- ✅ 진행 중 체크리스트가 실시간으로 갱신되는지 확인
- ✅ 새로고침 후 진행률 유지 확인
- ✅ Markdown 다운로드 파일 내용 검증

---

## 2. 병렬 실행 그룹 (4단계)

### 1단계 (1주차): BE 기반 + FE 스켈레톤 (May 5–9)
**병렬 추진:**
- **TASK-401 (FE)**: Monaco Editor SSR 검증 + 빈 에디터
- **TASK-403 (FE)**: 3컬럼 레이아웃 + 파일 트리 스켈레톤
- **TASK-406 (BE)**: Progress API + DB 조회 로직

**산출물:** 에디터 페이지 뼈대, 레이아웃 완성, 진행률 API 엔드포인트

---

### 2단계 (1주차 말): SSE 실시간 (May 10–12)
**순차 추진 (1단계 완료 후):**
- **TASK-402 (BE ↔ FE)**: SSE 연결 + 취약점 실시간 푸시

**산출물:** 분석 중 취약점이 실시간으로 표시됨 ⭐

---

### 3단계 (2주차): 상세 패널 + FE 완성 (May 13–16)
**병렬 추진:**
- **TASK-404 (BE ↔ FE)**: 취약점 상세 API + Diff 뷰어
- **TASK-406 (FE)**: 진행률 패널 + 체크리스트 마크다운

**산출물:** 취약점 우측 패널 완성, 진행률 체크리스트 표시 ⭐

---

### 4단계 (2주차 말): AI 채팅 (May 17–18)
**순차 추진 (3단계 완료 후):**
- **TASK-405 (BE ↔ AI ↔ FE)**: 채팅 API + AI 응답 스트리밍

**산출물:** 취약점 AI 설명 기능 완성

---

## 3. 이월 태스크 (Sprint 3 미완료)

| 우선순위 | 항목 | 이유 |
|---------|------|------|
| P0 | GitHub 레포 스캔 실제 동작 (✅ 수동) | 자동화 불가 — 실제 GitHub API + 웹훅 필요 |
| P0 | NVD API 실제 CVE 조회 (✅ 수동) | 실제 NVD 네트워크 호출 필요 |
| P1 | AuthController 취약점 2건 수정 | URL 토큰 노출, Open Redirect 패치 필요 |
| P2 | Zustand state 복합 시나리오 (✅ 수동) | e2e 테스트로 실제 UI에서 검증 |

---

## 4. 위험 요소 및 완화 전략

| 위험 | 영향 | 완화 전략 |
|------|------|----------|
| Monaco Editor SSR 호환성 | TASK-401 차단 (1주차 지연) | 초반에 Worker 분리 + dynamic import 검증 |
| SSE 메모리 누수 | 장시간 분석 시 메모리 초과 | EventSource cleanup + teardown 테스트 작성 |
| AI 채팅 dual-layer (FastAPI + Spring) | 통신 오버헤드 | 프로토콜 먼저 정의, mock으로 검증 후 실 구현 |
| Zustand persist 전략 (localStorage vs sessionStorage) | 상태 불일치 | enum으로 persist mode 정의, 테스트 케이스 다중화 |
| 30+ 수동 검증 항목 | 인수 검증 누락 | 체크리스트 작성 후 각 TASK 마다 수동 테스트 수행 |

---

## 5. 테스트 마일스톤 (M1~M6)

| # | 마일스톤 | 달성 기준 | 예상 완료 |
|---|---------|---------|----------|
| M1 | Empty Editor | 에디터 페이지 로드 + 빈 파일 표시 | May 9 |
| M2 | Real-time Display | SSE 연결 → 취약점 실시간 표시 | May 12 ⭐ |
| M3 | Progress Checklist | 진행률 API + 체크리스트 MD 생성 | May 16 ⭐ |
| M4 | Detail Panel | 우측 패널에서 취약점 상세 + Diff 뷰 | May 16 |
| M5 | AI Chat | 채팅 창에서 AI 질문/답변 | May 18 ⭐ |
| M6 | Sprint 3 Carry-over | GitHub 스캔 + NVD 실제 조회 수동 검증 | May 25 (Sprint 4 외) |

---

## 6. 정의적 완료 기준 (DoD)

각 TASK 완료 전 확인:
```
[ ] 구현 완료 (코드 리뷰 통과)
[ ] 테스트 통과 (🧪 + 🔬 자동화, ✅ 수동 체크리스트)
[ ] 커밋 메시지 작성 (Conventional Commits)
[ ] docs/sprints/sprint-4.md 에 구현 방식 기록
```

---

## 7. 다음 세션 시작 체크리스트

- [ ] Sprint 4 브랜치 생성: `git checkout -b feat/sprint4`
- [ ] Docker 기동: `make dev`
- [ ] Backend + AI Engine + Frontend 모두 정상 기동 확인
- [ ] TASK-401부터 시작

---

## 8. 구현 완료 기록

### TASK-402: SSE 실시간 구독 인프라
**완료일**: 2026-05-05
**Epic**: EPIC-5 | **Sprint**: 4
**상태**: 구현 완료 / 수동 검증 이월 (JWT 인증 구현 후 연동 예정)

#### 구현 내용
- `useSse.ts`: fetch + ReadableStream 방식 SSE 훅 (EventSource 미사용 — JWT 헤더 전달 위해)
- exponential backoff 재연결: 1s → 2s → 4s → 8s → 16s → 30s 상한, 401 시 재연결 중단
- `useToast.ts` / `Toast.tsx`: Zustand 독립 스토어, 4초 자동 소멸, severity별 색상, 우하단 고정
- `SseIndicator.tsx`: status별 점멸 표시 (idle/connecting/open/reconnecting/auth_error)
- `useSecureStore.ts`: `addVuln()`, `sseSessionId`/`setSseSessionId` 추가
- `AppHeader.tsx`: useSse 연결, vuln_found/completed/error 이벤트 핸들러

#### 설계 결정
- EventSource 대신 fetch + ReadableStream 사용: JWT Authorization 헤더 전달이 EventSource API에서 불가
- 401 응답 시 재연결 안 함: 토큰 만료 시 무한 재연결 방지
- AbortController cleanup: useEffect cleanup에서 abort → 메모리 누수 방지
- 파싱 오류 skip: 개별 이벤트 파싱 실패 시 전체 세션 중단 금지

#### 이월 사유
SSE 수동 검증 6개 항목 모두 JWT 인증 구현에 의존.
`sseSessionId`는 실제 `POST /api/v1/analysis/sessions` 응답으로 설정되어야 하나,
프론트엔드 로그인 플로우가 미구현 상태. 인증 Sprint 완료 후 검증 예정.

#### 테스트 결과
- 🧪 단위 테스트: 이월 (인증 연동 후 작성 예정)
- ✅ 수동 검증: 이월 (JWT 인증 구현 후)
- 🛡️ 보안 검증: 이월 (백엔드 @AuthenticationPrincipal 처리 완료, 프론트 검증 이월)

---

### TASK-403: VSCode 스타일 에디터 레이아웃 & 파일 트리
**완료일**: 2026-05-05
**Epic**: EPIC-5 | **Sprint**: 4

#### 구현 내용
- `useSecureStore.ts`: 동적 탭 관리 (`openTabs`, `openTab`, `closeTab`) 추가
  - 중복 탭 방지, 닫을 때 인접 탭 자동 이동
  - `EditorTab` 타입 인라인 정의 (순환 의존성 방지)
- `useSecureStore.ts`: Zustand `persist` 미들웨어 적용
  - `sidebarWidth`, `rightPanelWidth`, `terminalHeight`, `workspaceId`, `workspaceTree`, `openTabs`, `selectedPath` localStorage 저장
- 리사이즈 범위 수정: 사이드바 160–400px, 우측 패널 280–640px
- `AppSidebar.tsx`: `injectVulnCount`로 vulns 배열 → 파일별 최악 severity → 트리 도트 표시
- `AppSidebar.tsx`: 파일 클릭 시 `openTab` 동시 호출 → 탭 자동 생성
- `useWorkspace.ts`: 워크스페이스 열기 시 mock 탭 초기화 후 첫 파일 탭으로 교체
- `useWorkspace.ts`: 마운트 시 workspaceId 유효성 확인 (Redis 만료 시 자동 초기화)

#### 설계 결정
- 멀티 워크스페이스 기능 논의 → 단일 워크스페이스(교체 방식) 유지 결정
  - 이유: 복잡도 대비 사용 빈도 낮음, GitHub 레포 연동 Sprint 이후 재검토
- `EditorLayout`에서 `MOCK_TABS` 하드코딩 제거 → store `openTabs` 완전 위임

#### 테스트 결과
- ✅ 수동 검증: 6개 확인

---
