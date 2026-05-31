# [2026-05-31] Sprint 11 Stage 2 + 런타임 검증 + VC 통합(V5.6) + Sprint 13 계획

**브랜치**: `main` (직접 작업, origin 동기화)
**모델**: Claude Opus 4.8
**범위**: (앞 로그 `260531_sprint11_stage1.md` 이후) TASK-1102 + 뱃지 일원화 → `make dev` 런타임 검증/부팅 fix → VC 리뷰(doc 18) 평가·백로그 V5.6 통합 → Sprint 13(EPIC-VAL) 계획

---

## 0. 커밋 (모두 origin/main push 완료)

| 커밋 | 내용 |
|------|------|
| `7c6ce9e` | feat(frontend): **TASK-1102** 페르소나별 랜딩 & 사이드바 분기 |
| `da16485` | docs(sprint): Stage 2 완료 기록 + 태스크 인덱스 동기화 |
| `9b19a93` | docs(session): Sprint 11 /done — Stage 2 + 원격 분기 rebase |
| `e651fb9` | fix(backend): **WebClient.Builder 빈 수동 등록** — Spring Boot 4.0.5 부팅 실패 해결 |
| `76a5174` | docs(backlog): V5.6 — **VC 리뷰(doc 18) 통합 평가** |
| `b870b33` | docs(backlog): V5.6 — VC 우선순위 구체화(신규 9태스크 + 로드맵 재정렬) |
| `8d932e7` | fix(frontend): **TASK-1102 뱃지/게이팅 단일 소스 일원화** |
| `55c9c5f` | docs(sprint): **Sprint 13(EPIC-VAL) 계획 확정** (PM+Dev) |

> 원격 세션 커밋(`d4b66a8`·`0079615`·`94723fe`·`6524444`)은 push 중 divergence로 **rebase 통합**(무충돌). 그중 `94723fe`가 앞 세션에서 "기존 부채"로 짚은 AI 13건 mock 실패를 해소.

---

## 1. TASK-1102 — 페르소나별 랜딩 & 사이드바 (Stage 2) ✅

- **실측 정정**: `/dashboard` 라우트는 없음 → dashboard는 `/editor` 내 `viewMode` 토글. 로그인/OAuth 콜백에서 `authUser.workspaceMode`로 viewMode 설정(SECURITY_MANAGER→dashboard, 그 외→editor) 후 `/editor` 랜딩.
- AppHeader 페르소나 배지, AppSidebar 보안담당 시 취약점·SBOM 상단 강조. tsc 0 + 프론트 17 테스트 통과.
- **push 중 원격 divergence(4커밋)** 발생 → `git rebase origin/main` 무충돌 통합 후 푸시(앞 세션에서 우려했던 시나리오 실제 발생, 강제 푸시 없이 처리).

---

## 2. 뱃지/게이팅 단일 소스 일원화 (TASK-1102 후속 버그 수정) ✅

**발견**: 워크스페이스 모드 뱃지가 **2개** 존재하고 소스가 달랐음.
- 좌측 Pagori 옆 `ModeIndicator`(⬡ DEV/🛡 SEC MGR) ← `useSecureStore.workspaceMode` (온보딩에서만 set → **로그인 후 stale**)
- 내가 1102에서 추가한 토글 옆 배지 ← `authUser.workspaceMode` (DB `/me`, 권위)
- 같은 stale 소스가 **"분석 시작" 버튼 읽기전용 게이팅**도 구동 → 보안담당 로그인 시 좌측 ⬡ DEV로 남고 게이팅 어긋날 수 있던 버그.

**수정**: AppHeader `workspaceMode` 소스를 `authUser.workspaceMode`로 교체(권위 단일화) → ModeIndicator·게이팅 자동 정합. 중복 배지 제거. `ModeIndicator`를 3값(useAuthStore) + BOTH(⬢ BOTH) 처리로 확장. (`8d932e7`)

---

## 3. `make dev` 런타임 검증 + 백엔드 부팅 fix ✅

> 사용자 요청으로 실제 스택을 띄워 검증. (브라우저 시각 확인은 드라이버 없어 사용자 몫)

- **부팅 블로커 발견·수정**: 백엔드 재빌드 시 `SlackWebhookAdapter`가 `WebClient.Builder` 빈을 못 찾아 컨텍스트 부팅 실패(크래시 루프). Spring Boot 4.0.5 servlet 앱에서 webflux 의존성이 있어도 `WebClientAutoConfiguration`이 Builder 빈을 제공하지 않음 → `AppConfig`에 `WebClient.builder()` 빈 명시 등록(`e651fb9`). **베타 전 어차피 막혔을 블로커를 선제 해소.**
- **Flyway V048·V049 적용 성공** + 컬럼 4개 생성 + **기존 사용자 `workspace_mode=DEVELOPER` 백필** 확인.
- **페르소나 API 데이터 플로우 실검증**(실서버):
  - 동의 누락 가입 → **400**, 동의 포함 → **201** (TASK-1104)
  - DB: workspace_mode 기본값 + terms/privacy/marketing 동의 저장
  - 로그인 → GET /me `workspaceMode=DEVELOPER` → PATCH SECURITY_MANAGER **200** / HACKER **400** → /me **SECURITY_MANAGER** 반영 (TASK-1101)
  - 프론트 `/login` **200** (서빙 정상)
- **결론**: 페르소나 랜딩을 구동하는 백엔드 데이터·엔드포인트 전부 동작 확인. 브라우저 시각 랜딩만 사용자 확인 대기. (사용자 뱃지 변경 확인 완료)
- 검증 메모: register 500은 **curl 한글 displayName UTF-8 깨짐**(테스트 아티팩트)이었고 코드 버그 아님 — ASCII 재시도로 정상.

---

## 4. VC 리뷰(doc 18) 평가 + 백로그 V5.6 통합 ✅

`docs/18_VC_REVIEW_RESPONSE_260530.md`(원격 작성)가 백로그에 미치는 영향 평가 후 통합.

**평가 결론**: 전략 방향(검증 숫자 최우선 + 한국 컴플라이언스 쐐기 + 캐싱)은 타당하나, **"20개 신규"가 아님**:
- 🔴 **ID 충돌**: doc 18의 `TASK-1301~1303`이 **기존 Sprint 13(멀티파일·오탐·모델벤치)과 정면 충돌** → **EPIC 접두 ID**(VAL-/WEDGE-/MOAT-/ECON-)로 재정의.
- 🔁 **다수 중복**: 패치안전=1402/1403, 규제매핑=ComplianceMappingService, 증적=MISC-002, 트리아지=FEAT-AI-003, 원가계측=1204, 증분스캔=1106, 가격=Sprint17 등 12건이 기존과 겹침.
- → **순수 신규 9건**(VAL-1·3·4·ECON-1·MOAT-1·4·WEDGE-3·4·5)만 materialize. 나머지는 기존 확장/재정의.

**반영(V5.6)**: 평가 + ID해소 + 중복/신규 매핑표 + 신규 9태스크 DoD/사이즈 표 + **로드맵 재정렬**(Sprint13=EPIC-VAL, Sprint14=검증된 AI, Sprint15~16=EPIC-WEDGE, Sprint12에 ECON-1 캐싱). 상세 서사/KPI는 doc 18 링크.

---

## 5. Sprint 13 계획 (EPIC-VAL — 검증 우선) ✅ 계획 확정

PM(Opus 4.8) → Dev 현실성 평가 → 확정. `docs/sprints/sprint-13.md` 기록(`55c9c5f`).

- **범위**: Stage1(병렬) VAL-1(벤치 하니스)·VAL-3(AST 가드)·MOAT-1(트리아지 피드백) / Stage2 VAL-2(eval CI 게이트).
- **Dev 평가가 바꾼 결정**:
  - **VAL-4(SAST→DAST 증명) → Sprint 14 이월** — 실측 5개 신규 레이어 + VAL-3 직렬 의존 + DAST 인프라 의존(L×2 회피). 옵션 B(SQLi 데모)는 Sprint 6 단건과 차별점 없어 기각.
  - VAL-3 파서: tree-sitter 비현실적 → **Python `ast` + Java `javalang` + TS/JS 정규식**, 검증은 "라인 실재" MVP.
  - **`save_vulnerabilities()`가 sast_node 내부** → VAL-3가 save를 검증 후로 이관 필요.
  - **Flyway V052부터** (V050/V051은 Sprint 12 TASK-1202a/1202b가 선점).
  - VAL-1 `--limit` 샘플 코어(2,740 풀런은 야간), VAL-2는 VAL-1 기준점 후(직렬).
  - proven_exploitable 내부 API 누락 → VAL-4(이월분) 명세에 포함.
- **목표**: VC 지적③(검증 부재) → "FP율/탐지율 정량 숫자 + 가짜인용 0건 + 독점 라벨 데이터 수집 개시".

---

## 6. 현재 상태 (세션 종료 시점)

- **main `55c9c5f`, origin 동기화**, 미커밋 없음(추적 안 되는 `docs/dev-docs/`만).
- **Sprint 11**: dev(코드) **전부 완료**(Stage 0·1·2). 남은 것 = **수동 검증** ↓
  - 이번 기능 브라우저 확인(페르소나 랜딩·온보딩 저장·동의 차단·legal·Progress 아코디언) — 뱃지는 확인됨
  - **TASK-1105 = Sprint 7~10 수동 검증 부채 청산**(PDF·이메일·Android·ZAP·k6·2FA QR·Nginx HTTPS·Slack·VSCode 등) — 가장 큰 잔여분
- **Sprint 12 (보안 코어)**: **미착수** — sprint-12.md 없음, V050/V051 없음, 구현 커밋 0. (GitHub App·해시체인·세션·**토큰비용 1204**·백업·관측성·이메일 전부 미구현)
- **Sprint 13 (EPIC-VAL)**: 계획 확정, **착수 전**(`/stage 1` 대기).

---

## 7. 다음 세션에서 할 것

- [ ] `git pull --rebase` (다른 세션과 main 공유 — 원격 선행 가능)
- [ ] 우선순위 결정 (택1):
  - (a) **Sprint 11 잔여 수동검증(TASK-1105)** 마무리 → Sprint 11 공식 종료(부채 대장 ✅ 0건)
  - (b) **Sprint 13 `/stage 1`** 착수 (VAL-1·VAL-3·MOAT-1 — VC 검증 숫자)
  - (c) **Sprint 12(보안 코어)** 먼저 (토큰 비용 통제·인증 등 운영 필수)
- [ ] `git remote set-url origin .../secureai-editor.git` (원격 이전 안내 정리)

---

## 8. 의논·결정 요약 (왜)
- **뱃지 일원화**: 사용자가 "좌측 dev 뱃지가 다른 거냐" 질문 → 두 소스(useSecureStore 2값 stale vs authUser 3값 권위) 불일치 + 게이팅까지 영향하는 실버그 발견 → 권위 소스 단일화로 1102 마무리.
- **make dev 검증 = 부팅 fix 수확**: 런타임 검증 시도가 Spring Boot 4 WebClient.Builder 부팅 블로커를 선제 발견·해소. Flyway·API 데이터 플로우까지 실증.
- **VC 통합은 "추가"가 아니라 "재정의"**: ID 충돌·중복 때문에 그대로 추가 시 혼선 → EPIC 접두 ID + 매핑 흡수 + 재우선순위 권고로 통합.
- **Sprint 13 VAL-4 이월**: Dev 실측으로 작업량 과소평가 확인(5 신규 레이어) → 한 스프린트 L×2 + 직렬 의존 회피, doc 18 90일 로드맵(7~8주차)과도 정합.
