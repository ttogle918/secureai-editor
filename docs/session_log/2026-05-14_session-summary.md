# [2026-05-14] 작업 세션 요약

**브랜치**: `feat/frontend-ui` → `feat/i18n` → `feat/sprint4` → `feat/i18n`  
**작업 범위**: 분석 UX 개선 (이력 모달·SSE 레이스 컨디션·비차단 오버레이·패치 배지) + 언어 설정·번역 인프라 + patch_node 그래프 연결 + 잔존 버그 수정 2건

---

## 1. 완료 작업

| 항목 | 브랜치 | 주요 파일 |
|------|--------|---------|
| 분석 이력 모달 (`AnalysisHistoryModal`) 생성 | `feat/frontend-ui` | `src/components/analysis/AnalysisHistoryModal.tsx` |
| AppHeader에 이력 버튼(History 아이콘) 연결 | `feat/frontend-ui` | `AppHeader.tsx` |
| SSE 레이트 커넥트 레이스 컨디션 수정 | `feat/frontend-ui` | `AnalysisController.java` |
| 완료 이벤트 시 취약점을 DB에서 로드 | `feat/frontend-ui` | `AppHeader.tsx` |
| SseIndicator 상태 세분화 (분석중/완료/대기) | `feat/frontend-ui` | `SseIndicator.tsx` |
| 분석 시작 시 에디터 + 진행률 탭 자동 전환 | `feat/frontend-ui` | `useStartAnalysis.ts`, `RightPanel.tsx` |
| 패치 매칭 로직을 filePath+vulnType 기준으로 변경 | `feat/frontend-ui` | `VulnDetailPanel.tsx`, `VulnPanel.tsx` |
| 대시보드 토큰 사용량 카드 (USD·KRW·모델별) | `feat/frontend-ui` | `DashboardPage.tsx` |
| `AnalysisLoadingOverlay` 비차단 플로팅 위젯 | `feat/frontend-ui` | `AnalysisLoadingOverlay.tsx` |
| SOLVED/PATCHED 배지 (VulnDetailPanel·VulnPanel) | `feat/frontend-ui` | `VulnDetailPanel.tsx`, `VulnPanel.tsx` |
| `loading-anim` 미사용 키프레임 제거 | `feat/frontend-ui` | `globals.css` |
| `displayLanguage` store 필드 + localStorage 영속 | `feat/i18n` | `useSecureStore.ts` |
| `/settings` 언어 선택 섹션 | `feat/i18n` | `settings/page.tsx` |
| `useTranslate` 훅 (메모리 캐시·abort 지원) | `feat/i18n` | `src/hooks/useTranslate.ts` |
| VulnDetailPanel 카드 펼칠 때 설명 자동 번역 | `feat/i18n` | `VulnDetailPanel.tsx` |
| AI Engine `POST /agent/translate` 엔드포인트 | `feat/i18n` | `api/routes/translate.py`, `main.py` |
| Spring Boot `POST /api/v1/translate` 컨트롤러 | `feat/i18n` | `TranslateController.java`, `AiAgentClient.java`, `DefaultAiAgentClient.java` |
| `patch_node` 그래프 연결 (`aggregate → patch → END`) | `feat/sprint4` | `graph_builder.py` |
| `completed` 이벤트를 patch_node 완료 후 발행으로 이동 | `feat/sprint4` | `analyze.py` |
| `patch_node` BYOK 지원 (state의 user_api_key 사용) | `feat/sprint4` | `patch_node.py` |
| `feat/i18n` globals.css — loading-anim 키프레임 동기화 | `feat/i18n` | `globals.css` |
| `useTranslate` 캐시 localStorage 영속화 | `feat/i18n` | `src/hooks/useTranslate.ts` |

---

## 2. 의논 내용 & 결정 맥락

### SSE 레이스 컨디션 (0 취약점 버그)

캐시 히트 시 분석이 ~100ms 내에 완료 → 프론트가 SSE 구독하기 전에 Redis pub/sub 메시지가 유실됨.

**수정 방향**: Spring Boot `AnalysisController.streamSession()`에서 SSE 연결 시 세션 상태를 먼저 확인. 이미 `completed`이면 즉시 `completed` 이벤트를 재전송하고 연결을 닫음.

```java
if ("completed".equals(session.status()) || "error".equals(session.status())) {
    SseEmitter immediate = new SseEmitter(0L);
    immediate.send(SseEmitter.event().name("progress").data(payload));
    immediate.complete();
    return immediate;
}
```

또한 프론트는 SSE 페이로드(합성 ID) 대신 DB에서 실제 취약점을 로드하도록 변경 → UUID 불일치 문제 동시 해결.

### 분석 이력 모달 설계

`GET /analysis/sessions?projectId=...` → 완료 세션 목록 → 각 세션별 `GET /vulnerabilities?sessionId=...` 호출로 심각도별 취약점 수 집계.  
모달에서 세션 선택 시 해당 세션의 취약점·패치를 store에 로드 후 모달 닫힘.

projectId가 없을 때(아직 분석 전)는 이력 버튼 자체를 숨겨 빈 모달 노출 방지.

### AnalysisLoadingOverlay 비차단 전환

기존: 전체화면 블러 오버레이 → 에디터·채팅 클릭 불가  
변경: `position: fixed; bottom: 24px; right: 24px; pointer-events: none` 플로팅 위젯  
- 실제 분석 중인 파일명을 `progressSteps` 마지막 항목에서 표시
- L1 SAST만 활성(녹색), L2/L3는 비활성(회색) 표시

### 패치 매칭 로직 변경

AI Engine이 저장하는 `Patch` 엔티티에 `vulnId`(FK)가 null인 경우 많음 — 패치 생성 시점에 취약점 UUID를 알 수 없기 때문.  
기존 `patch.vulnId === vuln.id` 단순 매칭 → `filePath === vuln.filePath && vulnType === vuln.type` 복합 매칭으로 변경.

### 언어 설정 및 번역 인프라

DB는 영어로 저장, 화면 표시 언어는 사용자 설정에 따라 전환.  
`displayLanguage: 'ko' | 'en'`을 Zustand store에 추가 후 localStorage 영속.

번역 호출 경로:
```
VulnDetailPanel (카드 펼침)
→ useTranslate hook (메모리 캐시 확인)
→ POST /api/v1/translate (Spring Boot)
→ AiAgentClient.translate() → POST /agent/translate (AI Engine)
→ Claude Haiku (BYOK 지원)
→ 번역 텍스트 반환 + 캐시 저장
```

### patch_node 그래프 연결

**기존 흐름**: `aggregate_node → END` (completed 이벤트가 aggregate_node 이후 즉시 발행)  
**변경 흐름**: `aggregate_node → patch_node → END` (completed 이벤트를 patch_node 완료 후 발행)

이 순서가 중요한 이유: 프론트는 `completed` 이벤트 수신 직후 `GET /sessions/{id}/patches`를 호출하는데, 기존에는 patch_node가 그래프에 없어 응답이 항상 빈 배열이었음.

`analyze.py` 변경:
- `aggregate_node` 핸들러에서 completed 발행 제거
- `patch_node` 핸들러에서 completed 발행 (패치 저장 완료 후)
- `vuln_count`를 파일 수(`len(results)`) → 실제 취약점 수(`sum(len(r["vulnerabilities"]) ...)`)로 수정

### loading-anim 키프레임 정리

`AnalysisLoadingOverlay` 리팩토링으로 progress bar 애니메이션이 제거됐으나 `globals.css`의 `@keyframes loading-anim` 블록이 두 브랜치에 잔존. `feat/frontend-ui`에서 먼저 제거(커밋 `8fb5667`) 후, `feat/i18n`에도 동일하게 적용(커밋 `064fce0`의 일부).

### 번역 캐시 localStorage 영속화

기존 `useTranslate`의 `cache`는 모듈 레벨 `Map`이라 페이지 새로고침 시 초기화됨. 같은 취약점 설명을 다시 펼치면 API 재호출 발생.

**수정**:
- 모듈 초기화 시 `localStorage.getItem('secureai:translate:cache')` 에서 직렬화된 엔트리 배열을 읽어 `Map` 재구성
- 신규 번역 저장 시 즉시 `JSON.stringify([...cache.entries()])` 로 기록
- 최대 500건 유지 (초과 시 오래된 항목 제거) → localStorage 쿼터 overflow 방지

---

## 3. 커밋 목록

| 해시 | 브랜치 | 메시지 |
|------|--------|--------|
| `66c9e4a` | `feat/frontend-ui` | feat(frontend): 분석 완료 후 UX 개선 및 토큰 사용량 대시보드 표시 |
| `9057739` | `feat/frontend-ui` | feat(frontend): AnalysisLoadingOverlay 비차단 위젯으로 교체 + 취약점 패치 배지 추가 |
| `8fb5667` | `feat/frontend-ui` | chore(frontend): 미사용 loading-anim 키프레임 제거 |
| `e8c274d` | `feat/i18n` | feat(i18n): 표시 언어 설정 및 취약점 설명 한국어 번역 기능 추가 |
| `5e83929` | `feat/sprint4` | feat(ai-engine): patch_node를 그래프에 연결하고 BYOK 지원 추가 |
| `ac7431f` | `feat/sprint4` | docs: 2026-05-14 세션 로그 추가 |
| `064fce0` | `feat/i18n` | fix(i18n): loading-anim 키프레임 제거 및 번역 캐시 localStorage 영속화 |

---

## 4. 미해결 / 다음 세션

- [x] `feat/frontend-ui`, `feat/i18n` 브랜치 PR 생성 (PR #62, #63) — 머지는 수동 진행
- [x] `feat/sprint4` PR 생성 (PR #64) — 머지 후 patch_node 동작 검증 예정
- [ ] PR #62, #63, #64 main 머지 → `feat/sprint5` 브랜치 생성
- [ ] patch_node 실제 동작 검증 (분석 실행 후 `/sessions/{id}/patches` 응답 확인)
- [ ] DAST / L2 GitHub 파이프라인 실제 연결 (Sprint 5 TASK-501~505)
- [x] Sprint 5 계획 수립 → `docs/sprints/sprint-5.md` 작성 완료

## 5. 이번 세션 추가 완료 (2026-05-14 이어서)

| 항목 | 내용 |
|------|------|
| PR #62 생성 | `feat/frontend-ui` → `main` (Sprint 4 전체 + UX 개선) |
| PR #63 생성 | `feat/i18n` → `main` (번역 기능 + 보안 수정 포함) |
| PR #64 생성 | `feat/sprint4` → `main` (patch_node 그래프 연결) |
| Sprint 5 계획 | `docs/sprints/sprint-5.md` — 이월 3건 + TASK-501~505 실행 계획 |
| 보안 수정 | AuthController URL 토큰 노출(→ 일회용 코드 교환) + Open Redirect(→ `@Value` 설정값) |
