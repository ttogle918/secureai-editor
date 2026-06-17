# Sprint 13 — ★EPIC-VAL (검증 우선) · 신뢰성 정량화

**계획 수립일**: 2026-05-31 (PM Opus 4.8 + Dev 현실성 평가)
**백로그**: V5.6 (VC 리뷰 대응 재포지셔닝)
**목표**: VC 지적 ③(신뢰성 검증 부재) 정면 대응 — "AI가 잘 찾습니다"(추상)를 **정량 숫자 + 결정론적 검증**으로 전환.
**계획 상태**: 최종 확정 (Dev 평가 반영 — VAL-4 이월, VAL-3 스코프 확정, Flyway 재배정) — **시작점 `/stage 1`**

---

## 핵심 결정 (Dev 평가 반영)

| 쟁점 | PM 초안 | Dev 평가 | 확정 |
|------|--------|---------|------|
| 용량 (L×2) | VAL-3+VAL-4 동시(경계선) | **VAL-4 이월 권고(A)** — 5개 신규 레이어, B(SQLi 데모)는 Sprint 6 단건과 차별점 없음 | **VAL-4 → Sprint 14 선두 이월.** Sprint 13 = VAL-1·VAL-3·MOAT-1·VAL-2 (L×1) |
| VAL-3 파서 | tree-sitter/javalang/ast | tree-sitter는 네이티브 빌드라 비현실적 | **Python=`ast`(stdlib) · Java=`javalang`(순수 py) · TS/JS=정규식 라인범위(MVP)**. deep source→sink는 Sprint 14 |
| VAL-3 검증 범위 | source→sink 검증 | save 위치 문제 + 범위 과대 | **MVP = "file:line 실재(라인 범위·비주석) 검증"**. source→sink 심층은 분리 |
| VAL-1 벤치 | 2,740 풀런 | 풀런은 스프린트 내 반복 불가 | **`--limit N` 샘플 모드(100~200)가 코어**, 풀런은 야간/릴리스 게이트 |
| Flyway | V050/V051 선점 | **V050/V051은 Sprint 12 TASK-1202a/1202b가 사용** | Sprint 13은 **V052부터** (MOAT-1=V052) |

---

## 사전 발견 사항 (실측 정정 — Dev 재확인)

| 항목 | 실측 상태 | 조치 |
|------|---------|------|
| `save_vulnerabilities()` 위치 | **`sast_node.py:236`에서 호출** (classify 직후, 저장 즉시) | VAL-3 "저장 전 폐기"는 노드 삽입만으론 불가 → **save 호출을 sast_node 밖(검증 후 persist)으로 이동** 필요. cache_check(히트 시 sast 스킵)·next_file 연동 확인 |
| 그래프 구조 | scan→api_discovery→cache_check→**sast_node**→next_file→aggregate→patch→END | VAL-3 `validate_findings_node`를 sast↔next_file 사이 + save 이관 |
| DAST | **별도 그래프** `dast_graph_builder` + 단건 `/agent/dast/start` | VAL-4(이월) 오케스트레이션 신규 |
| `Vulnerability` status | `open/fixed/false_positive` (`Vulnerability.java:82-85`, FE `types/index.ts:22`) | MOAT-1은 그린필드 아님. 단 "확인/채택" 값 추가 시 기존 필터 충돌 → **별도 `triage_feedback` 테이블(append-only)** + status는 기존 값 매핑 |
| AST 파서 | requirements.txt에 부재 | `javalang>=0.13.0` 1줄 추가(Java), Python ast는 stdlib |
| `make eval` | 없음 | VAL-1에서 신규 |
| Flyway 최고 | V049 + Sprint12가 V050/V051 예약 | Sprint 13 = **V052~** |

---

## Flyway 번호 예약
| 번호 | 태스크 | 파일명 | 비고 |
|------|--------|--------|------|
| V052 | MOAT-1 | `V052__create_triage_feedback.sql` | 트리아지 라벨 이력(독점 학습 데이터, append-only) |
| (V053 예약) | VAL-4(Sprint 14) | `V053__add_exploit_label_to_vulnerabilities.sql` | exploit_status 등 — Sprint 14에서 |

---

## 실행 계획

### Stage 1 — 병렬 (선행 없음, 공유 파일 격리)
| TASK | 제목 | 서비스 | 에이전트 | 사이즈 |
|------|------|--------|---------|--------|
| **VAL-1** 🔴 | OWASP Benchmark 평가 하니스 (`make eval`) | ai_engine | Dev+Tester | M |
| **VAL-3** 🔴 | 결정론적 검증 레이어 / AST 할루시네이션 가드 | ai_engine | Dev+Tester | **L** |
| **MOAT-1** 🟠 | 트리아지 피드백(확인/기각/채택) API+UI | backend+frontend | Dev+Tester | M |

### Stage 2 — 순차 (VAL-1 완료 후)
| TASK | 제목 | 선행 | 사이즈 |
|------|------|------|--------|
| **VAL-2** 🟠 | 평가 CI 게이트 (VAL-1 점수 → CI, TASK-1203 연계) | VAL-1(기준점 산출) | M |

**용량**: L×1(VAL-3) + M×3 → 경계선 이내. VAL-4 이월로 AI Engine 동시 수술 위험 제거.

### 공유 파일 소유권
- `sast_node.py`·`graph_builder.py`·`agent_state.py` → **VAL-3 단독** (VAL-1은 파이프라인 호출만)
- `requirements.txt` → VAL-3(`javalang`)·VAL-1(벤치 의존성) **각 별도 라인**, 먼저 머지하는 쪽 기준 rebase
- Backend `Vulnerability*`/FE `VulnDetailPanel` → **MOAT-1 단독**

---

## 태스크별 상세 구현 명세

### VAL-1 — OWASP Benchmark 평가 하니스 (M)
- **변경 파일**: `apps/ai_engine/eval/owasp_benchmark/{fetch.sh,runner.py,scorer.py}` (신규), `eval/README.md`, `Makefile`(`eval` 타겟), `requirements.txt`(채점 의존성)
- **인터페이스**: `make eval LIMIT=N` → stdout `recall=.. fpr=.. score=..` + `eval/results/latest.json{total,tp,fp,tn,fn,recall,fpr,score,model,elapsed_s,cost_usd_est}`. 채점 = OWASP `score=TPR−FPR` + **고정 recall 80%에서의 FPR**.
- **핵심 로직**: fetch.sh로 BenchmarkJava 고정 태그 클론 → `expectedresults*.csv` 정답 로드 → 케이스를 SAST 파이프라인 분석 → vuln_type↔CWE 매핑 → TP/FP/TN/FN 집계 → 지표. `LIMIT`으로 vulnType별 N건 샘플(코어 개발용), 풀런은 야간.
- **엣지/실패**: 레포 미존재→fetch 안내 후 비0 종료. 케이스 분석 실패→skip&log(FN 계상). rate limit→백오프+부분결과.
- **준수**: 개별 실패가 전체 중단 금지(general.md). 토큰/키 로그 금지. 매직넘버(0.8, 태그) 상수화.
- **DoD**: `make eval LIMIT=100` → 지표+latest.json / README 첫 숫자 / 매핑 단위테스트 / 풀런 비용·시간 명시.

### VAL-3 — 결정론적 검증 레이어 / AST 할루시네이션 가드 (L)
- **변경 파일**: `agent/nodes/validate_findings_node.py`(신규), `agent/validation/ast_verifier.py`+`parsers/{java,python,ts}.py`(신규), `agent/agent_state.py`(`validated_findings`,`discarded_findings`), `agent/graph_builder.py`(재배선), `agent/nodes/sast_node.py`(**save 호출 제거→검증 후 persist**), `requirements.txt`(`javalang`)
- **인터페이스**: `verify_finding(finding, file_content, language) -> {verified:bool, reason:str}`. **MVP 검증 = (1) file:line이 파일 범위 내 + 비주석/비공백 라인 실재**. (deep source→sink는 Sprint 14)
  - 파서: Python=`ast`, Java=`javalang`, TS/JS=정규식 라인범위. **미지원 언어 → 보류(verified=true)** — 거짓 폐기로 recall 훼손 금지.
- **핵심 로직**: sast_node가 findings 생성(저장 안 함) → validate_findings_node가 verify → `verified=false`는 `discarded_findings`로 이동(미저장), `verified=true`만 persist_node에서 `save_vulnerabilities()`. 폐기 건수 metric 기록(=가짜인용 차단 수, VC 숫자).
- **⚠️ save 이관**: sast_node 반환 계약 변경 → cache_check(히트 시 sast 스킵: 캐시된 결과도 검증 경유 여부 결정)·next_file 연동 확인 필수.
- **엣지/실패**: 파서 에러(문법 안 맞는 코드)→해당 파일 보류(통과)+log. line 없는 finding→file 존재만. **불확실 시 통과**(recall 보호). 경로 순회 방어.
- **준수**: 결정론적(LLM 미사용 — 비용 0·재현성). 개별 파일 오류 전체 중단 금지.
- **DoD**: 가짜 finding(없는 line/주석 라인)→폐기 단위테스트 / 실재 finding→통과 / Java·Python 검증 동작(TS/JS 정규식) / 미지원 언어 보류 / `discarded` 카운트 노출 / **저장된 findings는 모두 라인 실재("가짜인용 0건")**.

### MOAT-1 — 트리아지 피드백 UI(확인/기각/채택) (M)
- **변경 파일**: `V052__create_triage_feedback.sql`(신규), `domain/analysis/entity/TriageFeedback.java`(신규), `VulnerabilityController.java`(`PATCH /vulnerabilities/{id}/triage`), `VulnerabilityService.java`(`applyTriage`), FE `components/analysis/VulnDetailPanel.tsx`, `store/useSecureStore.ts`(낙관적 갱신)
- **인터페이스**: `PATCH /api/v1/vulnerabilities/{vulnId}/triage` (JWT) 바디 `{action:"CONFIRM"|"DISMISS"|"ACCEPT_PATCH", reason?:string}` → 200+VulnerabilityResponse. Controller `@Pattern` action 화이트리스트+reason 길이제한.
  - status 매핑(**기존 값 재사용**): CONFIRM→`open`(확정 유지), DISMISS→`false_positive`, ACCEPT_PATCH→`fixed`. (신규 enum 값 추가 안 함 — 기존 필터 충돌 회피)
  - V052 `triage_feedback(id, vulnerability_id FK, user_id, action, reason, created_at)` — **append-only**(라벨 학습 자산, update/delete 금지).
- **핵심 로직**: 버튼 클릭→PATCH→Service가 vuln.status 갱신 **+** TriageFeedback row insert(누가/언제/무엇/사유). FE 낙관적 갱신→응답 확정, 실패 롤백+toast.
- **엣지/실패**: 타 사용자 vuln→권한 거부(소유 프로젝트만). 잘못된 action→400. reason 민감정보 가능→로그 금지. 재트리아지→이력 누적.
- **준수**: 입력검증 Controller 한정. 도메인 간 직접 Repo 주입 금지(필요시 이벤트). 파라미터 바인딩. 라벨 append-only.
- **DoD**: 3액션 PATCH / status 매핑 / TriageFeedback 이력 누적 / 잘못된 action 400 / 권한 거부 / FE 버튼·사유·낙관적 갱신 / 단위·통합 테스트.

### VAL-2 — 평가 CI 게이트 (M, 선행 VAL-1)
- **변경 파일**: `.github/workflows/`(eval step — **TASK-1203 워크플로에 통합**, 중복 잡 금지), `eval/baseline.json`(신규), `eval/check_regression.py`(신규)
- **로직**: CI에서 `make eval LIMIT=<CI한도>` → `check_regression.py`가 score 하락폭 임계(예: −2%p) 초과 시 **경고(초기 non-blocking — LLM 변동성)**. 기준점은 **VAL-1 풀런 후 산출**(직렬 의존).
- **DoD**: PR에서 eval step 실행 / baseline 대비 하락 시 경고 / TASK-1203 통합(별도 잡 없음).

---

## ✅ Stage 1 완료 (2026-06-18) — 브랜치 `feat/sprint13-val`
**커밋**: `15cd49a` — `feat(sprint13-stage1): EPIC-VAL 검증하니스·결정론적 가드·트리아지 라벨`
3-way 병렬 Dev(VAL-1·VAL-3·MOAT-1) → Tester PASS → Reviewer PASS(권고 3건, 블로커 0) → 커밋. STAGE-2 머지된 main에서 분기(충돌 0). **Flyway 번호 정정: 계획서 V052 → 실제 최고 V059이므로 V060 사용.**

#### VAL-1 — OWASP Benchmark 평가 하니스 (M)
- `eval/owasp_benchmark/{fetch.sh,runner.py,scorer.py}` + `eval/README.md`, `Makefile`(eval 타겟). `make eval LIMIT=N`→`recall/fpr/score` + `eval/results/latest.json`. 채점 `score=TPR−FPR` + 고정 recall 80% FPR. vulnType↔CWE 매핑. 매직넘버 상수화(`FIXED_RECALL_THRESHOLD=0.8`, `BENCHMARK_TAG`). 케이스 실패 skip&log(FN). `requirements.txt`는 stdlib만 사용(Reviewer 권고로 미사용 `tabulate` 제거).
- **단위 테스트**: 76개(scorer 매핑·집계·지표 + runner CSV파싱·샘플링·rate limit).

#### VAL-3 — 결정론적 검증 레이어 / AST 할루시네이션 가드 (L)
- `agent/validation/{ast_verifier.py, parsers/{python,java,ts}.py}` + `nodes/validate_findings_node.py`. `agent_state.py`(`validated_findings`/`discarded_findings`), `graph_builder.py`·`security_audit_graph.py` 재배선, `sast_node.py` **save 호출 제거**→검증 후 persist. `requirements.txt` `javalang>=0.13.0`.
- MVP 검증 = file:line 파일범위 내 + 비주석/비공백 실재. python=`ast`/java=`javalang`/ts=정규식. **미지원언어·파서에러·line없음·불확실 시 통과(recall 보호)**. 완전 결정론적(LLM 미사용). 폐기 건수 metric. **캐시히트 경로(`route_after_cache→validate_findings_node`)도 검증 경유** — next_file 루프 영향 없음 확인.
- **단위 테스트**: 44개(가짜 line/주석 폐기·실재 통과·언어별·미지원 보류·discarded 카운트). 회귀 0(기존 sast/graph/planning 테스트 save patch 제거 반영).

#### MOAT-1 — 트리아지 피드백 API+UI (M)
- `V060__create_triage_feedback.sql`(append-only, FK CASCADE, action CHECK), `TriageFeedback.java`(setter/@PreUpdate 부재·생성자 protected), `TriageFeedbackRepository`, `TriageRequest`(@Pattern action 화이트리스트·reason @Size). `VulnerabilityService.applyTriage/resolveStatus`, `VulnerabilityController` `PATCH /api/v1/vulnerabilities/{id}/triage`. FE `VulnDetailPanel` 트리아지 버튼 + `useSecureStore` 낙관적 갱신.
- status 매핑(기존 enum 재사용): CONFIRM→`open`, DISMISS→`false_positive`, ACCEPT_PATCH→`fixed`. IDOR 방어=타 사용자 vuln→`VULN_NOT_FOUND`(존재 비노출). reason 로그 미출력. 재트리아지=이력 누적(append).
- **단위/통합 테스트**: 13개(3액션 매핑·이력 누적·400·권한거부).
- **수동 검증 및 E2E 테스트**: 통과 ✅. 런타임 및 E2E 시나리오 수동 테스트를 전체 수행 완료하였습니다. 상세 결과는 [sprint-13-verification.md](file:///c:/Users/ttogl/workspace/secureai-editor/docs/sprints/sprint-13-verification.md)을 참조하십시오.

**검증 종합**: 신규 단위 133+(ai 120·be 13·fe 6) 및 수동 검증/E2E 테스트 전부 그린. 회귀 0. 실패는 인프라 의존 기존부채(Redis/DB/TestContainers, 이번 브랜치 미수정 확인)뿐. Reviewer 권고 3건 중 #1(BENCHMARK_TAG 상수화)·#3(tabulate 제거) 즉시 반영, **#2 이월** 아래.

#### ⚠️ 이월(다음 스테이지 처리) — FE VulnStatus 타입 불일치
FE `mockData.ts`의 `VulnStatus = 'open'|'exploited'|'patched'|'pending'`와 서버 반환값(`false_positive`/`fixed`)이 불일치. MOAT-1 낙관적 갱신은 `as` 캐스팅으로 처리 중이나, `VulnCard`의 `vuln.status==='patched'` 체크가 서버 `fixed`와 어긋남. → **서버 enum↔FE 타입 정규화 매핑 레이어** 필요(Reviewer 비차단 권고 #2). Stage 2 또는 별도 fix에서 처리. (Stage 2 시점 미처리 — 별도 fix로 잔존.)

---

## ✅ Stage 2 완료 (2026-06-18) — 브랜치 `feat/sprint13-val`
**커밋**: `908c7eb` — `feat(sprint13-stage2): VAL-2 평가 CI 회귀 게이트 (eval-check)`
단독 Dev → Tester PASS → Reviewer(FAIL→수정→PASS) → 커밋. Stage 1 위에서 연속 진행(동일 브랜치).

#### VAL-2 — 평가 CI 회귀 게이트 (M)
- `eval/check_regression.py`: `baseline.json` vs `latest.json` 의 score/recall/fpr 하락폭을 임계(−2%p) 비교 → 초과 시 GitHub Actions `::warning::`(비차단, 항상 exit 0). baseline/latest 누락 시 graceful no-op. by_category 회귀도 표기. LLM 미사용(순수 JSON 비교).
- `eval/baseline.json`: 초기 시드(VAL-1 수동런 LIMIT=5, total=55, score=0.3). `_note`에 "대표런(LIMIT≥100/풀런) 후 갱신" 명시.
- `.github/workflows/ci-ai-agent.yml`: eval 게이트 2 step 통합(별도 job 없음 — TASK-1203 취지). 시크릿→job env `HAS_API_KEY` 승격 후 `if: env.HAS_API_KEY=='true'`(키 있을 때만 LIMIT=5 샘플 eval). **latest.json은 생성물이라 미커밋** → 키 없는 일반 PR은 latest.json 부재로 게이트 no-op. 둘 다 `continue-on-error`.
- `Makefile` `eval-check` 타겟 + `eval/README.md` VAL-2 섹션.
- **단위 테스트**: 20개(임계 초과/이내·파일누락 graceful·malformed json·by_category·커스텀 임계·비차단 exit0). eval 전체 96 그린.

**Reviewer**: 1차 FAIL(블로커 2 — 시크릿 `if` 직접비교·README↔gitignore 불일치) → env 승격 비교 + 문서를 "생성물 미커밋·키 있을 때만 실효" 동작에 맞게 정정 → PASS. Tester가 argparse `%p`→`%%p` 이스케이프 버그 1건 수정.

#### ⚠️ baseline 한계(문서화된 비차단)
현재 baseline은 LIMIT=5 소규모 시드라 통계적으로 불안정(cmdi fpr=1.0 등). 회귀 감지 노이즈 가능 — **대표 런 후 `baseline.json` 갱신** 필요(README #baseline-갱신-절차). VAL-2 게이트의 실효는 baseline 갱신 + 실제 eval 실행(키 존재) 전제.

---

## 리스크
1. **VAL-3 save 이관(높음)**: sast_node 반환 계약 변경 → cache_check 캐시 히트 경로·next_file 상태 처리 회귀 주의. cache된 결과도 검증 경유할지 결정.
2. **VAL-1 벤치 비용(높음)**: 2,740 LLM 호출 = 비용·시간·rate limit. `LIMIT` 샘플 필수, 풀런 야간.
3. **VAL-2 → VAL-1 직렬**: 기준점이 VAL-1 풀런 후 산출 → Stage 2 강제.
4. **requirements.txt 동시 수정**: VAL-3(javalang)·VAL-1(벤치) → 먼저 머지 후 rebase.
5. **Flyway**: Sprint 12가 V050/V051 사용 → MOAT-1=V052. Sprint 12 머지 순서 확인.
6. **VAL-3 거짓 폐기**: 검증 과하면 recall 훼손 → 불확실 시 통과 원칙.
7. **MOAT-1 status 매핑**: 기존 enum 재사용으로 필터 충돌 회피(신규 값 금지).

---

## 완료 게이트 (VC 지적 ③ — 정량 증명)
| 마일스톤 | 기준 | 상태 |
|---------|------|------|
| VAL-1 | `make eval LIMIT=N`로 **TPR/FPR/score 산출** + latest.json + README 첫 숫자 | ✅ 수동 검증 완료 ([sprint-13-verification.md](file:///c:/Users/ttogl/workspace/secureai-editor/docs/sprints/sprint-13-verification.md)) |
| VAL-3 | **가짜인용 0건**(폐기 후 저장 findings는 모두 라인 실재) + Java/Python 동작 + discarded 카운트 | ✅ 수동 검증 완료 ([sprint-13-verification.md](file:///c:/Users/ttogl/workspace/secureai-editor/docs/sprints/sprint-13-verification.md)) |
| MOAT-1 | 3액션 라벨 저장(독점 데이터 수집 개시) + status 매핑 + 이력 append + 권한 | ✅ 수동 검증 완료 ([sprint-13-verification.md](file:///c:/Users/ttogl/workspace/secureai-editor/docs/sprints/sprint-13-verification.md)) |
| VAL-2 | PR eval + baseline 회귀 경고 (TASK-1203 통합) | ✅ 구현·테스트·Reviewer PASS (`908c7eb`). baseline 대표런 갱신은 후속 |
| **Sprint 13 완료** | 위 통과 + **VC 데모 숫자 확보**("FP율 X%/탐지율 Y%" · 가짜인용 차단 수) + 부채대장 잔여 0 + 세션 로그 | 진행 중 (Stage 1·2 완료, baseline 대표런·FE 타입 fix 후속) |

> 산출물의 본질 = **"VC에게 보여줄 첫 슬라이드 숫자"**. VAL-1 숫자가 0순위, VAL-3 가짜인용 차단이 신뢰 증명.

---

## 이월
| 항목 | 사유 | 처리 |
|------|------|------|
| **VAL-4** SAST→DAST proven_exploitable | L, 5개 신규 레이어(엔티티 컬럼·오케스트레이션·내부 API·그래프 분기·FE), VAL-3 직렬 의존, DAST 인프라 의존. doc 18 §7도 7~8주차 | **Sprint 14 선두**. V053 예약. proven_exploitable 내부 API(`PATCH /internal/v1/vulnerabilities/{id}/proven-exploitable`) 명세 포함 필요 |
| VAL-3 deep source→sink 검증 | MVP는 라인 실재만 | 별도(Sprint 14 후보) |

---

## 실행 명령어
```
/stage 1   — VAL-1 + VAL-3 + MOAT-1  (3-way 병렬)
/stage 2   — VAL-2  (VAL-1 완료 후)
/done      — 세션 로그
```

---

## 에이전트 평가 요약
### PM (Opus 4.8)
- Sprint 13을 EPIC-VAL로 배치, 실측으로 그래프 구조·MOAT-1 비그린필드·DAST 분리·Flyway 상태 확인. 용량 L×2 경계선 플래그 + 분할(A)/축소(B) 제시.
### Dev (현실성 평가)
- **A 채택 권고**: VAL-4 작업량 과소평가(5 신규 레이어), B는 차별점 없음 → Sprint 14 이월.
- VAL-3 파서: tree-sitter 비현실적 → ast+javalang+정규식 MVP, 검증 범위 라인 실재로 제한.
- VAL-1: `--limit` 샘플 코어, 풀런 야간.
- 숨은 의존성: save 이관 / VAL-2→VAL-1 직렬 / **Flyway V052부터(Sprint12가 V050/V051)** / requirements.txt 동시수정 / proven_exploitable 내부 API 누락(VAL-4).

*작성: 2026-05-31 (PM+Dev, Opus 4.8). VAL-4 이월·VAL-3 스코프·Flyway 재배정 확정.*
