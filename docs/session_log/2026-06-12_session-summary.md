# [2026-06-12] Sprint 12C/12D 계획 + 멀티-프로바이더(Gemini) 방향 + 브랜치 정리

**브랜치**: 계획=main / 구현=feat/sprint12(신규) / 테스트=test/to_sprint11
**모델**: Claude Opus 4.8
**범위**: (2026-06-11 SAST 실행·실데이터 연동 이후) 빌드 그린화 → Sprint 12C(분석UX)·12D(멀티프로바이더 원가) 2건 계획 → 로컬LLM/Gemini Flash 방향 합의 → 브랜치 3분할 정리

---

## 1. 빌드/테스트 그린화 (`be78682`)
- 병합 후 프론트 **tsc 5건 타입에러**(useSecureStore `sendChat` 인터페이스 누락, AppHeader `CommitSecretScanModal` 오타, useAuthStore.test `workspaceMode` 픽스처 등) 수정 → tsc 0 + 프론트 68 passed. 백엔드 BUILD SUCCESSFUL, ai_engine 407 passed(28 errors=Windows async 격리 플레이크).
- 진행률/분석이력 UI + 랜딩·인증(AuthRedirect) + VulnerabilityService 보정 함께 커밋. `backend_logs.txt`(2.6MB 로그덤프) gitignore.

## 2. Sprint 12C (EPIC-STAGE "분석 UX") 계획 — `fd0e258`
사용자 제안: 전체 파일 선읽기 → **구조/허브 우선 + 계획 컨펌 + stage별 점진 노출**.
- STAGE-1 stage 완료 시 점진 취약점 노출(데이터·이벤트 이미 존재, 저비용) / STAGE-2 계획 컨펌 게이트(LangGraph interrupt) / STAGE-3 API-허브 우선 lazy.
- **Dev 핵심 정정**: `interrupt_after` 도달 시 **`GraphInterrupt` 예외 발생**(별도 catch), `graph.aupdate_state(as_node=...)`, 싱글턴 캐시 분리, filePaths POST화, STAGE-3 api_groups 회귀방지, SessionStatus AWAITING_CONFIRMATION, EPIC-VAL과 graph_builder 충돌→순서 의무.

## 3. Sprint 12D (EPIC-COST "멀티-프로바이더 + 원가") 계획 — `1e6ae18`
크레딧 고갈 반복 → **멀티-프로바이더 LLM + 원가 통제**가 즉시 우선순위로.
- COST-1 프로바이더 추상화/팩토리 + AUDIT→Gemini 라우팅 / COST-2 Gemini vs Claude 품질벤치 / COST-3 토큰원가 계측(=1204 확장, provider 인지) / COST-4 멀티-프로바이더 BYOK UI.
- **PM 발견**: ECON-1(프롬프트 캐싱)은 `claude_client`/`chat_client`에 **이미 구현** → 폐기, 계측만 COST-3 흡수. 캐싱은 Anthropic 전용(Gemini 미적용).
- **Dev 필수보완**: `openai` 패키지 추가(현재 anthropic만), Gemini OpenAI호환은 system을 messages로·`cache_control` 제거·usage 정규화(prompt/completion→input/output), provider 시그니처 체인+mock 6개, COST-3 **세션집계 콜백**(파일별 200콜 회피), Flyway V052(token_usage) 충돌 재조정, **AUDIT 키없음→haiku 폴백**, AnalysisClient 인터페이스 확장.
- **G0 사전검증 게이트**: COST-1 전에 **Gemini 실호출 1회**(`AsyncOpenAI(base_url=.../v1beta/openai/)`) + **`.env` 키형식 확인**(`GEMINI_API_KEY=AQ.Ab8...` — 표준은 `AIza...`라 의심, 401이면 재발급).

## 4. 로컬 LLM / 프로바이더 방향 (논의·결정)
- 사용자 노트북: **RAM 32GB / Intel GPU(전용 GPU 없음)** → 로컬 LLM은 CPU로 7B(Q4)까지 가능(느림·무료, AUDIT용). 전용 GPU 없어 큰 모델 비현실적.
- **결정**: 크레딧 비용 회피엔 로컬보다 **싼/무료 클라우드 API가 유리** → **Gemini Flash 채택**(Google AI Studio 무료티어, One Pro와 별개). 사용자 키 발급·`.env` 등록 완료.
- 통합: Gemini=OpenAI 호환 엔드포인트 → ai_engine에 OpenAI 클라이언트, scan_mode **AUDIT=Gemini(저렴)/PIPELINE=Claude(정밀)** 하이브리드. (= Sprint 12D)
- **프라이버시 주의**: Gemini 무료티어는 입력을 학습에 쓸 수 있음 → 민감코드는 유료/공개레포만.

## 5. 브랜치 정리 (요청 반영)
- 발견: 작업 중 브랜치가 `main`이 아니라 **`test/to_sprint11`**(Sprint 11 테스트용)로 전환돼 있었음 → `git push origin main`이 "up-to-date"로 헷갈림(로컬 main 안 바뀌어서). 추가로 git 전역 `credential.helper`에 **`manager`+`manager-core` 둘 다** 설정, `manager-core`는 없는 명령이라 경고 → `manager`만 써서 push 해결.
- **정리(사용자 합의)**: **계획→main, 구현→신규 `feat/sprint12`, 테스트→test/to_sprint11 유지**.
  - 미커밋 테스트 작업(test_sprint11.py·EVALUATION_GUIDE·test_evaluation_metrics·UserControllerTest) → `test/to_sprint11`에 커밋(`f4bc49b`).
  - Sprint 12D 계획(`1e6ae18`)만 **main으로 빨리감기 + push**(`fd0e258..1e6ae18`).
  - **`feat/sprint12`** 를 main에서 생성(구현용).
- **현재 상태**: main(=1e6ae18, origin 동기화)·feat/sprint12(=1e6ae18)·test/to_sprint11(=f4bc49b). 사용자가 UI 테스트 중이라 test/to_sprint11로 복귀(테스트 스크립트 복원). **프론트 소스는 세 브랜치 거의 동일 → UI 테스트 무영향.**

## 6. 의논·결정 요약 (왜)
- **계획 main / 구현 feat 분리**: git-workflow 룰(이번 세션 신설)대로 — 계획문서는 추적성 위해 main, 구현은 격리 브랜치.
- **Sprint 12D 신설**: 크레딧 블로커가 12(보안)·12C(UX)·13(VAL) 어디에도 안 맞음 → 독립 원가 트랙.
- **ECON-1 폐기**: 캐싱이 이미 구현돼 있어 신규 태스크 불필요(실측). 1204→COST-3 흡수.
- **Gemini 채택 > 로컬**: Intel GPU 한계 + 비용회피 목적엔 무료 클라우드(Flash)가 품질·편의 우위.

## 7. 이번 분량 커밋
| 커밋 | 브랜치 | 내용 |
|------|--------|------|
| `be78682` | main | fix(frontend): 진행률/이력 UI + 타입에러 5건 |
| `fd0e258` | main | docs(sprint): Sprint 12C 계획 |
| `1e6ae18` | main | docs(sprint): Sprint 12D 계획 |
| `f4bc49b` | test/to_sprint11 | test(sprint11): 평가/검증 스크립트 |
> 이 세션로그는 현재 test/to_sprint11에 작성(UI 테스트 방해 회피) — main 이동은 추후.

## 8. 다음 세션에서 할 것
- [ ] **구현 시작**: `git switch feat/sprint12` → **G0 검증(Gemini 실호출 + `AQ.` 키 형식 확정)** → 통과 시 **`/stage 1`** (Sprint **12D** COST-1+COST-2). ⚠️ /stage가 12C/12D 중 **12D를 타겟**하도록 지정 필요.
- [ ] 401 등 키 문제 시 AI Studio에서 `AIza...` 키 재발급.
- [ ] (선택) credential 정리: `git config --global --unset credential.helper manager-core`.
- [ ] (선택) 이 세션로그·test 작업분 main 반영 시점 결정.
- [ ] 우선순위: 12D Phase1(Gemini) → Sprint 12 TASK-1201(GitHub App 블로커) → 12D Phase2 → 12C → 13.
</content>
