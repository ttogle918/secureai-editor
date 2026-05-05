# [2026-05-05] 작업 세션 요약

**브랜치**: `feat/sprint3`  
**작업 범위**: Sprint 3 잔여 통합 테스트 완료 + Sprint 3 완료 처리 + Sprint 4 계획 수립

---

## 1. Sprint 3 잔여 통합 테스트 (test_sprint3_pending.py)

이전 세션에서 자동화 불가로 pending 처리된 항목 중 일부를 자동화 테스트로 전환.  
총 8개 테스트 신규 작성.

### 자동화된 항목

| 테스트 | TASK | 결과 |
|--------|------|------|
| 5 HIT + 5 MISS 시나리오 → Claude 호출 5회 검증 | TASK-301 | ✅ |
| 진행률 5/10 = 50% 정확성 | TASK-301 | ✅ |
| 각 단계별 진행률 계산 (10.0~100.0) | TASK-301 | ✅ |
| asyncio.gather 병렬 처리가 순차보다 빠른지 검증 | TASK-301 | ✅ |
| SQL Injection → PreparedStatement 패치 생성 | TASK-304 | ✅ |
| 동일 취약점 2차 요청 → 캐시 HIT (Claude 호출 없음) | TASK-304 | ✅ |
| 패치 적용 → is_applied / applied_at / applied_by 업데이트 | TASK-304 | ✅ |
| 의존성 컴포넌트 → CVE 매핑 저장 및 조회 | TASK-305 | ✅ |

### 발생한 오류 및 수정 (상세: troubleshooting 참조)

- `patch_node._redis` 전역 상태 → 테스트 간 asyncio 이벤트 루프 충돌 → `_redis = None` 리셋으로 해결
- `_generate_patch_for_vuln` mock: Claude가 마크다운 펜스로 JSON 감싸는 문제 → `_call_claude`를 직접 mock해 clean JSON 반환
- `test_backend_sprint3.py`: FK 체인 미생성으로 JSONB INSERT 실패 → users → projects → analysis_sessions → vulnerabilities 순서로 생성
- `psycopg3` SQL: `ILIKE '%s%'` 내 `%s`를 플레이스홀더로 인식 → `%%s%%` 또는 파라미터 바인딩으로 수정
- `jinja2` 미설치 → `pip install jinja2`

---

## 2. 최종 테스트 결과

```
AI 엔진 전체 테스트: 147 passed / 0 failed

  tests/integration/test_backend_sprint3.py      9 passed
  tests/integration/test_sprint3_integration.py  7 passed
  tests/integration/test_sprint3_pending.py      8 passed
  tests/api/test_analyze_route.py                9 passed
  tests/agent/ (단위)                           85 passed
  tests/infrastructure/ (단위)                  25 passed
  tests/integration/test_checkpointer_integration.py  4 passed
```

---

## 3. Sprint 3 완료 처리 (/done sprint 3)

`docs/sprints/sprint-3.md` 구현 방식 기록 완료.

### 이월 항목 (자동화 불가 — 수동 검증 필요)

| 항목 | 이유 |
|------|------|
| GitHub 레포 스캔 실제 동작 | 실제 GitHub API + 웹훅 필요 |
| NVD API 실제 CVE 조회 | 실제 NVD 네트워크 호출 필요 |
| AuthController 취약점 2건 수정 | URL 토큰 노출, Open Redirect |
| Zustand state 복합 시나리오 | e2e UI 검증 필요 |

---

## 4. Sprint 4 계획 수립 (/sprint 4)

`docs/sprints/sprint-4.md` 작성 완료.

### 태스크 요약

| TASK | 내용 | 우선순위 | 기간 |
|------|------|--------|------|
| TASK-401 | Monaco Editor 통합 | P1 | 5일 |
| TASK-402 | SSE 실시간 취약점 스트리밍 | P1 | 4일 |
| TASK-403 | VSCode 레이아웃 & 파일 트리 | P1 | 4일 |
| TASK-404 | 취약점 상세 패널 | P2 | 3일 |
| TASK-405 | AI 채팅 API | P2 | 4일 |
| TASK-406 | 진행률 체크리스트 Markdown | P0 | 3일 |

### 병렬 실행 순서

```
1단계 (May 5–9):   TASK-401 (FE) + TASK-403 (FE) + TASK-406 BE 동시
2단계 (May 10–12): TASK-402 SSE
3단계 (May 13–16): TASK-404 + TASK-406 FE 동시
4단계 (May 17–18): TASK-405 AI 채팅
```

---

## 5. 브랜치 전략 결정

- Sprint 4는 태스크별 브랜치 분리 없이 `feat/sprint4` 단일 브랜치에서 태스크 단위 커밋으로 진행
- 이유: 태스크 간 의존성 강함 (401/403 → 402 → 404/406 → 405), 분리 시 머지 오버헤드만 증가

---

## 6. 다음 세션에서 할 것 (이 항목은 이번 세션에서 진행됨 → 섹션 7 참조)

- [x] TASK-401: Monaco Editor 취약점 시각화 개선
- [ ] TASK-403: 3컬럼 레이아웃 병렬 진행

---

## 7. Sprint 4 구현 (2026-05-05 계속)

### 7-1. CLAUDE.md 슬림화 — 에이전트 위임 원칙 적용

- Sprint 번호 제거 → PM 에이전트가 백로그에서 직접 파악하도록
- 중복 내용(테스트 표기 기준, DoD, 에이전트 상세 역할) 삭제
- "마스터는 이해·분배, 직접 구현하지 않는다" 원칙 명시
- 78줄 → 59줄

### 7-2. Monaco Editor 취약점 시각화 개선 (TASK-401 연계)

| 파일 | 변경 |
|---|---|
| `globals.css` | `vuln-{severity}-line` 배경 + `vuln-{severity}-glyph` 브레이크포인트 점 CSS |
| `useSecureStore.ts` | `revealLine / setRevealLine` 상태 추가 |
| `CodeEditor.tsx` | `setModelMarkers` 물결 밑줄 + overview ruler + `revealLineInCenter` 연결 |
| `VulnDetailPanel.tsx` | 카드 토글/Call Chain 클릭 → 해당 라인으로 에디터 스크롤 |

**핵심 수정**: `handleJump(path, line)`에서 `line`을 받고도 사용하지 않아 라인 이동 안 됨 → `revealLine` store 상태로 해결. `onMount`에서도 파일 전환 후 pending reveal 처리.

### 7-3. TASK-407 추가 및 구현 — 로컬 폴더 열기

**배경 논의**:
- VS Code "Add Folder to Workspace" 방식을 웹앱에서 구현 요청
- 브라우저 보안 제약: 절대 경로를 서버에 전달 불가
- 결론: `showDirectoryPicker()` (File System Access API) 채택

**아키텍처 결정**:
- 파일 내용 → 백엔드 → Redis 임시 저장 (TTL 24h) → AI Engine 분석
- Snyk, SonarCloud 등 클라우드 SAST 도구와 동일 방식
- 배포 후 모든 사용자 사용 가능 (Chrome/Edge)

**백엔드 신규 파일:**
- `WorkspaceController.java` — POST /api/workspace, GET /{id}/tree, GET /{id}/file
- `WorkspaceService.java` — Redis Hash 저장, 트리 JSON 생성, TTL 24h
- DTO 3종 (Request, Response, TreeNode)
- `SecurityConfig.java` — `/api/workspace/**` permitAll 추가

**프론트엔드:**
- `useWorkspace.ts` (신규) — `showDirectoryPicker()` + 재귀 파일 읽기 (node_modules/.git 제외, 500KB 초과 제외) + 업로드 + 트리 로드
- `useSecureStore.ts` — `workspaceId`, `workspaceTree` 상태 추가
- `EditorLayout.tsx` — "폴더 열기" 버튼 + 사이드바 파일 트리 + 파일 내용 API 로드

### 7-4. 아키텍처 논의 — 웹앱 vs 데스크탑 앱

| 항목 | 결론 |
|---|---|
| 분석 서버 방식 | ✅ 맞음 — Backend+AI Engine이 Docker로 서버 역할 완성 |
| 로컬 파일 수정 | `showDirectoryPicker({ mode: 'readwrite' })` 로 브라우저에서도 가능 |
| 데스크탑 앱 필요 시점 | 파일 감시(fs.watch), CI/CD 연동, 모든 브라우저 지원 필요 시 |
| 현재 전략 | 웹앱 유지 / VS Code Extension은 Sprint 8~9에 별도 TASK |

**중요 포인트**: 로컬 파일 수정이 불가능해서 데스크탑 앱이 필요한 게 아님. `readwrite` 모드로 브라우저에서도 수정 가능. 데스크탑 앱의 장점은 권한 팝업 없는 접근, 파일 변경 감지, CI/CD 연동.

---

## 8. TASK-407 디버깅 및 사이드바 통합 (2026-05-05 계속)

### 8-1. TASK-407 백엔드 오류 2건 수정

**오류 1: WorkspaceTreeNode Jackson 역직렬화 실패**

```
Cannot construct instance of WorkspaceTreeNode (no Creators, like default constructor, exist)
```

- 원인: `@Builder`만 있고 `@NoArgsConstructor` 없음 → Jackson이 기본 생성자 못 찾음
- 수정: `@NoArgsConstructor` + `@AllArgsConstructor` 추가

**오류 2: Failed to fetch (백엔드 컨테이너 미실행)**

- 원인: `docker compose up --build -d backend`를 실행하지 않아 컨테이너가 올라오지 않음
- `docker ps`로 확인 시 `secureai-backend` 없음
- 수정: `docker compose down -v` 후 재빌드로 해결

### 8-2. 사이드바 중복 구조 발견 및 통합

**문제**: 사이드바가 두 겹으로 렌더됨

| 위치 | 내용 | 너비 |
|---|---|---|
| `AppSidebar.tsx` (page.tsx) | 로고 + mock 파일트리 + 하단 버튼 | `sidebarWidth` |
| `EditorLayout.tsx` 내부 | 폴더 열기 + workspace 트리 | `sidebarWidth` |

- 같은 `sidebarWidth` (220px)를 두 번 적용 → 실제 사이드바 폭 2배
- EditorLayout 내부 ResizeHandle의 `onSidebarResize`가 `prev - d` → 방향 반전 버그 포함

**수정 내용**:

| 파일 | 변경 |
|---|---|
| `AppSidebar.tsx` | `useWorkspace` 통합 — 폴더 열기 버튼 + workspace/mock 트리 전환 |
| `EditorLayout.tsx` | 내부 사이드바 div + 중복 ResizeHandle 제거 |

**리사이즈 방향 분석 결과**:

| 핸들 | 수식 | 방향 |
|---|---|---|
| 사이드바 (`page.tsx`) | `prev + d` | ✅ 정확 |
| 오른쪽 패널 | `prev - d` | ✅ 정확 |
| 터미널 | `prev - d` | ✅ 정확 |
| EditorLayout 내부 사이드바 | `prev - d` | ❌ 반전 → 삭제로 해결 |

---

## 9. TASK-402 SSE 인프라 구현 (2026-05-05 계속)

### 9-1. 구현 완료 (수동 검증은 JWT 인증 구현 후 이월)

| 파일 | 내용 |
|---|---|
| `hooks/useSse.ts` (신규) | fetch+ReadableStream SSE, exponential backoff(1s→30s), 401 재연결 중단, AbortController cleanup |
| `hooks/useToast.ts` (신규) | Zustand 독립 스토어, 4초 자동 소멸 |
| `components/ui/Toast.tsx` (신규) | 우하단 고정, severity별 색상, framer-motion 애니메이션 |
| `components/ui/SseIndicator.tsx` (신규) | idle/connecting/open/reconnecting/auth_error 상태별 점멸 |
| `store/useSecureStore.ts` (수정) | `addVuln()`, `sseSessionId`/`setSseSessionId` 추가 |
| `components/layout/AppHeader.tsx` (수정) | useSse 연결, 이벤트 핸들러, SseIndicator 렌더 |
| `app/page.tsx` (수정) | ToastContainer 마운트 |

### 9-2. 이월 사유

- SSE 수동 검증 6개 항목 모두 JWT 인증 연동 필요
- `sseSessionId`는 실제 `POST /api/v1/analysis/sessions` 응답으로 설정되어야 함
- 현재 auth_error 상태로 대기 — 인증 Sprint 완료 후 검증 예정

### 9-3. 커밋 대상 파일 (git commit 전 정리)

이번 세션 전체(TASK-401 + TASK-407 + TASK-402)를 하나의 커밋으로 묶음.

---

## 10. 다음 세션에서 할 것

- [ ] git commit (커밋 메시지 추천 완료)
- [ ] TASK-403: VSCode 레이아웃 완성
- [ ] TASK-407 수동 검증 (폴더 열기 → 파일 트리 → 에디터 실제 동작)
- [ ] TASK-401 수동 검증 (물결 밑줄, glyph 점, 라인 이동 확인)
- [ ] TASK-402 수동 검증: JWT 인증 구현 후
