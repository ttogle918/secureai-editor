# Sprint 12D — ★EPIC-COST "멀티-프로바이더 LLM + 원가 통제"

**계획 수립일**: 2026-06-11 (PM Opus 4.8 + Dev 현실성 평가)
**계획 상태**: 최종 확정 (Dev 평가 반영 — openai 의존성·system메시지 분기·usage 정규화·시그니처 체인·Flyway 재조정·콜백 빈도·AUDIT fallback·Gemini 실호출 게이트) — **시작점: 사전검증(G0) → `/stage 1`**
**목표**: Anthropic 크레딧 고갈로 분석이 멈추는 블로커를 **프로바이더 추상화 + scan_mode 하이브리드(AUDIT=Gemini 저비용 / PIPELINE=Claude 정밀) + 멀티-프로바이더 BYOK + provider 인지 원가 계측**으로 해소.

---

## 스프린트 번호·우선순위 (PM 결정)
- **신규 `Sprint 12D` (EPIC-COST)** — 12(보안코어)·12C(분석UX)·13(VAL) 어디에도 안 맞는 **원가/프로바이더 트랙**. 크레딧 고갈(2026-06-07: failed 402, 취약점 0)이 현재 최우선 블로커.
- **우선순위 (12C·12D·13 통합 — 2026-06-12 단일화)**: ① **12D Phase 1(COST-1·2)** 즉시 1순위(크레딧 블로커) → ② Sprint 12 **TASK-1201(GitHub App)** → ③ **12D Phase 2(COST-3·4)** → ④ **12C STAGE-1·2** → ⑤ **Sprint 13 EPIC-VAL** → ⑥ **12C STAGE-3**(VAL-3 머지 후 — api_discovery 충돌 회피).
  - 12C STAGE-2는 ⑤(13)보다 **먼저 머지**(graph_builder/agent_state 충돌). 이전 표기 "이후 12C → 13"은 STAGE-3가 13 뒤라는 제약을 누락 → 본 순서로 정정.
- **ECON-1(캐싱)**: 이미 `claude_client.py`/`chat_client.py`에 `cache_control:ephemeral` **구현됨** → 별도 태스크 폐기, 계측은 COST-3 흡수. ⚠️ **캐싱은 Anthropic 전용**(Gemini/OpenAI 미적용).
- **1204(토큰비용)**: **COST-3으로 대체·확장**(provider 인지).

---

## ✅ G0 — 사전 검증 게이트 (2026-06-12 **PASSED**)
COST-1 착수 전 검증 — **통과 완료**. 결과:
1. **Gemini 실호출 성공(HTTP 200)**: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` (Bearer 키, system+user). 응답 `usage:{prompt_tokens,completion_tokens,total_tokens}` 확인 → input/output 정규화 OK.
2. **`AQ.` 키 형식 = 유효** (404 모델오류였지 401 인증오류 아님 → 인증 통과). **재발급 불필요.**
3. ⚠️ **모델명 정정**: `gemini-2.0-flash`는 **폐기(404 NOT_FOUND)** → **`gemini-2.5-flash`** 사용. `.env`에 `GEMINI_MODEL=gemini-2.5-flash` 추가 완료. **COST-1은 `settings.gemini_model` 기본값도 `gemini-2.5-flash`로 변경**.
4. ⚠️ **thinking 토큰**: gemini-2.5-flash는 `total_tokens > prompt+completion`(추론 토큰 사용). SAST엔 불필요 → COST-1에서 thinking 최소화(`reasoning_effort`/extra_body) 고려, COST-3 원가계측은 total 기준.
> 전제(Gemini로 크레딧 없이 분석) 확정. COST-1 진입 가능.

---

## 실행 계획
| 순서 | TASK | 제목 | 선행 | 서비스 | 에이전트 | 사이즈 |
|------|------|------|------|--------|---------|--------|
| 1 | **COST-1** | 프로바이더 추상화/팩토리 + AUDIT→Gemini 라우팅 | G0 | ai_engine | Dev+Tester | M |
| 2 | **COST-2** | Gemini vs Claude 품질 검증 하니스 | COST-1 | ai_engine | Dev+Tester | S |
| 3 | **COST-3** | 토큰 원가 계측(provider 인지)+한도 (=1204 확장) | COST-1 | ai_engine+backend+frontend | Dev+Tester | L |
| 4 | **COST-4** | 멀티-프로바이더 BYOK 스키마+Settings UI+라우팅 | COST-1 | backend+frontend+ai_engine | Dev+Tester | L |

- **Phase 1 = Stage 1(COST-1·2)**, **Phase 2 = Stage 2(COST-3·4)**. Phase 1 머지·품질검증 후 Phase 2.
- 용량 L×2 = 경계선 상한.
- **공유파일 충돌**: `sast_node.py`(COST-1 골격→COST-4 provider주입→COST-3 콜백 순), `agent_state.py`·`analyze.py`(COST-4 preferred_provider), 12C STAGE-1과도 sast_node 겹침(12D 선행 시 12C rebase).

---

## COST-1 — 프로바이더 추상화 + AUDIT→Gemini 라우팅 (M) ★Dev 보완 집중

- **변경 파일**: `agent/llm/{__init__,base,anthropic_provider,openai_compat_provider,factory}.py`(신규), `agent/claude_client.py`(얇은 위임으로 수정·시그니처 유지), `agent/nodes/sast_node.py`(provider 분기 + `_analyze_chunks` 체인), `config/settings.py`(default/audit/pipeline_provider, gemini_base_url), **`requirements.txt`(`openai` 추가 — Dev #1: 현재 anthropic만 있음)**, `tests/agent/test_llm_factory.py`(신규) + `tests/agent/test_sast_node.py`(mock 시그니처 6개 수정 — Dev #2).

### ⚠️ Dev 필수 보완 (스펙 명시)
1. **`openai` 패키지 requirements 추가** (현재 없음). google SDK 불필요(Gemini=OpenAI호환).
2. **openai_compat_provider 구현 세부**:
   - system을 **`messages=[{"role":"system","content":system_text},{"role":"user","content":user_content}]`** 로 전달 (Anthropic의 `system=[{type:text,cache_control}]` 구조 **금지** — 파싱오류).
   - **`cache_control` 제거**(OpenAI호환은 무시/오류).
   - **usage 정규화**: `prompt_tokens→input_tokens`, `completion_tokens→output_tokens`, `cache_creation/read_input_tokens→0`.
   - **응답 markdown 펜스 스트립**(```json … ```) + 빈 응답 `""` 가드.
3. **시그니처 체인**: `provider`가 `sast_node → _analyze_chunks → analyze_for_sast → provider.analyze()` 전체에 흐르도록 수정. `analyze_for_sast(..., provider="anthropic")`는 **keyword-only default**(하위호환). `test_sast_node`의 fake mock 6개에 provider 인자 추가.
4. **AUDIT fallback 정책**(Dev #7): GEMINI 키 없는데 AUDIT→gemini 라우팅 시 → **명확 로깅 후 anthropic audit_model(haiku)로 폴백**(세션 중단 금지). 즉 "키 있으면 Gemini, 없으면 기존 haiku".

- **인터페이스**:
  - `base.LLMProvider.analyze(system_text, user_content, model, max_tokens=4096) -> (raw_text, usage_4keys)`.
  - `factory.get_provider(provider, api_key=None) -> LLMProvider` (anthropic/gemini/openai, 미지원 ValueError, 플랫폼키 싱글턴·BYOK 1회용).
  - Gemini base_url=`https://generativelanguage.googleapis.com/v1beta/openai/`, model=`gemini-2.5-flash` (G0 정정 — `gemini-2.0-flash`는 404 폐기. `settings.gemini_model` 기본값도 동일).
  - `analyze_for_sast(file_path, content, guidelines="", model=None, api_key=None, *, provider="anthropic")`.
- **핵심 로직(sast_node, 기존 model 결정 블록 뒤)**: `preferred_provider`(state, COST-4) → None이면 scan_mode(AUDIT→audit_provider, PIPELINE→pipeline_provider) → `_default_model_for(provider)`로 provider/model 짝 강제(preferred_model 우선) → `_analyze_chunks(..., provider)`.
- **엣지**: 키 없음→폴백(위 #4) or ValueError 조기로깅. Gemini 펜스/빈응답→가드. 토큰/키 로그 금지. gemini 컨텍스트 1M라 지침 53~58K 여유.
- **준수**: LLMProvider 프로토콜(DIP), provider 리터럴·base_url 상수화, 빈 catch 금지, 키 로그 금지.
- **DoD**: 🧪 get_provider 정확(gemini base_url/anthropic 싱글턴/미지원 ValueError) / 🧪 `analyze_for_sast(provider="anthropic")` 기존 회귀 0 / 🧪 openai usage 정규화 / 🧪 mock 6개 수정 후 기존 sast 테스트 그린 / 🔬 AUDIT→gemini·PIPELINE→anthropic 분기 + 키없음→haiku 폴백 / ✅ **.env GEMINI 키로 실 1파일 Gemini 분석 성공(크레딧 0 vuln 산출) = 블로커 해소 증명**.

---

## COST-2 — Gemini vs Claude 품질 검증 하니스 (S)
- **변경 파일**: `eval/provider_compare/{runner,report}.py`+README(신규), `Makefile`(`eval-providers`).
- **인터페이스**: `make eval-providers TARGET=<dir> PROVIDERS=gemini,anthropic [LIMIT=N]` → provider별 SAST → 표(findings 수·severity·지연·추정cost) + latest.json.
- **로직**: 동일 파일셋 provider별 분석 → `(file,line,type)` 집합 비교(합의/Claude-only=미탐/Gemini-only=추가·오탐 후보). **VAL-1(절대채점) 중복 회피** — 상대 비교 + 수동 spot-check MVP, scorer 인터페이스만 VAL-1 재사용 가능하게.
- **엣지**: 키없음 provider 스킵, 부분실패 skip&log, rate limit 백오프.
- **DoD**: 🧪 집합 비교 정확 / ✅ backend/dvwa 일부로 Gemini vs Claude 표 + recall gap·오탐 후보 수치 1장.

---

## COST-3 — 토큰 원가 계측(provider 인지) + 한도 (L) = 1204 확장 ★Dev 보완

### ⚠️ Dev 필수 보완
- **콜백 빈도(Dev #4)**: 파일별 POST(100파일=200 HTTP + 중간 한도차단 문제) 대신 → **세션 종료(patch_node) 시 집계 1회 POST** 권고. 파일별 토큰은 기존 state `_add_usage`로 이미 누적됨. (실시간 차단이 꼭 필요하면 차단신호 처리 로직 별도 명시.)
- **Flyway(Dev #5)**: PM의 V054는 백로그 V052(token_usage, Sprint13 1204)와 **중복**. COST-3이 1204 확장이므로 **token_usage 슬롯을 단일화** — 12/13 미머지 상태라 **머지 순서로 번호 확정**(잠정 V054, 12·13 선점 시 재배정). 백로그 1204(V052) 항목을 COST-3으로 매핑.

- **변경 파일**: ai_engine `sast_node.py`(세션집계 usage→콜백)·`backend_api_client.py`(`report_token_usage`); backend `V0xx__create_token_usage.sql`·`domain/usage/{TokenUsage,Repository,Service,InternalController,UserController,PricingTable}.java`; frontend `TokenUsageChart.tsx`+대시보드.
- **인터페이스**: 내부 `POST /internal/v1/sessions/{id}/token-usage`(X-Internal-Key) body `{userId,projectId,provider,model,inputTokens,outputTokens,cacheCreation,cacheRead}`. 사용자 `GET /api/v1/users/me/token-usage?from&to`(JWT, userId=principal 강제). `token_usage(... provider VARCHAR(20), model, *_tokens, cost_usd NUMERIC(12,6), occurred_at)` + idx(user_id,occurred_at).
- **PricingTable**: provider/model→1K토큰 단가. **단가 출처는 설정/상수 파일로 분리**(Dev #7 — 하드코딩 운영부채 회피), cache_read 할인단가 별도, 미등록 모델→0+경고.
- **로직**: 세션 완료 시 집계 콜백 → cost 계산 insert → 월 집계 → 한도: 80%경고(메일 미구현시 로그+플래그), 100%→다음 분석 403(`AnalysisService` 가드). **BYOK 세션은 한도 제외**.
- **준수**: 입력검증 Controller, 내부 X-Internal-Key, 파라미터 바인딩, 키/토큰 로그 금지, usage 도메인 분리.
- **DoD**: 🧪 PricingTable cost 정확(캐시할인) / 🧪 누적 합산 / 🔬 콜백→적재→조회 / 🔬 100%+비BYOK→403, BYOK→통과 / 🛡️ 타 사용자 403 / ✅ 대시보드 provider별 일별+월비용+캐시적중률.

---

## COST-4 — 멀티-프로바이더 BYOK 스키마+UI+라우팅 (L) ★Dev 보완

### ⚠️ Dev 필수 보완 (#6)
- **기존 BYOK 합류 명시**: 현재 `users.anthropic_api_key`→`UserService.getAnalysisSettings()`→`UserAnalysisSettings(preferredModel,apiKey)`→`AnalysisService`→`DefaultAiAgentClient.doStartAnalysis(...userApiKey)`→`AnalyzeRequest.user_api_key`→state→`_get_client`. → COST-4는 이 경로를 **provider 인지로 확장**:
  - `UserAnalysisSettings` record(**`UserService.java` 소유** — `getAnalysisSettings()` 반환)에 **`preferredProvider` 추가**(또는 신규 DTO). **변경 파급: `UserService.java`(record 확장) + `AnalysisService.dispatchToAgent()` github/local 두 호출 경로 모두 수정 + AiAgentClient mock 테스트 연쇄.**
  - **`AiAgentClient`/`DefaultAiAgentClient.doStartAnalysis`에 `preferredProvider` 파라미터 추가**(인터페이스 변경).
  - `AnalyzeRequest.preferred_provider`·`AgentState.preferred_provider` 추가(+ `initial_state` dict 수정).
  - **fallback 레이어**: provider 키 없으면 `users.anthropic_api_key`(레거시)→플랫폼 기본 순. `ProviderKeyService`에서 처리.
- **Flyway**: `user_provider_keys` 번호도 머지 순서로 확정(잠정 V055, 백로그 V055 notification_channels와 충돌 → 재배정).

- **스키마**: **별도 `user_provider_keys(id, user_id FK, provider VARCHAR(20), encrypted_key TEXT, default_model VARCHAR(60), created_at, updated_at, UNIQUE(user_id,provider))`** — `@Convert(AesEncryptionConverter)` 재사용. 기존 `users.anthropic_api_key`는 하위호환 fallback.
- **인터페이스**: `POST/GET/DELETE /api/v1/users/me/provider-keys`(GET은 hasKey만, 평문 미반환), `POST .../{provider}/validate`→ai_engine `POST /agent/validate-key`(경량 ping, boolean만), `PUT /users/me/settings`(preferredProvider). provider 화이트리스트 `@Pattern`.
- **로직**: 키 AES 암호화 upsert → 분석 시 preferredProvider+복호화키 → startAnalysis 확장 전달 → ai_engine 라우팅(COST-1). 키 없으면 폴백.
- **엣지**: 타 사용자 403, 잘못된 provider 400, validate 키노출 금지, 빈키 분석→폴백, 재저장 upsert.
- **준수**: 입력검증 Controller, 키 암호화·로그금지·복호화 후만 전달, 파라미터 바인딩, 도메인 경계.
- **DoD**: 🧪 저장 시 암호화(평문 부재) / 🧪 GET hasKey만 / 🔬 Gemini 키 저장→분석→gemini 라우팅 / 🔬 validate boolean / 🛡️ 타 사용자 403·로그 키부재 / ✅ Settings UI(드롭다운·키입력·검증·모드별 모델)+키없음 폴백 안내.

---

## Flyway (Dev #5 — 재조정 필요)
- 머지 최고 **V049**. 백로그 예약(미머지): V050/051=Sprint12(1202a/b), **V052=token_usage(Sprint13 1204)**, V053/054/055=알림·온보딩·채널.
- **COST-3 token_usage = 1204와 동일 테이블** → 슬롯 단일화. **번호는 머지 순서로 확정**(12/13 미머지면 12D가 선점, 추적표에 명기). COST-4 user_provider_keys도 동일.
- Flyway는 갭 허용·순서 엄격 → **실제 머지 시점에 가용 최저번호 부여**(잠정 COST-3=V054, COST-4=V055, 충돌 시 재배정).

---

## 리스크
1. **Gemini OpenAI호환 실현(높음)**: openai 패키지·system messages·cache_control 제거·usage 정규화 미명시 시 동작 안 함(Dev #1·2·3). **G0 실호출로 선검증**.
2. **시그니처 회귀(중)**: provider 체인 + test mock 6개. keyword-only default로 하위호환(Dev #2).
3. **캐싱 Anthropic 전용(중)**: AUDIT(Gemini)는 캐시 절감 없음 → Gemini 저단가가 절감원. COST-3 대시보드로 가시화.
4. **AUDIT 회귀(중)**: AUDIT 기본 provider 변경이 기존 사용자 영향 → 키없음 haiku 폴백(Dev #7).
5. **키 암호화/노출(높음·보안)**: 멀티키 컨버터 재사용·GET 평문 미반환·validate boolean·로그금지. Reviewer 보안게이트 필수.
6. **sast_node 공유 충돌(중)**: COST-1→4→3 순 + 12C 겹침.
7. **Flyway 번호 충돌(중)**: 백로그 V052(token_usage) 중복 → 머지순서 확정.
8. **AnalysisClient 인터페이스 변경 파급(중)**: doStartAnalysis preferred_provider 추가 → 호출부·테스트 영향(Dev #6).

---

## 실행 명령어
```
(G0 사전검증: Gemini 실호출 + 키형식 확정)
/stage 1   — COST-1 + COST-2 (Phase 1: Gemini 라우팅 + 품질검증)
  (검증 PASS → 크레딧 0 분석 동작)
/stage 2   — COST-3 + COST-4 (Phase 2: 원가계측 + BYOK UI)
/done
```

---

## 에이전트 평가 요약
### PM (Opus 4.8)
- Sprint 12D 신규(EPIC-COST), Phase1(COST-1/2)→Phase2(COST-3/4). ECON-1 폐기(캐싱 구현됨)·1204→COST-3 흡수. 우선순위 12D Phase1 → 1201 → 12D Phase2.
### Dev (현실성 평가) — 반영 결과
- **필수 보완 5건+ 반영**: (1)openai 패키지 추가 (2)openai_compat의 system messages·cache_control 제거·usage 정규화 (3)provider 시그니처 체인+mock 6개 (4)COST-3 세션집계 콜백 (5)Flyway 번호 재조정(V052 token_usage 충돌) + AUDIT haiku 폴백 + AnalysisClient 인터페이스 + PricingTable 설정분리 + **G0 Gemini 실호출 선검증**.
- **동의된 판단**: settings gemini/openai 필드 기존재, AgentState preferred_model/user_api_key/scan_mode 기존재, AesEncryptionConverter 재사용, provider keyword-only default 하위호환.

*Sprint 12D 계획: 2026-06-11 (PM+Dev, Opus 4.8). Gemini 실호출 게이트·openai 의존성·usage 정규화·시그니처 체인·Flyway 재조정·콜백 빈도·AUDIT 폴백 확정.*
</content>
