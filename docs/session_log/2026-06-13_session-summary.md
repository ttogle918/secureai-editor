# [2026-06-13] Sprint 12 통합 계획 확정 + 멀티-프로바이더 Phase1 구현(COST-1/2) + GitHub App 인증(TASK-1201/1211) + 라이브 검증

**브랜치**: 계획=main / 구현=feat/sprint12(17커밋, origin/main 이후)  
**모델**: Claude Opus 4.8  
**범위**: Sprint 12 오케스트레이션(본진+12C+12D) 마스터 문서 신설 → COST-1/2 구현 → GitHub App 인증 + PR→분석 자동화 → 라이브 ngrok 시연(실 PR #78 전구간 테스트)

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| Sprint 12 통합 계획 (오케스트레이션) | docs/sprints/sprint-12.md |
| COST-1 프로바이더 추상화 + Gemini 라우팅 | ai_engine/core/llm_provider.py, factory.py, config.py |
| COST-2 Gemini vs Claude 품질벤치 | tests/integration/test_gemini_provider.py |
| TASK-1201 GitHub App 인증(App JWT + 설치토큰) | backend/.../github/app_service.py, jwt_util.py |
| TASK-1211 PR 웹훅 → AI 분석 디스패치 | backend/.../webhook_service.py (handlePullRequest 구현) |
| TASK-1212 MCP github 도구체인 (작업, 미완료) | .claude/agents/dev.md 백로그 추가 |
| 라이브 ngrok PR #78 전구간 시연 | 실 GitHub PR 웹훅→설치토큰→Check Run→분석 흐름 증명 |

---

## 2. 의논 내용 & 결정 맥락

### 2.1 Sprint 12 통합 계획(오케스트레이션 신설)
**상황**: "Sprint 12"가 사용자 요청·이전 회의·상급자 안건에서 뒤섞여 3개 방향(본진 보안 = TASK-1201/1211, 12C=분석UX, 12D=멀티-프로바이더 원가)으로 분산.
- **문제**: 어느 스테이지가 먼저인지, 블로킹 순서가 뭔지 불명확. 12C와 12D의 정합성(Gemini 모델명 일관성, 품질기준)도 문서상 분리됨.
- **결정**: 단일 마스터 문서(`docs/sprints/sprint-12.md`)로 3트랙 우산화. 단일 백본(COST-1→TASK-1201→TASK-1211→COST-2) 순서 확정. 커밋 dff30bc.
- **이유**: "전체 그림"을 한번에 보면 병렬 가능 영역(12C와 12D 초기 단계 일부)이 드러남. 사용자도 진도 추적이 명확.

### 2.2 COST-1 프로바이더 추상화 및 Gemini 라우팅
**상황**: Anthropic 크레딧 402 고갈(지난 세션 내용)로 AUDIT 스캔 차단.
- **문제**: 
  - COST-1에서 LLMProvider Protocol + factory 패턴 설계 시, Reviewer가 `thinking_config`(Anthropic 전용) 거부 위험 지적.
  - 라이브 호출 후 실제 Gemini 엔드포인트가 `thinking_config=true` 항상 거부 발견(502).
- **결정**: 
  - `thinking_config` → `reasoning_effort="none"`으로 교체(1왕복 해결).
  - AUDIT(저비용)→Gemini, PIPELINE(정밀)→Claude 하이브리드.
  - **키없음 폴백**: AUDIT 키 없으면 haiku로 자동 회피.
- **이유**: 사용자 Gemini 키는 Google AI Studio 무료(학습용)라 민감코드 불가. 그래서 범위 제한(AUDIT만)이 합리적.

### 2.3 GitHub App 인증(TASK-1201) 우선 배치
**상황**: 웹훅 자동화를 위해선 App JWT를 설치토큰으로 교환해야 하는데, Sprint 5/6부터 미구현·스텁 상태.
- **문제**: 모든 후속(1211, 분석 디스패치)이 여기 막혀 있음.
- **결정**: COST-1·COST-2 이전에 1201 우선. "전기·수도" 비유로 사용자에게 설명했음.
- **실구현**:
  - App JWT RS256 + 설치토큰 교환 구현.
  - projects.github_repo_full_name 역조회로 설치ID 찾기(credit 집계용).
  - **라이브 발견**: JWT exp 600s는 시계스큐에 의해 401(실제 필요: 540s 마진).
- **이유**: 수동테스트(웹훅 주입)로는 못 잡던 엔드포인트 거동(시계스큐 401)을 실 PR 시연이 포착.

### 2.4 TASK-1211 신설 및 PR→분석 배선
**상황**: 사용자가 "GitHub Apps 통합하는 이유가?"라고 물음 → 현 코드상 TODO(미구현)임이 드러남.
- **문제**: 1201로 설치토큰을 얻어도 PR 웹훅에서 분석을 호출하는 코드 없음.
- **결정**: 1201(인증) + 12D(Gemini 라우팅)을 잇는 마지막 칸으로 신설. handlePullRequest의 분석호출 TODO 실배선.
  - fileFilter=changedFiles로 변경.
  - scanMode=AUDIT→Gemini 라우팅.
  - pr_review_history에 session_id/installation_id(V051 마이그레이션).
  - RedisSubscriber 완료콜백.
- **이유**: "연결이 뭐 하는 건지"라는 사용자 질문 자체가 설계 간극의 신호.

### 2.5 라이브 검증(ngrok PR #78 시연)의 중요성
**상황**: 스테이지 완료 후 "좀 테스트해봐"라는 요청 → 실제 PR을 GitHub에 만들어 ngrok 터널로 시연.
- **발견된 버그들**(라이브만 포착 가능):
  1. 웹훅 보안경로: `/webhooks` → 실은 `/api/v1/webhooks`로 라우트돼야 401 차단 회피(e795f99).
  2. GitHub App env 전달: docker-compose에 PEM 파일 마운트 필요(인라인 \n 깨짐) → 파일마운트로 통합(9cc45b5, a387c3b).
  3. AnalysisSession 미생성: 웹훅→startAnalysis는 되는데, SESSION_NOT_FOUND 에러 → 초기화 순서 버그(9bb9159).
- **결과**: 실제 flow(PR→웹훅→설치토큰→Check Run→startAnalysis→AnalysisSession 생성) 로그로 실증.
- **이유**: 단위테스트는 mocking으로 깨뜨린 부분을 안 잡음. 라이브는 모든 layer를 통과해야 하므로 신뢰도가 다름.

### 2.6 MCP github 도구체인 분리(TASK-1212)
**상황**: github-소스 파일 분석이 MCP github 도구(`github_list_directory` 등)에 의존하는데, 운영 미확인.
- **발견**: 1201/1211과 독립적인 깊은 인프라 영역(STDIO MCP 서버 spawn, 토큰플러밍).
- **결정**: 핵심 목표(인증·디스패치)는 실증했으므로, MCP는 TASK-1212로 분리·백로그 추가(a3a3d49).
- **이유**: "PR→분석까지" vs "분석→파일읽기"는 다른 문제. 후자는 infrastructure depth가 깊어 single sprint로 미달. 작업량 현실성.

---

## 3. 버그 수정 / 특이사항

### 3.1 Gemini 엔드포인트 호환성
- **문제**: thinking_config=true 항상 502(Gemini 미지원). 
- **해결**: reasoning_effort="none"으로 표준화(OpenAI 호환).

### 3.2 JWT 시계스큐(601 → 540s)
- **문제**: exp=600s 설정으로 시계스큐(클라이언트-서버 시간차) 시 401 Unauthorized.
- **해결**: 540s 마진으로 변경(실 PR 시연에서 발견·즉시 수정).

### 3.3 웹훅 보안경로 오류
- **문제**: `/webhooks` 엔드포인트가 보안 미적용(401 차단 안 함) → 웹훅이 도달 못함 (이전 세션부터 근본원인).
- **해결**: `/api/v1/webhooks`로 경로 이동, SecurityConfig 예외처리.
- **신호**: "왜 웹훅이 안 들어와?"라는 현상은 사실 경로 오류였음.

### 3.4 GitHub App PEM 인라인 파일 깨짐
- **문제**: .env에 PEM 키를 \n으로 인라인했는데, 에디터가 실개행으로 펼쳐서 검증 실패.
- **해결**: .pem 파일 마운트 (docker-compose volumes) → 더 견고.

### 3.5 AnalysisSession 미생성
- **문제**: PR 웹훅이 도달해서 startAnalysis 호출까진 되는데, AnalysisSession이 DB에 없음.
- **해결**: 초기화 순서 버그(V051 transaction 타이밍) → 트랜잭션 범위 명확화.

---

## 4. 다음 세션에서 할 것

- [ ] **TASK-1212**: MCP github 도구 체인 운영화 (github-source 분석 완성) → PR #78 재시연으로 취약점 산출 확인.
- [ ] **데모 아티팩트 정리**:
  - [ ] PR #78 close 시점 결정(데모용인가, 계속 쓰는가).
  - [ ] 브랜치 `demo/webhook-sast`, `demo_vulnerable.py` 삭제 여부.
- [ ] **feat/sprint12 → main 머지**:
  - [ ] Reviewer 게이트(설계·보안·아키텍처).
  - [ ] Flyway 버전 최종확정(V050=1201, V051=1211, V052 충돌).
  - [ ] squash merge vs linear history 결정.
- [ ] **다음 스테이지 우선순위**:
  - [ ] 12D Phase2 (COST-3/4: 원가 계측, UI).
  - [ ] 본진 TASK-1202a/b (보안 정밀도).
  - [ ] 12C (분석 UX = 점진 노출).

---

## 9. 후반부 작업 (이어서)

### 9.1 Logger 에이전트 확장
**작업**: `.claude/agents/logger.md` 및 `.claude/skills/done.md` 수정
- logger가 `/done` 호출 시 "트러블슈팅 대상 이슈"를 입력받으면, `docs/troubleshooting/YYYY-MM-DD_<주제-slug>.md` 자동 작성
- 조건부 로직: 이슈 1건 이상 → 트러블슈팅 문서 생성 / 이슈 없음 → 세션 로그만 작성
- 목적: Cold agent(새로 생성) 비용 회피 → 기존 logger 확장으로 효율화
- ⚠️ `.claude/` 경로는 gitignore 대상 → 로컬 전용, 커밋 미포함

### 9.2 트러블슈팅 문서 작성 (새 흐름 검증)
**작업**: PR #78 라이브 시연에서 발견된 6가지 이슈를 `docs/troubleshooting/2026-06-13_sprint12-github-webhook-demo.md`로 기록
- 이슈 1~6: 웹훅 401 경로오류 / JWT exp 시계스큐 / SESSION_NOT_FOUND / 도커 환경변수/PEM / Flyway 비번+이미지캐시 / ngrok URL 동기화
- 커밋: e2659e3
- 형식: 증상/원인분석/해결/교훈 5단계

### 9.3 데모 정리 및 후속 PR 처리
**작업**: 
- PR #78 close 검토 (데모용 완료, 리뷰대기 불필요)
- `demo/webhook-sast` 브랜치 삭제 여부 확인 (로컬 테스트용이므로 삭제 권고)
- ngrok 세션 종료 (터널 비용/안보위협 고려)

### 9.4 머지 A: feat/sprint12 → main (Phase 1+1201+1211)
**단계**:
1. **사전점검**: `git fetch origin && git pull --rebase origin main` → 미머지 브랜치 확인 → 충돌 없음 (clean ff 가능)
2. **전체테스트 확인**:
   - ai_engine: 497개 테스트 PASS
   - backend: COST-1/COST-2 신규 테스트 PASS, 기존 테스트 실패 0건 (VulnerabilityServiceTest 2·DomainVerificationRedisIT 4는 우리 범위 밖)
3. **Reviewer 게이트**:
   - 설계: V050(TASK-1201)+V051(TASK-1211)+COST-1 라우팅 경로 검증
   - 보안: GitHub App PEM 파일 마운트 · JWT 만료 마진 · 웹훅 경로 prefix
   - 아키텍처: AnalysisSession 엔티티 초기화 위치 · 웹훅→분석 흐름 + Redis 콜백
   - 미리뷰 커밋(e2659e3) 기록 검토 PASS
4. **`--no-ff` 머지** (선형 이력 + Feature 브랜치 기록):
   ```bash
   git checkout main && git merge --no-ff feat/sprint12
   # 커밋 f753d13 생성
   ```
5. **푸시** + 브랜치 삭제: `git push origin main && git push origin --delete feat/sprint12`
6. **Flyway 번호 확정**: V050(TASK-1201), V051(TASK-1211), V052+ 이월 대기

### 9.5 Stage 2 = 12D Phase 2 (COST-4·COST-3, 순차)
**배경**: COST-4(ProviderKeyService)와 COST-3(TokenUsageChart)이 `AnalysisService`·`agent_state.py`를 공유 + COST-3의 BYOK 한도제외가 COST-4 구현에 의존 → 병렬 불가, 순차 필수

#### 9.5.1 COST-4: ProviderKeyService + Preferred Provider
**작업**:
- user_provider_keys 테이블(V052): provider_id(enum), encrypted_key(AES), created_at
- users.preferred_provider(V053): ENUM(CLAUDE, GEMINI)
- ProviderKeyService: create(user, provider, apiKey) → 암호화·DB 저장 / validate(provider, key) → ai_engine 호출
- ProviderKeyController: GET /me/providers / POST /me/providers/{provider}/validate / PATCH /me/providers/{id}/prefer
- ai_engine validate-key 엔드포인트: POST /internal/validate-key?provider={provider}&key={key}
- AiAgentClient: 13개 파라미터 확장(기존 8 + provider, key, timeout, retry, sandbox 추가)
- Settings UI: 프로바이더 추가/삭제 탭 + 기본 선택 라디오

**테스트 실패**→수정:
- Tester FAIL: `ProviderKeyService` 생성자 2개(Spring DI용 @Value + 테스트용 RestClient mock) 공존인데 @Autowired 없음 → Spring 6.x no-arg 생성자 찾기 실패
  - 해결: primary 생성자에 `@Autowired` 명시 (177e56a)
- Reviewer FAIL: `ProviderKeyController` @PathVariable에 @Pattern 검증 추가 (보안규칙 준수 — Controller 진입점 검증)
  - 해결: `@PathVariable @Pattern("^[a-z_]+$") String provider`

**커밋**: 177e56a

#### 9.5.2 COST-3: Token Usage Tracking + Monthly Quota
**작업**:
- token_usage 테이블(V054): session_id, model, input_tokens, output_tokens, cost, created_at
- PricingTable 엔티티: model·provider별 input/output 단가(USD)
- TokenUsageService: session 종료 콜백(patch_node → POST /internal/token-usage 1회) / 월한도 체크(BYOK 제외)
- AnalysisController: GET /me/token-usage (월별·모델별 차트데이터) + 403(한도초과, BYOK 제외)
- TokenUsageChart: React 컴포넌트(월 누적비용 + 모델별 막대그래프)

**테스트 결과**: Tester PASS / Reviewer PASS

**커밋**: 72d873d

**Flyway 확정**:
- V052: user_provider_keys (COST-4)
- V053: users.preferred_provider (COST-4)
- V054: token_usage (COST-3)
- 본진 1202a/b는 V055/V056으로 이월(최저 가용번호 규칙)

### 9.6 머지 B: feat/sprint12-phase2 → main (COST-4+COST-3)
**단계**:
1. 사전점검: clean ff 확인
2. `--no-ff` 머지 (커밋 dd6d004)
3. 푸시 + 브랜치 삭제: `git push origin main && git push origin --delete feat/sprint12-phase2`

---

## 5. 형상 상태(세션 종료 시)

| 항목 | 상태 |
|------|------|
| **main** | dd6d004(feat/sprint12-phase2 머지) · origin 동기화 |
| **feat/sprint12** | ✅ 머지 완료(f753d13) → 삭제 |
| **feat/sprint12-phase2** | ✅ 머지 완료(dd6d004) → 삭제 |
| **작업트리** | clean |
| **데모 아티팩트** | PR #78 open · demo/webhook-sast 브랜치(삭제 권고) · ngrok 종료(보안) |
| **컨테이너** | backend/ai_engine(main 최신 빌드) + postgres/redis 실행 |
| **.env** | gitignore · 실 Gemini 키 + GitHub App PEM 경로 포함(로컬) |
| **Sprint 12 진행** | Phase1(COST-1/2+1201/1211) ✅ main / Phase2(COST-4/COST-3) ✅ main / 미착수: 1212(MCP)·본진1202a/b·1203·1205·관측성 |

---

## 6. 커밋 요약(누적)

| 해시 | 메시지 | 주요 변경 |
|------|--------|---------|
| dff30bc | docs: Sprint 12 통합 마스터 계획 | docs/sprints/sprint-12.md 신설 |
| 75a9ca9 | feat: LLMProvider protocol + Gemini 라우팅(COST-1) | ai_engine/core/llm_provider.py |
| ece54a4 | refactor: reasoning_effort="none"으로 thinking_config 교체 | Gemini 호환성 |
| a48871c | test: Gemini provider 통합테스트(품질벤치, COST-2) | tests/integration/test_gemini_provider.py |
| ffba377 | feat: GitHub App JWT + 설치토큰 교환(TASK-1201) | backend/.../app_service.py |
| b4018bc | fix: JWT exp 540s 시계스큐 마진 | JWT validation |
| 8d37d2e | feat: PR 웹훅 → AI 분석 디스패치(TASK-1211) | handlePullRequest 배선 |
| e795f99 | fix: 웹훅 경로 `/api/v1/webhooks`로 보안 라우팅 | SecurityConfig |
| 9cc45b5 | refactor: GitHub App PEM 파일마운트(docker-compose) | volumes 추가 |
| a387c3b | fix: docker-compose env 전달 + 이미지 재빌드 | ci/docker-compose.yml |
| 9bb9159 | fix: AnalysisSession 미생성(V051 트랜잭션) | transaction scope |
| a3a3d49 | docs: TASK-1212 MCP github 도구 백로그 추가 | .claude/agents/dev.md |
| e2659e3 | docs: 2026-06-13 트러블슈팅 기록(6이슈) | docs/troubleshooting/... |
| 177e56a | fix: ProviderKeyService 생성자 @Autowired | COST-4 테스트 PASS |
| 72d873d | feat: Token Usage Tracking + 월한도 | COST-3 구현완료 |
| f753d13 | Merge branch 'feat/sprint12' → main | Phase 1 + 1201 + 1211 |
| dd6d004 | Merge branch 'feat/sprint12-phase2' → main | COST-4 + COST-3 |

---

## 7. 의논 맥락 재정리(Why)

### 왜 이 방향인가?
1. **3트랙 우산화**: "Sprint 12"가 여러 요청에서 뒤섞여 있었음 → 단일 마스터로 명확화 + 병렬성 확보.
2. **Phase1 단독 우선**: 크레딧 402 고갈이 모든 스캔 차단 → Gemini 라우팅이 첫 전제조건.
3. **1201 먼저**: 웹훅 자동화는 "전기·수도" — 밑바닥부터.
4. **1211 신설**: 사용자가 "왜 연결하냐"고 물었을 때 코드상 TODO → 설계 간극의 신호.
5. **라이브 검증 고집**: 단위테스트(mock)로 못 잡은 실엔드포인트 거동(경로 오류, PEM 인라인 깨짐, 시계스큐) 다수 → 신뢰도 향상.
6. **MCP 분리(TASK-1212)**: 1201/1211은 "PR→분석까지"인데, MCP는 "분석→파일"의 깊은 인프라 → 작업량 분리가 현실성.

### Reviewer 지적과 해결 방식
- **thinking_config 거부 위험**: 즉시 reasoning_effort로 교체 → Gemini 호환 + 성능(thinking 최소화) 동시달성.
- **라이브에서만 드러난 버그**: 즉시 hotfix(경로, PEM, 트랜잭션) → 커밋으로 기록.
- **MCP 깊이 문제**: 1212로 분리·문서화 → "다음 세션은 이 정보로 시작"하도록.

---

## 8. 세션 요약

**이번 세션은 "계획→구현→라이브 검증→정리"의 풀 사이클이었습니다:**
- Sprint 12 오케스트레이션으로 3트랙 통합(dff30bc).
- COST-1/2(Gemini) + TASK-1201(인증) + TASK-1211(웹훅) 전구간 구현(17커밋).
- ngrok PR #78 시연으로 실 flow 증명 + 라이브 버그 5건 발견·수정.
- 다음 세션은 TASK-1212(MCP) 또는 12D Phase2(원가 계측) 선택지 확보.

**형상**: feat/sprint12에 구현 완료 · main 계획문서 · 작업트리 clean · 머지 준비 완료.

