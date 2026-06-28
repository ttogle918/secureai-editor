# [2026-06-28] SAST/Gemini 경로 버그 5건 수정 + 데모 풀루프 검증

**브랜치**: `fix/gemini-patch-sse` → `main` 머지 (9015ad8)  
**작업 범위**: Gemini 모델 SAST 분석 시 발견된 버그 5건 수정 (프로바이더 라우팅·크래시·저장·SSE 파싱·UI 연동)

---

## 1. 완료 작업

| 항목 | 주요 파일 | 커밋 |
|------|---------|------|
| Gemini patch_node 프로바이더 라우팅 버그 (404→200) | `apps/ai_engine/agent/nodes/patch_node.py` | `79f1ae3` |
| analyze.py None 반환 시 TypeError 크래시 (완료 후 summary 업데이트) | `apps/ai_engine/api/routes/analyze.py` | `79f1ae3` |
| patch_suggestions camelCase 변환 (snake_case→camelCase, file_path null 제약) | `apps/ai_engine/infrastructure/backend_api_client.py` | `79f1ae3` |
| SSE 데이터 파싱 버그 (data: 공백 매칭 누락→라이브 진행률/로그 미표시) | `apps/frontend/src/components/editor/BottomPanel.tsx` | `84da25a` |
| 문제/AI로그 탭 라이브 연동 + PR 버튼 활성화 (patchId 매핑) | `apps/frontend/src/components/layout/AppHeader.tsx`, `BottomPanel.tsx` | `84da25a`, `57f3198` |

---

## 2. 의논 내용 & 결정 맥락

### 2.1 Gemini 모델 SAST 데모 드라이런 발견 이슈
**배경**: VC 데모 시나리오(2026-06-28_sast-demo-scenario.md)를 바탕으로, 모델을 Gemini 2.5 Flash로 설정하여 실제 demo-vuln-sample 스캔 시행.

**발견된 버그 5건**:

1. **patch_node 프로바이더 라우팅** (AI Engine)
   - 증상: Gemini 모델이 Anthropic API로 전송되어 404 "Provider anthropic not found" 에러
   - 원인: patch_node가 `preferred_provider` 파라미터를 무시하고 하드코딩된 Anthropic API 호출
   - 해결: `get_provider()` 함수로 동적 프로바이더 라우팅 (gemini → Google API, anthropic → Anthropic API)

2. **analyze 완료 후 TypeError 크래시** (AI Engine)
   - 증상: 분석이 완료된 후 `full_state.update(None)` 호출 시 TypeError
   - 원인: 노드가 None을 반환했을 때 상태 업데이트 로직이 None을 처리하지 못함
   - 해결: `_run_analysis()`, `_run_resume()` 메서드에서 None 가드 추가 + test 추가

3. **patch_suggestions snake_case→camelCase 변환** (AI Engine)
   - 증상: 백엔드에서 `file_path` 필드가 null이어서 NOT NULL 제약 위반 → 500 에러
   - 원인: AI Engine이 `file_path`를 전송하지만, Python snake_case로 백엔드 Java camelCase 필드명과 불일치
   - 해결: `backend_api_client.save_patch_results()` 에서 명시적 매핑 (file_path→filePath)

4. **SSE 데이터 파싱 버그** (FE + BE) ★클라이맥스
   - 증상: 진행률·AI로그·완료 이벤트가 FE에서 누락됨 (화면에 아무것도 표시 안 됨)
   - 원인: Spring SseEmitter가 `data:{...}` 형식(공백 X), FE `useSse` 훅이 정규식 `/^data: /`(공백 O)만 매칭
   - 해결: `BottomPanel.tsx`의 useSse 정규식을 `/^data:\s*`로 수정 (공백 optional) → 라이브 진행률·AI로그·완료 표시 정상화
   - **영향**: 진행률 탭, AI로그 탭, 완료 신호가 모두 재생.

5. **PR 생성 버튼 비활성 + 문제 탭 정적 상태** (FE)
   - 증상: PR 생성 버튼이 "패치 ID가 없습니다" 비활성, 문제 탭이 placeholder만 표시
   - 원인: `AppHeader` 컴포넌트가 백엔드 응답의 `p.id`를 `patchId` 상태로 매핑하지 않음 + `BottomPanel`이 고정 UI
   - 해결: 응답 payload 구조를 `PatchSuggestion` 타입으로 정의하고, `patchId` 상태에 매핑 → 버튼 활성 + 문제 목록 동적 표시

### 2.2 데모 풀루프 검증 시나리오
**타깃**: `C:\Users\ttogl\workspace\demo-vuln-sample` (Flask 5파일, ~12개 취약점)  
**모델**: Gemini 2.5 Flash (기본은 Claude Haiku)  
**검증 단계**:
1. 좌측 워크스페이스 선택기 → demo-vuln-sample 폴더 열기
2. "분석 시작" 버튼 → 실시간 진행률(우측) + AI로그(하단) 표시
3. 완료 → 취약점 목록(우측) + 문제 탭(하단) 라이브 연동
4. 첫 번째 취약점 선택 → Patch Manager로 이동 → diff 확인
5. PR 생성 → `ttogle918/kkebi` 레포에 브랜치 생성 → PR #1 생성 (demo-vuln-sample/app.py SSRF 수정)

### 2.3 데모 경로 정합 (로컬 ↔ GitHub)
**선결 조건**: demo-vuln-sample 파일이 kkebi 레포 루트에 같은 경로로 존재해야 PR 매칭
- 로컬 스캔 시 사용자가 연 디렉토리 기준 상대경로 기록 → "demo-vuln-sample/app.py"
- PR 생성 시 대상 레포(`ttogle918/kkebi`)와 매칭
- ❌ 서브폴더(예: `demo-vuln-sample/` 루트에서 스캔)에서 스캔하면 경로가 어긋남 → **kkebi 루트 디렉토리를 열어야 함**
- **해결**: PR 모달에 "대상 레포 URL" 및 "스캔 경로 미리보기" 추가 (백로그: FEAT-FE-010 "경로 정합 자동화")

### 2.4 의사결정: 브랜치 워크플로우 전환
**기존**: direct-main (소형 fix는 main에 직접 커밋)  
**변경**: feature 브랜치 → main 머지 (본 세션부터 적용)
- 이유: 5건 버그 동시 수정 + 타 세션 동시 진행 시 충돌 위험 낮춤
- 정책: `fix/gemini-patch-sse` 브랜치 생성 → 커밋 5건 → Reviewer 통과 → `main` 머지(sqsh)

---

## 3. 버그 수정 / 특이사항

| 항목 | 설명 | 상세 |
|------|------|------|
| **SSE 라이브 진행률 기능복구** | data: 공백 파싱 버그 수정으로 진행률·AI로그·완료 신호 정상화 | [2026-06-28_gemini-patch-sse 트러블슈팅](../troubleshooting/2026-06-28_gemini-patch-sse.md) |
| Gemini 프로바이더 라우팅 | patch_node에서 동적 프로바이더 호출(get_provider) | 79f1ae3 |
| 다건 버그 동시 수정 | 5개 버그를 한 브랜치에서 처리(격리성·추적성↑) | 9015ad8 머지 |
| **미해결: FIX-PATCH-001** | 패치 적용 시 첫 줄 들여쓰기 소실(Python IndentationError) → PR #1 demo-vuln-sample/app.py 검증 후 백로그 추가 | d456d1c |

---

## 4. 다음 세션에서 할 것

- [ ] **PR #1 검증 및 FIX-PATCH-001 패치 추가** (패치 적용 들여쓰기 보존)
- [ ] **DAST 자체 타깃 (FastAPI 취약앱) 통합**
  - `C:\Users\ttogl\workspace\fastapi-vuln-sample` → kkebi에 복사 → API 엔드포인트 매핑 → DAST 배치 실행
- [ ] **컴플라이언스 피드 실데이터 연동** (KISA 일일 갱신 스케줄)
- [ ] **VC 데모 촬영** (모든 버그 수정 후)
  - 시나리오: SAST 분석 → 진행률·AI로그 라이브 → 취약점 확인 → PATCH → PR 생성 → /billing 모드 토글

---

## 5. 형상관리

**브랜치**: `fix/gemini-patch-sse`  
**머지**: main (9015ad8, sqsh)  
**미푸시**: 없음 (이미 원격 반영)  
**관련 커밋**:
- `79f1ae3` fix(ai-engine): Gemini 패치 경로 + 분석 완료 크래시·저장 버그 수정
- `84da25a` fix(fe): SSE data: 파싱 수정 + 문제·AI로그 패널 라이브 연동
- `57f3198` fix(fe): 패치 PR 생성 버튼 활성화 — 실제 patchId 매핑
- `9015ad8` Merge fix/gemini-patch-sse

**검증 테스트**:
- ai_engine: `pytest tests/api/test_analyze_route.py -v` (10/10 통과)
- frontend: `npm run typecheck` (13/13 통과)
