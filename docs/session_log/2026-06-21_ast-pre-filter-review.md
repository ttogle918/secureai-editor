# [2026-06-21] AST 사전 필터링 & LLM 하이브리드 파이프라인 리뷰 세션 (당일 2차)

**브랜치**: `main`
**작업 범위**: "AST 기반 사전 필터링 & LLM 하이브리드 SAST 파이프라인" 코드 리뷰 2라운드 + 수정 검증
**스프린트**: 스프린트 외 작업 (성능·토큰 비용 최적화 — EPIC-ECON 선행 성격)
> 직전 세션 로그(`2026-06-21_session-summary.md`, 커밋 `5ee3093`)에 이어, 그 이후 진행된 AST pre-filter 리뷰 사이클을 별도 기록.

---

## 1. 완료 작업

| 항목 | 산출/커밋 |
|------|---------|
| **AST pre-filter 1차 리뷰** (대상 커밋 `7152777`) | 🔴 FN 키워드 갭·문서↔코드 불일치, 🟠 `resolved_model` 오염·스킵 절감 계측 부재, 🟡 스킵이 guidelines/DB 조회 뒤 배치 등 지적 |
| **사용자 수정 검증** (커밋 `3b710d4`) | 전 항목 해결 확인 + 신규 테스트가 갭(os.system·pickle·fs·redirect) 실제 차단 검증 — **pytest 38 passed** |
| (사용자 병행 커밋 요약) | `3043660` 노드 간 파일 내용 공유(중복 read I/O 제거) · `fe716bf` 트러블슈팅 · `7152777` 파이프라인 도입 · `3b710d4` 견고화+토글 |

---

## 2. 의논 내용 & 결정 맥락

- **리뷰 핵심 쟁점**: 메모의 "미탐(FN) 0%" 목표 vs **키워드 세트 불완전**. 1차 구현은 `os.system`(명령 인젝션)·`pickle.loads`(역직렬화)·`fs.readFile`(path traversal)·`res.redirect`(open redirect) 등을 키워드에 안 담아 **취약 파일이 스킵될 수 있었음**. 설계 문서엔 있는데 코드엔 빠진 항목도 있었음(문서↔코드 불일치).
- **수정 결과(3b710d4)**: Python/Java/Kotlin/JS·TS 키워드를 카테고리별로 보강 + 문서 동기화. 신규 테스트 4종으로 갭 차단을 단언.
- **`resolved_model` 오염 해결 방식**: 스킵 분기의 `"skipped"` 할당을 제거하고 함수 상단(`sast_node.py:264~265`)에서 `resolved_provider/preferred_model = None` 초기화 → 스킵 시 최종 가드(`if resolved_provider and preferred_model ...`)가 falsy → **세션 보고 모델이 스킵 파일로 안 덮임 + UnboundLocalError도 없음**. (가드의 `!= "skipped"` 조건은 이제 중복이나 무해.)
- **계측**: `secureai_ai_llm_skipped_total` Prometheus 카운터 추가 → EPIC-ECON "LLM 호출 절감률" 증명 자산.
- **안전 롤아웃 결정(중요)**: `settings.ast_pre_filter_enabled` **기본 False**. 즉 현재는 동작 불변(회귀 0). **프로덕션 활성화 전 유일한 게이트 = VAL-1 recall 측정**(필터 on/off 탐지율 동일성 증명).
- **결론**: 추가 코드 fix 불필요 → **Reviewer 게이트 미수행**(변경할 코드가 없음). 남은 건 검증/측정 작업.

---

## 3. 버그 수정 / 특이사항

- 1차 리뷰 중 "스킵 분기에서 `resolved_provider/preferred_model` 미할당 → `UnboundLocalError` 가능" 우려를 제기했으나, 코드 확인 결과 **함수 상단 `None` 초기화로 이미 방어**돼 있어 실제 결함 아님을 확인(re-review에서 정정).
- 그 외 마스터발 코드 변경 없음(리뷰만 수행, 구현·커밋은 사용자).

---

## 4. 트러블슈팅 대상 이슈

신규 트러블슈팅 문서 생성 없음. 관련 기존 문서:
- 설계/구현 메모: `docs/memo/2026-06-21_ast-pre-filter-llm-pipeline.md`
- 중복 read 최적화 트러블슈팅: `fe716bf` (파일 내용 노드 간 공유)

---

## 5. 다음 세션에서 할 것

- **VAL-1 recall 측정** — AST 필터 on/off로 벤치마크 탐지율(Recall) 동일함을 증명 → 통과 시 `AST_PRE_FILTER_ENABLED=true`로 프로덕션 활성화. (이게 활성화 전 유일한 필수 게이트)
- (선택) JS/TS 키워드 substring 과대 항목(`constructor`/`prototype`/`path`) 정밀화 — JS/TS 절감률이 아쉬울 때. 현재는 안전 방향이라 결함 아님.
- **EPIC-ECON 본편(TASK-1331~1334)과 연계** — 이 pre-filter는 ECON 토큰 절감의 선행 자산. EPIC-ECON 정식 착수 시 절감률 숫자(skipped 카운터)와 묶어 VC 자료화.
