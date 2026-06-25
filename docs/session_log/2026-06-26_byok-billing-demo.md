# [2026-06-26] BYOK 검증·과금 2모드·빌링 페이지·분석 타이머

**브랜치**: `main` (direct commit)  
**작업 범위**: Gemini BYOK 폴백 버그 수정 + FEAT-BILLING-2(키모드 토글) + 빌링 페이지 신규 + 분석 진행 경과 타이머

---

## 1. 완료 작업

| 항목 | 주요 파일 | 커밋 |
|------|---------|------|
| Gemini BYOK 폴백 버그 수정 (서버 키만 검사→user_api_key 무시) | `apps/ai_engine/src/llm/factory.py` | `bdf80ba` (머지 `44ca168`) |
| 크레딧 충전 페이지 `/billing` 신규 + 헤더 크레딧칩 연결 | `apps/frontend/app/billing/page.tsx`, `components/Header.tsx` | `cabd9e8` |
| FEAT-BILLING-2: 키모드 토글(BYOK/PLATFORM) + 빌링 강화 | `apps/backend/src/api/request/StartAnalysisRequest.java`, `AnalysisService.java`, `apps/frontend` localStorage | `d3fd02f` |
| 분석 진행 경과 타이머(FE) + 타이밍 백로그 | `apps/frontend/hooks/useAnalysisProgress.ts`, `components/AnalysisTimer.tsx` | `72b32f8` |

---

## 2. 의논 내용 & 결정 맥락

### 2.1 BYOK end-to-end 검증
사용자 요청: "내 키를 넣으면 그 키로 분석할까? 3개 프로바이더(Anthropic, OpenAI, Gemini) 각각?"

**검증 흐름**:
- FE 설정: 3개 키 입력 필드 + 프로바이더/모델 선택
- 백엔드 `ProviderKeyService.resolveKeyForAnalysis(userId, provider)`: 프로바이더별 AES 복호화된 키 반환
- ai_engine `llm/factory.get_provider(provider, api_key)`: 그 키로 호출

**발견된 버그**: Gemini SAST 분석 시 서버 GEMINI_API_KEY만 검사하고, 사용자 API 키(`user_api_key`)는 폴백 **이후**에 읽음
→ 서버 키 미설정 시 사용자 Gemini 키를 무시하고 Anthropic으로 폴백

**해결**:
- `factory.py` → `user_api_key`를 폴백 조건 **위로** 이동
- `sast_node` 로직: `if user_api_key: ... elif server_key: ... else: 폴백`
- 결과: Anthropic·OpenAI·Gemini 모두 정상 작동 (ai_engine 142 단위테스트 통과)

### 2.2 기본 모델 및 프로바이더 확인
- **PIPELINE(정밀)**: `claude-sonnet-4-6` (Anthropic)
- **AUDIT(빠름)**: `claude-haiku-4-5` (Anthropic)
- **기본 프로바이더**: `anthropic`
- **사용자 선택 가능**: FE `PreferredModel` 선택기 → `preferred_model` 필드 → `sast_node`가 최우선 사용

### 2.3 과금 2모드 설계·검증
**모드1: BYOK (bring-your-own-key)**
- 차감 없음 (크레딧 사용 X)
- 무제한 (API 호출 시 TOKEN_LIMIT 체크 스킵)
- `deductForScan()` 메서드에서 BYOK 제외

**모드2: PLATFORM (플랫폼 제공 키)**
- 대납: 서버 키(Anthropic) 또는 사용자 플랫폼 크레딧 사용
- 크레딧 차감: 각 모델별 가중치 (Sonnet $0.01, Haiku $0.002/콜)
- 한도: `TOKEN_LIMIT_EXCEEDED` 403 에러로 가드

**갭(미구현 → 백로그)**:
- ❌ 자가결제(Payment Gateway): 구매 페이지 UI만 선구현
- ⚠️ 명시 토글(FEAT-BILLING-2): **지금 구현**
- ⚠️ API 키 발급(FEAT-BILLING-3): 백로그

### 2.4 FEAT-BILLING-2 구현 전략 (저위험 선택)
**목표**: `resolveKeyForAnalysis()`, 기존 테스트 mock 건드리지 않으면서 사용자가 BYOK/PLATFORM 명시 선택 가능

**백엔드**:
- `StartAnalysisRequest`: 새 enum 필드 `KeyMode` (BYOK, PLATFORM, null)
  - 호환 생성자: null 입력 시 기존 동작(BYOK 자동 감지) 유지
- `AnalysisService.startAnalysis()`: PLATFORM 선택 시 `isByok=false` 설정 + `resolvedApiKey`를 플랫폼 기본키로 강제
- 기존 `ProviderKeyService` 메서드: 그대로 유지 (테스트 영향 최소)

**프론트엔드**:
- localStorage: `keyMode` + `scanModeDefault` 패턴 따름
- `useStartAnalysis()`: 토글 선택값을 요청에 포함
- `/billing` 페이지: 모드 토글 UI (라디오 버튼)
- **마이그레이션 불필요** (새 필드는 null-safe)

### 2.5 데모용 FE-only 구현 (사용자 지침)
**현재 데모 시점에서 필요**:
- 빌링 강화: 요금제 카드(Basic/Pro/Enterprise) + 사용량 막대그래프(더미) + Enterprise 문의 모달
- 분석 경과 타이머: FE만 (setTimeout으로 경과시간 표시)

**실 백엔드 구조 (백로그)**:
- FEAT-ANALYSIS-TIMING: 서버에서 분석 시작~종료 시간 영속(analysis_duration)
- FEAT-DASH-USAGE: 대시보드 실 사용량 그래프(월별 토큰 누적 데이터)

### 2.6 VC 데모 보강 항목 논의
**클라이맥스 요소**:
- **증명된 취약점** (Proven 배지, 빨간 표시)
  - 제약: scorecard 팝업은 CLI 벤치만 지원 → DAST 워크스페이스는 라이브 데모로 진행
- **원가 투명성**
  - 타이머(경과시간 표시)
  - 토큰·달러 비용(`$0.01/콜` 등)
  - 그래프(월 누적 토큰)
  - 모드 토글(BYOK 무제한 vs PLATFORM 크레딧)
- **탐지→증명→교정→PR 풀루프**
  - SAST 탐지 → 트리아지(기각/취약·자동) → Proven 목록 → 패치 자동 적용 → GitHub PR 제출
- **벌크·배치**: 다건 동시 트리아지·스캔
- **규제증적**: 보안 문서(DAST/SAST 규칙, 패치 아테스테이션)
- **플랫폼 폭**: 좌측 사이드바(분석/보고/설정/과금 탭)

**데모 사전 조건 및 주의**:
- ✅ 파이프라인: SAST 노이즈 데이터(미리 준비, 취약점 다양한 심각도)
- ✅ 프로바이더: Anthropic 키 설정(BYOK 테스트용) + 서버 키 설정(PLATFORM 폴백)
- ✅ 환경: WebGoat 실행 중 (DAST 타겟)
- ✅ GitHub App: 저장소 권한 활성화 (PR 생성)
- ✅ 패치 검증 이미지: patch-verify 실행 중
- ⚠️ 패치 검증: 자동 실행 (수동 버튼 없음 — 주의해서 진행)
- ⚠️ 그래프: 더미 데이터 (실 누적 데이터 아님 — 사용자 이해 필요)

---

## 3. 버그 수정 / 특이사항

| 항목 | 설명 |
|------|------|
| Gemini BYOK 폴백 우선순위 버그 | 서버 키 미설정 시 사용자 Gemini 키를 무시 → `factory.py` user_api_key 조건 재정렬 (상세: [2026-06-26_byok-gemini-fix.md](../troubleshooting/) 참고) |
| 키모드 토글 마이그레이션 불필요 | null-safe 필드 추가로 기존 요청 호환성 유지 |
| FE-only 타이머 구현 | 실 duration은 백엔드에서 미영속(FEAT-ANALYSIS-TIMING 백로그) |

---

## 4. 다음 세션에서 할 것

- [ ] **데모 촬영** (VC 피칭용)
  - 시나리오: SAST 노이즈 → 트리아지(기각) → Proven 취약점 선별 → 자동 패치 → PR 생성
  - 원가 투명성: 타이머 + 토큰 비용 + 모드 토글(BYOK 무제한 표시)
  - 주의: 패치 자동 실행, 그래프 더미 데이터
- [ ] **백로그 이슈 구현**
  - FEAT-BILLING-1: Payment Gateway 실 결제 로직 (구매 페이지 완성)
  - FEAT-BILLING-3: API 키 발급·관리 UI
  - FEAT-ANALYSIS-TIMING: 서버 분석 duration 영속화
  - FEAT-DASH-USAGE: 실 사용량 그래프 (월별 토큰 누적)
  - 앞선 FE 태스크: SAVE/LOAD, GIT 통합, VAL-18 UI, 자동화

---

**관련 스프린트 문서**: `docs/sprints/sprint-14.md` "2026-06-26 세션" 섹션 추가 예정
