# [2026-06-24] Sprint 14 실행 + 백로그 체크리스트 코드검증 감사

**브랜치**: `main`
**작업 범위**: Sprint 14 계획·실행(Stage 1+2) + 완료 스프린트(8~14) 백로그 체크리스트 코드검증 감사 + Sprint 14B 정리
**스프린트**: Sprint 14 (검증된 AI) — 코드 완료 / 백로그 위생 작업
> 직전 세션 로그(`2026-06-21_ast-pre-filter-review.md`, `acf1492`) 이후 ~ `476ab30`까지(10커밋).

---

## 1. 완료 작업

### Sprint 14 — "검증된 AI" 계획·실행 (코드 완료)
| 단계 | 산출 | 커밋 |
|------|------|------|
| 계획 | `/sprint 14` PM+Dev → `sprint-14.md`. 코어 VAL-4(L)+1401(M)+1402(M), 나머지(1403/VAL-5/8/9/13/16) 이월 | `290ea27` |
| Stage 1 | VAL-4(proven_exploitable 하니스) ∥ TASK-1401(패치 자동 PR, PR-only) | `bcf3804`(+`739a100`) |
| Stage 2 | TASK-1402(패치 검증, Docker 샌드박스, Python+pytest 한정) + getFileSha | `11510ac`(+`ab8e398`) |
- 각 Stage: 병렬/단독 Dev → 자동테스트 그린 → Reviewer **PASS**(블로커 0) → 커밋. 상세는 `sprint-14.md`.

### 백로그 체크리스트 코드검증 감사 (앞부분 미체크 청산)
- **status 포인터 정정**(`4a40e5f`): 내가 "다음=Sprint 13 Stage 2"로 잘못 안내 → 실제 Stage 2(VAL-2)는 이미 `908c7eb`(2026-06-18) 완료였음. "Sprint 13 전체 완료, 다음=Sprint 14"로 정정.
- **완료 스프린트 미체크 항목 체크**(`5696e61`,`7572f14`,`e31544d`): **반드시 코드 실측 후** 체크.
  - TASK-1106(API 패널): 중복·깨진 체크리스트 정리 + 전 항목 체크(`api_discovery_node`/`scan_files file_filter`/`StartAnalysisRequest.fileFilter`/FE 실측). DTO명 `StartAnalysisRequest`로 정정.
  - TASK-1204(토큰비용): 헤더는 완료인데 박스 미체크 → 콜백/V054/TokenUsageService/Chart/누적테스트 실측 체크. (80% 경고메일 미구현·실콜백 수동은 유지)
  - TASK-1101 onboarding workspace-mode API 연동, Sprint 11 수동항목(1100/1102/1103/1105) 체크.
  - sprint-9: Prometheus/GDPR/모니터링(SslCertChecker·CveReMatch)/VSCode/Android 실측 체크. sprint-10: Check Run(`completeCheckRunAfterAnalysis`, 실 PR #78) 체크.
- **Sprint 14B(EPIC-AI-V2) 정리**: 코드 실측 결과 **4종 전부 미구현**(personas/persona_loader/estimated_cost_usd/review_patch_node/BaseState) → 미체크 유지. 붙여넣기 오타(`pps/`→`apps/`, `patch_node → review_patch_node`) 정정.

---

## 2. 의논 내용 & 결정 맥락

- **수동검증 일괄 처리**(사용자 결정): Stage 1·2의 런타임 검증(WebGoat·실 PR·Docker)을 스프린트 말에 몰아서. Stage마다 멈추지 않고 코드+자동테스트+Reviewer까지만 진행.
- **앞당길 항목(pull-forward) = 없음**: Sprint 14B/15~18 후보(1411~1414·OPS-005)는 **코드 미구현**이라 당기지 않음. 사용자 의도 = "투기적 우선순위 변경이 아니라, **이미 구현된 것**을 순서대로 보고 싶음". later sprint의 실제 구현물은 Loki(1603)·Sentry(1804)뿐인데 이미 `🟢 완료`+Sprint 12 편입 참조로 정렬됨 → 재배치 불필요.
- **ZAP Critical 0건(sprint-8 완료기준)**: 사용자가 한 번 체크했으나 "애매, 테스트 필요시 추가로 하겠다" → **수동 ZAP 스캔 미실행 = 코드검증 불가**이므로 미체크(대기)로 환원(`476ab30`). 백로그 TASK-1203b line과 일치.
- **체크 원칙**: 구현 항목은 코드 실측 후 체크 / `sendTokenLimitWarning`처럼 코드에 없는 것·🔬 런타임 수동·MCP 미동작(TASK-1212)·k6/ZAP 수동 스캔은 정직하게 미체크 유지.

---

## 3. 버그 수정 / 특이사항

- 신규 버그 수정 없음(이번 세션은 Sprint 14 구현은 Dev 위임 + 백로그 감사).
- **특이사항(프로세스)**: status 포인터에 "다음=Sprint 13 Stage 2"라 잘못 적어 `/stage 2`를 돌릴 뻔함 → sprint-13.md 확인으로 **이미 완료(`908c7eb`)** 발견·중단·정정. 교훈: 스테이지 실행 전 sprint-{N}.md의 실제 완료 기록을 먼저 확인.
- 사용자 병행 편집(sprint docs·메모) 존중 — `git add`는 대상 파일만 지정, 추적 안 된 사용자 문서(`memo/architecture-v2-plan.md`, `user_test_scenario.md`)는 미터치.

---

## 4. 트러블슈팅 대상 이슈

신규 트러블슈팅 문서 없음(디버깅/원인추적 이슈 없었음 — 계획·실행·문서 위생 작업).

---

## 5. 다음 세션 — 누적 수동 검증 (스프린트 말 일괄) + 이후

**수동 검증 큐 (런타임 필요):**
- VAL-4: WebGoat 기동 → proven 실증(SQLi/XSS) + scorecard + **데모 영상**
- TASK-1401: 테스트 레포 실 PR 등록+코멘트 / auto-merge 안 됨 / 기존파일 PR 409 미발생(getFileSha)
- TASK-1402: `pytest tests/sandbox/ -m integration` (Docker) → 문법에러→FAILED/정상→VERIFIED / FE 배지
- **ZAP Critical 0건**: `make zap-scan`(TASK-1203b 하니스)로 Sprint 8 부채 청산
- (기존) 토큰 한도 403, k6 p95<500ms 등 🔬 항목

**이후 작업:** 수동검증 통과 → **EPIC-ECON**(토큰 경제성, VC ③) 정식 착수 또는 Sprint 15. AST 사전필터 `AST_PRE_FILTER_ENABLED` 활성화 전 VAL-1 recall 측정.
