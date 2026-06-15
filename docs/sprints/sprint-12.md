# Sprint 12 — 통합 마스터 계획 (오케스트레이션 문서)

**작성일**: 2026-06-12 (PM Opus 4.8)
**역할**: "Sprint 12" 라벨 아래 **3개 트랙**(본진 보안코어 / 12C 분석UX / 12D 원가)의 **전역 실행·머지 순서**를 단일화하고, 본진 태스크의 삽입 위치를 확정한다. 개별 트랙의 구현 명세는 각 세부 문서에 있으므로 **여기서는 복제하지 않고 링크로 참조**한다.
**형상**: main=1e6ae18(계획만), 구현 브랜치 `feat/sprint12` 생성됨. **G0 PASSED**(Gemini 실호출 OK, 모델=`gemini-2.5-flash`). 다음 액션: `feat/sprint12`에서 `/stage 1` (= 12D COST-1+2).

---

## 1. 트랙 개요

| 트랙 | 정체성 | 세부 문서 | 태스크 (사이즈) | 상태 |
|------|--------|-----------|-----------------|------|
| **본진 (보안 코어 & 관측성)** | 베타 운영 필수 보안·운영 인프라 | `docs/07_SPRINT_BACKLOG_V4_260523.md` §Sprint 12 (line 429~) | TASK-1201(L) · 1202a(M) · 1202b(M) · 1203(M) · 1203b(M) · 1205(M) · 관측성[Loki·Sentry 편입](M) · 1210(M) | ⬜ 예정 |
| **12C (EPIC-STAGE, 분석 UX)** | stage 점진 노출 + 계획 컨펌 게이트 + 허브우선 lazy | `docs/sprints/sprint-12C.md` | STAGE-1(M) · STAGE-2(**L**) · STAGE-3(M) | ⬜ 예정 (Dev 보완 8건 반영 완료) |
| **12D (EPIC-COST, 멀티-프로바이더 원가)** | 크레딧 블로커 해소 + BYOK + provider 원가계측 | `docs/sprints/sprint-12D.md` | COST-1(M) · COST-2(S) · COST-3(**L**) · COST-4(**L**) | ⬜ 예정 (**G0 PASSED**) |

> **본진에서 제외**: TASK-1204(토큰비용)는 12D **COST-3**으로 흡수됨. ECON-1(프롬프트 캐싱)은 이미 구현됨 → 폐기, 계측만 COST-3.
> **Sprint 12B**(Enterprise Admin UI: 1206~1209)는 베타 필수 아님 → 본 사이클 범위 밖. 단, **1208(감사로그 UI)·1208b(2FA FE)는 1202a/806 백엔드 선행 완료가 전제**이므로 본진 1202a 머지 후 후속 트랙으로 분리.

---

## 2. 확정 전역 실행·머지 순서 (정본)

이미 12C·12D 양 문서에 기록된 단일 순서를 **정본으로 채택**하고, 본진 태스크의 삽입 위치를 PM이 확정한다.

### 2.1 채택된 단일 백본 (12C·12D 합의, 2026-06-12)
```
12D Phase1(COST-1·2) → TASK-1201 → 12D Phase2(COST-3·4) → 12C STAGE-1·2 → Sprint13 EPIC-VAL → 12C STAGE-3
```
- **근거**: 크레딧 블로커(12D-P1)가 1순위(현재 402로 분석 자체가 멈춤). 12C STAGE-2는 Sprint13보다 **먼저 머지**(graph_builder/agent_state 충돌). 12C STAGE-3는 VAL-3 머지 후(api_discovery 충돌 회피).

### 2.2 본진 태스크 삽입 위치 (PM 결정)

본진 7개 묶음(1201·1202a·1202b·1203·1203b·1205·관측성·1210)을 백본에 배치한다. **판단 기준**: ① 베타 운영 직결도(1201·1202=보안 필수) ② 트랙 독립성(파일 충돌 유무) ③ 백본 블로커 우선.

| 본진 태스크 | 백본 내 위치 | 배치 근거 | 12C/12D와 충돌 |
|-------------|--------------|-----------|----------------|
| **TASK-1201** GitHub App 인증 | **백본 2순위 (그대로 유지)** | 양 문서가 이미 1201을 COST-1·2 직후로 못박음. Sprint5/6 웹훅 블로커 선행이라 보안 필수. | **없음** (backend GitHub 도메인 — ai_engine·analyze.py 무관) |
| **TASK-1202a** 감사로그 해시체인 | **백본과 병렬 가능 — 본진 트랙 A** | backend audit 도메인 단독. Flyway V050. ai_engine/graph 무관. | **없음** |
| **TASK-1202b** 세션관리·강제로그아웃 | **본진 트랙 A (1202a와 병렬)** | backend user/session + Redis. Flyway V051. | **없음** |
| **TASK-1203b** ZAP DAST 하니스 | **본진 트랙 B (독립, 언제든)** | docker-compose/Makefile/infra 인프라 전용. 코드 충돌 0. | **없음** |
| **TASK-1203** CI 품질게이트 | **본진 트랙 B (1203b 선행 필수)** | 1203b의 `make zap-scan`을 CI에 연결. GitHub Actions yml. | **없음** |
| **TASK-1205** 백업 스케줄러+S3 | **본진 트랙 B (독립, 언제든)** | infra/scripts + BackupJob. 코드 충돌 0. | **없음** |
| **TASK-1210** 트랜잭션 이메일 | **본진 트랙 A (1202 후 권고)** | EmailService 추상화. COST-3 한도경고메일이 의존 → COST-3 전 완료가 이상적이나 강결합 아님. | **약함** (COST-3가 sendTokenLimitWarning 사용 — 미완 시 로그+플래그 폴백 명시됨) |
| **관측성(Loki·Sentry)** | **본진 트랙 B (독립, 베타 1일차 가치)** | 로깅/모니터링 인프라. **범위 제한: `main.py`+docker-compose/인프라 설정만, `analyze.py` 에러핸들러 수정 금지**(수정 시 12C STAGE-2와 충돌). | **없음 (범위 제한 시)** |

> **핵심 인사이트**: 본진 전 항목이 12C/12D와 **파일 충돌이 없다**(본진=backend 보안도메인·infra / 12C·12D=ai_engine graph·sast·analyze 중심). 따라서 본진은 백본 LLM 트랙과 **병렬 트랙**으로 진행 가능하다. 본진 내부 의존은 `1203b → 1203`, `1202a → (후속)1208`, `1210 → (느슨)COST-3` 뿐이다.

### 2.3 통합 타임라인 (LLM 백본 + 병렬 본진)

```
사이클 t0 ─────────────────────────────────────────────────► 후속
LLM 백본:  [12D P1: COST-1·2] → [1201] → [12D P2: COST-3·4] → [12C STAGE-1·2] → ║Sprint13 VAL║ → [12C STAGE-3]
본진 A  :  [1202a ∥ 1202b]  ──────────────► [1210]  (보안 백엔드, LLM 백본과 무관하게 병렬)
본진 B  :  [1203b] → [1203] ; [1205] ; [관측성]   (인프라/CI, 아무 때나 병렬)
```

- **머지 게이트 순서 (충돌 회피 의무)**:
  1. **12D Phase1 먼저 머지** (sast_node.py 골격을 12D가 선점 → 12C STAGE-1은 그 위에서 rebase).
  2. **12C STAGE-2 → Sprint13 VAL-3 보다 먼저 머지** (graph_builder.py·agent_state.py 충돌). VAL-3가 먼저 들어가면 STAGE-2는 **rebase 의무**.
  3. **12C STAGE-3 → VAL-3 머지 후** (api_discovery_node.py 충돌 회피).
  4. **본진 트랙 A/B는 LLM 백본과 독립 머지** — Reviewer PASS 시 순서 무관하게 main 머지 가능(파일 교집합 없음).

---

## 3. 파일 충돌 매트릭스

| 공유 파일 | 만지는 태스크 | 충돌 해소 규칙 |
|-----------|---------------|----------------|
| `sast_node.py` | 12D COST-1(골격)·COST-3(콜백)·COST-4(provider주입) / 12C STAGE-1 | **12D 내부 순서 COST-1→4→3**. 12C STAGE-1은 12D Phase 전체 머지 후 rebase. |
| `agent_state.py` | 12C STAGE-2(`confirmed`) / 12D COST-4(`preferred_provider`) / 13 VAL-3 | 12D Phase2 → 12C STAGE-2 → VAL-3 순 머지. STAGE-2가 VAL-3보다 선행. |
| `graph_builder.py` | 12C STAGE-2(interrupt_after) / 13 VAL-3(validate node) | **STAGE-2 먼저 머지 or VAL-3 후 rebase 의무.** |
| `analyze.py` | 12C STAGE-1·2 / 12D COST-4(preferred_provider) | 12D Phase2 → 12C STAGE-1·2 순. |
| `api_discovery_node.py` | 12C STAGE-3 / 13 VAL-3 | **STAGE-3는 VAL-3 머지 후** (백본 마지막). |
| **본진 파일 전체** (audit/session/email/infra/CI) | 본진만 | **교집합 0** — 충돌 없음. 독립 머지. |

---

## 4. 이번 사이클 스코프 권고 (지금 당장 돌릴 범위)

> 한 스프린트 용량 경계선 = **L 약 2개**. 백본 1라운드를 그 경계 안으로 좁힌다.

### 4.1 1순위 — **지금 즉시 (`/stage 1`)**
- **12D Phase 1 = COST-1(M) + COST-2(S)** — 크레딧 블로커 해소. **현재 최우선이자 유일한 블로커.** G0 PASSED로 진입 준비 완료.
- 용량: M+S = 경계 한참 이내. 단독 스테이지로 빠르게 그린화 → 블로커 즉시 해소.

### 4.2 1순위 병렬 — **본진 보안 백엔드 (선택적 동시 착수 가능)**
- **TASK-1202a(M) + TASK-1202b(M)** — LLM 백본과 파일 충돌 0이므로 12D Phase1과 **병렬 착수 가능**. 베타 보안 필수. 별도 작업자/세션이면 동시 진행 권고.
- 단, **단일 세션이면 백본 우선** — 블로커부터 끝내고 본진은 다음 라운드.

### 4.3 2순위 — 블로커 해소 직후
- **TASK-1201(L)** — 백본 2순위. L 1개이므로 단독 스테이지.

### 4.4 후속 (이번 사이클 경계 밖, 순차)
- 12D Phase 2 (COST-3 L + COST-4 L) → **L 2개 = 경계 상한**. 별도 사이클로 분리 권고.
- 12C STAGE-1·2 → Sprint13 VAL → 12C STAGE-3.
- 본진 트랙 B(1203b→1203, 1205, 관측성) 및 1210 — 인프라 여력 있을 때.

### 4.5 과적 경고
- "Sprint 12" 라벨 전체(본진 8 + 12C 3 + 12D 4 = **15 항목, L 4개**)를 한 사이클에 넣는 것은 **명백한 과적**(구 Sprint 12가 11개로 과적이었던 전례 재연). 반드시 위 라운드로 분할한다.

---

## 5. 리스크 · 선행의존성

### 5.1 트랙 간 의존
- **12D Phase1이 모든 것의 선행**: 크레딧 402 상태에서는 12C·VAL 등 LLM 호출 태스크의 실검증(✅ 항목)이 불가. COST-1로 Gemini 라우팅 확보 후에야 다른 트랙의 실스캔 검증이 가능.
- **1210 → COST-3 느슨한 의존**: COST-3의 80%/100% 한도 메일이 `EmailService.sendTokenLimitWarning()`에 의존. 1210 미완 시 COST-3는 **로그+플래그 폴백**으로 진행(12D 문서 명시) — 강결합 아니나, 1210을 COST-3 전에 끝내면 메일 경로까지 완결.
- **1208/1208b → 1202a/806**: Sprint 12B 항목이나, 1202a(해시체인)·806(2FA 백엔드) 완료가 전제. 본진 1202a 머지 후 후속 트랙으로 분리.

### 5.2 Flyway 번호 (머지 순서로 확정 — 충돌 주의)
- **머지 최고번호 = V049** (검증 완료: `V049__add_legal_consent_to_users.sql`이 현재 최고).
- 예약(미머지, 머지 순서로 확정):
  | 슬롯(잠정) | 태스크 | 비고 |
  |-----------|--------|------|
  | V050 | 1202a audit_logs 해시컬럼 | 본진 |
  | V051 | 1202b user_sessions | 본진 |
  | **V054 (잠정)** | **COST-3 token_usage** | 백로그 1204의 token_usage와 **동일 테이블로 단일화** (COST-3=1204 확장). ⚠️ **V052는 Sprint13 MOAT-1(triage_feedback)이 선점** → COST-3은 V054. 12D 본문도 V054. |
  | V055 (잠정) | COST-4 user_provider_keys | 백로그 V055 notification_channels와 충돌 → **머지 시점 최저 가용번호 재배정**. |
- **규칙**: Flyway는 갭 허용·순서 엄격 → **실제 머지 시점에 가용 최저번호 부여**. 12C/STAGE는 신규 마이그레이션 불필요(스키마 변경 없음).
- **충돌 핵심**: token_usage 슬롯 이중예약(본진 1204 ↔ COST-3) → COST-3이 1204를 흡수하므로 **단일 슬롯**. ⚠️ **V052는 Sprint13 MOAT-1(triage_feedback) 선점이므로 COST-3은 V054**(12D 본문과 일치). 백업/관측성/본진 세 곳이 동시에 V05x를 잡지 않도록 머지 직전 최고번호 재확인 의무.

### 5.3 Sprint 13 교차
- VAL-3(`graph_builder`·`agent_state`·`api_discovery_node`)가 12C STAGE-2·STAGE-3와 같은 파일을 만짐. **STAGE-2는 VAL-3 선행 머지, STAGE-3는 VAL-3 후행 머지** — 이 순서를 어기면 머지 충돌. 백본 순서가 이를 강제한다.

### 5.4 구현 리스크 (요약 — 상세는 세부문서)
- 12D: Gemini OpenAI호환 실현(G0로 선검증 완료), 키 암호화/노출(Reviewer 보안게이트 필수). → `sprint-12D.md` §리스크.
- 12C: STAGE-2 interrupt→resume 회귀(GraphInterrupt 예외처리 등 Dev 보완 8건). → `sprint-12C.md` §리스크.
- 본진: 1203b ZAP `dast-isolated-net` 격리 준수, 1210 메일 본문 민감정보 미포함, 1205 S3 Block Public Access, **관측성은 `analyze.py` 미수정(범위 제한)으로 12C STAGE-2 충돌 회피**. **1202b 강제로그아웃은 user_sessions+Redis 블랙리스트에 국한 — AnalysisSession 강제취소가 필요하면 별도 이벤트 발행(SessionStatus 직접 수정 금지)으로 12C 충돌 회피.**

---

## 6. 백로그 위생 반영 (PM 액션)
완료 시 `docs/07_SPRINT_BACKLOG_V4_260523.md`에 반영할 항목:
1. **현재 위치 포인터**: 브랜치 `feat/sprint12`, 진행 = 12D Phase1, 다음 액션 = `/stage 1`로 갱신.
2. **태스크 인덱스**: 1204→COST-3 흡수, ECON-1 폐기 표기.
3. **배정 매핑**: `1204 → 12D COST-3`, `ECON-1 → 폐기(구현 완료)` 추가.
4. **Flyway**: token_usage 슬롯 단일화 + V049 최고번호 명기.
5. **완료 게이트**: 본 사이클 = 12D Phase1 블로커 해소를 1차 게이트로. 나머지는 후속 라운드 ✅로 이월.

---

## Stage 1 완료 (2026-06-12) — 12D Phase1
**커밋**: `75a9ca9` — `feat(sprint12-stage1): 12D Phase1 — LLM 프로바이더 추상화 + Gemini 라우팅 + 품질벤치`
**브랜치**: `feat/sprint12` | **파이프라인**: 병렬 Dev(COST-1·COST-2) → Tester PASS → Reviewer FAIL→수정→PASS → 커밋

### COST-1 — 프로바이더 추상화 + AUDIT→Gemini 라우팅
- 구현: `agent/llm/{base,anthropic_provider,openai_compat_provider,factory,__init__}.py`(신규), `agent/claude_client.py`(얇은 위임·provider keyword-only 하위호환), `agent/nodes/sast_node.py`(provider 체인·AUDIT→Gemini·키없음 haiku 폴백), `config/settings.py`(gemini_model→gemini-2.5-flash·provider 필드), `requirements.txt`(openai==1.82.0)
- 안전장치: openai_compat `thinking_config` 거부(400/422) 시 제거 후 재시도(`_create_with_thinking_fallback`)
- **단위 테스트**: 신규/수정 그린(test_llm_factory + test_sast_node mock)
- 🛡️ Reviewer: 키/페이로드 로그 미출력·DIP·상수화 PASS

### COST-2 — Gemini vs Claude 품질 벤치 하니스
- 구현: `eval/provider_compare/{runner,report,__init__}.py`+README(신규), `Makefile`(`eval-providers` 타겟). findings 집합비교(합의/미탐/오탐후보)+cost·지연 표+latest.json. 기존 `parse_sast_response` 재사용.
- **단위 테스트**: 집합비교·정규화 그린

### 검증 (실 LLM 호출 — 블로커 해소 증명 ✅)
- **Gemini(gemini-2.5-flash) 실호출 성공**: 취약 샘플 1파일 SAST → `SQL_INJECTION [CRITICAL] line 10` 탐지, usage in761/out164, **Anthropic 크레딧 0 사용** = 402 블로커 해소 증명.
- **docker compose build ai_engine 성공**(exit 0, openai 의존성 포함).
- Tester: 단위 497 그린(신규 80 포함), 실패는 인프라 미기동 통합 플레이크뿐.

### 후속 보완
- ✅ **(해결) thinking 비활성**: `extra_body.thinking_config`가 gemini-2.5-flash에서 항상 400 거부되던 문제 → 표준 호환 파라미터 **`reasoning_effort="none"`으로 교체**(거부 없이 1왕복, 실호출 확인). 추론토큰 절감 의도 달성.
- (비차단, COST-4 전) `reasoning_effort="none"`이 openai_compat에서 **무조건 전송** → openai 직결+비추론 모델(gpt-4o 등)에서 400 위험. 현재 gemini만 라우팅돼 안전하나, **openai 직결 경로 활성화 전** gemini 한정(`base_url`/모델패턴) 또는 좁은 try/except로 가드.
- (비차단) runner `_collect_files` target 하위 경로 검증, `_default_model_for`↔sast_node 결정관계 주석.

---

## TASK-1201 완료 (2026-06-12) — GitHub App 인증 (백본 2순위)
**커밋**: `ffba377` — `feat(sprint12): TASK-1201 GitHub App 인증 플로우 완성`
**파이프라인**: Dev → Tester PASS(28 신규 그린, 회귀 그린) → Reviewer PASS(보안 위반 0) → 커밋

- `GitHubAppAuthService`(신설): App JWT RS256(iss=App ID, exp≤10분) + 설치 토큰 교환, PKCS#8/#1 PEM 로드
- `GitHubWebhookService`: extractInstallationToken/resolveProjectId 스텁 실구현(미매칭 skip), `projects.github_repo_full_name` 역조회(github_repo_url 컬럼 부재로 재활용)
- credit_transactions 집계 연동, `PrReviewHistory.project_id` nullable + **V050**
- **Flyway 재배정**(충돌 해소): 1201=V050 선점 → **1202a=V051, 1202b=V052, COST-3 token_usage=V054**
- ✅ **인증 검증 완료(2026-06-12)**: PEM 발급·`.env` 연결 후 라이브 `GET /app → 200`(slug=secure-editor, app_id=3851268, owner=ttogle918) — **App ID+키쌍 유효 확정**. 라이브에서 exp=600 시계스큐 401 버그 발견·수정(→540s, `b4018bc`).
- ⏳ **남은 검증**: `installations=0` — GitHub App을 대상 레포에 **설치** + 그 `owner/repo`를 `projects.github_repo_full_name`에 등록 + `GITHUB_WEBHOOK_SECRET` 설정 후 → 실 PR 웹훅→설치토큰→Check Run 전구간 검증 가능.
- 기존부채: `VulnerabilityServiceTest` 2건 실패는 `be78682`발(1201 무관, main에서도 실패) — 별도 정리 필요.

---

## Stage 2 완료 (2026-06-13) — 12D Phase2 (브랜치 `feat/sprint12-phase2`)
**커밋**: `177e56a`(COST-4) · `72d873d`(COST-3) | COST-4 → COST-3 순차(공유파일 AnalysisService/agent_state 충돌 회피), 각 Dev→Tester→Reviewer(각 FAIL 1건 수정)→커밋.

### COST-4 — 멀티-프로바이더 BYOK
- `user_provider_keys`(V052, AES 암호화) + `users.preferred_provider`(V053). ProviderKeyService/Controller(저장·hasKey만·삭제·validate; provider 화이트리스트 @Pattern Controller검증, 타사용자 403, 키 평문 미반환/미로그).
- ai_engine `POST /agent/validate-key`(boolean) + `agent_state.preferred_provider`. 기존 BYOK 경로 provider 인지 확장(`AiAgentClient.startAnalysis` 13-param, fallback 레이어). frontend Settings UI.
- Reviewer FAIL→수정: DELETE/validate PathVariable `@Pattern` Controller 검증 보강 + ProviderKeyService 생성자 @Autowired.

### COST-3 — 토큰 원가계측(provider 인지) + 한도 (=1204 확장)
- `token_usage`(V054) + domain/usage(TokenUsage/Repo/Service/**PricingTable**/Internal·UserController). 세션종료 1회 집계 콜백(ai_engine `patch_node._report_session_token_usage` → `POST /internal/v1/sessions/{id}/token-usage` X-Internal-Key) → cost 적재. DefaultAiAgentClient userId 오버로드 → body `user_id` 귀속.
- 한도 가드: 비BYOK 월100%→403(`TOKEN_LIMIT_EXCEEDED`), **BYOK 세션 제외**. `GET /api/v1/users/me/token-usage`(userId=principal). frontend TokenUsageChart.

### 검증·Flyway
- Tester: backend 신규실패 0(기존부채 6만), ai_engine 512 그린, frontend 68 그린.
- **Flyway 최종**: V050=1201, V051=1211, **V052·V053=COST-4, V054=COST-3** → 백로그 1202a→V055, 1202b→V056 이월.
- 🔬 실 콜백→적재→대시보드, ✅ Settings UI/차트는 수동검증.
- 후속(비차단): resolveKeyForAnalysis 이중호출 캐싱, PricingTable @ConfigurationProperties 외부화, ConstraintViolation 400 핸들러, TokenUsageChart 단위테스트.

---

## Stage 3 완료 (2026-06-14) — 본진 트랙 A (브랜치 `feat/sprint12-main-1202`)
**커밋**: `9f1a964` | TASK-1202a ∥ TASK-1202b 병렬 Dev(파일 충돌 0: audit 도메인 vs user/session+auth+frontend) → Tester → Reviewer PASS → 커밋.

### TASK-1202a — 감사 로그 해시체인 불변성 (Flyway V055)
- `audit_logs`에 `prev_hash`/`current_hash`(CHAR(64)) 추가. `current_hash = SHA-256(prev_hash + canonical(actor_id|action|resource|outcome|created_at))`, genesis prev_hash="0"×64.
- 신설: AuditLogHashService(해시계산)·AuditLogChainAppender(직렬화 append)·AuditVerifyService·AuditLogAdminController(`GET /api/v1/admin/audit-logs/verify`, @PreAuthorize admin). AuditLogAspect는 ChainAppender로 위임.
- **동시성 직렬화**: ReentrantLock(VThreads pinning 회피) + REPEATABLE_READ + `SELECT ... FOR UPDATE`(다중 인스턴스 방어). 저장 실패는 try-catch 격리(원 요청 무영향).

### TASK-1202b — 세션 이력 관리 + 강제 로그아웃 (Flyway V056)
- `user_sessions`(user_id, jwt_jti, device_info, ip, user_agent, created_at, revoked_at). TokenService jti 발급(login/refresh/OAuth), AuthService에서 세션 기록.
- `GET/DELETE /api/v1/users/me/sessions[/{id}]` — 소유권 불일치 403. DELETE는 Redis 블랙리스트(`secureai:jwt:blacklist:{jti}`, TTL=토큰 잔여만료) + revoked_at.
- JwtAuthenticationFilter가 jti 블랙리스트 적중 시 인증 미설정→401. frontend ActiveDeviceSection(활성 기기 관리).

### 검증·Flyway
- Tester: backend 745(신규 실패 0, 기존부채 6=VulnerabilityServiceTest 2+DomainVerificationRedisIT 4), frontend 74/74.
- **Flyway 최종**: V055=1202a, V056=1202b.
- 🔬 강제로그아웃 e2e(실 앱+Redis 401), ✅ 활성기기 UI는 수동검증. 후속(비차단, Reviewer 권고): ① AuthService.recordSession의 deviceInfo/userAgent 분리(현재 둘 다 UA 헤더) ② audit 정렬 동일타임스탬프 비결정성 → sequence/ULID 보강.

---

## Stage 4 완료 (2026-06-14) — 본진 트랙 B 착수 (브랜치 `feat/sprint12-trackB-1203b`)
**커밋**: `0101624` | TASK-1203b 단독 Dev → Tester → Reviewer PASS → 커밋.
**스코프 결정**: 트랙 B(1203b·1203·1205·관측성)는 모두 `docker-compose.yml`을 공유 → 병렬 Dev 시 레이스. 게다가 1203b는 1203 선행 필수. 따라서 **1203b 단독 스테이지**로 분리(docker-compose 충돌 원천 차단 + 의존성 루트 우선).

### TASK-1203b — OWASP ZAP DAST 스캔 하니스
- docker-compose: `zap` 서비스(`--profile zap`, `dast-isolated-net` **단독** 연결 → data-net 미연결로 postgres/redis 직접 도달 불가) + nginx에 dast-isolated-net 추가(공개 게이트웨이 스캔 표면).
- `make zap-scan`/`zap-gate`(perf-test 동형 옵트인), `SCAN_TYPE=full` 전환. `ZAP_TARGET_URL` 환경변수.
- `infra/zap/gate.py`: ZAP JSON `riskcode≥3`(High/Critical) 집계 → 1건+ `exit 1`. `rules.tsv`/`zap-baseline.conf` 룰 등급, `reports/` gitignore.
- `docs/runbooks/zap-dast.md` 사용법+게이트 해석. **Sprint 8 부채 "ZAP Critical 0건" 청산 수단 확보**.

### 검증
- Tester: `tests/zap/test_gate.py` 23 PASS(빈 리포트·riskcode 문자열/정수·다중 site·파일없음 exit2 등 경계 커버), `docker compose config` 파싱 정상.
- Reviewer PASS: **DAST 격리 네트워크 레이어 검증**(ZAP는 HTTP 스캐너로 nginx 경유 피벗 불가, data-net 직접 TCP 차단), additive-only.
- 🔬 실 `make zap-scan` 스캔·취약응답 주입·컨테이너 격리는 수동검증(도커 환경). 후속(비차단, Reviewer 권고): ① gate.py except fallback why주석 ② evaluate_gate 27줄 함수분리 ③ infra/zap/.gitignore `*.md` 범위 한정 ④ runbook HTTPS 타깃 권장 명시.
- **다음**: Stage 5 = TASK-1203(CI 품질게이트, `make zap-scan`을 GitHub Actions에 연결 — 1203b 선행 충족). 이후 1205·관측성.

---

## Stage 5 완료 (2026-06-14) — 본진 트랙 B (브랜치 `feat/sprint12-trackB-1203`)
**커밋**: `ebc4329` | TASK-1203 단독 Dev → Tester → Reviewer PASS → 커밋. 1203b(Stage4) 선행 충족 후 CI 배선.

### TASK-1203 — CI/CD 품질 게이트
- 신규 `.github/workflows/ci-quality-gate.yml`: **k6**(p95<500ms, `tests/perf/load-test.js`) / **ZAP**(Stage4 `infra/zap/gate.py` 재사용, Critical·High 0) / **SCA**(frontend npm audit · ai_engine pip-audit --severity high · backend OWASP Dependency-Check --failOnCVSS 7).
- `ci-backend.yml`: JaCoCo 커버리지 게이트 + Codecov 업로드. `build.gradle.kts`: `jacocoTestCoverageVerification`(라인 **58%**, 실측 59.73%) + `jacocoTestReport` dependsOn→mustRunAfter(test).

### 검증·결정
- Tester: yml 전부 파싱 OK, k6/zap 참조 경로 실존, `jacocoTestCoverageVerification` 로컬 BUILD SUCCESSFUL.
- Reviewer PASS(필수 0): 게이트 6개 중 **5개 하드차단**, frontend npm audit만 기존부채(next.js 연쇄 1 high+1 critical)로 `continue-on-error` 경보전용 — "알면서 허용" 단계조치로 허용.
- **트레이드오프 결정**: ① 커버리지 70%→**58%** (70%면 전 PR 즉시 차단 → 점진상향이 정직). ② npm audit 비차단 유지하되 audit-ci allowlist 전환 강력권고.
- 🔬 k6/ZAP/SCA 실 게이트 동작은 **GH Actions 수동검증**. 후속(비차단): k6-action env 전달 보강, npm audit→audit-ci allowlist(S13 전), 커버리지 65% 백로그 등록(S13).
- **남은 트랙 B**: TASK-1205(백업+S3), 관측성(Loki/Sentry).

---

## Stage 6 완료 (2026-06-15) — 본진 트랙 B 관측성 (브랜치 `feat/sprint12-trackB-observability`)
**커밋**: `795c1e0` | TASK-1603(Loki) + TASK-1804(Sentry) 단일 Dev(공유파일 docker-compose/main.py 레이스 회피) → Tester(Docker 라이브) → Reviewer PASS → 커밋.
**스코프 제약 준수**: `analyze.py` 에러핸들러 미수정(12C STAGE-2 충돌 회피), docker-compose additive(기존 jaeger/prometheus/grafana 유지).

### TASK-1603 — Loki 로그 집계
- docker-compose: `loki`+`promtail`(docker_sd 수집) 서비스 + `loki_data` 볼륨. `infra/loki/{loki-config,promtail-config,loki-alerts}.yaml`.
- Grafana: `datasources/loki.yaml`(derivedFields→Jaeger 링크) + `dashboards/loki-logs.json`.
- **Trace ID 상관관계**: backend logback-spring.xml(`%X{traceId}` JSON) + ai_engine dictConfig(trace_id) → Promtail 추출 → LogQL로 Backend↔AI Engine 추적.

### TASK-1804 — Sentry 에러 추적 (3런타임)
- backend `sentry-spring-boot-starter-jakarta` + ai_engine `sentry-sdk[fastapi]`(main.py init) + frontend `@sentry/nextjs`(client/server config). **전부 DSN env-gated**(미설정 시 init 스킵 → 로컬/CI 무해).
- 🛡️ **before_send PII 스크럽**(JWT/password/token/Authorization/X-Internal-Key/cookie/set-cookie), `send-default-pii=false`. SentryPiiScrubber(java)·sentry_filter(py)·beforeSend(ts).

### 검증 (Docker 라이브 — 이번엔 실제 기동)
- Tester: Sentry PII 단위 py16+java15 PASS, backend compile OK. **Loki 스택 라이브 기동**: Loki `/ready`·labels, **Grafana→Loki proxy 쿼리 success**, Promtail 소켓OK.
- **라이브 버그 발견·수정**: grafana `GF_INSTALL_PLUGINS=grafana-loki-datasource`가 404 크래시루프(Loki는 빌트인 코어 데이터소스) → env 제거 후 정상화. (라이브 기동이 아니면 못 잡았을 버그)
- Reviewer PASS(필수 0): set-cookie 일관성 권고 반영.
- 🔬 실 backend 로그 LogQL 적재·Trace ID 상관관계는 풀스택 기동 수동, Sentry 실 이벤트 도달은 사용자 DSN 필요(수동).
- **트랙 B 남은 1건**: TASK-1205(백업+S3).

---

## 핵심 결정사항 (요약)

1. **백본 정본 확정**: `12D P1 → 1201 → 12D P2 → 12C S1·2 → S13 VAL → 12C S3`. 12C·12D 양 문서 합의 순서를 검증·채택.
2. **본진은 병렬 트랙**: 본진 8개 전부 LLM 백본과 **파일 충돌 0** → 별도 트랙으로 병렬 진행 가능. 내부 의존은 `1203b→1203`, `1210→(느슨)COST-3` 뿐.
3. **이번 사이클 스코프 = 12D Phase1(COST-1+2)** 단독 우선(블로커). 본진 1202a/b는 여력 시 병렬. L 항목(COST-3·4, 1201)은 다음 라운드.
4. **과적 차단**: 15항목/L4개를 한 사이클에 넣지 않음 — 라운드 분할.
5. **머지 게이트 의무**: 12D P1 선점 → 12C STAGE-1 rebase; STAGE-2는 VAL-3 선행 머지; STAGE-3는 VAL-3 후행; 본진은 독립.
6. **Flyway**: 최고 V049 검증 완료. token_usage 슬롯 단일화(1204=COST-3). 머지 시점 최저 가용번호 부여.

---

## 7. 에이전트 평가 결과

### PM (Opus 4.8)
- 3트랙(본진/12C/12D) 우산 구조 확정. 단일 백본 순서 채택·검증. **본진 8개를 LLM 백본과 충돌 0 → 병렬 트랙**으로 배치. 이번 사이클 = 12D Phase1 단독 권고. 과적(15항목/L4) 차단. Flyway V049 최고번호 직접 검증.

### Dev (현실성 평가) — 판정 **"보완 후 진행 가능"** (치명적 재계획 불필요)
실레포 grep/read로 검증. 동의: V049 최고번호 실측 일치, backend↔ai_engine 파일 교집합 0, `openai` 패키지 부재 확인, `gemini_model` 기본값 여전히 `2.0-flash`(수정 필요), `get_graph()` 캐시키 취약점 실재.
- **착수 전 반영 완료(4건)**:
  1. ✅ 12C STAGE-2 변경파일에 `RedisSubscriber.java`(awaiting_confirmation→status 전환) + `AnalysisController` confirm EP 명시 — `RedisSubscriber`가 현재 completed/error만 처리.
  2. ✅ sprint-12.md §5.2 COST-3 슬롯 V052→**V054** 정정 (Sprint13 MOAT-1이 V052 선점).
  3. ✅ 관측성 범위를 `main.py`+docker-compose만으로 제한(analyze.py 미수정) — 12C 충돌 회피.
  4. ✅ 12D COST-4에 `UserService.java`(UserAnalysisSettings 확장) + AnalysisService 두 호출경로 파급 명시.
- **착수 직전 확인(2건, Phase1과 무관)**: 1202b 강제로그아웃의 analysis 도메인 연쇄 여부(§5.4 반영), TASK-1201 GitHub App 외부 준비물(App 등록·PEM·App ID).
- **추가 관찰**: 단일 `feat/sprint12` 브랜치 — 인터페이스 변경(COST-4 AiAgentClient) 커밋 시 호출부 수정을 같은 커밋에 묶을 것. eval/ 디렉터리(COST-2 ↔ VAL-1) Makefile 머지 순서 주의.

*Sprint 12 마스터 계획: 2026-06-12 (PM+Dev, Opus 4.8). 오케스트레이션 전용 — 구현 명세는 12C/12D 세부문서 참조. Dev 보완 4건 반영, 판정 "보완 후 진행 가능".*
