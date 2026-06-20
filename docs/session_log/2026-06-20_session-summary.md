# [2026-06-20] 작업 세션 요약

**브랜치**: `fix/fe-vuln-status-normalize` → main 머지 완료 (현재 main)  
**작업 범위**: FE 취약점 status 타입을 서버 정렬값으로 정규화 (mock 잔재 ↔ 서버값 불일치 해소)  
**스프린트**: 스프린트 외 작업 (Sprint 13 EPIC-VAL Stage1 Reviewer 비차단 권고 #2 이월분 처리)

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| VulnStatus 서버 정렬 단일화 + 정규화/판정 헬퍼 신규 | apps/frontend/src/lib/mockData.ts (VulnStatus='open'\|'false_positive'\|'fixed', normalizeVulnStatus, isVulnResolved) |
| ingest 경계 정규화 (새로고침 시 트리아지 상태 소실 해소) | apps/frontend/src/hooks/useLoadLatestResults.ts (하드코딩 'open' → normalizeVulnStatus(v.status)) |
| 패치/트리아지 표시 로직 서버값 정렬 | apps/frontend/src/store/useSecureStore.ts (applyPatch 'patched'→'fixed', optimistic/rollback 타입 VulnStatus로 좁혀 as 캐스팅 제거), VulnDetailPanel.tsx, VulnPanel.tsx, DashboardPage.tsx (=== 'patched' → isVulnResolved()) |
| 헬퍼 단위 테스트 신규 12개 | apps/frontend/src/lib/__tests__/vulnStatus.test.ts |
| 미사용 중복 타입 주석 | apps/frontend/src/types/index.ts (별도 Vulnerability 인터페이스 미사용 명시, 향후 통합 주의) |
| 커밋 | 5385e5e fix(frontend): VulnStatus 서버 타입 정규화 (Sprint13 Stage1 권고 #2) |

---

## 2. 의논 내용 & 결정 맥락

- **시작점**: 세션 로그(2026-06-18) "다음 세션 할 것"의 이월 #1 = FE VulnStatus enum ↔ 서버 타입 정규화. 사용자가 4개 트랙 중 ① FE fix를 선택.

- **근본 원인**: FE에 status 타입이 두 갈래 존재:
  - mockData.ts의 VulnStatus enum(mock 잔재): `'open'|'exploited'|'patched'|'pending'`
  - 백엔드 실제 반환값(Vulnerability.java): `'open'|'false_positive'|'fixed'`
  - 결과: 표시 로직이 서버가 보내지 않는 `'patched'`를 체크하고 있어, ACCEPT_PATCH 트리아지/패치 적용 후 SOLVED 배지가 안 뜨고, ingest가 status를 `'open'`으로 하드코딩해 새로고침 시 트리아지 상태가 소실되는 결함 발생.

- **방향 결정**: VulnStatus를 서버 정렬 3값으로 단일화(canonical) + ingest 경계 정규화 헬퍼 + 표시 로직 헬퍼화.
  - `exploited`는 영속 status가 아니라 DAST 분석 결과(dastExploitResults 별도 store) 소관 → status에서 제외하고 경계 유지.

- **위임**: CLAUDE.md 위임 원칙대로 구현은 Dev 에이전트에 위임, 커밋 전 Reviewer 게이트 수행.

- **Reviewer 1차 FAIL → 마스터 직접 수정 후 충족** (SendMessage로 동일 Reviewer 재호출 불가 환경 → 06-18 선례대로 소규모·기계적 수정은 마스터가 직접):
  - **블로커 1**: VulnPanel.tsx의 statusLabel/statusColor 딕셔너리가 구 mock 키(`exploited`/`patched`/`pending`)를 들고 있어, `false_positive`/`fixed`에서 undefined 렌더 → VulnStatus와 1:1 매핑으로 정정 (`open`=미해결, `false_positive`=기각됨, `fixed`=패치됨).
  - **권고 1**: VulnDetailPanel의 patchApplied 로컬 state가 트리아지 경로(store status 변경)와 미동기화 → `useEffect(vuln.status)`로 `isVulnResolved()` 시 `setPatchApplied(true)` 동기화 추가 (원래 트리아지 버그의 핵심).

- **형상관리**: 멀티파일(8) low-risk FE fix → git-workflow.md 원칙(애매하면 브랜치 선택) 따라 `fix/` 브랜치 생성 → Reviewer 게이트 충족 후 main fast-forward 머지. 푸시는 미수행 (사용자 판단 대기).

---

## 3. 버그 수정 / 특이사항

**3.1 VulnStatus 타입 불일치 (트리아지 상태 소실)**  
세션 로그 2026-06-18 이월 #2에서 권고했던 FE enum 정규화 작업으로 해소.

**3.2 무관한 기존 버그 발견(범위 밖, 미수정)**  
apps/frontend/src/hooks/__tests__/useConfirmPlan.test.ts:86  
`new ApiError('msg','CODE',500)` — ApiError 생성자 시그니처 인자 순서 뒤바뀜 (기대: status:number, code, message).  
이번 작업 전부터 존재하는 기존 버그. 별도 fix 대상으로 남김.

**3.3 검증 결과**  
- apps/frontend `npm test`: 103/103 그린 (신규 12개 포함)
- `npx tsc --noEmit`: 이번 변경발 타입에러 0 (남은 1건은 위 useConfirmPlan.test.ts 기존버그)
- 잔존 `exploited`/`patched`/`pending` 참조: 전부 무관 (DastFilter, FileAnalysisStatus, 세션/진행 status, 주석, 테스트 픽스처) — VulnStatus 참조 0 확인

---

---

## 묶음 A: useConfirmPlan ApiError 버그 수정

**커밋**: 7548b90  
**브랜치**: direct-main (소형 테스트전용 fix)

### 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| ApiError 생성자 시그니처 정렬 | apps/frontend/src/hooks/__tests__/useConfirmPlan.test.ts (line 86) |

### 의논 내용 & 결정 맥락

- **배경**: §3.2에서 발견한 기존 버그. 사용자가 "Fix 우선 처리" 요청 → 즉시 수정.
- **수정 내용**: `new ApiError('컨펌 실패','CONFIRM_FAILED',500)` → `new ApiError(500,'CONFIRM_FAILED','컨펌 실패')`  
  ApiError 정의된 시그니처는 `(status: number, code: string, message: string)`. 테스트에서만 인자 순서 뒤바뀨어 있었음.
- **검증**: `tsc --noEmit` 0 에러 (프로젝트 전체 클린), useConfirmPlan 6/6 그린, direct-main (무관파일).

### 버그 수정 / 특이사항

- 테스트 전용 1라인 수정. 기존 버그(mock 환경에서만 노출) 해소.

---

## 묶음 B: VC 데모 숫자 정리

**커밋**: 6d788b6  
**문서**: `docs/21_VC_DEMO_NUMBERS_260620.md` (신규)

### 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| VC 피치용 데모 숫자 정리 (961케이스, gemini-2.5-flash baseline) | docs/21_VC_DEMO_NUMBERS_260620.md |

### 의론 내용 & 결정 맥락

- **요구사항**: Sprint 13 완료 게이트 항목 ④ "VC 데모 숫자 확보" → baseline.json(961케이스, gemini-2.5-flash 평가) 측정값을 VC 피치용으로 정직하게 정리.

- **핵심 산출**:
  - **전체 평균**: 탐지율(recall) 43.9% / 오탐율(FPR) 27.1% / 점수(macro F1) 0.168
  - **인젝션 계열 합산**(SQLi/CmdI/XPath/PathTraversal/LDAP Injection/XSS): 탐지율 84.6% (강점)
  - **위생 계열**(Crypto/Config): 탐지율 3.4% (약점 → 전체 평균을 끌어내림)
  - **계열 분리 프레이밍**: 제품의 강점(인젝션)과 현재 한계(위생) 분리 제시.

- **한계 정직 표기**:
  - 오탐율 27.1% 높음 (실운영 고려 필요)
  - Recall 80% 지점의 FPR 산출 불가 (단일 임계값 설정이라 ROC 곡선 산출 불가)
  - **헤드라인이 비-기본 모델**: gemini-2.5-flash (제품 기본은 Claude)
  - 위생 계열 ~0% (구조적 한계)
  - 샘플(961케이스)≠풀런(전체 데이터셋) → 확장성 미보증
  - VAL-3 "가짜인용" 0건은 구조적 보장(평가셋이 폐쇄, 집계 폐기수 미측정)

- **결정 & 권고**:
  - 이 숫자들(gemini 평가)은 현재 기술 확보용으로 제시하되, **§6 "제품 기본 모델 Claude로 LIMIT=100 재측정" 권고 명시**.
  - VAL-2/VAL-3 체크 상태 정보도 표기 (이번 측정 회차에서는 완료 미해당).

---

## 묶음 C: 멀티 프로바이더 모델 선택 확장

**커밋**: bc299b6 (feat/multi-provider-model-selection) → main ff 머지 완료  
**무관 문서 커밋**: 104f81f (docs: VC 심사 피드백 + 사용자 시나리오)

### 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| 사용자 모델선택 체인 검증 + 실제 모델/프로바이더 전달 확인 | 코드추적(Settings → UserService → AnalysisService → AI엔진) |
| **#1 분석완료 표시 정확화** (하드코딩 Haiku → 실제 모델) | apps/ai_engine/src/api/sse_helpers.py (resolved_model, resolved_provider 추가), apps/frontend/src/components/AppHeader.tsx (event.model/MODEL_RATES 테이블) |
| **#2 모델 7종 확장** (Claude 3종·Gemini 2종·OpenAI 2종) | apps/backend/src/main/java/io/secureai/common/ModelConstants.java (VALID_MODELS, CREDIT_COST_PER_FILE), apps/frontend/src/lib/constants/models.ts (MODELS with provider label) |
| **#3 모델→프로바이더 정합화** (자동 유도) | apps/backend/src/main/java/io/secureai/common/ModelConstants.java (providerForModel), apps/backend/src/main/java/io/secureai/user/UserService.java (updateSettings provider 자동 선택) |
| AI엔진 factory 통합(anthropic/gemini/openai 패스스루) | 기존 지원 확인, 변경 최소 |

### 의논 내용 & 결정 맥락

- **배경**: 사용자가 "FE 모델 선택 기능이 실제로 동작하나" 검증 요청 → 코드추적 결과 전체 체인은 정상이나, **3개 결함 발견**.

- **결함 1: 분석완료 표시 하드코딩**
  - AppHeader가 `modelId='claude-haiku-4-5'` + Haiku 단가로 고정 → 사용자가 Opus/Gemini 선택해도 항상 "Haiku 사용" 표시.
  - **해결**: AI엔진 sast_node에서 resolved_model/provider를 상태에 기록 → streaming_helpers의 completed 이벤트에 model/provider 포함 → FE AppHeader가 `event.model` + 모델별 `MODEL_RATES` 테이블로 실제값 반영 (엔진 폴백도 감지).

- **결함 2: 모델 라인업 제한**
  - 기존 3개(Claude Haiku/Sonnet, Gemini Flash) → 비즈 요청 7종 확장.
  - Claude Haiku / **Sonnet / Opus 4.8** / Gemini 2.5-Flash/**Pro** / OpenAI GPT-4o-mini/**4o**.
  - **크레딧 3단계**: 1크레딧/파일(Haiku/GPT-4o-mini) / 5(Sonnet/Gemini-Pro) / 20(Opus/GPT-4o).
  - FE MODELS 객체: 프로바이더별 그룹 라벨 ("Claude", "Google", "OpenAI").

- **결함 3: 모델→프로바이더 정합화**
  - handleSaveModel이 preferredModel만 보내면, provider 미스매치 가능 (예: "claude-opus-4.8" 저장했는데 provider가 "gemini"라면 오류).
  - **해결**: ModelConstants.providerForModel(모델ID prefix 매핑) 신규 함수 + UserService.updateSettings가 선택 모델에서 provider 자동 유도 저장 → 단일 진실원천.

- **AI엔진 영향**: factory.py가 이미 anthropic/gemini/openai 3종 factory 지원 + 모델ID passthrough 기능 있음 → 엔진 변경 최소.

- **의논 & 선택지**:
  - 사용자가 2개 선택: (A) 모델 라인업=추천 7종 vs 더 다양 / (B) 분석완료 표시 방식=#1 방식(엔진이 model 전달) vs FE 저장값 사용.
  - **선택 결정**: 추천 7종 + #1 방식(엔진 전달이 더 정확).

- **형상관리**: feat/multi-provider-model-selection → main fast-forward 머지.  
  무관 스트레이 문서 3건(`docs/feedback/*`, `docs/user_scenarios_updated.md`)은 기능 커밋에서 제외 → 별도 `104f81f docs:` 커밋으로 정리.

### 검증 결과

- **Backend**: `./gradlew test` → ModelConstants 신규 14케이스 + UserService 신규 4케이스 합산 전체 832 통과. 기존 Redis IT 4건만 인프라 의존(테스트 환경 미설정, 기능 회귀 아님).
- **AI Engine**: streaming 4·sast 18 (신규 model/provider 필드 포함 검증).
- **Frontend**: `npm test` 118 통과·`tsc --noEmit` 0 에러.
- **회귀**: 0 (기존 분석/사용자/설정 기능 영향 없음).

### 버그 수정 / 특이사항

- 결함 3건 발견·수정 완료. 회귀 0.

---

## 묶음 D: 잡문서 커밋 + 푸시

**커밋**: 104f81f (docs)  
**푸시**: main을 origin/main에 반영 (7548b90..104f81f)

### 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| VC 심사 피드백 정리 | docs/feedback/ (2건) |
| 사용자 시나리오 업데이트 | docs/user_scenarios_updated.md |
| main 푸시 | (워킹트리 클린) |

### 의론 내용 & 결정 맥락

- **배경**: 묶음 A~C의 커밋 후 외부 평가 산출물(VC 심사 피드백, 사용자 시나리오) 보존 필요.
- **처리**: 기능 커밋과 분리하여 별도 docs 커밋으로 정리.
- **푸시**: main을 origin/main에 푸시 완료 (7548b90..104f81f).

---

## 4. 다음 세션에서 할 것

- [ ] **버그 우선 처리(사용자 지정)** — eval 재측정 전에 잡을 버그 먼저. (구체 버그는 다음 세션에 사용자가 지정)
- [ ] **VAL-1 eval 헤드라인 Claude 재측정** — 제품 기본 모델(Claude)로 `make eval` LIMIT=100 재측정 → docs/21_VC_DEMO_NUMBERS §2·§3 갱신 + baseline.json 모델표기 정정 + kkebi README 숫자 동기화. (gemini 결과는 저비용 대조군 병기). ※사용자가 "버그 먼저 잡고" 후 진행 지시.
- [ ] 모델 선택 멀티프로바이더 **브라우저 에이전트 수동 테스트 보류**(사용자가 미룸) — Settings에서 Gemini/GPT-4o 선택 분석 시 헤더 토스트·Dashboard 토큰차트 모델이 선택값과 일치하는지.
- [ ] (부채) FE 모델 상수 lib/constants/models.ts 단일화 — 모델 8종+ 시 (Reviewer 권고).
- [ ] ② VAL-1 탐지율 개선(recall 0.439↑) / ③ kkebi 마감(시연영상·Description/Topics).
