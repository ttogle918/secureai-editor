# [2026-06-18] 작업 세션 요약

**브랜치**: `feat/sprint12C-stage2-plan-confirm-gate`  
**작업 범위**: Sprint12C STAGE-2(컨펌 게이트) 수동 E2E 25/25 PASS 검증 + 발견 버그 4건 수정 + Reviewer 게이트 통과 후 커밋  
**스프린트**: Sprint12C STAGE-2

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| 컨펌 게이트 전 구간 수동 E2E 검증 (25 케이스 100% PASS) | test-scripts/20260617_confirm_gate_e2e.py (신규) |
| LangGraph interrupt 상태 미감지 버그 수정 | apps/ai_engine/api/routes/analyze.py |
| AI Engine 4xx 응답 보안 처리 강화 | apps/backend/.../DefaultAiAgentClient.java |
| Redis DB 인덱스 분리 | apps/backend/src/main/resources/application.yaml |
| status 컬럼 길이 확장 | V059__alter_analysis_sessions_status_varchar.sql (신규) |

---

## 2. 의논 내용 & 결정 맥락

- **Reviewer 게이트 순서**: 소스 변경(4건 버그 수정)이 포함되어 있어 git-workflow.md 규칙(소스 변경=Reviewer PASS 후 커밋)에 따라 Reviewer를 먼저 수행.

- **DefaultAiAgentClient confirmPlanFallback 보안 위반 (1차 FAIL)**:
  - 문제: 원본은 `hcee.getResponseBodyAsString()`으로 AI Engine 4xx 응답 본문을 raw로 BusinessException에 전파 → 향후 detail 필드에 내부경로/스택트레이스가 포함되면 사용자 에러 메시지로 노출되는 구조적 보안 위반 (general.md "에러 처리" 규칙 위반)
  - 검토된 대안:
    - A. detail 필드만 파싱 → **채택**
    - B. 전체 응답을 로그만 하고 기본 에러 메시지 반환 (정보 손실)
  - 결정: Reviewer 권고 A 채택. ObjectMapper로 detail 필드만 추출, 파싱 실패 시 null → INVALID_INPUT 기본 메시지로 폴백.
  - 검증: compileJava 통과 확인.

- **E2E 수행 맥락**:
  - 테스트 계정: e2etest1@secureai.com
  - 테스트 프로젝트: ee604167-2b86-42cb-8da3-a7453cdd6cb9
  - 발견 버그 4건 모두 TC-01~TC-09 실행 과정에서 현장 검증 후 즉시 수정.

---

## 3. 버그 수정 / 특이사항

**3.1 LangGraph interrupt 상태 미감지 (TC-01 반복 재현)**  
상세 트러블슈팅: [docs/troubleshooting/2026-06-18_langraph-interrupt-state-detection.md](../troubleshooting/2026-06-18_langraph-interrupt-state-detection.md)

**3.2 Redis DB 인덱스 분리 (설정 정리)**  
기존: 로컬 Redis 기본 DB(0) 사용 → 배포 환경과 불일치  
수정: `application.yaml`에 `redis database: ${REDIS_DATABASE:1}` 추가하여 DB 인덱스 명시

**3.3 status 컬럼 길이 부족 (V059 마이그레이션 신규)**  
문제: analysis_sessions.status VARCHAR(20) → AWAITING_CONFIRMATION(21자) 초과  
수정: V059__alter_analysis_sessions_status_varchar.sql로 VARCHAR(50) 확장

**3.4 스크래치 파일 제외**  
workspace-e2e/test.php(E2E 검증 중 작성된 취약 PHP 스크래치 파일)는 커밋 대상에서 제외

---

## 4. 다음 세션에서 할 것

- [ ] Sprint12C STAGE-3 진행 (다음 스테이지 이어가기)
- [ ] feat/sprint12C-stage2-plan-confirm-gate 브랜치 main 머지 여부 판단 (STAGE-2 완료 상태)

---

# [2026-06-18 · 두 번째 묶음] Sprint 13 EPIC-VAL Stage 1

**브랜치**: `feat/sprint13-val`  
**작업 범위**: Sprint12C STAGE-2 main 머지 후, Sprint 13 EPIC-VAL Stage 1(VAL-1·VAL-3·MOAT-1) 3-way 병렬 구현·검증·머지 완료  
**스프린트**: Sprint 13 EPIC-VAL STAGE-1

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| VAL-1: OWASP Benchmark 평가 하니스 | apps/ai_engine/eval/owasp_benchmark/{fetch.sh, runner.py, latest.json} |
| VAL-3: 결정론적 검증 레이어 + AST 가드 | apps/ai_engine/sast/graph/{agent_state.py, save_node.py, validate_findings_node.py} + python/java/typescript 파서 |
| MOAT-1: 트리아지 PATCH API + UI | apps/backend/src/.../Vulnerability*Controller.java + apps/frontend/components/VulnStatus.tsx |
| 마이그레이션 + .gitignore | V060__triage_feedback_schema.sql, .gitignore (BenchmarkJava·eval/results·workspace-e2e) |
| 단위 테스트 | VAL-1(76), VAL-3(44), MOAT-1(13) — 모두 그린 |

---

## 2. 의논 내용 & 결정 맥락

- **스테이지 순서 결정(사용자 컨펌)**:  
  계획서(2026-05-31) 전역 순서: `STAGE-2 → Sprint13 EPIC-VAL → STAGE-3`.  
  STAGE-3는 VAL-3와 api_discovery_node/graph_builder 간 파일 충돌 위험.  
  사용자가 두 옵션 제시 (a) 계획 순서 준수(EPIC-VAL 먼저), (b) STAGE-2 지금 머지 선택.  
  → (a) 선택. STAGE-3는 보류, EPIC-VAL 착수.

- **Flyway 마이그레이션 번호 정정**:  
  계획서 MOAT-1: V052 지정 → 그 사이 마이그레이션 진행(V059까지) → V060 사용하도록 수정 지시.  
  이유: 마이그레이션 번호는 순차적 일관성 필수.

- **Reviewer 게이트 (1차: Stage 1 본 구현)**:  
  PASS. 블로커 0, 권고 3:  
  - #1 BENCHMARK_TAG 상수화 → 즉시 반영 (1da87a5)
  - #2 FE VulnStatus 타입 불일치(enum 매핑) → 다음 스테이지 이월(매핑 결정 필요)
  - #3 미사용 tabulate import 제거 → 즉시 반영 (1da87a5)

- **Reviewer 게이트 (2차: eval 핫픽스)**:  
  PASS. 권고 2:  
  - env 키 상수화(EVAL_PROVIDER/EVAL_MODEL) → 반영 (1da87a5)
  - latest.json model을 실제 eval 모델로 기록 → 반영 (1da87a5)

- **VAL-1 Gemini provider 수동검증**:  
  eval 하니스가 기본(analyze_for_sast 기본 provider)로만 실행되어, 평가 AI 모델 선택 불가.  
  env 전달 구조 추가로 EVAL_PROVIDER/EVAL_MODEL을 runner에서 읽도록 정정 (트러블슈팅 참고).

- **3-way 병렬 파일 격리**:  
  - VAL-1: eval/owasp_benchmark/{fetch.sh, runner.py, requirements-eval.txt}
  - VAL-3: sast/graph/{agent_state.py, save_node.py, validate_findings_node.py} + 파서들
  - MOAT-1: Vulnerability*Controller.java, triage_feedback(V060) + FE (VulnStatus.tsx, requirements.txt별도)
  → 충돌 0. 병렬 PASS.

---

## 3. 버그 수정 / 특이사항

**3.1 VAL-1 eval 하니스 실행 실패 (3개 이슈)**  
상세 트러블슈팅: [docs/troubleshooting/2026-06-18_val1-eval-harness-fixes.md](../troubleshooting/2026-06-18_val1-eval-harness-fixes.md)

---

## 3.5 Sprint 13 EPIC-VAL Stage 2 (VAL-2 평가 CI 회귀 게이트)

단일 태스크 스테이지. Dev → Tester PASS → Reviewer(FAIL→수정→PASS) → 커밋 → 수동검증(트랙 F) 통과.

**완료 작업 (커밋)**
- `908c7eb` feat(VAL-2): `eval/check_regression.py`(baseline.json vs latest.json의 score/recall/fpr 하락폭 임계 −2%p 비교 → `::warning::` 비차단·항상 exit 0, 파일누락 graceful, by_category 회귀 표기, LLM 0콜) + `eval/baseline.json`(초기 시드 LIMIT=5) + `.github/workflows/ci-ai-agent.yml` eval 게이트 2 step 통합(별도 job 없음) + Makefile `eval-check` + README. 단위 20.
- `ed2843e` docs: Stage 2 완료기록 + 백로그 VAL-2 표식.
- `db93a02` docs: 수동검증 보고서 트랙 F + 완료게이트 갱신.

**의논/결정 맥락 (왜)**
- CI에서 매 PR LLM 풀 eval은 비현실적(비용·시크릿·rate limit·BenchmarkJava 154M) → check_regression은 파일비교만, 실제 eval은 키 있을 때만 LIMIT=5 조건부, 게이트 non-blocking.
- **Reviewer 1차 FAIL(블로커 2)**: (1) `if: ${{ secrets.X != '' }}` 직접비교 작동 불확실 → job env `HAS_API_KEY` 승격 후 `if: env.HAS_API_KEY=='true'`. (2) README/CI 주석이 "커밋된 latest.json" 전제인데 `eval/results/`는 gitignore라 커밋 불가 → 방식 B(생성물 미커밋) 채택, 문서를 "키 있을 때만 실효·일반 PR no-op"으로 정정. 수정 후 PASS. (SendMessage로 Dev 이어가기 불가 환경이라 소규모·기계적 수정은 마스터가 직접.)
- Tester가 argparse `%p`→`%%p` 이스케이프 버그 1건 수정.
- **baseline 한계**: LIMIT=5 시드라 통계 불안정 → 대표 런 후 갱신 필요(문서화된 비차단). 사용자가 백그라운드 eval 기동 중이며 `eval/results/latest.json`은 gitignore라 머지 비포함.

**형상관리**: Sprint 13 Stage 1·2 전체를 `feat/sprint13-val` → main 머지(세션 마지막 단계).

---

## 4. 다음 세션에서 할 것

- [ ] baseline 대표런 갱신(VAL-2 게이트 실효화): 백그라운드 eval 완료 후 `cp eval/results/latest.json eval/baseline.json` + 커밋
- [ ] 이월: FE VulnStatus enum ↔ 서버 타입 정규화 매핑 (Stage 1 Reviewer 권고 #2, 별도 fix)
- [ ] Sprint 12C STAGE-3(API-허브 우선 읽기) — EPIC-VAL 이후로 계획됐으므로 착수 가능
- [ ] VC 데모 숫자 확보(대표런 결과)
