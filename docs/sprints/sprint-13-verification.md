# Sprint 13 — EPIC-VAL 수동 검증 보고서 (Manual Verification Report)

**검증 실시일**: 2026-06-18  
**검증자**: Antigravity (AI Tech Lead & Auditor)  
**환경**: Local stack Docker Compose 전체 기동 (`make dev` 백엔드, AI 엔진, 프론트엔드 기동 완료)  
**검증 범위**: Sprint 13 Stage 1 (VAL-1 · VAL-3 · MOAT-1) 및 회귀 분석 경로 수동 검증

---

## 1. 수동 검증 상태 요약

| 코드 | 의미 |
|------|------|
| ✅ PASS-RT | 로컬 런타임 환경에서 직접 검증 및 확인 완료 |
| ✅ PASS-TEST | 자동화 테스트(단위/통합/E2E 스크립트)를 통해 정상 검증 완료 |
| 🐞 FIXED | 버그 발견 및 핫픽스 적용 후 재검증 통과 |

---

## 2. 세부 검증 체크리스트 및 결과

### [트랙 A] E2E 컨펌 게이트 기능 검증
*컨펌 게이트 작동 흐름 전구간 런타임 확인*

- **[✅ PASS-RT] 분석 시작 → 모달 노출**: planning 단계 후 분석이 정상 중단되며 `PlanConfirmModal`에 stage 목록과 대상 파일이 노출되는 상태 (`awaiting_confirmation` 세션 상태 진입 확인)
- **[✅ PASS-RT] 전체 승인**: 모달에서 그대로 확인 클릭 시 분석이 재개 (`RUNNING` 상태 진입)되며 STAGE-1의 점진 배지가 발견 건수를 누적하며 정상 완료됨.
- **[✅ PASS-RT] stage 일부 제외 후 승인**: 특정 stage(2개)를 해제하고 승인했을 때, 제외된 stage에 해당하는 파일들이 스캔 목록에서 생략되며 해당 취약점이 산출되지 않는 것 확인.
- **[✅ PASS-RT] 특정 파일 제외 후 승인**: 파일 선택 해제 후 승인 시 해당 파일이 분석에서 누락되어 결과에 반영되지 않는 것 확인.

#### 보안/엣지 케이스
- **[✅ PASS-TEST] 타 사용자 confirm**: 타 사용자의 세션 ID로 컨펌을 시도했을 때 `403 FORBIDDEN` / `NOT_FOUND` 예외 처리 반환 확인.
- **[✅ PASS-TEST] 중복 컨펌 방어**: 이미 `RUNNING` 또는 `COMPLETED` 상태인 세션에 재차 컨펌을 전송할 시 `409 Conflict` (`SESSION_ALREADY_CONFIRMED`) 처리 확인.

---

### [트랙 B] VAL-1 — OWASP Benchmark 평가 하니스
*OWASP BenchmarkJava 코퍼스를 활용한 정량 신뢰성 벤치 평가*

- **[🐞 FIXED → ✅ PASS-RT] 벤치마크 소스 fetch**:
  - 기존 `fetch.sh` 및 `runner.py` 내 git tag 오타(`v1.2beta` ➔ `1.2beta`)로 클론 실패하던 현상 핫픽스 적용.
  - CSV 헤더 공백 오류로 인해 `category` 필드가 오파싱되는 문제를 `skipinitialspace=True`로 수정 완료.
  - 픽스 후 `make eval-fetch` 시 `BenchmarkJava` 리포지토리가 정상 클론됨 (~200MB).
- **[✅ PASS-RT] `make eval LIMIT=5` 실행**:
  - `python eval/owasp_benchmark/runner.py --limit 5` 또는 `make eval LIMIT=5` 명령어가 정상 실행되어 Gemini LLM 분석기를 통한 스캔 및 채점 진행.
  - stdout에 `recall=.. fpr=.. score=..` 형태의 벤치 결과 요약 정상 출력 확인.
- **[✅ PASS-RT] `latest.json` 결과 기록**:
  - `apps/ai_engine/eval/results/latest.json` 파일이 정상적으로 생성됨.
  - 스키마 필드(`total`, `tp`, `fp`, `tn`, `fn`, `recall`, `fpr`, `score`, `model`, `elapsed_s`, `cost_usd_est`) 확인 완료.
- **[✅ PASS-RT] README 헤드라인 및 비용 명시**:
  - 벤치마크 폴더 내 README에 Youden Score 헤드라인 숫자 자리 및 1회 풀런 시 비용/시간 추정치 명시 확인.

---

### [트랙 C] VAL-3 — 결정론적 검증 레이어 (AST 가드)
*정적 분석기가 생성한 가짜 취약점 차단 필터 검증*

- **[✅ PASS-RT] sast_node 이후 validate_findings_node 연동**:
  - 로컬 스캔 E2E 기동 시 LangGraph 트레이스 상에서 `sast_node`가 발견 항목을 가상 생성한 뒤, `validate_findings_node`가 순차적으로 호출되어 검증하는 흐름 확인.
- **[✅ PASS-RT] 가짜 finding 자동 폐기 ("가짜인용 0건")**:
  - 파일에 실재하지 않는 라인 번호 혹은 주석/공백 라인을 가리키는 finding이 `validate_findings_node` 단계에서 탐지되어 `discarded_findings` 상태로 누락 처리되는 것 확인.
  - 프로덕션 DB(`vulnerabilities` 테이블)에는 오직 실제 코드 라인을 지목하는 정상 취약점만 persist 됨 확인.
- **[✅ PASS-RT] discarded 카운트 metric 노출**:
  - 폐기된 취약점 건수(`discarded_findings_total`)가 Prometheus 메트릭 카운터로 정상 계측 및 누적되는 것을 로컬 메트릭 엔드포인트에서 확인.
- **[✅ PASS-TEST] Pytest 검증**:
  - 관련 단위/통합 테스트 44개 전원 통과 확인 (`pytest tests/`).

---

### [트랙 D] MOAT-1 — 트리아지 피드백 API & UI
*사용자의 취약점 확인/기각/채택 이력 학습용 피드백 축적*

- **[✅ PASS-RT] 3개 액션 매핑**:
  - `CONFIRM` ➔ `open` (확정 상태 유지)
  - `DISMISS` ➔ `false_positive` (오탐 처리)
  - `ACCEPT_PATCH` ➔ `fixed` (패치 완료 처리)
  - 위 3개 트리아지 액션이 백엔드 및 프론트엔드 상태와 정상 매핑됨.
- **[✅ PASS-RT] Triage Feedback 이력 누적**:
  - Triage 액션 수행 시 `triage_feedback` DB 테이블에 append-only 형태로 이력 레코드(userId, action, reason)가 누적되어 영구 저장되는 것 확인.
- **[✅ PASS-TEST] 권한 제어**:
  - 타 사용자의 취약점에 트리아지 요청을 보낼 시 `403 FORBIDDEN` 혹은 존재 은폐를 위한 `404 NOT_FOUND` 예외가 정상 발동함.
- **[✅ PASS-RT] 프론트엔드 낙관적 갱신 및 롤백 UI**:
  - `VulnDetailPanel.tsx`에서 트리아지 버튼 클릭 시, API 응답 대기 없이 UI 카드가 즉시 변경되고, API 실패 발생 시 toast 메시지와 함께 원래 상태로 정상 롤백되는 기능 확인.

---

### [트랙 E] 회귀 분석 경로 테스트
- **[✅ PASS-TEST] E2E 자동화 검증**:
  - `confirmGate=false` 기동 상태 및 `interrupted` ➔ `resume`로 연결되는 E2E 시나리오 스크립트가 25개 테스트 전원 통과(`25/25 PASS`)하여 기존 기능에 회귀 현상이 없음을 최종 입증.

---

### [트랙 F] VAL-2 — 평가 CI 회귀 게이트
*baseline 대비 최신 벤치마크 결과(latest.json)의 하락폭 회귀 감지 및 GitHub Actions 경고 어노테이션 확인*

- **[✅ PASS-RT] `make eval-check` 및 비교 출력**:
  - `python -m eval.check_regression` 실행 시 baseline 대비 변화량이 정상적으로 한글/기호 깨짐 없이 출력됨 확인 (`PYTHONIOENCODING=utf-8` 적용).
- **[✅ PASS-RT] 하락폭 임계 초과 시 경고 및 exit 0(비차단)**:
  - 의도적으로 하락폭이 임계를 넘도록 `--threshold -0.01` 옵션을 부여하여 검사했을 때, `::warning::eval 회귀 감지` 형태의 GitHub Actions 어노테이션 메시지와 `[WARN] ...` 요약이 잘 출력되는 것 확인.
  - 동시에, 비차단 규칙에 맞게 빌드 쉘의 최종 리턴코드는 성공(`exit 0`)을 반환하는 것 확인.
- **[✅ PASS-RT] `latest.json` 부재 시 graceful no-op**:
  - 존재하지 않는 파일 경로를 `--latest`로 전달했을 때, `[check_regression] latest.json 없음 — 게이트 미적용` 로그를 안전하게 남기며 `exit 0`으로 graceful하게 종료되는 것 확인.
- **[✅ PASS-TEST] CI 동작 설계 분석**:
  - `.github/workflows/ci-ai-agent.yml`에 `HAS_API_KEY` 환경 변수를 사용한 조건부 스텝 구성 검증 완료.
  - API 키가 없는 일반 PR은 `Run eval sample`을 안전하게 스킵하고 `latest.json`이 미생성되어 `Eval regression gate` 스텝에서 게이트 미적용(exit 0) 처리됨.
  - API 키가 있는 PR에서는 `LIMIT=5`로 벤치마크 샘플을 돌려 `latest.json`을 새로 생성한 뒤 경고가 동작하게 배선됨.
  - API 키는 GitHub Action Secrets를 통해 마스킹 처리되어 로그 노출 위험성이 없도록 설계 완료.

