# Sprint 14 — 검증된 AI (탐지 → 교정 → 증명)

**계획 수립일**: 2026-06-21 (PM Opus 4.8 + Dev 현실성 평가)
**백로그**: V5.6 (EPIC-VAL 재정렬 + 백로그 원본 Sprint 14 reconcile)
**목표**: VC 3대 마일스톤 중 ②`proven_exploitable`(정적 의심 → 동적 증거) 확보 + "탐지가 아니라 교정"을 증명하는 패치 자동 PR·검증 루프. **시연 영상 ① 데모 트랙의 핵심 스프린트.**
**계획 상태**: 최종 확정 (Dev 평가 반영 — 1402 스코프 한정, GitHub App 권한 선행조건, VAL-4 WebGoat 기동방식 확정) — **시작점 `/stage 1`**

---

## 스코프 reconcile (백로그 두 관점 + 이월 통합)

Sprint 14는 백로그에 **두 관점**이 공존했고 + Sprint 13 이월이 있어 정리했다:
- 백로그 원본: TASK-1401(패치 PR)·1402(패치 검증)·1403(자동 롤백)
- EPIC-VAL 재정렬: 1401 + VAL-9(패치검증)·VAL-5(=1402/1403)·VAL-8(도구비교)·VAL-13(SARIF)·VAL-16(트리아지 품질)
- Sprint 13 이월: **VAL-4(proven_exploitable, L)** — 선두

**reconcile 결정**:
- **1402 = 프로덕션 패치 검증**(Docker 샌드박스 → `verificationStatus=Verified`). **VAL-9 = 벤치 측정 하니스**(코퍼스 소거율 숫자)로 별 레이어 → VAL-9 이월(1402가 선행 인프라).
- **1403/VAL-5(자동 롤백)**: 1401을 **PR-only(자동 머지 금지)**로 한정하므로 롤백 운영 리스크 전제 불성립 → 이월(자동 머지 도입 시점에 필요).
- **VAL-8·VAL-13·VAL-16**: 경쟁우위·품질 보강(데모 필수 아님) → 이월. (VAL-16은 VAL-4 proven 라벨 의존)

→ **Sprint 14 코어 = VAL-4(L) + TASK-1401(M) + TASK-1402(M).**

---

## 핵심 결정 (Dev 평가 반영)

| 쟁점 | PM 초안 | Dev 평가 | 확정 |
|------|--------|---------|------|
| **1402 사이즈** | M (Docker 샌드박스 검증) | **M→L 과소평가** — 패치 테스트 실행은 DAST 이미지(Python+httpx)와 달리 언어별 런타임 신규 이미지 필요 | **Python+pytest 단일 언어로 스코프 한정 → M 유지.** 다언어(Java/JS)는 후속 이월 |
| **1401 GitHub App 권한** | App 인증 재사용(언급) | **현재 App은 `checks:write`만. `contents:write`+`pull_requests:write` 미보유 가능성 → 권한 추가+설치 재승인은 GitHub UI 외부 작업** | **Stage 1 착수 전 외부 선행조건으로 확인 필수** (아래 §외부 선행조건). 미확인 시 1401 차단 |
| **VAL-4 WebGoat 기동** | runner가 오케스트레이션 | runner 직접 기동은 복잡도↑ | **compose로 사전 기동, runner는 target URL만 수신.** AI Engine 프로세스 내에서 `dast_runner.run_dast` 직접 await(컨테이너·Docker 소켓 불필요) |
| **VAL-4 mapping** | 매핑 함수 언급 | **mapping.py가 실작업의 절반**(WebGoat 엔드포인트↔SAST finding 매핑) | **mapping 테이블 확정을 runner.py 선행 하위할일로 분리** |
| **VAL-4 경로** | 벤치 하니스(DB 미수정) | executor가 DB 미접촉 → 분리 합리적 | **벤치 하니스 확정.** 프로덕션 proven 라벨(Vulnerability 컬럼+내부 API)은 VAL-16과 함께 S14+ 이월 |
| **1402 사이즈 재지정 여부** | — | Python 한정이면 M, 다언어면 L | **M(Python+pytest 한정).** Stage 2 단독 점유로 용량 확보 |

---

## 사전 발견 사항 (실측 — Dev 재확인)

| 항목 | 실측 상태 (근거) | 조치 |
|------|------------------|------|
| DAST executor | 5종 `execute(target_url, endpoint, params) -> ExploitOutcome` 동일 시그니처. `dast_runner.run_dast(vuln_type,...)` Strategy 선택. **DastState 강결합 없음**(순수 httpx async) | VAL-4가 **읽기전용 재사용**으로 외부 루프 호출 가능 |
| `benchmarks/` 디렉터리 | **부재** (VAL-1은 `eval/`에 들어감) | VAL-4 신규 `benchmarks/proven_exploit/` 생성 |
| GitHubAppAuthService | Installation Token 교환·RS256 JWT·PKCS#1/#8 파싱 완성 | 1401 재사용 |
| GitHubRestClient | `validateRepoAccess`·`createCheckRun`·`completeCheckRun`·`createPrComment`·`getPrChangedFiles` 5종. **ref생성/contents PUT/PR open 부재** | 1401이 동일 패턴(setBearerAuth+onStatus)으로 3종 신규 |
| GitHub App 권한 | 현재 `checks:write`+웹훅 목적 등록 추정. `contents`/`pull_requests` write 미확인 | **외부 선행조건**(§아래) |
| PatchSuggestion | 엔티티+`patch_suggestions` 테이블 존재(`unifiedDiff`/`patchedSnippet`/`isApplied`...). **`verification_status`/`verified_at`/`test_code` 부재** | 1402가 V061 신규 |
| DockerSandboxManager | `dast-isolated-net` 격리 컨테이너 생성/정리/로그 재사용 가능. **단 DAST 이미지(Python+httpx)는 테스트 실행 런타임 아님** | 1402 = Python+pytest 실행용 **신규 이미지 1종**(단일 언어 한정으로 M) |
| `dast-isolated-net` | `docker-compose.yml` `external:true` — postgres/redis 도달 불가 | VAL-4·1402 모두 이 네트워크 재사용(보안 규칙 충족) |
| Flyway 최고 | **V060** (`V060__create_triage_feedback.sql`) | Sprint 14 = **V061~** |
| AI↔BE 내부 통신 | `backend_api_client` + `POST /api/v1/internal/...`(`X-Internal-Key`) 패턴 확립 | 1402 검증결과 보고에 재사용 |

---

## 외부 선행조건 (Stage 1 착수 전 완료 — 👤 사용자)

> ⚠️ **코드 착수 후 발견하면 시간 낭비. 킥오프 전 확인.**

1. **GitHub App 권한 확장**: GitHub App 설정에서 **`Contents: Read & write`** + **`Pull requests: Read & write`** 활성화 → 각 설치(installation) **재승인**. (현재 `checks:write`만으로는 1401이 403/422)
2. **WebGoat 이미지**: VAL-4 통합 테스트용 WebGoat(또는 Juice Shop) 이미지 풀 가능 확인.
3. (1402) Python+pytest 검증용 베이스 이미지 빌드 환경.

---

## Flyway 번호 예약

실측 최고 **V060**. → V061부터. (착수 직전 `ls db/migration | tail`로 머지 브랜치 포함 재확인 — sprint-13 V052→V060 점프 전례)

| 번호 | 태스크 | 파일명 | 용도 |
|------|--------|--------|------|
| **V061** | TASK-1402 | `V061__add_verification_to_patch_suggestions.sql` | `verification_status`(varchar CHECK PENDING/VERIFIED/FAILED default PENDING)·`verified_at`(timestamptz null)·`test_code`(text null)·`verification_log`(text null). PR 메타(`pr_url`/`pr_branch`)는 1401 필요 시 동일 마이그레이션에 병합 |
| (보류) | VAL-4 proven 컬럼 | — | 벤치 하니스 우선 → DB 컬럼 미생성(S14+ 프로덕션 라벨링 시) |

---

## 실행 계획

### Stage 1 — 병렬 (서비스 분리, 충돌 0)
| TASK | 제목 | 서비스 | 에이전트 | 사이즈 |
|------|------|--------|---------|--------|
| **VAL-4** 🔴 | SAST→DAST `proven_exploitable` 연결 + 데모 영상 | ai_engine | Dev+Tester | **L** |
| **TASK-1401** 🟠 | 패치 자동 적용 → GitHub PR 생성 (PR-only) | backend(+FE) | Dev+Tester | M |

### Stage 2 — 순차 (1401 완료 후)
| TASK | 제목 | 선행 | 서비스 | 사이즈 |
|------|------|------|--------|--------|
| **TASK-1402** 🟠 | 패치 검증 자동화 (Docker 샌드박스 → Verified, **Python+pytest 한정**) | 1401(`PatchSuggestion`/`PatchService` 공유) | ai_engine+backend | M |

**용량**: L×1(VAL-4) + M×2 → L 상한 이내, 태스크 3개. 안전.

### 공유 파일 소유권
- `apps/ai_engine/benchmarks/proven_exploit/**`(신규) → **VAL-4 단독**. DAST `executors/*`·`dast_runner`·`dast_graph_builder` **읽기 전용**(수정 금지 — 회귀 방지).
- `GitHubRestClient.java`·`PatchPrService.java`·`PatchSuggestion.java`·`PatchService.java` → **1401(Stage1) → 1402(Stage2) 순차 소유**. 동일 엔티티/서비스 접촉 → 반드시 직렬.
- Flyway V061 → 1402 단독.

---

## 태스크별 상세 구현 명세

### VAL-4 🔴 — SAST→DAST `proven_exploitable` 연결 (L)
- **변경 파일**: `apps/ai_engine/benchmarks/proven_exploit/{runner.py, mapping.py, README.md}`(신규), `benchmarks/__init__.py`(신규), `benchmarks/proven_exploit/targets/docker-compose.webgoat.yml`(신규, `dast-isolated-net`). **읽기전용 재사용**: `agent/nodes/dast/executors/{sqli,xss,idor,ssrf,auth_bypass}_executor.py`·`agent/nodes/dast/dast_runner.py`(수정 금지).
- **인터페이스**:
  - CLI `python -m benchmarks.proven_exploit.runner --target-url <URL> [--categories sqli,xss,idor,ssrf] [--limit N]`
  - `ExploitResult{finding_id, cwe, file, line, vuln_type, exploit_attempted:bool, proven_exploitable:bool, evidence:str}`
  - `map_finding_to_executor(finding) -> ExecutorCase | None` (미지원 CWE→None skip)
- **핵심 로직**: ① WebGoat는 **compose로 사전 기동**(runner는 target URL만 수신) → ② SAST findings 로드/수집 → ③ `mapping.py`로 executor 케이스 매핑(실패 skip&log) → ④ **격리 네트워크 안에서** `dast_runner.run_dast` 직접 await(컨테이너 불필요) → ⑤ 성공 시 `proven_exploitable=True`+evidence(**민감 페이로드 마스킹**) → ⑥ proven 비율·카테고리별 집계 → `proven_exploitable.csv`+`proven_scorecard.md`+**데모 영상**.
- **하위 할일(순서)**:
  - [x] **(선행) `mapping.py` — WebGoat 엔드포인트↔SAST finding(CWE/vuln_type) 매핑 테이블 확정** (runner 블로킹 선행)
  - [x] WebGoat compose(`dast-isolated-net`) + 헬스체크
  - [x] runner.py — findings 루프 → executor 호출 → 집계
  - [x] scorecard/csv 산출 + 데모 영상 녹화
- **엣지/실패**: 익스플로잇 실패=정상(미증명, finding 유지). **격리 네트워크명 assert**(누락 시 중단). 외부 호스트 능동 스캔 금지(자체 WebGoat만). 대상 미기동→안내 후 비0 종료. 개별 실패 전체 중단 금지.
- **준수**: CLAUDE.md **DAST `dast-isolated-net` 격리 필수** · evidence/페이로드 마스킹·로그 금지 · 매직넘버(카테고리·타임아웃) 상수화 · executor 읽기전용 · 신규는 `benchmarks/` 하위만.
- **DoD**:
  - 🧪 단위: `map_finding_to_executor`(CWE→케이스, 미지원→None)
  - 🔬 통합/실행: WebGoat 기동 → SQLi/XSS 최소 2카테고리 proven 실증 (**격리 assert**)
  - ✅ 산출물: `proven_scorecard.md`(proven 비율 헤드라인)+`proven_exploitable.csv`+**데모 영상 1편**
  - 🛡️ `dast-isolated-net` 외 접근 0(postgres/redis 도달 불가 확인)

### TASK-1401 🟠 — 패치 자동 적용 → GitHub PR 생성 (M, PR-only)
- **변경 파일**: `GitHubRestClient.java`(신규 메서드 `getDefaultBranchSha`·`createBranchRef`·`putFileContents`·`createPullRequest`), `domain/patch/service/PatchPrService.java`(신규), `PatchController.java`(`POST /patches/{id}/pull-request`), `dto/CreatePatchPrRequest.java`·`PatchPrResponse.java`(신규), FE PatchPanel("PR 생성" 버튼+링크).
- **인터페이스**: `POST /api/v1/patches/{patchId}/pull-request` (JWT) `{owner, repo, baseBranch?}` → `200 {prUrl, prNumber, branchName}`. Controller `@Pattern`(owner/repo)+patchId 소유 검증.
- **핵심 로직**: patchId 조회(소유 검증)→Installation Token(재사용)→base HEAD SHA→`secureai/patch-{short}` ref 생성→`putFileContents` 커밋→`createPullRequest`(**자동 머지 금지**)→PR 메타 갱신+패치 설명 코멘트(재사용).
- **엣지/실패**: 권한 없음→`GITHUB_AUTH_REQUIRED`. 브랜치 충돌→suffix/409. 신규 파일→create 모드. rate limit→`GITHUB_RATE_LIMIT_EXCEEDED`. **auto-merge 절대 금지**.
- **준수**: 입력검증 Controller 한정 · `appToken`/`github_token` 로그 금지 · URI 템플릿 파라미터화 · auto-merge 금지 · PR 본문 민감경로/페이로드 금지.
- **DoD**:
  - 🧪 단위: `PatchPrService` 브랜치명·PR 바디 조립(GitHub mock)
  - 🔬 통합/실행: 패치 요청 → 테스트 레포 실제 PR 등록+코멘트
  - ✅ 수동: FE "PR 생성" → 링크 표시 · 자동머지 안 됨 확인
  - 🛡️ 토큰 비로그 · 권한 없는 레포 거부

### TASK-1402 🟠 — 패치 검증 자동화 (M, Python+pytest 한정, 선행 1401)
- **변경 파일**: `V061__add_verification_to_patch_suggestions.sql`(신규), `PatchSuggestion.java`(컬럼+`markVerified`/`markFailed`), `agent/nodes/patch_verify_node.py`(신규), `agent/sandbox/patch_test_runner.py`(신규, `dast-isolated-net` 격리), `backend_api_client.py`(`report_patch_verification`), `PatchController`(`POST /internal/patches/{id}/verification` `X-Internal-Key`), FE PatchPanel(Verified/Failed/Pending 배지), graph 엣지 연결.
- **인터페이스**: `POST /api/v1/internal/patches/{patchId}/verification` (X-Internal-Key) `{status:"VERIFIED"|"FAILED", log?}` → 200. `patch_test_runner.run(patched_code, test_code, language="python") -> {passed:bool, log:str}`.
- **핵심 로직**: ① 패치+취약점 컨텍스트 → Claude로 **임시 pytest 테스트 생성** → ② **`dast-isolated-net` 격리 컨테이너(Python+pytest 이미지)**에 패치+테스트 마운트 → 실행 → ③ 문법에러/기존테스트 깨짐→`FAILED`, 정상+조치+통과→`VERIFIED` → ④ 내부 API 보고 → 상태/`verified_at`/`verification_log` 갱신.
- **스코프 한정(Dev 권고)**: **Python+pytest 단일 언어**. 다언어(Java/JUnit·JS/Jest)는 후속 이월(이미지 1종으로 M 유지).
- **엣지/실패**: 컨테이너 타임아웃→`FAILED`. 비-Python 언어→`PENDING` 유지(명시). cleanup 실패→강제종료+로그. **격리 누락 시 중단**.
- **준수**: 샌드박스 `dast-isolated-net` 격리 필수 · 테스트코드/로그 페이로드 금지 · 입력검증 Controller · 파라미터 바인딩 · 개별 실패 전체 중단 금지.
- **DoD**:
  - 🧪 단위: 상태 전이(PENDING→VERIFIED/FAILED)·테스트코드 프롬프트 조립
  - 🔬 통합/실행: 문법에러 패치→FAILED, 정상+조치 패치→VERIFIED (Python)
  - ✅ 수동: FE 배지 표시
  - 🛡️ 샌드박스 격리 확인 · 토큰/페이로드 비로그

---

## 이월 (S14 후반 또는 S14+)

| 항목 | 사유 |
|------|------|
| **TASK-1403 / VAL-5** 자동 롤백 | 1401이 PR-only(자동머지 금지)라 운영 리스크 전제 불성립. 자동머지 도입 시점에 필요 |
| **VAL-9** 패치 유효성 측정 하니스 | 1402(프로덕션 검증) 위 벤치 측정 레이어. `benchmarks/patch_validation/` |
| **VAL-8** Semgrep/CodeQL 비교 | 데모 필수 아님. VAL-13 선행 |
| **VAL-13** SARIF 2.1.0 | 데모 필수 아님. VAL-8 전제 |
| **VAL-16** 트리아지 품질 | VAL-4 proven 라벨 의존 → VAL-4 완료 후 |
| **1402 다언어**(Java/JS) | Python+pytest MVP 후 확장 |

---

## 리스크

1. **1401 GitHub App 권한(높음, 외부)**: `contents:write`+`pull_requests:write` 미보유 시 1401 차단 → **킥오프 전 확인·재승인**(§외부 선행조건).
2. **VAL-4 DAST 다건 오케스트레이션 + mapping(높음)**: executor는 디커플링 OK이나 mapping 테이블·WebGoat 기동·정리가 실작업 — **mapping 선행 분리**.
3. **샌드박스 격리(보안·높음)**: VAL-4·1402 `dast-isolated-net` 필수 → **assert·중단 가드**.
4. **1402 신규 Docker 이미지(중)**: Python+pytest 한정으로 M 유지 — 다언어 욕심 시 L로 팽창.
5. **1401↔1402 동일 엔티티 직렬(중)**: `PatchSuggestion`/`PatchService` 공유 → Stage 분리 엄수.
6. **자동머지 유혹(중)**: 1401 PR-only 못 박기 — 어기면 1403 즉시 필요.
7. **Flyway 번호(중)**: 착수 직전 재확인.
8. **외부 의존(중)**: GitHub 테스트 레포·App 설치, WebGoat 이미지, Claude API(1402 테스트 생성 비용).

---

## 완료 게이트 (시연 ① 데모 트랙 — VC ② 마일스톤)

| 마일스톤 | 기준 | 상태 |
|---------|------|------|
| proven_exploitable 증명 | WebGoat 대상 SQLi/XSS proven + scorecard + 데모영상 | 🟡 VAL-4 코드완료(`bcf3804`) — WebGoat 실행 수동검증 대기 |
| 패치 자동 PR | 승인 패치 → 실제 PR 등록(PR-only) | 🟡 1401 코드완료(`bcf3804`) — 실 레포 PR 수동검증 대기 |
| 패치 자가 검증 | Python 패치 Docker 검증 → Verified/Failed 배지 | 🟡 1402 코드완료(`11510ac`) — Docker 샌드박스 실증 수동검증 대기 |

---

## ✅ Stage 1 완료 (2026-06-22) — 커밋 `bcf3804`
2-way 병렬 Dev(VAL-4 ∥ TASK-1401) → 자동 테스트 그린 → Reviewer **PASS**(블로커 0) → 커밋.

#### VAL-4 — SAST→DAST proven_exploitable 하니스 (L)
- 신규 `apps/ai_engine/benchmarks/proven_exploit/{runner,mapping}.py`·`targets/docker-compose.webgoat.yml`·`README.md`. DAST executor 5종 **읽기전용 재사용**(수정 0, 회귀 0).
- `dast-isolated-net` 격리 assert(`DAST_NETWORK` 불일치 시 `SystemExit`)·외부 호스트 능동 스캔 차단·evidence 마스킹. 매직넘버 상수화.
- **단위 53개 통과**(mapping/집계). 통합·proven 실증·데모영상은 WebGoat 실행 필요 → 수동검증(아래).

#### TASK-1401 — 패치 자동 PR (M, PR-only)
- `GitHubRestClient` 신규 4종(`getDefaultBranchSha`·`createBranchRef`·`putFileContents`·`createPullRequest`) + `GitHubAppAuthService.getInstallationTokenForRepo`. `PatchPrService`(소유검증→토큰→브랜치→커밋→PR→코멘트), `POST /api/v1/patches/{id}/pull-request`. FE `PatchManagerPage` "PR 생성" 모달.
- **auto-merge 금지**(PR-only)·토큰 비로그·Controller 입력검증·`sanitizePath`·`PatchSuggestion` 스키마 미변경(1402 V061 보존).
- **단위 12개**(PatchPrService 9 + Controller 3). 실 PR 등록은 테스트 레포 필요 → 수동검증(아래).

**Reviewer 권고(비차단, 후속)**: ① `resolveExistingFileSha()` 항상 null → 기존 파일 업데이트 시 GitHub 409(1402에서 `getFileSha` 추가 예정, 현재 신규파일 create만) · ② FE `patch.vulnId`를 patchId 대용(백엔드 patchId UUID 노출 시 교체) · ③ VAL-4 사설 IP 체크를 `ipaddress.is_private`로 정밀화.

---

## ✅ Stage 2 완료 (2026-06-22) — 커밋 `11510ac`
단독 Dev(TASK-1402) → 자동 테스트 그린 → Reviewer **PASS**(블로커 0) → 커밋.

#### TASK-1402 — 패치 검증 자동화 (M, Python+pytest 한정)
- **DB**: `V061__add_verification_to_patch_suggestions.sql`(최고 V060→V061) — `verification_status`(CHECK PENDING/VERIFIED/FAILED default PENDING)·`verified_at`·`test_code`·`verification_log`.
- **BE**: `PatchSuggestion` 컬럼 + `markVerified()`/`markFailed()` 도메인 메서드. `PatchService.reportVerification`. `POST /api/v1/internal/patches/{id}/verification`(**X-Internal-Key 전용**, InternalKeyAuthFilter 상수시간 비교). `PatchSuggestionResponse`에 검증 필드.
- **AI Engine**: `patch_verify_node`(Claude로 임시 pytest 생성→샌드박스 실행→VERIFIED/FAILED/PENDING 판정→보고), `sandbox/patch_test_runner`(**`dast-isolated-net` 격리 assert**, Python+pytest, 타임아웃→FAILED+강제 cleanup). graph `patch_node→patch_verify_node→END`. `backend_api_client.report_patch_verification`. 비-Python→PENDING.
- **FE**: `PatchManagerPage` `VerificationBadge`(Verified/Failed/Pending).
- **getFileSha**(Stage 1 Reviewer 권고 #1): `GitHubRestClient.getFileSha`(404→null) + `PatchPrService.resolveExistingFileSha` 연결 → 기존 파일 PR 409 해소.
- **단위**: ai_engine 42(상태전이·프롬프트·비Python→PENDING·격리 assert·타임아웃) + backend(PatchSuggestionVerification 5·PatchService 3·Controller 3). **integration 2건**(실 Docker pytest)은 `@pytest.mark.integration` → 수동검증.

**Reviewer 권고(비차단, 후속)**: ① `PatchSuggestion` 검증 4필드에 `@Setter(AccessLevel.NONE)` 적용해 공개 setter 차단(현재 호출처 0, 도메인 메서드만 사용) · ② `getFileSha` ref 유무 if/else 중복 단일화.

### 배치 DAST 엔드포인트 구현 기록 (2026-06-24)

> 이 섹션은 Sprint 14의 "다음 세션 할 것" §4 "배치 DAST 엔드포인트"를 별도 세션에서 구현한 내용 기록

**완료 커밋**: `20d3240` (feat), `38e8683` (docs), `6123d60` (--no-ff 머지)
**구현 방식**:

1. **엔드포인트**: `POST /api/v1/dast/batch` (backend) → `POST /agent/dast/batch` (ai_engine)
   - DTO: `DastBatchRequest{targets: List<DastBatchTarget>, consentGiven, ...}`, `DastBatchTarget{url, vuln_type, ...}`
   - 응답: `DastBatchResponse{session_id, status, summary}` (individual 결과는 SSE)

2. **vuln_type 그룹핑** (효율성)
   - Backend에서 파싱 후 vuln_type별 분류
   - AI Engine에 `batch=true` 플래그 전달 → 그룹당 `dast_guidelines` **1회** 벡터검색
   - 예: SQLi 5건 + XSS 3건 → 지침 캐시 8회→2회 감소

3. **동시성 제어**: `asyncio.Semaphore(_BATCH_CONCURRENCY=4)`
   - 라이브 익스플로잇 도커/네트워크 과부하 방지

4. **단일 SSE** (배치 조기종료 결함 수정)
   - `GET /agent/dast/logs/{session_id}?batch=true` 쿼리파라미터
   - `batch=True`: 개별 `dast_result`에서 종료 X → 최종 `dast_batch_complete` 또는 `dast_error`에서만 종료
   - 시작 시 `dast_result` 캐시 무시 (재구독 조기종료 방어)
   - **주의**: 1차 구현에서 첫 타깃 완료 시 스트림이 닫혀 나머지+배치완료신호 유실 → Reviewer 코드리뷰 중 적발, 재수정

5. **개별 타깃 실패 처리**
   - `asyncio.gather(return_exceptions=True)` → 실패 skip&log
   - 배치 전체 중단 X, 결과 요약에만 실패 건수 표시
   - 상한: 50건

6. **보안**
   - consentGiven · assertDastAllowed(도메인 소유권) 게이트 재사용
   - `target_url`/`params` 로그 금지
   - 입력검증: Backend 공개(400) / AI Engine 내부(422)
   - 문서: API_DESIGN에 레이어별 상태코드 명문화

**테스트**: ai_engine `test_dast_route.py` 24/24 통과 (기존 13 + 배치 11), backend 배치 4 PASS

**Reviewer 게이트**: 1차 FAIL(문서 422/400 불명확) → 재검토 PASS(코드 변경 없음, 문서만 명문화)

---

## 🎉 Sprint 14 코드 완료 (Stage 1+2) — 수동검증은 스프린트 말 일괄 (사용자 결정 2026-06-22)
모든 코어 태스크(VAL-4·1401·1402) 코드·단위테스트·Reviewer PASS 완료. **남은 것 = 런타임 수동검증 일괄**(아래 §누적 수동 검증). 이월(1403/VAL-5·VAL-8·VAL-9·VAL-13·VAL-16)은 별도.

### 누적 수동 검증 체크리스트 (스프린트 말 일괄)
**VAL-4 (WebGoat)**: compose 기동 → `DAST_NETWORK=dast-isolated-net python -m benchmarks.proven_exploit.runner --target-url ...` → SQLi/XSS proven 실증 · scorecard/csv 생성 · DAST_NETWORK 미설정 시 비0 종료 · postgres/redis 도달 불가 · 데모영상 녹화.
**TASK-1401 (테스트 레포+App)**: 패치→PR 등록+코멘트 · FE "PR 생성" 모달→PR 링크 · auto-merge 안 됨 · 권한없음→`GITHUB_AUTH_REQUIRED` · 기존파일 업데이트 PR 409 미발생(getFileSha).
**TASK-1402 (Docker)**: `pytest tests/sandbox/ -m integration -v` → 문법에러 패치→FAILED, 정상 패치→VERIFIED · FE 배지 표시 · 샌드박스 `dast-isolated-net` 격리 · X-Internal-Key 없이 내부 엔드포인트 거부.

---

## 실행 명령어
```
(킥오프 전) GitHub App 권한 확인·재승인 — 외부 선행조건
/stage 1   — VAL-4 ∥ TASK-1401  (서비스 분리 병렬)
/stage 2   — TASK-1402           (1401 후 직렬, Python+pytest 한정)
/done      — 세션 로그
```
