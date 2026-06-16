# Sprint 12C — ★EPIC-STAGE "Stage 기반 점진 분석 UX"

**계획 수립일**: 2026-06-11 (PM Opus 4.8 + Dev 현실성 평가)
**계획 상태**: 최종 확정 (Dev 평가 반영 — interrupt 예외처리·aupdate_state 경로·싱글턴캐시·filePaths POST화·STAGE-3 스코프 제한·충돌순서·SessionStatus·planning_mode 경로 보완) — **시작점 `/stage 1`**
**목표**: `api_discovery_node`의 "전체 파일 선읽기 후 분석" 구조 → **(③)stage별 점진 취약점 노출 + (②)계획 사용자 컨펌 게이트 + (①)API-허브 우선 읽기·lazy 로드**. 토큰 원가 통제 + 조기 피드백 UX. (VC 지적 "원가 통제" 직결, 세션로그 F-003/004/006/007 해소)

---

## 스프린트 번호·우선순위 (PM 결정)
- **신규 `Sprint 12C` (EPIC-STAGE)** — 보안코어(12)·검증(13) 어디에도 안 맞는 **분석 파이프라인 UX/원가 트랙**. Sprint 12 본진과 병행 가능한 독립 트랙.
- **전역 순서 (12C·12D·13 통합 — 2026-06-12 단일화)**: **12D Phase1(COST-1·2, 크레딧 블로커) → 1201 → 12D Phase2(COST-3·4) → 12C STAGE-1·2 → Sprint 13 EPIC-VAL → 12C STAGE-3**. (12D 문서와 동일 — single source.)
- **EPIC-VAL(Sprint 13)과 12C 내부 순서**: **STAGE-1·2 먼저 → Sprint 13 EPIC-VAL → STAGE-3**. 이유: ②컨펌게이트가 원가통제 즉효 + ③/②는 그래프 구조변경 최소(저위험). ①(허브 리팩터)은 VAL-3와 `api_discovery_node`/`graph_builder` 충돌 → VAL-3 머지 후가 안전.
- **Flyway**: 본 에픽 **신규 마이그레이션 불필요**(스키마 변경 없음). (참고 최고번호 V049, 컬럼 추가 시 V054부터.)

---

## 실행 계획
| 순서 | TASK | 제목 | 선행 | 서비스 | 에이전트 | 사이즈 |
|------|------|------|------|--------|---------|--------|
| 1 | **STAGE-1** | stage 완료 시 점진 취약점 노출 | — | backend+frontend | Dev+Tester | M |
| 2 | **STAGE-2** | 계획→사용자 컨펌 게이트 (interrupt/confirm/resume) | STAGE-1 | ai_engine+backend+frontend | Dev+Tester | **L** |
| 3 | **STAGE-3** | API-허브 우선 읽기 + lazy 로드 | STAGE-2 | ai_engine | Dev+Tester | M |

- 용량 L×1 + M×2 → 경계선 이내.
- **공유파일 소유권**: `analyze.py`(STAGE-1·2), `graph_builder.py`·`agent_state.py`(STAGE-2 ↔ **VAL-3 충돌**), `api_discovery_node.py`(STAGE-3). → **STAGE-2는 VAL-3보다 먼저 머지하거나 VAL-3 완료 후 rebase 의무**.

---

## STAGE-1 — stage 완료 시 점진 취약점 노출 (M)

> 실측: 취약점은 `sast_node.save_vulnerabilities()`로 파일별 즉시 DB 저장 + `stage_completed`(stage_no) 이벤트 발행 중. `full_state` 누적패턴으로 `stages` 보존됨(2026-06-07 픽스). 백엔드에 stage/파일 단위 취약점 조회가 없음 → 본 태스크.

- **변경 파일**: `analyze.py`(stage_completed에 files 동봉), `VulnerabilityRepository.java`·`VulnerabilityQueryService.java`·`VulnerabilityController.java`(파일 단위 조회), `useSse.ts`·`AppHeader.tsx`·`useSecureStore.ts`·`ProgressPanel.tsx`·`lib/api`(프론트 누적표시).
- **인터페이스**:
  - AI Engine: `publish("stage_completed", stage_no=last_stage_no, files=stage_files)` — `stages`에서 `stage_no`로 files lookup. **`_run_analysis`·`_run_resume` 양쪽**.
  - Backend: **`POST /api/v1/vulnerabilities/query`** (JWT) body `{sessionId, filePaths:[str], page,size}` → 페이징. **GET 쿼리파라미터 아님**(Dev 보완 #4 — filePaths가 수백개면 URL 8KB 초과). Repository `findBySessionIdAndFilePathIn(sessionId, filePaths, pageable)` `@EntityGraph`. Service는 기존 `severity` 분기 패턴 따라 `filePaths` 분기 + **소유권 검증 후**.
  - Frontend: `fetchVulnerabilitiesByFiles(sessionId, filePaths): Promise<Vuln[]>` (POST). **stage 단위로만 호출**(전체 일괄 금지).
- **핵심 로직**: stage_completed 수신 → `markStageCompleted(stage_no)`(기존) + `event.files`로 조회 → 결과를 store에 stage별 누적 → ProgressPanel stage 행에 "발견 N건" 배지 + 펼침 목록(파일·라인·severity) + 클릭 시 기존 `openTab(path)` Monaco 연동.
- **엣지**: files 누락(구버전)→조회 스킵·markStageCompleted만. 0건→"발견 0건". 조회 실패→toast+빈목록, 세션 중단 금지. 타 사용자 세션→403/NOT_FOUND.
- **준수**: 입력검증 Controller 한정(filePaths 길이/공백 가드), JPQL `IN :filePaths` 파라미터바인딩, QueryService 경유, skip&log.
- **DoD**: 🧪 findBySessionIdAndFilePathIn 정확 반환 / 🧪 filePaths 없는 기존 호출 하위호환 / 🔬 stage_completed→패널 N건(SSE mock) / 🛡️ 타 사용자 403 / ✅ 실스캔 stage 완료마다 누적·펼침·Monaco.

### ✅ STAGE-1 완료 (2026-06-16) — 브랜치 `feat/sprint12C-stage1-progressive-vulns`
**커밋**: `0ee09f2` | 단독 Dev(3서비스) → Tester → Reviewer PASS → 커밋. 12D Phase1/2 머지 후 그 위에서 작업(analyze.py 변경은 stage_completed 발행에 국한 → STAGE-2/graph_builder 충돌 0 확인).
- **AI Engine**: `analyze.py`에 `_get_stage_files()` + `stage_completed` 이벤트에 `files` 동봉(`_run_analysis`·`_run_resume` 양쪽). files 키 추가는 하위호환.
- **Backend**: `POST /api/v1/vulnerabilities/query`(JWT) — filePaths 단위 페이징. `VulnerabilityQueryService.listByFiles`(소유권 검증=타 사용자 세션 403 IDOR 차단)·`VulnerabilityController.validateFilePaths`(경로순회 방어·입력검증 Controller 한정)·`findBySessionIdAndFilePathIn`(JPQL IN 바인딩 + @EntityGraph N+1 방지). filePaths null/빈→전체조회(하위호환).
- **Frontend**: `stageVulns` 스토어 누적(persist 제외), `stage_completed` 수신→`fetchVulnerabilitiesByFiles`(POST, skip&log+toast), `ProgressPanel` "발견 N건" 배지+펼침(파일·라인·severity)+Monaco `openTab`. files 없으면 스킵.
- **검증**: 🧪 ai_engine +12·backend +9(contextLoads 그린)·frontend +14 (회귀 0, 기존부채만 잔존). Reviewer PASS(보안·설계·아키텍처·충돌회피 전체) — 비차단 권고 2건(filePaths 항목 길이 @Size(1024)·useCallback deps 주석) 즉시 반영. 🔬 SSE mock 패널표시·🛡️403 테스트화 / ✅ 실스캔 누적·펼침·Monaco는 수동검증.
- **다음**: STAGE-2(계획 컨펌 게이트, L) — ⚠️ VAL-3보다 먼저 머지 or 후 rebase 의무(graph_builder·agent_state 충돌).

---

## STAGE-2 — 계획→사용자 컨펌 게이트 (L) ★Dev 보완 집중

> 실측: LangGraph **`1.1.9`** — `interrupt_after`·`aupdate_state` API 실재(버전업 불요). 체크포인터 + `/agent/resume` 존재. planning_node idempotent(stages 있으면 no-op). **그러나 PM 가정과 다른 점 3가지 발견(아래 ⚠️).**

- **변경 파일**: `graph_builder.py`(interrupt_after + 캐시키 분리), `analyze.py`(GraphInterrupt catch + confirm 경로), `agent_state.py`(`confirmed:bool`), `planning_node.py`(confirm 제외 반영 — idempotent 양립), `AnalysisController.java`(confirm 엔드포인트 신규)·`AnalysisService.java`·**`RedisSubscriber.java`**(`awaiting_confirmation` 수신→`AWAITING_CONFIRMATION` status 전환 — 현재 completed/error만 처리하므로 케이스 추가 필수)(confirm API + SessionStatus), AI Engine 호출 클라이언트, `useSse.ts`·`PlanConfirmModal.tsx`(신규)·`useSecureStore.ts`·`AppHeader.tsx`·`useStartAnalysis.ts`(planning_mode 경로).

### ⚠️ Dev 필수 보완 (PM 가정 정정)
1. **interrupt 시 `GraphInterrupt` 예외 발생** — `PregelLoop.after_tick()`가 `raise GraphInterrupt()`. 현 astream 루프가 못 잡으면 `except Exception`에 걸려 **error 이벤트 발행**됨. → **반드시** `from langgraph.errors import GraphInterrupt` + 별도 catch:
   ```python
   try:
       async for event in graph.astream(initial_state, config): ...
   except GraphInterrupt:
       await publish("stage_plan", ...); await publish("awaiting_confirmation", ...)
       return  # 정상 종료(error 아님)
   except Exception as exc: await publish("error", ...)
   ```
   `_run_analysis`·`_run_resume` 양쪽.
2. **aupdate_state 호출 주체**: `checkpointer.aupdate_state`는 **없음**. → **`graph.aupdate_state(config, values, as_node="planning_node")`** (graph 인스턴스, `as_node` 필수).
3. **싱글턴 캐시 분리**: `get_graph()`가 checkpointer 동일 시 캐시 재사용 → interrupt 컴파일본과 구분되도록 **캐시 키에 interrupt 모드 포함**(예: `get_graph(checkpointer, interrupt=True)`).

- **API 계약**:
  - AI Engine `POST /agent/confirm/{session_id}` body `{selected_stage_nos:[int]|null, excluded_file_paths:[str]}` → 202. 처리: 체크포인트 `channel_values`에서 stages/files_to_scan 로드 → 제외 반영(제외 stage + excluded_file_paths, **원본 files_to_scan 교집합만** = 경로순회 방어) → **`graph.aupdate_state(config, {stages, files_to_scan, current_file_index:0}, as_node="planning_node")`** → `astream(None, config)` 재개. 모든 stage 제외→400.
  - Backend `POST /api/v1/analysis/sessions/{id}/confirm` (JWT) body `{selectedStageNos, excludedFilePaths}` → 200. 소유권 검증 → AI Engine confirm(X-Internal-Key) → **세션 status `AWAITING_CONFIRMATION`→`RUNNING`**.
  - **SessionStatus 보완(#7)**: `AWAITING_CONFIRMATION` enum 추가 여부 결정 — 신규 enum 1개 추가 권고(기존 필터 충돌 적음). interrupt 도달 시 backend가 RedisSubscriber로 `awaiting_confirmation` 수신→status 전환.
  - SSE 신규 `awaiting_confirmation` 페이로드: `{stages:[{stage_no,name,file_count,files:[...]}]}`. **stage_plan과 중복 회피(#5)**: stage_plan은 그대로 두고, awaiting_confirmation은 **모달 렌더용 파일목록 포함 상세본**(역할 분리 — stage_plan=진행바, awaiting_confirmation=컨펌모달).
  - **planning_mode 경로(#8)**: 현 `useStartAnalysis.createSession()`에 planning_mode 없음 → **createSession 파라미터에 `planningMode?: 'DETERMINISTIC'|'LLM'` 추가** + confirm 전용 훅 `useConfirmPlan` 신규(createSession과 분리).
- **상태 전이**: analyze→scan→api_discovery→planning_node→**interrupt(GraphInterrupt)**→stage_plan+awaiting_confirmation 발행→세션 AWAITING_CONFIRMATION → FE 모달 → confirm → aupdate_state → resume → cache_check 루프(STAGE-1 점진노출 합류).
- **엣지**: 타임아웃→체크포인트 유지(나중 confirm 가능, 강제만료 MVP 밖). 취소→기존 `/cancel`. 재컨펌(running/completed)→409. 모든 stage 제외→400. 체크포인터 None→error(기존 가드).
- **준수**: 입력검증 Controller 한정(경로는 체크포인트 stages 실재분만 — `_filter_to_whitelist` 재사용), X-Internal-Key는 confirm 호출만, 토큰/키 로그 금지.
- **DoD**: 🧪 confirm 제외 반영(체크포인트 mock) / 🧪 idempotent+confirm 갱신 양립(재계획 없이 보존) / 🔬 analyze→interrupt→awaiting→confirm→resume 전구간 / 🛡️ 타 사용자 403·running 재confirm 409·외부경로 무시 / ✅ stage 2개 해제 후 미분석 확인·전체승인 정상.

---

## STAGE-3 — API-허브 우선 읽기 + lazy 로드 (M) ★Dev 보완

> 실측: `api_discovery_node`가 `target_files` 전체 `open().read()` 후 파싱(메모리 부담). `sast_node`는 이미 파일별 MCP read_file로 다시 읽음(state 미저장).

### ⚠️ Dev 필수 보완 (#5) — api_groups 출력계약 회귀 위험
- **비허브 파일을 api_discovery에서 안 읽으면 그 파일의 API 엔드포인트가 안 잡혀 api_groups/stages가 바뀜** = "출력계약 불변" 위반. → **두 가지 중 택1로 스코프 제한**:
  - **(A 권고) lazy load는 `sast_node` 한정**: api_discovery는 현행대로 전체 읽되, "허브 우선"은 **읽는 순서/계획 우선순위**에만 적용(메모리 절감 효과는 작지만 회귀 0). 또는
  - **(B) api_discovery도 허브만 읽되**, **api_groups 회귀 방지 테스트**(동일 레포에서 허브-only vs 전체 읽기의 api_groups 동일성)로 고정 + 비허브 누락 시 "공통/기타" stage 보장.
  - → **실행 시 A부터 시도**(안전), 메모리 이득이 핵심이면 B를 회귀테스트와 함께.
- **변경 파일**: `api_discovery_node.py`(허브 휴리스틱), `test_api_discovery.py`. planning_node는 무변경(others 처리 기존 보유 — 확인만).
- **허브 휴리스틱 상수**(`api_discovery_node.py`): `_HUB_PATH_PATTERNS` = [`*Controller.java`, `**/controller/**.java`, `**/api/**/route.(ts|tsx|js)`, `*(api|client|axios).(ts|js)`, `**/api/routes/**.py`] + 보조 `_FASTAPI_HUB_CONTENT_RE`=`@router.(get|post|put|delete|patch)|APIRouter`(경로 미매칭 .py만 헤더 N줄 peek — 전체 read 회피). `_is_hub_file(path)->bool`.
- **핵심 로직(B 채택 시)**: target_files를 허브/비허브 분리 → 허브만 read → `discover_api_groups`(기존). 형제파일(`*Service`/`*Repository`) 수집은 **경로명 기반(내용 불요)** 유지. `files_to_scan` 불변(전체) → 비허브는 "공통/기타" stage + sast 차례 lazy.
- **엣지**: 허브 0건(비-API 레포)→api_groups 빈→단일 "공통/기타"(현행 fallback). FastAPI 경로 미매칭→헤더 peek 보조, 놓쳐도 비허브로 분석은 됨(누락 0, 그룹핑만 약화). 읽기 실패→skip&log. 경로순회 기존 방어 유지.
- **준수**: 허브 패턴 상수화, 개별 실패 전체중단 금지, **api_groups 출력계약 불변**(DETERMINISTIC/LLM 양쪽).
- **DoD**: 🧪 `_is_hub_file` 정확(Controller/route/api True, util/entity False) / 🧪 (B 시)비허브 read 미호출(mock 호출수=허브수) / 🧪 **api_groups·stage 산출 기존과 동일(회귀 — 기존 test_api_discovery 그린)** / ✅ 대형레포 메모리/시간 감소 + 전체 파일 sast 분석(누락 0).

---

## 리스크
1. **STAGE-2 interrupt→resume 회귀(높음)**: GraphInterrupt 예외처리·graph.aupdate_state(as_node)·싱글턴캐시 분리 누락 시 동작 안 함(Dev #1·2·3). interrupt 후 첫 resume에서 planning_node 재실행→idempotent no-op 보존 검증 필수. STAGE-1 그린화 후 단독 진행 + 전구간 통합테스트.
2. **STAGE-3 api_groups 계약(중)**: 허브-only 읽기가 api_groups/stage 분포 바꾸면 STAGE-1/2 회귀 → A안 우선 또는 B안+회귀테스트.
3. **EPIC-VAL 교차(중)**: `graph_builder.py`·`agent_state.py`를 VAL-3도 수정 → **STAGE-2 먼저 머지 or VAL-3 후 rebase 의무**. VAL-3 validate_findings_node(sast↔next_file)는 planning 직후 interrupt와 비충돌이나 graph_builder 머지충돌 주의.
4. **STAGE-1 filePaths 비대(낮음→해소)**: POST body로 전환(Dev #4), stage 단위 호출.
5. **체크포인터 미초기화(낮음)**: confirm은 checkpointer 의존 → None이면 error(기존 가드 재사용).
6. **SessionStatus(낮음)**: AWAITING_CONFIRMATION enum 추가 + 전환 다이어그램 명시(Dev #7).

---

## 세션로그 버그 매핑 (해소)
- **F-003 분석 전 계획 사전 승인** → STAGE-2 (직접).
- **F-004 분석 중단·재개** → STAGE-2 confirm/resume/cancel (부분).
- **F-006 분석 제외 파일 필터** → STAGE-2 excluded_file_paths (검증경로).
- **F-007 단계별 취약점 코드 뷰어** → STAGE-1.

---

## 실행 명령어
```
/stage 1   — STAGE-1 (stage별 점진 취약점 노출)
/stage 2   — STAGE-2 (계획 컨펌 게이트)  ※ VAL-3보다 먼저 머지 or 후 rebase
/stage 3   — STAGE-3 (API-허브 우선 읽기)  ※ STAGE-2 후
/done      — 세션 로그
```

---

## 에이전트 평가 요약
### PM (Opus 4.8)
- Sprint 12C 신규 편성(독립 트랙), ③→②→① 배치, EPIC-VAL과 우선순위(STAGE-1·2 먼저 → 13 → STAGE-3). Flyway 불필요. 세션로그 F-003/004/006/007 매핑.
### Dev (현실성 평가) — 반영 결과
- **필수 보완 8건 전부 명세 반영**: (1)GraphInterrupt 예외 catch (2)graph.aupdate_state(as_node) (3)싱글턴 캐시 분리 (4)filePaths POST화 (5)STAGE-3 api_groups 회귀 방지(A안 우선) (6)충돌순서 의무 (7)SessionStatus AWAITING_CONFIRMATION (8)useStartAnalysis planning_mode 경로+confirm 전용 훅.
- **동의된 판단**: langgraph 1.1.9 interrupt_after/aupdate_state 실재(버전업 불요), full_state로 stages 보존(STAGE-1 현실적), planning_node idempotent로 confirm 후 보존 안전, Vulnerability.filePath 실재.

*Sprint 12C 계획: 2026-06-11 (PM+Dev, Opus 4.8). interrupt 예외처리·aupdate_state·캐시분리·filePaths POST·STAGE-3 스코프·충돌순서·SessionStatus·planning_mode 보완 확정.*
</content>
