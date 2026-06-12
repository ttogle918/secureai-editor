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

## 5. 형상 상태(세션 종료 시)

| 항목 | 상태 |
|------|------|
| **main** | 계획문서만(sprint-12.md) · origin 동기화 |
| **feat/sprint12** | 17커밋 · origin/main 이후 · 구현 완료(1201+1211+COST-1+COST-2) |
| **작업트리** | clean |
| **데모 아티팩트** | PR #78 open · demo/webhook-sast 브랜치 · ngrok 임시 URL 가동 중 |
| **컨테이너** | backend/ai_engine(feat/sprint12 빌드) + postgres/redis 실행 |
| **.env** | gitignore · 실 Gemini 키 + GitHub App PEM 경로 포함(로컬) |

---

## 6. 커밋 요약(17개, 일부 목록)

| 해시 | 브랜치 | 메시지 | 주요 변경 |
|------|--------|--------|---------|
| dff30bc | main | docs: Sprint 12 통합 마스터 계획 | docs/sprints/sprint-12.md 신설 |
| 75a9ca9 | feat/sprint12 | feat: LLMProvider protocol + Gemini 라우팅(COST-1) | ai_engine/core/llm_provider.py |
| ece54a4 | feat/sprint12 | refactor: reasoning_effort="none"으로 thinking_config 교체 | Gemini 호환성 |
| a48871c | feat/sprint12 | test: Gemini provider 통합테스트(품질벤치, COST-2) | tests/integration/test_gemini_provider.py |
| ffba377 | feat/sprint12 | feat: GitHub App JWT + 설치토큰 교환(TASK-1201) | backend/.../app_service.py |
| b4018bc | feat/sprint12 | fix: JWT exp 540s 시계스큐 마진 | JWT validation |
| 8d37d2e | feat/sprint12 | feat: PR 웹훅 → AI 분석 디스패치(TASK-1211) | handlePullRequest 배선 |
| e795f99 | feat/sprint12 | fix: 웹훅 경로 `/api/v1/webhooks`로 보안 라우팅 | SecurityConfig |
| 9cc45b5 | feat/sprint12 | refactor: GitHub App PEM 파일마운트(docker-compose) | volumes 추가 |
| a387c3b | feat/sprint12 | fix: docker-compose env 전달 + 이미지 재빌드 | ci/docker-compose.yml |
| 9bb9159 | feat/sprint12 | fix: AnalysisSession 미생성(V051 트랜잭션) | transaction scope |
| a3a3d49 | feat/sprint12 | docs: TASK-1212 MCP github 도구 백로그 추가 | .claude/agents/dev.md |

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

