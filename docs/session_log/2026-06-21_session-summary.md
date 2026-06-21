# [2026-06-21] 작업 세션 요약

**브랜치**: `main`
**작업 범위**: 2026-06-20 VC 피드백의 백로그 반영(EPIC-ECON 정식 편입 + 신규 전략항목 상세화 + 시연/배포 2트랙 포인터) + 병행 버그 수정
**스프린트**: 스프린트 외 작업 (백로그 그루밍 + 버그픽스) — Sprint 13 Stage 1 완료 이후

---

## 1. 완료 작업

| 항목 | 산출/커밋 |
|------|---------|
| FE 모델 상수 단일화(#4) **검증** — 이미 확정된 작업 확인 | `b35c363`(기커밋), 모델 테스트 16/16 통과·`tsc` 클린 확인. 후속 부채 **FEAT-FE-008** 식별 |
| 백로그 — **EPIC-ECON 섹션 신규**(TASK-1331~1334, 잠정 Sprint 19) + PM 실측 스코핑·상세화(구현/체크리스트/수동검증) | `7aec968` → `ba79f95` |
| 백로그 — Future 신규: **FEAT-AI-009**(로컬 LLM Ollama/vLLM)·**FEAT-OPS-007**(On-Prem 폐쇄망)·**FEAT-RPT-001**(야간 스캔 모닝 브리핑)·**FEAT-FE-008** 상세 | `ba79f95` |
| 백로그 — **현재 위치 포인터 갱신 + 시연/배포 2트랙 명시** | `125e7ba` |
| (병행) 버그 수정 — §3 참조 | `ee2040d`·`aa33fdd`·`1c3a8b0`·`794b0b8`·`cacdaa4`·`668e59b`·`01883c6`·`46476e5`·`ff55324` 등 |

---

## 2. 의논 내용 & 결정 맥락

- **VC 6/20 피드백 분석**: 두 피드백(투자 심사서 + V2)의 핵심이 **대부분 이미 EPIC-VAL(VAL-1~17)에 반영**돼 있음을 교차 검증. 진짜 갭은 두 가지 —
  1. **토큰 경제성**이 `18_VC_REVIEW_RESPONSE_260530.md`(EPIC-ECON)에만 있고 정본 백로그 미편입.
  2. **on-prem / 로컬 LLM**이 어디에도 없음.
- **사용자 결정**: ① 토큰 경제성을 EPIC-ECON으로 정식화 ② on-prem/로컬LLM은 Future Backlog 등재(스프린트 미배정).
- **코스 교정(중요)**: 처음에 `/sprint 19`를 돌려 **실행 계획(/stage 진입점)까지** 만들었으나, 사용자가 "13·14도 미완인데 19부터 세우는 건 순서가 안 맞고, 백로그에만 추가하려던 것"이라 지적. → **실행 계획을 폐기하고 백로그 편입 수준으로 되돌림**(EPIC-ECON은 "Sprint 번호 미배정·잠정 19" 표기, /stage 미수립).
- **EPIC-ECON 실측 스코핑(코드 직접 확인)** — "신규 구현" 착각 방지:
  - 프롬프트 캐싱은 **이미 구현됨**(`anthropic_provider.py` `cache_control:ephemeral`) → TASK-1331은 *계측+적중률 리팩터*로 재정의.
  - 증분 스캔 PR 경로는 **이미 연결**(`GitHubWebhookService.getPrChangedFiles` + AI Engine `file_filter`) → 신규는 diff 라인 한정·라우팅·계측.
  - Flyway 최고 **V060** → TASK-1334는 V061.
  - TASK-1335(가격 모델)은 빌링 도메인 → **Sprint 17 이관**.
- **시연/배포 2트랙 결정**: 시연 영상 = **Sprint 14(최소) ~ 14 + EPIC-ECON(최적)** (VC 3대 마일스톤: ①ISMS-P 증적=현재가능 · ②proven_exploitable=VAL-4@S14 · ③원가통제=EPIC-ECON). 실배포(GA) = **Sprint 18 Hardening** 기준. 백로그 "현재 위치" 포인터에 표로 명시.

---

## 3. 버그 수정 / 특이사항

### 병행 버그 수정 (사용자, 06-20~21)
> 상세는 각 Conventional 커밋 + 트러블슈팅 문서에 기록됨 — 여기선 요약·참조만.

- **트러블슈팅 3종** → `docs/troubleshooting/2026-06-20_ast-path-traversal-session-cookie-hydration-mismatch.md`
  - `ee2040d` AST verifier path traversal finding 폐기(`verified:False`) · `aa33fdd` refresh cookie `Secure`를 `request.isSecure()`로 동적 설정(로컬 HTTP 세션 끊김) · `1c3a8b0` LandingNav hydration mismatch(`isMounted` 패턴)
- **AI Engine 개선/버그** → `docs/troubleshooting/2026-06-20_guideline-engine-stack-detection-connection-pool.md`
  - `794b0b8` Android 보안 가이드라인 + SQL 생성 매핑 · `cacdaa4` path-aware stack detection(sast_node) · `668e59b` 시스템 프롬프트 CWE 패턴 일반화 · `01883c6` DB 커넥션 풀링(psycopg_pool) · `46476e5` docker postgres→localhost 치환 우회 · `ff55324` **DB 커넥션 풀 초기화 race condition** 방지(06-21)

### ⚠️ 특이사항 — 마스터의 오복원 사고 (재발 방지 기록)
- **사고**: 마스터가 PM 에이전트(/sprint) 산출물을 점검하던 중, 작업트리의 `ast_verifier.py`·테스트 변경과 신규 트러블슈팅 문서를 **"PM 에이전트의 지시 위반 산출물"로 오판**하여 `git checkout --`로 되돌리고 문서를 `rm`으로 삭제함.
- **실상**: 그건 **사용자가 IDE에서 병행 진행 중이던 버그 수정**(이후 `ee2040d` 등으로 커밋)이었음.
- **복구**: 컨텍스트에 남아 있던 diff·문서 전문으로 코드 2파일 + 트러블슈팅 문서를 **전량 복원**(데이터 손실 없음).
- **교훈**: 세션 시작 시 워크트리가 clean이었더라도 **사용자가 동시에 편집/커밋할 수 있다.** 워크트리 변경을 서브에이전트 탓으로 단정하고 destructive 조작(`git checkout`/`rm`)하지 말 것 — **먼저 사용자에게 확인**. 서브에이전트의 파일시스템 부작용 의심 시에도 revert 전에 출처를 검증.

---

## 4. 트러블슈팅 대상 이슈

이번 세션에 **신규 트러블슈팅 문서는 생성하지 않음** — 해당 버그들은 사용자가 작업하며 이미 문서화함:
- `docs/troubleshooting/2026-06-20_ast-path-traversal-session-cookie-hydration-mismatch.md`
- `docs/troubleshooting/2026-06-20_guideline-engine-stack-detection-connection-pool.md` (DB 풀 race condition `23ec27a` 포함)

마스터 오복원 사고는 코드/운영 이슈가 아니라 **프로세스 사고**라 별도 트러블슈팅 문서 대신 위 §3에 기록.

---

## 5. 다음 세션에서 할 것

- **Sprint 13 Stage 2 (VAL-2 CI 게이트)** → **Sprint 14**(검증된 AI = 패치 자동화 1401 + **VAL-4 proven_exploitable** — 시연 영상 핵심 산출).
- **EPIC-ECON 당겨오기 판단** — 시연 ③원가 통제 마일스톤 확보용(15~18보다 먼저).
- **FEAT-FE-008** — 온보딩·github-scan 화면 모델 데이터 정합화(models.ts 단일 진실원천 정렬).
- (선택) 모닝 브리핑 데모 시나리오 원하면 **FEAT-RPT-001** 착수.
