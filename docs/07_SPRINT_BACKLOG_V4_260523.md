# SecureAI — 스프린트 & 백로그 V4
> 기준일: 2026-05-22 | 방법론: Scrum | 스프린트 단위: 2주  
> **정본 지정일**: 2026-05-23 | 구버전(`07_SPRINT_BACKLOG_V2.md`, `V3.md`) 아카이브 완료

## 버전 이력

| 버전 | 기준일 | 주요 변경 |
|------|--------|---------|
| V2 | Sprint 6 완료 | Sprint 6 DAST 완료 기록, Sprint 7(리포트·대시보드·Android) 계획 추가 |
| V3 | Sprint 7 완료 | Sprint 7 완료 기록, Sprint 8(안정화·보안·런칭 준비) 계획 추가. 프론트엔드 Pagori 리디자인 현황 포함 |
| V4 | 2026-05-22 | Sprint 8/9 완료 기록, Sprint 10 Enterprise 백로그 추가 (TASK-1001~1004: 야간 스캔·팀 대시보드·리포트 Export·스캔 모드). 미구현 프론트엔드 화면 7개 목록 추가 |
| V5 | 2026-05-26 | Sprint 10 완료 처리. Sprint 11 범위 재정의 (refactor/frontend-ui 통합). Sprint 12 ADR-016 중복 제거 → GitHub App 인증 스텁 해소로 교체. Sprint 11~16 방향 구체화 |
| V5.1 | 2026-05-28 | Sprint 11~18 평가 + 누락 항목 13개 보강 (법적페이지/수동검증청산/해시체이닝/세션관리/토큰추적/백업/모델벤치/패치롤백/로그집계/결제/Hardening Sprint 신설) |
| V5.2 | 2026-05-28 | pages-inventory & UX 스펙 대조 후 11개 태스크 보강 (알림센터/관리자온보딩/EnterpriseChannels/마켓플레이스/모바일3state/QBR/status) + Future 5개 (TTS/ChatHistory/온콜/단축키/모바일채팅) |
| V5.3 | 2026-05-28 | **양방향 동기화 완료** — pages-inventory ↔ 백로그 갭 5건 보강: TASK-1208(EnterpriseLogs 감사 로그 페이지) / TASK-1208b(SettingsSecurity 2FA FE 전체) / TASK-1209(EnterprisePolicies) / TASK-1705(EnterpriseScale 랜딩) / TASK-1706(EnterpriseLaunch 30/60/90 플레이북). pages-inventory에 신규 페이지 15종(`/legal/*`, `/notifications`, `/admin/onboarding`, `/admin/audit-logs`, `/admin/policies`, `/settings/channels`, `/settings/security`, `/integrations`, `/billing`, `/enterprise`, `/enterprise/launch`, `/admin/master/qbr`, `apps/status/`) 추가 |
| V5.4 | 2026-05-29 | TASK-1106 신설 — API 중심 분석 계획 & 진행률 패널 (api_discovery_node · api_plan SSE 이벤트 · fileFilter 선택 분석 · 프론트 Progress Panel 개편). Sprint 11 Stage 3으로 편입 |
| V5.5 | 2026-05-30 | Sprint 11 Stage 0(브랜치 통합) 완료 기록. **Sprint 12 분할** — 보안·운영 필수(12)와 Enterprise Admin UI(12B)로. 관측성(Loki·Sentry) Sprint 16/18 → 12 편입. **TASK-1210 트랜잭션 이메일 인프라** 신설. Flyway: 리포트 V047 확정에 따라 workspace_mode V048/legal_consent V049 |
| **V5.6 (현재)** | 2026-05-31 | Sprint 11 Stage 1·2 dev 완료(1101·1102·1103·1104·1106) + 런타임 검증(make dev). **VC 리뷰 대응(doc 18) 통합** — EPIC VAL/WEDGE/MOAT/ECON 평가·ID충돌(Sprint13) 해소·중복 매핑·재우선순위 권고. WebClient.Builder 부팅 fix |
| V5.6.1 | 2026-06-06 | TASK-1105 수동검증 갭 등록 — **TASK-1203b 신설**(OWASP ZAP DAST 스캔 하니스, Sprint 12, TASK-1203 선행). 레포에 ZAP 하니스 0건(검증 인프라 미비) 확인. 수동검증 부채 대장의 "ZAP Critical 0건"(Sprint 8) → 1203b로 이관 |

---

## 전체 로드맵

```
Sprint 0  (Week 01-02): 환경 세팅 & 인프라 기반                        ✅ 완료
Sprint 1  (Week 03-04): 인증 & 프로젝트 관리                           ✅ 완료
Sprint 2  (Week 05-06): AI Agent 기반 & MCP + 체크포인트 시스템          ✅ 완료
Sprint 3  (Week 07-08): SAST 파이프라인 & GitHub 레포 스캔               ✅ 완료
Sprint 4  (Week 09-10): 웹 에디터 UI & 실시간 SSE + 체크리스트 UI        ✅ 완료
Sprint 5  (Week 11-12): GitHub Layer 2 완성                            ✅ 완료 (일부 이월 → feat/sprint5-github)
Sprint 6  (Week 13-14): DAST 엔진 & Docker 샌드박스                     ✅ 완료 (PR #70)
feat/sprint5-github:    Sprint 5 이월 구현 (별도 브랜치)                 ✅ 완료 (Sprint 10 흡수)
Sprint 7  (Week 15-16): 리포트 & 대시보드 & Android MVP                  ✅ 완료
Sprint 8  (Week 17-18): 안정화 & 보안 강화 & 런칭 준비                ✅ 완료
Sprint 9  (Week 19-20): VSCode Extension & 지속 모니터링 (Phase 3)        ✅ 완료
Sprint 10 (Week 21-22): Enterprise B2B + GitHub Integration                ✅ 완료 (Stage 1~5, feat/sprint10)
refactor/frontend-ui:   Pagori 리디자인 Stage 1~6 (온보딩·설정·SBOM·ChatFAB) ⚠️ 미머지 → Sprint 11 통합
Sprint 11 (Week 23-24): QA + 브랜치 통합 + Persona-based UX                 ✅ dev 완료 (1105 수동검증만)
Sprint 12 (Week 25-26): 보안 코어 & 관측성 + ECON-1(프롬프트 캐싱)          예정
Sprint 12B(분할/후순위): Enterprise Admin UI (알림센터·온보딩·감사로그UI·2FA FE·정책)          예정
Sprint 13 (Week 27-28): ★EPIC-VAL 검증 우선 (벤치 점수·AST가드·SAST→DAST증명·트리아지 피드백) 예정 (V5.6 재정렬)
Sprint 14 (Week 29-30): 검증된 AI (패치 자동화 + VAL-5 안전장치=1402/1403)     예정
Sprint 15 (Week 31-32): ★EPIC-WEDGE 컴플라이언스 쐐기 + Ecosystem/MCP        예정 (V5.6)
Sprint 16 (Week 33-34): EPIC-WEDGE 파일럿/준비도 + Live Scan Simulator (Loki→Sprint12) 예정
Sprint 17 (Week 35-36): 수익화 인프라 (Payment + Billing)                       예정 (신규 — V5 추가)
Sprint 18 (Week 37-38): Hardening Sprint (E2E·a11y·시크릿·Swagger·StatusPage; Sentry는 Sprint 12로 이동) 예정
EPIC-MISC:              독립 기능 (스프린트 비종속)
```

---

## 현재 위치 (Status) — 2026-05-31
- **브랜치**: `main` (origin 동기화). Sprint 11 **Stage 0·1·2 dev 완료**(1100·1101·1102·1103·1104·1106) — 빌드/테스트 그린, 푸시 완료
- **남은 것**: TASK-1105(수동 검증 청산, 👤 사용자) + 실런타임 검증(`make dev`)
- **다음 액션**: Sprint 11 수동 검증 후 **Sprint 12**(보안 코어: GitHub App 인증·해시체인·세션·토큰비용·백업·관측성·이메일)
- **TASK-1105 검증 갭 등록(2026-06-06)**: "OWASP ZAP Critical 0건"(Sprint 8 부채) 검증 시도 중 **레포에 ZAP 하니스/설정 0건** 발견 → 검증 인프라 미비. 신규 **TASK-1203b**(ZAP DAST 스캔 하니스, Sprint 12, TASK-1203 선행) 등록. 해당 부채 항목은 1203b로 이관 후 청산.
- **런타임 검증(2026-05-31)**: `make dev` 백엔드 부팅 ✅(WebClient.Builder 빈 누락 fix `e651fb9` 후), Flyway V048/V049 적용 ✅, 페르소나 API 플로우(가입·동의400·로그인·/me workspaceMode·PATCH200/400) ✅, 프론트 `/login` 200 ✅. 브라우저 시각 랜딩만 사용자 확인 대기.

---

## ⚡ VC 리뷰 대응 — 사업 방어력 재포지셔닝 (doc 18 통합, V5.6)

> 출처: `docs/18_VC_REVIEW_RESPONSE_260530.md` (2026-05-30). VC가 지적한 5약점(해자·레드오션·검증부재·범위과대·단위경제성)에 대응하는 4개 에픽(VAL/WEDGE/MOAT/ECON).

### 평가 (Opus 4.8)
- **방향 타당**: ① 보안 제품의 정량 신뢰도(FP율·탐지율) 부재는 생존 문제 → VAL 최우선이 맞다. ② 한국형 컴플라이언스 증적은 **이미 만든 자산(Sprint 8 보안문서 생성·Sprint 10 ComplianceMappingService)** 의 재포지셔닝이라 ROI가 높다. ③ 프롬프트 캐싱·증분 스캔은 토큰 비용 구조적 절감 quick win.
- **단, "20개 신규"가 아님**: doc 18의 TASK는 **(a) 기존 Sprint 13 TASK-1301~1303과 ID 충돌** + **(b) 다수 기존 항목과 중복**. 그대로 추가 시 혼선 → 아래처럼 **EPIC 접두 ID 재정의 + 중복 흡수**로 통합.

### ⚠️ ID 충돌 해소
기존 Sprint 13에 **TASK-1301(멀티파일)·1302(오탐학습)·1303(모델벤치)** 이 이미 있음 → VC 태스크는 **EPIC 접두 ID**로 표기: `VAL-1..6 · WEDGE-1..5 · MOAT-1..4 · ECON-1..5`. (doc 18의 TASK-13xx 번호는 그 문서 내부 표기로만)

### 중복/신규 매핑
| VC 항목 | 기존 백로그 관계 | 처리 |
|---|---|---|
| VAL-1 OWASP Benchmark 하니스 / VAL-3 AST 할루시네이션 가드 / VAL-4 SAST→DAST proven_exploitable | **신규** | 신규 — 핵심 차별점·최우선 |
| VAL-2 평가 CI 게이트 | TASK-1203 확장 | 1203에 eval-score 게이트 추가 |
| VAL-5 패치 안전장치 | **TASK-1402·1403 중복** | 1402/1403로 흡수(auto-merge 금지 원칙) |
| VAL-6 신뢰 지표 대시보드 | **TASK-1303(모델벤치) 중복** | 1303을 "신뢰 지표 대시보드"로 재정의 |
| WEDGE-1 취약점→규제 매핑 | ComplianceMappingService+FEAT-COMP-002 확장 | 기존 확장(ISMS-P/행안부 심화) |
| WEDGE-2 증적 패키지 고도화 | **TASK-MISC-002 Level 2 중복** | MISC-002 Level 2로 흡수 |
| WEDGE-3 준비도 대시보드 / WEDGE-4 재포지셔닝(문서) / WEDGE-5 파일럿 PoC(GTM) | 신규 | 신규 |
| MOAT-1/2 트리아지 피드백+리랭커 | **FEAT-AI-003+Sprint13 1302 중복** | 1302/FEAT-AI-003 흡수 + 기각/채택 버튼 UI 신규 |
| MOAT-3 시스템 오브 레코드 | 감사로그(1202a)+증적 누적 | 기존 위 서사화 |
| MOAT-4 모델 비종속 명문화(문서) | BYOK(완료) | 신규(문서) |
| ECON-1 프롬프트 캐싱 | **신규 quick win** | 신규 — 즉시 효과 |
| ECON-2 증분 스캔 | **TASK-1106 fileFilter(완료) 확장** | 1106 위 PR-diff 한정 추가 |
| ECON-3 모델 캐스케이드 | TASK-1004 스캔모드 확장 | 1004 확장 |
| ECON-4 스캔 원가 계측 | **TASK-1204(토큰 추적) 중복** | 1204로 흡수(스캔당 원가 대시보드) |
| ECON-5 가격 재설계 | Sprint 17(결제) 확장 | Sprint 17에 구독/per-repo 반영 |

→ **순수 신규**: VAL-1·VAL-3·VAL-4 · WEDGE-3·4·5 · MOAT-1(피드백 UI)·MOAT-4 · ECON-1. 나머지는 기존 태스크 확장/재정의.

### 재우선순위 권고 (전략 제안 — 실제 편성은 `/sprint`에서 확정)
- **근시일 최우선(1~2주)**: VAL-1(벤치 점수) · ECON-1(프롬프트 캐싱) · MOAT-1(기각/채택 버튼) → "FP율 X% / 토큰 절감 / 데이터 수집 개시" 첫 숫자 확보.
- 기존 **Sprint 13(AI Advanced)·14(패치)** 를 VAL-3/4/5와 통합해 "검증된 AI"로 재구성.
- **WEDGE(컴플라이언스 쐐기)** 는 9~12주 — 기존 컴플라이언스 자산 위 재포지셔닝.
- 상세 서사·DoD·KPI는 doc 18 참조.

### 신규 태스크 구체화 (materialized — 스프린트 편성 대상)
> EPIC 접두 ID. 흡수 항목(VAL-2/5/6·WEDGE-1/2·MOAT-2/3·ECON-2/3/4/5)은 기존 태스크에서 처리(매핑표). 아래는 **순수 신규 9건**.

| ID | 제목 | DoD 요약 | 사이즈 |
|----|------|---------|--------|
| **VAL-1** 🔴 | OWASP Benchmark 평가 하니스 | 2,740 케이스 → TPR/FPR/score, `make eval` 한 방. README에 FP율/탐지율 첫 숫자 | M |
| **VAL-3** 🔴 | 결정론적 검증 레이어(AST 할루시네이션 가드) | 모델 보고 file:line·source→sink를 AST로 실재 검증, 불일치 findings 자동 폐기 | L |
| **VAL-4** 🔴 | SAST→DAST `proven_exploitable` 연결 | SAST 의심 → DAST 샌드박스 익스플로잇 성공 시 라벨. "증명" 데모 영상 1편. (인접: ZAP 스캔 하니스 **TASK-1203b** — 단, VAL-4는 AI 라벨링이고 1203b는 회귀 스캔 게이트로 별개 트랙. 묶지 않음) | L |
| **ECON-1** 🔴 | 프롬프트 캐싱 | 가이드라인 컨텍스트 Anthropic prompt caching. 캐시 적중률+토큰 절감률 계측 (claude-api 스킬) | S |
| **MOAT-1** 🟠 | 트리아지 피드백 UI(확인/기각/채택) | findings 라벨 저장 → 독점 학습 데이터. FEAT-AI-003 리랭커 입력 | M |
| **WEDGE-3** 🟠 | 컴플라이언스 준비도 대시보드 | "ISMS-P 준비도 73%, 미충족 12개" (ComplianceMappingService 위) | M |
| **WEDGE-4** 🟢 | 피치/문서 재포지셔닝(문서) | README·랜딩·피치덱 "컴플라이언스 증적 자동화" 중심 | S |
| **WEDGE-5** 🟠 | 파일럿 고객 PoC(GTM) | ISMS-P 준비 기업과 "3주→3일" 사례 1건 | L |
| **MOAT-4** 🟢 | 모델 비종속 아키텍처 명문화(문서) | BYOK·모델선택을 "무기"로 서사화 | S |

### 채택된 로드맵 (V5.6 재우선순위)
- **Sprint 12** (보안 코어) + **ECON-1(프롬프트 캐싱)** 끼움 — 즉시 토큰 절감.
- **Sprint 13 = EPIC-VAL(검증 우선)**: VAL-1 · VAL-3 · VAL-4 + **MOAT-1**(데이터 수집 1주차 시작) + VAL-2(→1203 eval 게이트). *기존 Sprint 13(멀티파일/오탐/모델벤치)은 VAL-6(신뢰 대시보드=1303 재정의)·MOAT-2(오탐학습=FEAT-AI-003)로 재배치.*
- **Sprint 14 = 검증된 AI**: 기존 패치(1401) + VAL-5(=1402/1403 안전장치, auto-merge 금지).
- **Sprint 15~16 = EPIC-WEDGE(컴플라이언스 쐐기)**: WEDGE-1(규제 매핑 심화) · WEDGE-3(준비도) · WEDGE-5(파일럿) · WEDGE-4.
- 배경 누적: MOAT(데이터 플라이휠)·시스템 오브 레코드는 전 스프린트 걸쳐 누적.
- ⚠️ 실제 스프린트 배정·DoD 확정은 `/sprint 13`(Opus 4.8 PM)에서.

### EPIC-VAL 확장 — 객관 검증 방법 보강 (2026-06-15)
> 출처: `docs/memo/SECUREAI_BENCHMARK_GUIDE.md` + `docs/memo/SECUREAI_VALIDATION_ROADMAP.md` 정합 + 신규 방법 발굴.
> **정합 확인**: 메모의 OWASP Benchmark = 기존 **VAL-1**, Juliet/DAST(WebGoat·Juice Shop) = VAL-1/VAL-4 확장으로 흡수, eval CI 게이트 = 기존 **VAL-2**. 아래는 **메모엔 있으나 미태스크화된 것(VAL-7·8)** + **두 문서 모두에 없던 신규 방법(VAL-9~13)**.

| ID | 제목 | DoD 요약 | 사이즈 | 배치 | 선행 |
|----|------|---------|--------|------|------|
| **VAL-7** 🔴 | 실제 CVE 재현 벤치 | GHSA/CVEfixes·Big-Vul에서 Java/Python 취약 커밋 20~30 케이스 → real-world recall(전체·CWE별), `benchmarks/cve/` 독립 하니스, reproduction_scorecard.md | M | **S13** | VAL-1 하니스 |
| **VAL-8** 🟠 | 기존 도구 비교(Semgrep·CodeQL) | 동일 코퍼스에 Semgrep(무료)·CodeQL → 도구별 TPR/FPR/Youden 대비표 + **차등분석**("SecureAI 단독 탐지 N건") + 막대그래프 | M | **S13말~S14** | VAL-1·VAL-7 코퍼스, VAL-13(SARIF) 권장 |
| **VAL-9** 🔴⭐ | **패치 유효성 검증** | AI 패치 적용 → **재스캔 시 취약점 소거율** + **대상 프로젝트 테스트 그린(기능 회귀 0) 비율** + CVEfixes의 human fix 대비 의미동치. "탐지"가 아닌 "교정"을 증명 — 경쟁 SAST 미보유 수치 | M | **S14** | 패치 자동화(1401) |
| **VAL-10** 🟠 | 결정성/안정성 하니스 | 동일 입력 N회(예 5) 반복 → finding 집합 **Jaccard 안정성·분산** 지표. LLM-SAST "매번 다르지 않나" 의심에 수치로 답 | S | **S13** | VAL-1 하니스 재사용 |
| **VAL-11** 🟢 | CWE 커버리지 매트릭스 | **CWE Top 25 / OWASP Top 10(2021)** 대비 탐지가능 여부 매트릭스(벤치 결과 기반 자동 생성) → IR/지원서 1장 아티팩트 | S | **S13** | VAL-1 결과 |
| **VAL-12** 🟠 | 분석기 적대적 견고성 | 스캔 대상 코드 내 **프롬프트 인젝션/오인 유도 주석**으로 탐지 우회·오탐 유발 가능한지 측정(우회 성공률). AI 보안도구 자체 신뢰성 | M | **S14+** | sast_node 안정화 |
| **VAL-13** 🟠 | SARIF 2.1.0 표준 출력 | findings → SARIF 산출 → **GitHub code scanning 업로드** + Semgrep/CodeQL과 (file,line,CWE) 정규화 공정비교 기반. 기능이자 표준 상호운용 신뢰신호 | M | **S13말~S14** | — |

**배치 원칙(메모 §단계배치와 동일 — 싸고·빠르고·혼자·IR숫자 즉효 우선)**:
- **Sprint 13(검증 우선)**: VAL-1(벤치)·VAL-3(AST가드)·VAL-4(SAST→DAST) + **VAL-7(실CVE)·VAL-10(결정성)·VAL-11(CWE커버리지)** + MOAT-1(데이터수집). → "탐지율 X% / 오탐률 Y% / 실CVE recall Z% / CWE Top25 N개 / 안정성 S" 한 번에 확보.
- **Sprint 14(검증된 AI=패치)**: 패치 자동화(1401) + **VAL-9(패치검증)** + VAL-5(안전장치) + **VAL-8(도구비교)·VAL-13(SARIF)**. → "패치 소거율·회귀0 / Semgrep 대비 단독 N건".
- **S14+ 여유**: VAL-12(적대적 견고성).
- ⚠️ 실제 배정·DoD 확정은 `/sprint 13`(Opus 4.8 PM)에서. 위는 후보·근거 정리.

---

## 태스크 인덱스 (활성 스프린트)
> 사이즈: **S**(작음·단일 파일/컴포넌트) · **M**(중간·1~2 레이어) · **L**(큼·다중 서비스/다수 파일). 기간은 표기하지 않고 상대 규모만 표시.
> 스프린트 용량 점검: 한 스프린트의 L 합계가 과다하면(대략 L 2개 초과) 분할 검토.

| 스프린트 | 태스크 | 제목 | 상태 | 사이즈 |
|---------|--------|------|------|--------|
| 11 | 1100 | 브랜치 통합 | ✅ | L |
| 11 | 1101 | Persona 온보딩 BE+FE | ✅ | M |
| 11 | 1102 | 페르소나 랜딩·사이드바 | ✅ | M |
| 11 | 1103 | 디자인 시스템 통일 | ✅ | S |
| 11 | 1104 | 법적 페이지 3종+동의 | ✅ | L |
| 11 | 1105 | Sprint 10 수동검증 청산 | ✅ | M |
| 11 | 1106 | API 중심 분석 패널 | ✅ | L |
| 12 | 1201 | GitHub App 인증 완성 | ⬜ | L |
| 12 | 1202a | 감사 로그 해시체인 | ✅ | M |
| 12 | 1202b | 세션 관리·강제 로그아웃 | ✅ | M |
| 12 | 1203 | CI/CD 품질 게이트 | ⬜ | M |
| 12 | 1203b | OWASP ZAP DAST 스캔 하니스 | ⬜ | M |
| 12 | 1204 | AI 토큰 비용 통제 | ⬜ | L |
| 12 | 1205 | 자동 백업+S3 | ✅ | M |
| 12 | 1210 | 트랜잭션 이메일 인프라 | ⬜ | M |
| 12 | 1603·1804(편입) | 관측성 (Loki·Sentry) | ✅ | M |
| 12B | 1206 | 알림 센터 페이지 | ⬜ | L |
| 12B | 1207 | 관리자 온보딩 체크리스트 | ⬜ | M |
| 12B | 1208 | 감사 로그 페이지 | ⬜ | M |
| 12B | 1208b | 2FA 프론트엔드 | ⬜ | M |
| 12B | 1209 | 보안 정책 관리 | ⬜ | M |
| 13~18 | — | AI Advanced·Ecosystem·시각화·결제·Hardening | 📋 계획 | 각 섹션 참조 |

---

## 수동 검증 부채 대장 (Verification Debt Ledger)
> ✅ 수동 검증이 스프린트마다 미완료로 누적되는 만성 문제 대응.
> **규칙: 스프린트 완료 게이트 = 해당 스프린트 ✅ 잔여 0건 (또는 이월 사유 명시 승인)**. 미구현 기능의 ✅는 부채가 아니라 백로그(기능 구현 시 함께 검증).

| 출처 | 미검증 항목(요약) | 상태 | 처리 |
|------|------------------|------|------|
| Sprint 7 | PDF 내용·CycloneDX 검증, 차트 5종 시각화, Android 실기기 로그인·루팅·TLS·네비·FCM/SSE | 🟢 구현완료·검증대기 | TASK-1105 일부 + Android 실기기 |
| Sprint 8 | perf p95<500ms·캐시히트·N+1, ZAP Critical 0·SQLi·XSS, Nginx HTTPS 리다이렉트, 2FA QR | 🟢 구현완료·검증대기 | TASK-1105 (2FA login 검증은 1208b 의존). **ZAP Critical 0건은 실행 수단 미비 → TASK-1203b(하니스 구축)로 이관 후 청산** |
| Sprint 9 | Slack 알림 포스팅, VSCode `.vsix` 설치, Android 채팅/PDF공유/알림채널 | 🟢 구현완료·검증대기 | TASK-1105 + 클라이언트 실환경 |
| Sprint 10 | 12건(야간스캔·팀대시보드·ROI·스캔모드·FE 3종 + 이월 4건) | 🟡 진행 | TASK-1105 전담 |
| Sprint 5/6 | GitHub Webhook→PR 자동분석·Check Run, 커밋 시크릿 스캔 | 🔴 차단 | GitHub App 인증 스텁 — **Sprint 12 TASK-1201 선행** |
| Sprint 9 | PostgreSQL/Docker MCP 조회·권한 (904/905) | ⚪ 미구현 | 기능 자체가 Sprint 15 후보 (부채 아님) |

---

## 테스트 표기 범례

- 🧪 **단위 테스트** — 각 개발자가 작성하는 자동화 테스트
- 🔬 **통합 테스트** — 여러 컴포넌트 조합 동작 검증
- ✅ **수동 검증** — 사람이 실제로 확인해야 하는 항목
- 🛡️ **보안 검증** — 보안 관점 확인 항목
- 📏 **사이즈** — S / M / L 상대 규모 (기간 아님). 태스크 인덱스 표 + 각 태스크 헤더에 표기

---

## Sprint 0~5 — 완료 (요약)

> 상세 내용: `docs/sprints/sprint-0.md` ~ `docs/sprints/sprint-5.md` 참조

### Sprint 0 — 환경 세팅 & 인프라 기반 ✅ 완료

- [x] TASK-001: 모노레포 Git 초기화 및 디렉토리 구조 생성
- [x] TASK-002: Docker Compose 전체 서비스 구성
- [x] TASK-003: Spring Boot 프로젝트 초기화
- [x] TASK-004: Python AI Agent 서비스 초기화
- [x] TASK-005: MCP Server 초기화 (Node.js)
- [x] TASK-006: Next.js 프론트엔드 초기화
- [x] TASK-007: GitHub Actions CI 파이프라인 기본 설정

### Sprint 1 — 인증 & 프로젝트 관리 ✅ 완료

- [x] TASK-101: JWT 인증 시스템 구현
- [x] TASK-102: GitHub OAuth 연동
- [x] TASK-103: 플랜 체계 및 Rate Limit 구현
- [x] TASK-104: 프로젝트 CRUD API
- [x] TASK-105: 사용자 정보 API & 프론트엔드 인증 UI

### Sprint 2 — AI Agent 기반 & MCP + 체크포인트 시스템 ✅ 완료

- [x] TASK-201: LangGraph 보안 감사 그래프 구축
- [x] TASK-202: MCP Filesystem Tool → SAST 노드 연동
- [x] TASK-203: Spring Boot ↔ AI Agent HTTP 연동 & SSE 브릿지
- [x] TASK-204: 취약점 저장 파이프라인 & Spring 이벤트
- [x] TASK-205: 진행 로그 시스템 구축
- [x] TASK-206: LangGraph Checkpointer 통합
- [x] TASK-207: 중단 감지 및 재개 API

### Sprint 3 — SAST 파이프라인 완성 & GitHub 레포 스캔 ✅ 완료

- [x] TASK-301: 파일 배치 SAST — 전체 프로젝트 스캔
- [x] TASK-302: CWE/OWASP 분류 자동 매핑 & API 호출 체인 구성
- [x] TASK-303: GitHub 레포지토리 API 기반 코드 스캔 (일부 이월)
- [x] TASK-304: 패치 에이전트 구현
- [x] TASK-305: CVE 기초 데이터베이스 & SBOM 파서 인터페이스
- [x] TASK-306: 보안 지식 베이스(SKB) 구축 및 초기 동기화

### Sprint 4 — 웹 에디터 UI & 실시간 SSE + 체크리스트 UI ✅ 완료

- [x] TASK-401: Monaco 에디터 통합 & 취약점 인라인 하이라이팅
- [x] TASK-402: SSE 실시간 구독 & 취약점 실시간 표시
- [x] TASK-403: VSCode 스타일 에디터 레이아웃 & 파일 트리
- [x] TASK-404: 취약점 상세 패널 & AI 채팅 패널
- [x] TASK-405: AI 채팅 API 및 UI
- [x] TASK-406: 진행 체크리스트 MD 자동 생성 & UI
- [x] TASK-407: 로컬 폴더 열기 (showDirectoryPicker)
- [x] TASK-408: 크레딧 시스템 & BYOK & 모델 선택

### Sprint 5 — GitHub Layer 2 (일부 완료, 일부 이월) ✅/🟠

> TASK-501~505는 DAST와 의존성 없어 Sprint 6 이후로 이월.  
> `feat/sprint5-github` 브랜치에서 진행 중.  
>
> **이월 처리 결정 (2026-05-23)**: Sprint 10에서 GitHub Integration Sprint로 묶어 처리.  
> `feat/sprint5-github` 브랜치는 Sprint 10 시작 시 `feat/sprint10-github`로 재사용(리베이스).  
> TASK-505(GitHub Security Advisory)는 Enterprise 기능 성격으로 EPIC-MISC로 이관.

- [x] TASK-503: GitHub 레포 나머지 파일 전체 SAST 최적화
- [x] TASK-504: SBOM 완성 & CVE 매칭
- [ ] TASK-501: GitHub Webhook 이벤트 수신 → **Sprint 10 배정** (🔴 Critical)
- [ ] TASK-502: PR 분석 자동 트리거 → **Sprint 10 배정** (🔴 Critical, TASK-501 선행 필요)
- [ ] TASK-505: GitHub 연동 설정 UI → **Sprint 10 배정** (🟡 Medium, TASK-501/502 완료 후)

---

## Sprint 6~10 — 완료 (요약)

> 상세 완료 기록·구현 방식·테스트 체크리스트(✅/🔬/🛡️ 상태 포함)는 `docs/sprints/sprint-6.md` ~ `sprint-10.md` 참조.
> 각 스프린트의 미완료 ✅ 수동 검증 항목은 위 **수동 검증 부채 대장** 으로 일원화 관리.

### Sprint 6 — DAST 엔진 & Docker 샌드박스 ✅ (PR #70, DVWA SQLi 시연 완료)
- TASK-601 Docker 샌드박스 DAST(5종 익스플로잇, Strategy `_EXECUTOR_MAP`) · 602 도메인 소유권+Rate Limit(분산 락) · 603 DAST LangGraph 에이전트 · 604 터미널 UI(ANSI→React, XSS 안전)
- 추가 구현: FEAT-SEC-006 pgvector 임베딩(bge-small), AuditLog 활성화(V030~V031)

### feat/sprint5-github 이월 → Sprint 10 흡수
- TASK-503/504 완료(레포 SAST 최적화 · SBOM+CVE 매칭). 501/502(Webhook·PR 자동분석)는 Sprint 10에서 구현했으나 GitHub App 인증(`extractInstallationToken`/`resolveProjectId`) 스텁 → **Sprint 12 TASK-1201에서 해소**. 505(Security Advisory)는 EPIC-MISC.

### Sprint 7 — 리포트 & 대시보드 & Android MVP ✅
- TASK-701 PDF/JSON 리포트(OpenPDF, 다운로드 토큰+Path Traversal 방어) · 702 대시보드 집계 API+Redis 캐시 · 703 Android 인증(EncryptedSharedPrefs·인증서 피닝·RootDetector) · 704 Android 대시보드+Room 캐시 · 705 FCM+SSE 이중 알림
- 대시보드 차트 5종은 이후 V4 리디자인에서 완성

### Sprint 8 — 안정화 & 보안 강화 ✅
- 801 ShedLock(6 Job) · 802 Circuit Breaker(AI/NVD/DNS, Resilience4j) · 803 성능/캐시(@EntityGraph·@BatchSize) · 804 보안 헤더+ZAP · 805 Nginx+SSL · 806 2FA(TOTP+복구코드) · 807 IP Allowlist(CIDR) · 808 OpenTelemetry · 809 GDPR Export/Delete
- 보안 문서 자동 생성 Level 1(CISO·행안부·ISMS-P), SBOM 화면 포함

### Sprint 9 — VSCode Extension & 모니터링 (Phase 3) ✅
- 901 지속 모니터링(Slack·SSL 만료) · 902 VSCode Extension(.vsix) · 903 Android 고도화(채팅 스트리밍·PDF 공유·알림 채널 3종) · 906 Prometheus+Grafana · 907 GDPR 하드 삭제 스케줄러
- ⚠️ **904 PostgreSQL MCP / 905 Docker MCP는 미구현** → Sprint 15(Ecosystem & MCP 확장) 후보로 이관

### Sprint 10 — Enterprise B2B + GitHub Integration ✅ (feat/sprint10)
- 1001 야간 자동 스캔 · 1002 팀 대시보드+Gamification(MTTR) · 1003 리포트 ROI Export · 1004 스캔 모드(AUDIT/PIPELINE 모델 분기) · FE: 컴플라이언스 매핑·팀 관리·설정 스캔모드 기본값
- ⚠️ 잔존 기술 부채: `totalCreditsUsed`(credit_transactions 미연동)·GitHub App 토큰 스텁 → **Sprint 12 TASK-1201/1204**. 수동 검증 12건 → **Sprint 11 TASK-1105** 청산.

---

## Sprint 11 — QA 통합 + Persona UX + 브랜치 머지
> Week 23-24  
> **목표**: ① Sprint 0~10 전체 기능 수동 검증 및 버그 수정 ② `refactor/frontend-ui` 브랜치 통합 ③ 페르소나 기반 UX 완성
>
> **선행 조건**: `feat/sprint10` → main PR 머지, `refactor/frontend-ui` 충돌 해소 후 머지
>
> **주의**: `refactor/frontend-ui` (Pagori 리디자인 Stage 1~6)가 미머지 상태로 10커밋 앞서 있음.  
> `settings/page.tsx` 충돌 예상 — feat/sprint10의 ScanModeDefaultSection 유지 우선.

---

### TASK-1100 🔴 브랜치 통합 및 충돌 해소 (선행 필수)
- **중요도**: 🔴 Critical | **순서**: 0번째 (나머지 모두 선행) | **사이즈**: L
- **하위 할일**
  - [ ] `feat/sprint10` → `main` PR 생성 및 머지
  - [ ] `refactor/frontend-ui`를 `main`으로 머지 (충돌 해소)
    - `settings/page.tsx`: Sprint 10의 ScanModeDefaultSection 섹션 유지
    - `onboarding/page.tsx`: refactor 브랜치 버전 유지 (더 완성도 높음)
  - [ ] 머지 후 `make dev` 전체 서비스 기동 확인
- **테스트 체크리스트**
  - [ ] 🔬 머지 후 백엔드 전체 테스트 통과 (`./gradlew test`)
  - [ ] ✅ 모든 주요 페이지 렌더링 오류 없음 확인

---

### TASK-1101 🔴 Persona 기반 온보딩 — 역할 선택 + 백엔드 연동
- **중요도**: 🔴 Critical | **순서**: 1번째 | **의존성**: TASK-1100 | **사이즈**: M
- **맥락**: `refactor/frontend-ui`의 `onboarding/page.tsx` (842줄)이 이미 구현됨.  
  역할 선택 UI 자체는 존재하나 백엔드 API 연동이 없음.
- **하위 할일**
  - [ ] **Backend**: `V048__add_workspace_mode_to_users.sql` — `users.workspace_mode TEXT DEFAULT 'DEVELOPER'`
  - [ ] **Backend**: `PATCH /api/v1/users/me/workspace-mode` API 구현  
    (`workspace_mode` 값: `DEVELOPER` | `SECURITY_MANAGER` | `BOTH`)
  - [ ] **Backend**: `GET /api/v1/users/me` 응답에 `workspaceMode` 필드 추가
  - [ ] **Frontend**: `useAuthStore`에 `workspaceMode` 상태 추가
  - [ ] **Frontend**: `onboarding/page.tsx` 역할 선택 단계에서 실제 API 호출로 연동
- **테스트 체크리스트**
  - [ ] 🧪 `PATCH /workspace-mode` — 유효하지 않은 값 400 반환 (단위 테스트)
  - [ ] ✅ 온보딩 역할 선택 → DB 저장 → 로그인 후 workspaceMode 응답 포함 확인

---

### TASK-1102 🔴 로그인 후 페르소나별 랜딩 및 사이드바 분기
- **중요도**: 🔴 Critical | **순서**: 2번째 | **의존성**: TASK-1101 | **사이즈**: M
- **하위 할일**
  - [ ] `AuthProvider.tsx`: 로그인 성공 시 `workspaceMode`에 따라 `/editor` 또는 `/dashboard` 리다이렉트
  - [ ] `AppSidebar.tsx`: `DEVELOPER` — 에디터·SAST·SBOM 메뉴 강조, CISO 대시보드 하단 배치  
    `SECURITY_MANAGER` — 대시보드·컴플라이언스·리포트 메뉴 강조, 에디터 단순화
  - [ ] `layout.tsx` 또는 미들웨어: 역할에 맞지 않는 경로 접근 시 적절히 안내 (금지 X, 안내 O)
- **테스트 체크리스트**
  - [ ] ✅ DEVELOPER 로그인 → `/editor` 랜딩, 사이드바 에디터 중심 메뉴
  - [ ] ✅ SECURITY_MANAGER 로그인 → `/dashboard` 랜딩, 컴플라이언스·리포트 메뉴

---

### TASK-1103 🟠 디자인 시스템 통일 (refactor/frontend-ui 통합 후)
- **중요도**: 🟠 High | **순서**: 3번째 | **의존성**: TASK-1100 | **사이즈**: S
- **맥락**: `refactor/frontend-ui`의 `globals.css`에 추가된 토큰이 이미 있음. 통합 후 잔존 불일치 제거.
- **하위 할일**
  - [ ] 머지 후 페이지별 스타일 불일치 항목 목록 작성
  - [ ] 카드 외곽선, 섀도우, 폰트 스케일 — Pagori 토큰으로 통일 (globals.css 기준)
  - [ ] 다크 테마에서 모든 인터랙티브 요소 hover/focus 상태 일관성 확인
- **테스트 체크리스트**
  - [ ] ✅ 주요 페이지 5개(에디터, 대시보드, 온보딩, 설정, 컴플라이언스) 디자인 일관성 육안 확인

---

### TASK-1104 🔴 법적 페이지 3종 (ToS · Privacy · Cookie) — 배포 전 필수
- **중요도**: 🔴 Critical | **순서**: 4번째 | **의존성**: TASK-1100 | **사이즈**: L
- **배경**: 프론트엔드 `apps/frontend/src/app` 하위에 `terms/`, `privacy/`, `legal/` 디렉토리 0개. GDPR(EU), PIPA(한국), CCPA(캘리포니아) 준수 명시 없이는 글로벌 배포 불가. 회원가입 폼에 동의 체크박스도 없음.
- **하위 할일**
  - [ ] `apps/frontend/src/app/legal/terms/page.tsx` — 이용약관 (한/영, 데이터 처리 범위 명시)
  - [ ] `apps/frontend/src/app/legal/privacy/page.tsx` — 개인정보처리방침 (GDPR Art. 13 / PIPA 30조 필수 항목)
  - [ ] `apps/frontend/src/app/legal/cookie/page.tsx` — 쿠키 정책 + Banner 컴포넌트 (`CookieConsentBanner.tsx`)
  - [ ] 회원가입 폼에 `terms_accepted_at`, `privacy_accepted_at` 동의 체크박스 추가 + `users` 테이블 컬럼 (V049 마이그레이션)
  - [ ] 푸터(Footer)에 법적 페이지 3종 링크 추가
- **테스트 체크리스트**
  - [ ] 🔬 동의 미체크 시 회원가입 400 반환
  - [ ] 🛡️ 회원가입 시 동의 시각(`terms_accepted_at`) DB 저장 확인 — 분쟁 시 증빙
  - [ ] ✅ 푸터에서 3개 페이지 모두 접근 가능 + Cookie Banner 거절 시 비필수 쿠키 미설정 확인

---

### TASK-1105 🟠 Sprint 10 수동 검증 일괄 처리 (이월 청산)
- **중요도**: 🟠 High | **순서**: 5번째 (Stage 1과 병행 가능) | **사이즈**: M
- **배경**: Sprint 10 완료 기준 체크리스트 12개 전부 `[ ]` 상태. 코드는 구현됐으나 실제 동작 미확인 — 베타 배포 전 일괄 검증 필수.
- **하위 할일**
  - [ ] 야간 자동 스캔 (`project_schedules` 매일 01:00 KST 트리거 확인)
  - [ ] 팀 대시보드 — 월별 토큰·MTTR·보안 점수 랭킹 표시 (실제 데이터로 확인)
  - [ ] 리포트 ROI Export — ROI/MTTR 위젯 포함 PDF 다운로드 확인
  - [ ] 스캔 모드 AUDIT/PIPELINE 모델 분기 확인 (`grep claude-haiku` 로그)
  - [ ] CompliancePage / TeamManagementPage / SettingsPage UI 동작 확인
  - [ ] 이월 수동 검증 4건: k6 p95 < 500ms / OWASP ZAP Critical 0건 / 2FA QR Google Authenticator / Nginx HTTPS 리다이렉트
- **테스트 체크리스트**
  - [ ] ✅ 위 모든 항목 체크 완료 + 발견 버그는 Sprint 11 잔여 시간에 즉시 수정

---

### TASK-1106 🟠 API 중심 분석 계획 & 진행률 패널

- **중요도**: 🟠 High | **순서**: Stage 3 (TASK-1100 완료 후 독립 진행) | **의존성**: TASK-1100 | **사이즈**: L
- **배경**: 현재 AI 분석은 파일 단위 우선순위 정렬로 진행되며 사용자에게 "무엇을 분석하는지"가 보이지 않음.  
  사용자가 분석 전에 API 구조를 확인하고 원하는 API만 선택해서 분석할 수 있도록 개선.  
  Sprint 13 "AI Agent Advanced I (API 호출 경로 스캔)" 의 MVP 선행 구현.
- **하위 할일**

  **[AI Engine] `api_discovery_node` 신설** — LLM 없이 정적 파싱
  - [ ] Spring Boot: `@GetMapping/@PostMapping/@PutMapping/@DeleteMapping/@RequestMapping` 파싱 → URL + 메소드명 추출
  - [ ] FastAPI: `@router.get/post/put/delete` 데코레이터 파싱 → URL 추출
  - [ ] Next.js App Router: `app/api/**/route.ts` 경로 구조 → URL 자동 도출
  - [ ] React/TS SPA: `axios.create()` baseURL + `axios.get/post('/...')` 호출 사이트 파싱 (`api.ts`, `client.ts`, `axios.js` 등)
  - [ ] Prefix 기반 연관 파일 그룹화:  
    `*Controller.java` / `*Service.java` / `*ServiceImpl.java` / `*Repository.java` / `*Mapper.java` 동일 prefix → 한 그룹  
    (`AuthController` → `AuthService` + `AuthServiceImpl` + `AuthRepository`)
  - [ ] import 문 depth-1 추적: 각 Controller 파일의 직접 import를 그룹 파일 목록에 포함 (순환 참조 방어 필수)
  - [ ] 출력 state: `api_groups: [{name, url, files: [{path, line}]}]`

  **[AI Engine] `analyze.py` 이벤트 확장**
  - [ ] `api_plan` Redis 이벤트 추가: `scan_files_node` 완료 직후, 분석 시작 전 발행 (`api_groups` 전체 포함)
  - [ ] `scan_complete` 이벤트: `total` 외에 `files: List[str]` 추가 (프론트 전체 파일 목록 수신용)

  **[Backend] SSE 이벤트 + 세션 API**
  - [ ] `AnalysisController` SSE stream: `api_plan` 이벤트 타입 통과 (현재 필터 없으면 자동 통과 — 확인만)
  - [ ] `CreateSessionRequest`에 `fileFilter: List<String>` 옵션 필드 추가 (null = 전체 분석)
  - [ ] AI Engine 분석 요청(`POST /agent/analyze`) 시 `fileFilter` 전달

  **[AI Engine] `scan_files_node` fileFilter 지원**
  - [ ] `fileFilter` 목록이 있으면 수집한 파일 중 해당 목록만 `files_to_scan`에 포함

  **[Frontend] Progress Panel 개편**
  - [ ] `api_plan` 이벤트 수신 시: API 그룹별 아코디언 렌더링
    - 그룹 헤더: API 이름 + URL + 진행률 바 (0/N 파일)
    - 파일 목록: 각 파일 `pending` 상태 (회색 점)
  - [ ] `progress` 이벤트로 파일별 상태 업데이트: `pending → analyzing → done | cached | failed`
    - 파일별: 상태 아이콘 + 소요 시간
    - 그룹별: 완료 파일 수 증가 → 진행률 바 채움
  - [ ] 파일 클릭 → Monaco Editor 해당 파일 열기 (`line: 1` 기본, 향후 취약점 라인 연동)
  - [ ] "선택 분석" 모드: API 그룹별 체크박스 → "선택한 API만 분석" 버튼 클릭 시 `fileFilter` 포함해서 세션 생성

- **테스트 체크리스트**
  - [ ] 🧪 `api_discovery_node`: Spring Boot `AuthController.java` 파싱 → `AuthService`, `AuthServiceImpl`, `AuthRepository` 그룹 포함 확인
  - [ ] 🧪 `scan_files_node`: `fileFilter` 제공 시 해당 파일만 `files_to_scan`에 포함
  - [ ] ✅ 분석 시작 직후 Progress Panel에 API 그룹 목록 렌더링 확인
  - [ ] ✅ 파일별 상태가 `progress` 이벤트에 따라 실시간 업데이트 확인
  - [ ] ✅ 파일 클릭 시 Monaco Editor에서 해당 파일 열림 확인
  - [ ] ✅ API 그룹 2개 선택 해제 → 해당 파일 제외 후 분석 재시작 확인

---

## Sprint 12 — 보안 코어 & 운영 관측성 (Security Core & Observability)
> Week 25-26  
> **목표**: ① GitHub App 인증 스텁 해소 ② 감사 로그 불변성 + 세션 관리 ③ AI 토큰 비용 통제 ④ 백업/복구 ⑤ 운영 관측성(로그 집계·에러 추적) + 트랜잭션 이메일 인프라 ⑥ CI/CD 품질 게이트
> **재구성 (V5.5, 2026-05-30)**: 기존 Sprint 12가 11개 태스크로 과적 → **보안·운영 필수**(본 Sprint)와 **Enterprise Admin UI**(Sprint 12B)로 분할. 베타 운영에 직결되는 관측성(Loki·Sentry)·이메일 인프라를 Sprint 16/18에서 본 Sprint로 앞당김.
> **실행 우선순위**: **TASK-1204(토큰 비용 통제)·TASK-1201(인증)을 최우선**. 실사용자 유입 시 토큰 비용 폭주와 웹훅 미동작이 가장 큰 리스크.
> **참고**: ADR-016(AI Engine → Backend API 전환)은 Sprint 9에서 완료됨 — 제외.
> **진행 포인터 (2026-06-12)**: 통합 마스터 계획 `docs/sprints/sprint-12.md`(3트랙: 본진/12C/12D). 브랜치 `feat/sprint12`. **Stage1=12D Phase1(COST-1 프로바이더 추상화+Gemini 라우팅, COST-2 품질벤치) 완료**(`75a9ca9`) — Gemini 실호출로 **크레딧 402 블로커 해소 증명**(Anthropic 0 사용). **TASK-1204(토큰비용)는 12D COST-3으로 흡수**(provider 인지 확장, Phase2 예정). ECON-1(프롬프트 캐싱)은 구현 완료로 폐기. 다음: 본진 1201/1202a·b 또는 12D Phase2.

---

### TASK-1201 🔴 GitHub App 인증 플로우 완성 (Sprint 10 기술 부채 해소) — 🟢 구현완료(`ffba377`)·실웹훅 검증대기
- **중요도**: 🔴 Critical | **순서**: 1번째 | **사이즈**: L | **상태**: 코드+단위 28 그린 / 🔬 실 GitHub App PEM 대기
- **배경**: `GitHubWebhookService`의 `extractInstallationToken()` / `resolveProjectId()`가 스텁으로 남아  
  PR 자동 분석·Check Run API가 실제로 동작하지 않음.
- **하위 할일**
  - [x] GitHub App private key (PEM) + App ID 환경변수 **배선** (`GITHUB_APP_ID`/`GITHUB_APP_PRIVATE_KEY`/`_PATH`, GitHubConfig) — ⚠️ PEM 실값은 사용자 발급 대기(App ID 3851268 설정됨)
  - [x] `extractInstallationToken(payload)`: `installation.id` → App JWT(RS256) → Installation Token 교환 (`GitHubAppAuthService`)
  - [x] `resolveProjectId(owner, repoName)`: `projects.github_repo_full_name`(`owner/repo`) 역조회, 미매칭 시 null→분석 skip (※ github_repo_url 컬럼 부재로 full_name 재활용)
  - [x] `credit_transactions` 연동 — `OrgAnalyticsService.sumCreditsByOrgMembers` + `OrganizationService` totalCreditsUsed
- **테스트 체크리스트**
  - [x] 🧪 Installation Token 교환 로직 단위 테스트 (mock GitHub API)
  - [ ] 🔬 실제 GitHub Webhook push → resolveProjectId 성공 → 분석 세션 생성 확인 (PEM 발급 후)
  - [x] 🛡️ invalid JWT/App 미설정 → GITHUB_APP_AUTH_FAILED / skip 확인 (단위)

### TASK-1211 🔴 PR 웹훅 → AI 취약점 분석 디스패치 (1201 후속) — 🟢 구현완료·실PR 디스패치 검증
- **중요도**: 🔴 Critical | **순서**: 1201 직후 | **사이즈**: M | **출처**: 1201 검증 중 발견(2026-06-12) | **상태**: 코드+단위 그린, 실 PR(#78)로 웹훅→설치토큰→Check Run→startAnalysis→AnalysisSession 생성까지 검증. 단 **Gemini 실분석은 MCP github 도구 미운영으로 차단 → TASK-1212로 분리**.
- **배경**: TASK-1201로 GitHub App 인증(설치토큰)+Check Run 배선은 완료됐으나, `GitHubWebhookService.handlePullRequest()` line 192~197이 `// TODO: PR 전용 분석 엔드포인트 구현 후 연결`로 **실제 분석 호출이 비어 있음**. PR을 열어도 Check Run(in_progress)만 뜨고 취약점 분석/결과가 없음. **1201(인증)+12D(Gemini 분석)를 잇는 마지막 칸.**
- **발견 핵심**: `AiAgentClient.startAnalysis(...sourceType,githubOwner,githubRepo,githubRef,githubToken,...,scanMode,fileFilter)` GitHub 변종이 **이미 존재** → 웹훅이 호출만 하면 됨(변경파일=fileFilter, 설치토큰=githubToken, scanMode=AUDIT→Gemini).
- **하위 할일**
  - [x] `handlePullRequest`: AnalysisSession 생성(`AnalysisService` 패턴 미러링) → `aiAgentClient.startAnalysis`(github, fileFilter=changedFiles, githubToken=설치토큰, scanMode=AUDIT) 호출
  - [x] PR↔세션 연결: `pr_review_history`에 `session_id`, `installation_id` 컬럼 추가(Flyway V051)
  - [x] 완료 콜백: `RedisSubscriber`가 분석 완료(sessionId) 수신 → PrReviewHistory 역조회 → `installation_id`로 설치토큰 재발급 → `completeCheckRunAfterAnalysis`
  - [x] 에러/타임아웃 시 Check Run failure 마감(`finalizeCheckRunOnError`)
- **테스트 체크리스트**
  - [x] 🧪 handlePullRequest가 startAnalysis(github,fileFilter,token,AUDIT) 호출 (mock)
  - [x] 🧪 완료 콜백 → PrReviewHistory markCompleted + Check Run 완료 (mock)
  - [x] 🔬 실 PR(#78,ngrok) → 웹훅→설치토큰→Check Run→startAnalysis→**AnalysisSession 생성** 검증 (로그 확인). Gemini 실분석 산출은 TASK-1212 차단.
- **선행/전제**: 1201(✅), 12D COST-1 Gemini 라우팅(✅). **후속 차단: TASK-1212(MCP github 도구).**
- **실 시연 발견·수정(2026-06-12 커밋)**: 웹훅 보안경로 `/webhooks`→`/api/v1/webhooks`(401 차단 버그), JWT exp 600→540s(시계스큐), **AnalysisSession 미생성→SESSION_NOT_FOUND 수정**, docker-compose GitHub App env 전달+PEM 마운트.

### TASK-1212 🟠 MCP GitHub 도구체인 운영화 (github-소스 분석 활성화) (신규 — 2026-06-12)
- **중요도**: 🟠 High | **순서**: 1211 후속(github 분석 실동작 전제) | **사이즈**: M | **출처**: TASK-1211 실 PR 시연 중 발견
- **배경**: TASK-1211로 PR→웹훅→설치토큰→분석 디스패치(`source_type=github`, scanMode=AUDIT)까지 실증됐으나, **ai_engine의 github-소스 분석이 MCP github 도구(`github_list_directory`/`list_github_files`)로 레포 파일을 읽는데 그 MCP 도구체인이 운영 안 됨** → `[scan_files] MCP tool 'github_list_directory' not found`로 분석 중단. 1201/1211과 무관한 **기존 인프라 의존성**.
- **실측(2026-06-12)**: ai_engine 컨테이너에 `node`(/usr/bin/node)·`/app/mcp_server`(dist/node_modules) **존재**. MCP 서버는 **STDIO 서브프로세스로 ai_engine이 spawn**(별도 컨테이너 아님, compose에서 주석처리). 그러나 ① `[mcp] postgres_ro start failed — No such file or directory`(spawn 경로/엔트리 문제 추정) ② github MCP 도구 미등록(`GITHUB_TOKEN` 컨테이너 env 미설정, github MCP 서버 spawn/등록 실패).
- **하위 할일**
  - [ ] `agent/mcp_client.py` STDIO spawn 경로 점검 — `node <entry>` / `npx <server>` 커맨드가 컨테이너에서 실제 기동되는지(엔트리 파일 경로, dist 빌드 유무, npx 오프라인 캐시)
  - [ ] github MCP 서버 등록 + 설치토큰 주입 경로 — 분석 시 전달되는 installation token을 github MCP 도구(`list_github_files`/read)가 사용하도록 배선(현재 `GITHUB_TOKEN` env 미설정)
  - [ ] `scan_files_node`(source_type=github) → MCP 도구 실호출로 레포 파일 목록/내용 획득 → SAST 분석까지 전구간
  - [ ] (선택) MCP 서버 미가용 시 명확 폴백/에러 메시지(현재 tool not found로 세션 무한 in_progress)
- **테스트 체크리스트**
  - [ ] 🔬 ai_engine MCP github 도구 등록 확인(spawn 성공 + `github_list_directory` 가용)
  - [ ] 🔬 실 PR(#78 재시연) → github-소스 분석이 변경파일 읽고 취약점 산출 → Check Run ✓/✗ + PR 코멘트(취약점 N건)
- **선행/전제**: TASK-1211(✅), MCP 서버(`apps/mcp_server`) 빌드본, github 설치토큰 플러밍.

### TASK-1202a 🔴 감사 로그 불변성 (해시 체이닝) — 🟢 **완료**(`9f1a964`, Stage3)
- **중요도**: 🔴 Critical | **순서**: 2번째 | **출처**: FEAT-COMP-003 | **사이즈**: M
- **하위 할일**
  - [x] `audit_logs` 테이블에 `prev_hash`, `current_hash` 컬럼 추가 (Flyway **V055**)
  - [x] 신규 감사 로그 저장 시 이전 로그 해시 → 현재 로그 해시 체인 구성 (`SHA-256(prev_hash + canonical payload)`) — ReentrantLock+REPEATABLE_READ+SELECT FOR UPDATE 단일라이터 직렬화(AuditLogChainAppender/AuditLogHashService)
  - [x] `GET /api/v1/admin/audit-logs/verify` — 해시 체인 무결성 검증 API (@PreAuthorize admin)
  - [ ] (선택) 외부 SIEM(AWS CloudTrail/Azure Monitor) 비동기 전송 — 미구현(선택 항목)
- **테스트 체크리스트**
  - [x] 🧪 중간 로그 위변조 시 무결성 검증 API에서 감지 (단위 테스트) — AuditVerifyServiceTest(중간/genesis/prev_hash 조작 감지)
  - [ ] 🔬 운영 환경에서 10만건 체인 검증 1초 이내 (성능 검증 미실행)

### TASK-1202b 🔴 세션 이력 관리 및 강제 로그아웃 — 🟢 **완료**(`9f1a964`, Stage3)
- **중요도**: 🔴 Critical | **순서**: 2번째 (1202a와 병렬) | **출처**: FEAT-SEC-003 | **사이즈**: M
- **하위 할일**
  - [x] `user_sessions` 테이블 (**V056**: user_id, jwt_jti, device_info, ip, user_agent, created_at, revoked_at)
  - [x] `GET /api/v1/users/me/sessions` — 내 활성 세션 목록
  - [x] `DELETE /api/v1/users/me/sessions/{sessionId}` — 특정 세션 강제 로그아웃 (Redis JWT blacklist, TTL=토큰 잔여만료)
  - [x] Settings 페이지에 "활성 기기 관리" 섹션 추가 (ActiveDeviceSection)
- **테스트 체크리스트**
  - [x] 🔬 강제 로그아웃 시 즉시 JWT 무효화 + 다음 요청 401 반환 — JwtAuthenticationFilterBlacklistTest(필터 레벨), 🔬 실 앱+Redis e2e는 수동검증
  - [x] 🛡️ 타 사용자 세션 조회/삭제 시도 → 403 — UserSessionServiceTest(revokeSession_nonOwner_throws403)

### TASK-1203 🟡 CI/CD 품질 게이트 (k6 + ZAP + SCA) — 🟢 **완료**(`ebc4329`, Stage5)
- **중요도**: 🟡 Medium | **순서**: 3번째 | **사이즈**: M
- **선행**: ZAP 스캔 자체 실행 수단은 **TASK-1203b**(로컬 하니스)에서 구축 — 본 태스크는 그 하니스를 GitHub Actions에 연결만.
- **하위 할일**
  - [x] k6 부하 테스트 — GitHub Actions 통합 (p95 < 500ms 게이트, `ci-quality-gate.yml` k6-load-test)
  - [x] OWASP ZAP 보안 스캔 CI 통합 (Critical/High 0건 게이트) — **TASK-1203b `infra/zap/gate.py` 재사용**
  - [x] **npm audit / pip-audit / OWASP Dependency-Check** — 의존성 SCA 자동화 (HIGH/CVSS≥7 차단). ⚠️ frontend npm audit은 기존부채(next.js 연쇄 1 high+1 critical)로 `continue-on-error`(경보전용) — 후속 audit-ci allowlist 전환 권고
  - [x] **JaCoCo + Codecov** 백엔드 라인 커버리지 게이트 — 임계 **58%**(실측 59.73%) 도입, build.gradle.kts 주석에 Sprint13 65%→Sprint14 70% 점진상향 명시
- **테스트 체크리스트**
  - [ ] 🔬 성능 저하/보안 취약점/커버리지 미달 PR은 자동 차단 확인 (GH Actions 실행 — 수동검증; 로컬: yml 파싱 OK·jacocoTestCoverageVerification BUILD SUCCESSFUL)
- **후속(비차단, Reviewer 권고)**: ① k6-action env(BASE_URL) 전달 확인/`args --env` 보강 ② frontend npm audit→`audit-ci --allowlist <CVE>` 전환(Sprint13 전) ③ 커버리지 65% 상향 태스크 Sprint13 등록

### TASK-1203b 🟠 OWASP ZAP DAST 스캔 하니스 구축 (baseline scan + Critical 게이트) (신규 — V5.6) — 🟢 **완료**(`0101624`, Stage4)
- **중요도**: 🟠 High | **순서**: 3번째 (TASK-1203 선행) | **사이즈**: M | **출처**: TASK-1105 수동검증 갭 (2026-06-06)
- **배경**: Sprint 8 TASK-804에서 보안 헤더·ZAP 게이트를 "구현"으로 표기했고, 수동 검증 부채 대장에도 "ZAP Critical 0건"(Sprint 8)이 검증 대기로 누적돼 있다. 그러나 **레포에 ZAP 스캔 하니스/설정이 전혀 없어**(`find -iname "*zap*"` 0건) 검증을 실행할 수단 자체가 없음 — 이는 Sprint 8/10 구현 결함이 아니라 **검증 인프라 미비**다. k6 부하테스트는 `make perf-test`(docker compose `--profile perf`)로 존재하지만 DAST(ZAP) 스캔은 등가 수단이 없다. 본 태스크가 그 실행 수단(로컬 하니스)을 만들고, TASK-1203이 이를 CI에 연결한다.
- **하위 할일**
  - [x] `docker-compose.yml`에 ZAP 서비스 추가 — `ghcr.io/zaproxy/zaproxy:stable`, **`--profile zap`** (perf 프로파일과 동일한 옵트인 패턴)
  - [x] `make zap-scan` 타겟 추가 (`make perf-test` 패턴 동형) — `zap-baseline.py`. full scan은 `SCAN_TYPE=full`로 전환
  - [x] 스캔 대상 URL 환경변수화(`ZAP_TARGET_URL`, 기본 nginx 엔드포인트)
  - [x] ZAP 룰 설정 파일(`infra/zap/rules.tsv` + `zap-baseline.conf`)로 오탐 룰 IGNORE/WARN/FAIL 등급 관리
  - [x] 결과 리포트 HTML/JSON → `infra/zap/reports/` 마운트, `.gitignore` 등록
  - [x] **Critical/High(riskcode≥3) 집계 → 1건+ exit 1 게이트** (`infra/zap/gate.py`, 단위테스트 23)
  - [x] **`dast-isolated-net` 격리** — zap이 해당 네트워크에만 연결(data-net 미연결 → postgres/redis 직접 도달 불가). Reviewer 네트워크 레이어 검증 PASS
  - [x] `docs/runbooks/zap-dast.md` 사용법 + 게이트 해석 가이드
- **테스트 체크리스트**
  - [ ] 🔬 `make dev` 기동 후 `make zap-scan` 실행 → baseline 스캔 완료 + 리포트(HTML/JSON) 생성 확인 (도커 환경 — 수동검증)
  - [ ] 🛡️ 의도적 취약 응답 주입 시 게이트 비정상 종료코드 반환 (게이트 로직은 gate.py 단위테스트로 검증 / 실 스캔 주입은 수동검증)
  - [x] 🛡️ ZAP 컨테이너가 `dast-isolated-net` 격리 — postgres/redis 도달 불가 (Reviewer 네트워크 토폴로지 검증). 🔬 실 컨테이너 격리는 수동검증
  - [ ] ✅ Sprint 8 부채 "ZAP Critical 0건" 항목을 본 하니스로 실제 실행하여 청산 (수동검증 — 실 스캔 리포트 첨부)

### TASK-1204 🔴 AI 토큰 사용량 추적 + 한도 알림 (비용 통제) — 🟢 **12D COST-3로 구현완료**(`72d873d`)
- **중요도**: 🔴 Critical | **순서**: 4번째 | **사이즈**: L | **상태**: 12D COST-3(provider 인지 확장)로 완료 — token_usage(V054)·PricingTable·세션종료 콜백·월100% 403(BYOK 제외)·`GET /me/token-usage`·TokenUsageChart. 🔬 실콜백/대시보드 수동검증. 상세 `docs/sprints/sprint-12.md` §Stage2.
- **배경**: 코드베이스 grep 결과 `tokenCount/inputTokens/outputTokens` 추적 코드 0개. 사용자 한도 제어 불가 — 토큰 폭주 시 비용 폭탄 위험.
- **하위 할일**
  - [ ] AI Engine: Claude API 응답의 `usage.input_tokens` / `output_tokens`를 Backend로 콜백 (`POST /internal/v1/sessions/{id}/token-usage`)
  - [ ] **V054** (잠정): `token_usage` 테이블 — **12D COST-3로 흡수**(provider 인지 확장). V052는 1202b가 선점. (session_id, user_id, provider, model, input/output_tokens, cost_usd, occurred_at)
  - [ ] `TokenUsageService.java`: 월별 집계 + 플랜별 한도 비교
  - [ ] `EmailService.sendTokenLimitWarning()`: 80% 도달 시 경고 메일, 100% 도달 시 분석 일시 차단
  - [ ] 대시보드 위젯 `TokenUsageChart.tsx`: 일별 사용량 + 예상 월 비용
- **테스트 체크리스트**
  - [ ] 🧪 토큰 사용량 누적 정확성 (10건 호출 후 합산값 검증)
  - [ ] 🔬 한도 도달 시 다음 분석 요청 403 반환 + 안내 메시지
  - [ ] 🛡️ 다른 사용자 token_usage 직접 조회 403

### TASK-1205 🟠 자동 백업 스케줄러 + S3 업로드
- **중요도**: 🟠 High | **순서**: 5번째 | **사이즈**: M
- **배경**: 백업/복구 스크립트 0개. 데이터 손실 시 복구 불가 — 베타 운영 위험.
- **하위 할일**
  - [x] `infra/scripts/backup-postgres.sh`: pg_dump + gzip + AWS CLI 업로드
  - [x] `BackupJob.java`: `@Scheduled(cron="0 0 3 * * *", zone="Asia/Seoul")` + ShedLock — 매일 03:00 KST 자동 백업 (`backup.enabled` env-gated)
  - [x] S3 버킷 정책 — 30일 보관 후 Glacier 이관, 1년 후 삭제 (`infra/scripts/s3-lifecycle-policy.json`)
  - [x] `docs/runbooks/disaster-recovery.md`: 복구 시나리오 문서화 (RTO 4h / RPO 24h 명시)
  - [ ] (선택) Monthly Full + Daily Incremental 전략 적용 — 미적용(낮은 우선순위)
- **테스트 체크리스트**
  - [x] 🧪 BackupJob fail-isolation·env-gate 단위 테스트 4건
  - [ ] 🔬 백업 파일 다운로드 → 별도 DB 인스턴스 복원 → 데이터 동일성 확인 (수동)
  - [ ] 🛡️ S3 버킷 외부 접근 차단(Block Public Access) 확인 (실 S3 수동검증)

### TASK-1210 🔴 트랜잭션 이메일 발송 인프라 (신규 — V5.5)
- **중요도**: 🔴 Critical | **순서**: 본 Sprint 핵심 | **사이즈**: M
- **배경**: 리포트·야간스캔·GDPR·토큰경고·팀초대 등 제품이 의존하는 메일이 급증했으나 발송 인프라(전용 프로바이더·도메인 인증)가 없음. SMTP 직접 발송은 베타에서 스팸 처리·미도달 위험.
- **하위 할일**
  - [ ] 트랜잭션 메일 프로바이더 연동 (AWS SES 또는 SendGrid) — `EmailService` 발송 채널 추상화(Strategy)로 SMTP↔프로바이더 전환
  - [ ] 발신 도메인 SPF·DKIM·DMARC 레코드 설정 + `docs/runbooks/email-deliverability.md` 문서화
  - [ ] 바운스·스팸 신고 웹훅 수신 → 비활성 주소 suppression 처리
  - [ ] 공통 메일 템플릿 레이아웃 + 발송 실패 재시도(지수 백오프) + 발송 로그
- **테스트 체크리스트**
  - [ ] 🔬 프로바이더 테스트 발송 → 도착 + DKIM 서명 통과 (mail-tester 점수 ≥ 9)
  - [ ] 🛡️ 메일 본문·로그에 토큰/비밀번호 등 민감정보 미포함 확인
  - [ ] 🔬 바운스 이벤트 → 해당 주소 suppression 등록 확인

### TASK-1603(편입) 로그 집계 (Loki) · TASK-1804(편입) Sentry 에러 추적
> **V5.5 이동**: 멀티 인스턴스 베타 운영에 로그 집계·에러 추적이 필수라 각각 Sprint 16/18 → **본 Sprint로 편입**. 상세 명세는 원 위치(Sprint 16 TASK-1603, Sprint 18 TASK-1804) 참조. Loki는 Trace ID 상관관계 추적, Sentry는 베타 1일차부터 예외 수집 — 운영 가시성의 기반.

---

## Sprint 12B — Enterprise Admin UI (분할, 우선순위 낮음)
> **V5.5 신설**: 기존 Sprint 12에서 분리한 관리자 UI 묶음. 보안 백엔드(1202a 해시체인·1208 감사로그 등) 완료 후 진행하며 **베타 필수는 아님** — Sprint 13~14 여유 시간 또는 별도 트랙으로 처리(주차 미고정).
> 포함: TASK-1206(알림센터) · TASK-1207(관리자 온보딩) · TASK-1208(감사 로그 페이지) · TASK-1208b(2FA 프론트엔드) · TASK-1209(보안 정책 관리)
> **예외**: TASK-1208b(2FA FE)는 사용자가 2FA를 켤 수 있는 유일한 경로 — 베타에서 2FA 활성화가 필요하면 Sprint 12 본진으로 끌어올릴 것.

### TASK-1206 🟠 알림 센터 풀 페이지 (`/notifications`)
- **중요도**: 🟠 High | **순서**: 6번째 | **출처**: pages-inventory `EnterpriseChannels.jsx` 일부 | **사이즈**: L
- **배경**: 현재 토스트 알림만 존재. 누적 알림을 다시 보거나 카테고리·시간별로 필터링하는 수단 부재.
- **하위 할일**
  - [ ] V053: `user_notifications` 테이블 (user_id, category, severity, title, body, action_url, read_at, created_at)
  - [ ] `GET /api/v1/users/me/notifications?category=&unreadOnly=` + `PATCH /{id}/read` + `POST /mark-all-read`
  - [ ] `app/notifications/page.tsx`: 좌측 카테고리 사이드바(트리거·시스템·팀·청구·컴플라이언스) + 시간 그룹(오늘/어제/더 이전) + 우측 상세 패널
  - [ ] 헤더 종 아이콘 → 미니 드롭다운(최근 5건) + "전체 보기" → `/notifications` 라우팅
  - [ ] 9개 기본 카테고리 시드: 예산 초과 · 토큰 폭주 · 권한 변경 · ISO 위반 등
- **테스트 체크리스트**
  - [ ] 🧪 동시 mark-all-read 클릭 시 일괄 트랜잭션 안전성 (단위 테스트)
  - [ ] 🛡️ 타 사용자 알림 조회/읽음 처리 시도 → 403
  - [ ] ✅ 카테고리 필터 + "읽지 않은 것만" 동시 적용 정확성

### TASK-1207 🟡 관리자 온보딩 체크리스트 (15-item + Progress Ring)
- **중요도**: 🟡 Medium | **순서**: 7번째 | **출처**: 신규 UX 스펙 | **사이즈**: M
- **배경**: Enterprise 신규 가입 시 무엇부터 설정해야 하는지 가이드 부재 → 활성화율 저하. Stripe·Linear가 표준으로 채택한 패턴.
- **하위 할일**
  - [ ] V054: `org_onboarding_progress` 테이블 (org_id, item_key, completed_at)
  - [ ] 15개 체크리스트 정의: 카테고리 5종 (기업 인증 · 보안 · 팀 셋업 · 첫 분석 · 통합) × 각 3개
  - [ ] 각 항목: 라벨(필수/권장/제안/선택) + 예상 소요시간 + 자동 감지 트리거 (예: 2FA 활성화 → 자동 ✅)
  - [ ] `app/admin/onboarding/page.tsx`: 큰 진행률 링 + "다음 단계 추천" 핫스팟 카드 (오렌지 그라데이션) + 완료 항목 취소선
  - [ ] 진행률 95% 도달 → 축하 모달 + 보너스 크레딧 100 지급 (1회성, 멱등성 보장)
- **테스트 체크리스트**
  - [ ] 🔬 2FA 활성화 → `mfa.enabled` 이벤트 → 체크리스트 자동 완료 확인
  - [ ] 🛡️ 보너스 크레딧 중복 지급 방지 — `org_onboarding_bonus_granted` 플래그 검증

### TASK-1208 🟠 감사 로그 페이지 (`/admin/audit-logs`) — EnterpriseLogs.jsx
- **중요도**: 🟠 High | **순서**: 8번째 | **출처**: pages-inventory `EnterpriseLogs.jsx` | **사이즈**: M
- **배경**: TASK-1202a에서 감사 로그 해시 체이닝 백엔드 완성. 사용자 노출 UI 미구현. ISMS-P 인증 시 감사 로그 조회·내보내기 화면이 필수 증빙.
- **하위 할일**
  - [ ] `GET /api/v1/admin/audit-logs?from=&to=&actorId=&action=&page=` (Master 권한)
  - [ ] `GET /api/v1/admin/audit-logs/export?format=csv|json` (감사 로그 자체에 export 행위 기록)
  - [ ] `app/admin/audit-logs/page.tsx`: 시간 필터 + 행위자 검색 + 액션 칩 + 무결성 배지(체인 검증) + 페이지네이션
  - [ ] 멤버 토큰 사용 이력 패널(원본 토큰 마스킹 `sk-***last4`)
  - [ ] 의심 이벤트 자동 하이라이트 (동시 다중 IP 로그인, 권한 변경 등)
- **테스트 체크리스트**
  - [ ] 🛡️ Master 외 접근 시 403 + 시도 자체가 감사 로그에 기록
  - [ ] 🛡️ 토큰/비밀번호 원문 미노출 확인
  - [ ] 🔬 10만 건 페이지네이션 응답 < 1초

### TASK-1208b 🟠 SettingsSecurity 2FA 프론트엔드 (QR + 6-digit + 복구 코드)
- **중요도**: 🟠 High | **순서**: 9번째 | **출처**: pages-inventory `SettingsSecurity.jsx` | **사이즈**: M
- **배경**: TASK-806에서 `/auth/2fa/setup`, `/verify`, `DELETE /2fa` 백엔드 완성. Sprint 10에 TODO 플레이스홀더로만 남음. 사용자가 2FA 활성화 불가.
- **하위 할일**
  - [ ] `app/settings/security/page.tsx`: 2FA 토글 + 비활성 → 활성 모달 플로우
  - [ ] QR 코드 SVG (`qrcode.react`) + otpauth URI 표시
  - [ ] 6-digit OTP 입력 박스 (자동 다음 칸 이동 + paste 분할)
  - [ ] 복구 코드 8개 표시 + 다운로드(.txt) + 복사 + 재발급 액션
  - [ ] `DELETE /2fa` 호출 전 현재 OTP 재확인 강제
- **테스트 체크리스트**
  - [ ] ✅ Google Authenticator QR 스캔 → 6-digit 입력 → 활성화 성공
  - [ ] 🛡️ 복구 코드 다운로드 후 화면에서 즉시 마스킹 (재방문 시 표시 안 됨)
  - [ ] 🔬 OTP 30초 윈도우 만료 시 재입력 안내

### TASK-1209 🟡 기업 보안 정책 관리 (`/admin/policies`) — EnterprisePolicies.jsx
- **중요도**: 🟡 Medium | **순서**: 10번째 | **출처**: pages-inventory `EnterprisePolicies.jsx` | **사이즈**: M
- **배경**: 조직 단위 보안 정책(2FA 강제, 비밀번호 정책, 세션 만료, IP Allowlist 강제 등)을 GUI로 관리하는 페이지 부재.
- **하위 할일**
  - [ ] V057: `org_security_policies` 테이블 (org_id, policy_key, value JSONB, enforced_at)
  - [ ] 정책 키: `mfa_required`, `password_min_length`, `password_complexity`, `session_max_hours`, `ip_allowlist_enforced`, `sso_only`
  - [ ] `PUT /api/v1/admin/org/{orgId}/policies/{key}` (Master, 감사 로그 기록)
  - [ ] `app/admin/policies/page.tsx`: 카테고리 탭(인증·비밀번호·세션·네트워크) + 토글 + 변경 확인 모달 + 영향받는 사용자 수
  - [ ] 정책 강제 시 적용 시점 안내 ("다음 로그인부터 적용")
- **테스트 체크리스트**
  - [ ] 🛡️ Master 외 접근 시 403 + 감사 로그
  - [ ] 🔬 `mfa_required` 활성 → 미설정 사용자 로그인 시 강제 설정 플로우
  - [ ] ✅ 영향받는 사용자 수 카운트 정확성

---

## Sprint 13 — AI Agent Advanced I (API 호출 경로 스캔 & 오탐 학습)
> Week 27-28 | 목표: API 의존성 기반의 Taint Analysis 구현 및 pgvector를 활용한 오탐 자동 회피

### TASK-1301 🔴 멀티 파일 컨텍스트 분석 (API 호출 흐름 추적)
- **중요도**: 🔴 Critical | **순서**: 1번째
- **하위 할일**
  - [ ] API 엔트리 포인트(Controller, Axios, Swagger)를 읽어 호출 가중치를 파악하는 `call_graph_builder` 모듈 구현
  - [ ] LangGraph 분석 순서를 API 호출 순서(Controller -> Service -> Repository)에 따라 동적으로 가중치 정렬하여 스캔
  - [ ] 스캔 진행 시 API 경로 매핑 상황과 진척 상태를 실시간 SSE progress로 스트리밍 (FEAT-AI-001)
- **테스트 체크리스트**
  - [ ] 🔬 API 진입점에 정의된 파일 및 직접 연결된 의존성 파일들이 스캔 큐 최상단에 우선 배치되는지 확인
  - [ ] ✅ 프론트엔드 진행률 UI에서 "API 호출 경로 추적 중" 단계와 현재 매핑 스캔 중인 경로 텍스트가 정상 출력되는지 확인

### TASK-1302 🟠 취약점 오탐 학습 & 산업 도메인 커스텀
- **중요도**: 🟠 High | **순서**: 2번째
- **하위 할일**
  - [ ] 개발자가 '오탐(False Positive)'으로 지정한 코드 조각과 사유를 저장하는 `false_positive_patterns` 테이블 구현 (FEAT-AI-003)
  - [ ] 분석 시작 시 프로젝트의 해당 오탐 패턴들을 pgvector 기반 검색하여 프롬프트 내 Few-shot(Negative Examples)으로 자동 주입
  - [ ] 산업 도메인(핀테크, 의료, 공공 등) 설정에 맞춰 각 도메인 가이드라인(MD/DB) 및 규정 준수 패치 가이드를 프롬프트 컨텍스트에 주입하는 RAG 파이프라인 구현
- **테스트 체크리스트**
  - [ ] 🔬 오탐 지정된 파일 패턴과 완전히 동일한 오탐 시나리오가 다음 분석 시 자동으로 필터링 및 스킵되는지 검증
  - [ ] 🔬 핀테크 도메인 프로젝트의 경우 암호화 규격(AES-GCM 등) 및 세션 만료 정책 관련 가이드라인이 프롬프트 컨텍스트에 올바르게 포함되는지 검증

### TASK-1303 🟡 AI 모델 벤치마크 대시보드
- **중요도**: 🟡 Medium | **순서**: 3번째
- **배경**: 현재 Audit(haiku) vs Pipeline(sonnet) 분기만 있고 어떤 모델이 어떤 취약점 유형에 강한지 정량 데이터 없음. 사용자가 모델 선택 시 근거 부족.
- **하위 할일**
  - [ ] `model_benchmark` 테이블 (model, vuln_type, true_positives, false_positives, false_negatives, avg_latency_ms)
  - [ ] 분석 완료 시 모델별 검출 정확도 누적 (사용자가 오탐/실탐 마킹 시 백필)
  - [ ] `GET /api/v1/admin/benchmarks` — 모델별 Precision / Recall / F1 점수
  - [ ] Settings 페이지에 "모델 추천" 위젯 — 현재 프로젝트의 언어/도메인에 맞는 모델 표시
- **테스트 체크리스트**
  - [ ] 🔬 동일 코드를 두 모델로 분석 → 검출 결과 차이 정량화
  - [ ] ✅ 통계가 100건 누적 시 추천 모델 안내 동작

---

## Sprint 14 — AI Agent Advanced II (패치 자동화 및 격리 검증)
> Week 29-30 | 목표: 승인된 패치의 자동 PR 생성 및 Docker 샌드박스를 활용한 단위 테스트 기반 자가 검증

### TASK-1401 🟠 패치 자동 적용 및 GitHub PR 생성
- **중요도**: 🟠 High | **순서**: 1번째
- **하위 할일**
  - [ ] 취약점 패치 적용 요청 시, GitHub API를 통해 신규 패치 브랜치를 자동 생성하고 수정 사항을 커밋하는 로직 구현
  - [ ] 원본 브랜치에 대해 Pull Request를 자동으로 개설하는 API 구현 (FEAT-AI-002)
- **테스트 체크리스트**
  - [ ] 🔬 패치 적용 완료 시 GitHub 저장소에 PR 코멘트와 함께 실제 PR이 등록되는지 검증

### TASK-1402 🟠 패치 검증 자동화 (VC Feedback Loop)
- **중요도**: 🟠 High | **순서**: 2번째
- **하위 할일**
  - [ ] AI가 제안한 패치 코드를 컴파일하고 검증할 임시 테스트 코드를 Claude API로 동시 생성하는 모듈 구현
  - [ ] 임시 격리된 Docker 샌드박스 컨테이너 내부에서 패치 코드를 적용한 뒤 테스트를 실행하고 pass 여부를 수집 (FEAT-AI-005)
  - [ ] 테스트를 성공적으로 통과한 검증된 패치만 `patchSuggestions.verificationStatus`에 Verified로 표기하여 사용자에게 추천
- **테스트 체크리스트**
  - [ ] 🔬 문법 에러가 있거나 기존 테스트를 깨뜨리는 패치 제안은 검증 상태가 Failed로 분류되는지 확인
  - [ ] 🔬 정상 컴파일되고 취약점이 조치된 경우에만 Verified 상태로 업데이트되는지 확인

### TASK-1403 🔴 패치 자동 롤백 및 이력 관리 (안전장치)
- **중요도**: 🔴 Critical | **순서**: 3번째 | **출처**: FEAT-AI-006
- **배경**: TASK-1401(자동 PR 생성)이 활성화된 상태에서 잘못된 패치가 main에 머지될 경우 즉시 복구 수단 필요. 자동 롤백 없이 PR 자동화는 운영 리스크가 너무 크다.
- **하위 할일**
  - [ ] `PatchApplication` 테이블에 `applied_commit_sha`, `revert_commit_sha`, `revert_reason` 컬럼 추가 (V061)
  - [ ] GitHub Webhook `workflow_run.completed` 수신 — 패치 PR 머지 후 CI 실패 시 트리거
  - [ ] `PatchRollbackService`: GitHub API `git revert` 커밋 자동 생성 + PR 개설
  - [ ] Slack 알림 — "Patch X auto-reverted due to CI failure"
  - [ ] 사용자 설정: "Auto-revert on CI failure" 토글 (Settings 페이지)
- **테스트 체크리스트**
  - [ ] 🔬 패치 적용 후 CI 의도적 실패 → 5분 이내 Revert PR 생성 확인
  - [ ] 🛡️ Revert PR 생성 시 Slack 알림 + 감사 로그 기록
  - [ ] 🔬 토글 비활성 사용자 → 자동 롤백 발동 안 함

---

## Sprint 15 — Ecosystem & MCP Server Expansion (MCP/API 확장)
> Week 31-32 | 목표: AI Agent 기능 확장을 위한 MCP 서버 추가 도입 및 보안 데이터 Outbound 연동

### TASK-1501 🟠 MCP 서버 라인업 보강 (Redis & Brave Search)
- **중요도**: 🟠 High | **순서**: 1번째
- **하위 할일**
  - [ ] AI Agent가 캐시 히트율, 분산 락 상태, SSE 채널 상태를 디버깅할 수 있는 `mcp-server-redis` (MCP-003) 구축
  - [ ] NVD API 캐시 미스 시 AI Agent가 실시간 웹 검색으로 최신 CVE 및 보안 패치 우회법을 검색할 수 있도록 `mcp-server-brave-search` (MCP-004) 연동
- **테스트 체크리스트**
  - [ ] 🔬 AI Agent가 분석 중 외부 NVD 정보 수집을 위해 Exa/Brave Search MCP 도구를 자율적으로 호출하는지 확인
  - [ ] 🔬 Redis 캐시 및 락 상태 조회가 MCP 도구를 통해 에이전트 컨텍스트에 주입되는지 확인

### TASK-1502 🟠 Outbound Webhook 및 데이터 내보내기 고도화
- **중요도**: 🟠 High | **순서**: 2번째
- **하위 할일**
  - [ ] 분석 완료, Critical 발견 시 외부 시스템으로 웹훅을 발송하는 Outbound Webhook 시스템 구현 (FEAT-API-003)
  - [ ] 취약점 내보내기 형식을 SARIF (GitHub Code Scanning 호환), JIRA XML, CSV 포맷 등으로 다각화 (FEAT-API-002)
- **테스트 체크리스트**
  - [ ] 🔬 분석 완료 이벤트 발생 시 등록된 웹훅 엔드포인트로 정상 payload가 발송되는지 검증
  - [ ] 🔬 SARIF 포맷으로 다운로드하여 GitHub Code Scanning 탭에 정상 업로드되는지 확인

### TASK-1503 🟠 EnterpriseChannels — Slack/Teams/Discord 알림 라우팅 UI
- **중요도**: 🟠 High | **순서**: 3번째 | **출처**: pages-inventory `EnterpriseChannels.jsx` 미구현
- **배경**: 현재 단일 Slack Webhook URL만 환경변수로 설정. 룰(심각도/이벤트별) → 채널 매핑 + Teams/Discord 멀티 프로바이더 미지원.
- **하위 할일**
  - [ ] V055: `notification_channels` 테이블 (provider: SLACK|TEAMS|DISCORD, webhook_url AES 암호화, is_active)
  - [ ] V056: `notification_routes` 테이블 (org_id, severity, event_type, channel_id, mentions JSONB, mute_until, dedupe_minutes)
  - [ ] `TeamsWebhookAdapter` + `DiscordWebhookAdapter` 구현 (`SlackWebhookAdapter` 패턴 재사용, Strategy 패턴)
  - [ ] `app/settings/channels/page.tsx`: 상단 3개 통합 카드(LIVE/미연결) + 좌측 라우트 테이블(심각도 dot · provider 배지 S/T/D · 채널 · @멘션 · Mute) + 우측 편집기 + Slack 실시간 미리보기 패널(다크 #1a1d21 재현)
  - [ ] 채널별 메시지 포맷 템플릿 (Block Kit / Adaptive Card / Embed)
- **테스트 체크리스트**
  - [ ] 🧪 각 프로바이더 Webhook payload 스키마 단위 테스트
  - [ ] 🛡️ webhook_url AES-256-GCM 암호화 저장 + 응답 시 마스킹(`https://hooks.slack.com/***`)
  - [ ] 🔬 동일 룰 5분 내 중복 발송 시 dedupe_minutes 적용 확인

### TASK-1504 🟡 마켓플레이스 / 통합 카탈로그 페이지
- **중요도**: 🟡 Medium | **순서**: 4번째 | **출처**: 신규 UX 스펙
- **배경**: GitHub/Jira/Linear/PagerDuty/Slack 통합 시 각 설정 페이지가 분산 — 단일 진입점 부재.
- **하위 할일**
  - [ ] `app/integrations/page.tsx`: 카드 그리드 (각 카드: 로고 · 상태 배지 · "연결" 버튼 · 짧은 설명)
  - [ ] 카테고리 필터 (소스 코드 / 이슈 추적 / 알림 / 모니터링 / SSO)
  - [ ] 각 카드 클릭 → 통합 설정 모달 또는 별도 페이지로 라우팅 (기존 분산 페이지 재사용)
  - [ ] `GET /api/v1/integrations` — 사용자 조직의 통합 상태 일괄 조회
- **테스트 체크리스트**
  - [ ] 🔬 통합 상태 동기화 — GitHub 연결 해제 후 카드 상태 즉시 갱신
  - [ ] ✅ 카테고리 필터 클릭 → 해당 카테고리 카드만 표시

---

## Sprint 16 — Live Scan Visual Simulator & Observability (실시간 시각화)
> Week 33-34 | 목표: SSE 이벤트를 시각 정보로 변환하는 모던한 라이브 검사 시뮬레이터 및 운영 모니터링 활성화

### TASK-1601 🟠 모던 실시간 스캔 라이브 시뮬레이터
- **중요도**: 🟠 High | **순서**: 1번째
- **하위 할일**
  - [ ] DAST 테스트 동작 시 흘러나오는 실시간 공격 유형, 클릭 좌표, 페이로드 전송 등의 SSE 상세 이벤트를 파싱하는 리스너 구현 (FEAT-FE-007)
  - [ ] 프론트엔드 대시보드 내에 모던하고 정갈하게 디자인된 가상 웹 브라우저/네트워크 모형 위젯 구현
  - [ ] DAST 공격 이벤트 수신 시 가상 화면의 버튼 클릭, 폼 필드 페이로드 자동 타이핑 효과, DB로 흐르는 패킷 전기 신호 효과 등을 깔끔한 CSS/React 애니메이션으로 시각화 (해커 스크린 느낌을 빼고, 실시간 보안 검사 진행 상태를 모던하게 전달)
- **테스트 체크리스트**
  - [ ] ✅ DAST 스캔 시작 -> SSE 이벤트 유입 시 프론트엔드 모션 위젯이 끊김 없이 부드럽게(60fps) 동기화되어 동작하는지 확인
  - [ ] ✅ 통계 탭 이외의 라이브 검사 창을 띄웠을 때, 직관적으로 현재 침투 테스트가 어느 구간(Web 클라이언트 vs DB 영역)에서 일어나고 있는지 눈으로 확인 가능한지 검증

### TASK-1602 🟠 Prometheus 커스텀 메트릭 고도화 및 슬랙 연동
- **중요도**: 🟠 High | **순서**: 2번째
- **하위 할일**
  - [ ] 모니터링 에러 트래킹을 위한 Slack 알림 채널 세분화 및 Grafana 대시보드 알림 연계
  - [ ] AI Agent의 토큰 소모 속도 및 분석 시간 통계를 Prometheus 게이지로 연계
- **테스트 체크리스트**
  - [ ] ✅ 모니터링 시스템 장애 또는 만료 SSL 발견 시 지정 슬랙 채널 알림 수신 성공

### TASK-1604 🟡 모바일 알림 3-state UX (Android Compose)
- **중요도**: 🟡 Medium | **순서**: 3번째 | **출처**: 신규 UX 스펙
- **배경**: TASK-705에서 FCM 푸시는 동작하나 잠금화면·펼침·앱 내 상세 3단계 UX가 정렬되지 않음. iOS 잠금화면 스타일에 맞춘 디자인 정립 필요.
- **하위 할일**
  - [ ] **State 1 (알림 도착)**: 잠금화면 배너 + 펄스 애니메이션 (FCM `notification.title` + `notification.body`)
  - [ ] **State 2 (펼침)**: `Notification.Builder` BigTextStyle + 인라인 액션 3개 (확인 · 30분 연기 · Pagori에서 열기) — Android RemoteInput
  - [ ] **State 3 (앱 내 상세)**: `NotificationDetailScreen.kt` — 큰 숫자 ($4,120 / $4,000 · 103%) + 7일 추이 미니차트 (Compose Canvas) + 메타 row + 액션 바
  - [ ] FCM `data` 페이로드에 `state2_actions`, `detail_screen_route` 키 추가
- **테스트 체크리스트**
  - [ ] ✅ 잠금화면 → 펼침 → 앱 진입 3단계 흐름 실제 디바이스 검증
  - [ ] 🔬 30분 연기 클릭 → 30분 후 알림 재발송 확인 (WorkManager)
  - [ ] 🛡️ 비로그인 상태에서 알림 클릭 → 로그인 화면 후 딥링크 유지

### TASK-1603 🟠 로그 집계 시스템 (Loki + Grafana) — 🟢 **완료**(`795c1e0`, Stage6)
> ⏫ **V5.5: Sprint 12로 편입** — 멀티 인스턴스 베타 운영에 로그 집계가 필수.
- **중요도**: 🟠 High | **순서**: 4번째
- **배경**: 현재 Prometheus(메트릭) + Jaeger(트레이싱)만 있고 로그 집계 없음. 멀티 인스턴스 배포 시 분산 로그 추적 불가.
- **하위 할일**
  - [x] `docker-compose.yml`에 Grafana Loki + Promtail 서비스 추가(`infra/loki/`)
  - [x] Backend `logback-spring.xml`(`%X{traceId}`/JSON) + AI Engine `dictConfig`(trace_id) — Promtail docker_sd 수집
  - [x] Grafana 데이터소스로 Loki 등록(`datasources/loki.yaml`, derivedFields→Jaeger) + 기본 대시보드(loki-logs.json)
  - [x] LogQL 알림 규칙 — 5분 내 ERROR 100건 초과 시 Slack 발송 (규칙 `infra/loki/loki-alerts.yaml` 정의 완료, Slack webhook 연결은 수동)
- **테스트 체크리스트**
  - [x] 🔬 Loki 스택 라이브 기동 검증(마스터, Docker): Loki `/ready`·labels API, **Grafana→Loki proxy 쿼리 success**, Promtail 소켓OK. (실 backend 로그 LogQL 적재는 풀스택 기동 후 수동)
  - [x] ✅ Trace ID로 Backend ↔ AI Engine 로그 상관관계 추적 (풀스택 기동 수동검증)

---

## Sprint 17 — 수익화 인프라 (Payment + Billing)
> Week 35-36 | 목표: 베타 종료 후 Free → Pro/Team/Enterprise 유료 전환 가능한 결제 인프라 구축

### TASK-1701 🔴 결제 게이트웨이 통합 (Stripe / Toss Payments)
- **중요도**: 🔴 Critical | **순서**: 1번째
- **배경**: 코드베이스 grep 결과 `stripe/toss/payment` 의존성 0개. `Plan` 테이블만 존재하고 실제 결제 인프라 부재. 베타 종료 시점에 수익화 불가능.
- **하위 할일**
  - [ ] **글로벌 결제**: Stripe Checkout + Customer Portal — `com.stripe:stripe-java:25.x` 의존성
  - [ ] **국내 결제**: Toss Payments — 직접 REST API 호출 (`/v1/billing/authorizations`)
  - [ ] V062: `subscriptions` 테이블 (user_id, plan_id, gateway, gateway_customer_id, current_period_end, status)
  - [ ] V063: `invoices` 테이블 (subscription_id, amount, currency, paid_at, gateway_invoice_id, receipt_url)
  - [ ] `BillingController` — `POST /billing/checkout-session`, `POST /billing/webhook` (Stripe / Toss 양쪽)
  - [ ] Webhook HMAC 서명 검증 (Stripe `Stripe-Signature` / Toss `Tosspayments-Signature`)
  - [ ] 프론트엔드: `app/billing/page.tsx` — 플랜 비교 + Checkout 버튼 + 인보이스 다운로드
- **테스트 체크리스트**
  - [ ] 🧪 Stripe Webhook HMAC 검증 단위 테스트
  - [ ] 🔬 테스트 모드 Stripe Checkout → subscription.created 이벤트 → DB 반영 확인
  - [ ] 🛡️ Webhook 서명 위조 시 400 반환

### TASK-1702 🟠 결제 실패 / 환불 / 다운그레이드 처리
- **중요도**: 🟠 High | **순서**: 2번째
- **하위 할일**
  - [ ] `invoice.payment_failed` Webhook 핸들러 — 사용자에게 이메일 알림 + 3일 그레이스 기간 후 Free로 강등
  - [ ] `customer.subscription.deleted` 핸들러 — 다음 결제 주기 시작 시 플랜 변경
  - [ ] 환불 API — `POST /billing/refund` (관리자 전용, 감사 로그 필수)
- **테스트 체크리스트**
  - [ ] 🔬 결제 실패 시뮬레이션 → 그레이스 기간 동안 기능 사용 가능, 만료 후 차단
  - [ ] 🛡️ 비관리자가 환불 시도 → 403

### TASK-1703 🟡 인보이스 생성 및 영수증 발급 (사업자 등록 대응)
- **중요도**: 🟡 Medium | **순서**: 3번째
- **하위 할일**
  - [ ] Toss Payments — 매출 전표 / 세금계산서 발행 연동 (선택)
  - [ ] Stripe — Customer Portal 이메일 자동 발송 활성화
  - [ ] 인보이스 PDF 다운로드 (사업자 등록번호, VAT 표시)
- **테스트 체크리스트**
  - [ ] ✅ 인보이스 PDF에 사업자번호, VAT 별도 표기 확인

### TASK-1705 🟡 Enterprise 랜딩 페이지 (`/enterprise`) — EnterpriseScale.jsx
- **중요도**: 🟡 Medium | **순서**: 4번째 | **출처**: pages-inventory `EnterpriseScale.jsx`
- **배경**: 현재 `/` 랜딩에는 일반 Pricing만 있고, Enterprise(B2B) 영업용 별도 랜딩 없음. SSO·SLA·전담 지원 등 차별점을 강조할 페이지 필요.
- **하위 할일**
  - [ ] `app/enterprise/page.tsx`: Hero + 차별점 카드 5개 (SSO·SLA 99.9%·전담 매니저·On-prem 옵션·SOC 2 인증) + 케이스 스터디 + "상담 신청" CTA
  - [ ] `POST /api/v1/leads/enterprise` — 영업 리드 수집 (회사명·규모·연락처·요청 사항)
  - [ ] 리드 등록 시 Slack `#sales-leads` 채널 즉시 알림 (Sprint 9 SlackWebhookAdapter 재사용)
  - [ ] SEO 메타 태그 + OG 이미지 추가
- **테스트 체크리스트**
  - [ ] 🔬 리드 등록 → DB 저장 + Slack 알림 확인
  - [ ] 🛡️ reCAPTCHA v3 적용 — 봇 차단

### TASK-1706 🟢 Enterprise 런치 소개 화면 (`/enterprise/launch`) — EnterpriseLaunch.jsx
- **중요도**: 🟢 Low | **순서**: 5번째 | **출처**: pages-inventory `EnterpriseLaunch.jsx`
- **배경**: Enterprise 고객 계약 직후 첫 30일 셋업 가이드 페이지. Onboarding(TASK-1207)이 체크리스트라면, 이 페이지는 가시적 "런치 플랜" 소개 (영업 자료 성격).
- **하위 할일**
  - [ ] `app/enterprise/launch/page.tsx`: 30/60/90일 마일스톤 타임라인 + 각 단계 산출물 + 담당자
  - [ ] 다운로드 가능한 PDF "Enterprise Launch Playbook" 첨부
- **테스트 체크리스트**
  - [ ] ✅ 타임라인 시각화 데스크톱/태블릿/모바일 반응형 확인

### TASK-1704 🟡 QBR (Quarterly Business Review) 슬라이드 Export
- **중요도**: 🟡 Medium | **순서**: 6번째 | **출처**: 신규 UX 스펙
- **배경**: Master 관리자가 분기마다 임원진/이사회에 보고할 매출·사용량·Top 조직 요약 자료를 수동 작성 중. PDF 자동 export 수단 부재.
- **하위 할일**
  - [ ] V064: `qbr_snapshots` 테이블 (quarter, generated_by, total_mrr, total_orgs, top_orgs JSONB, vuln_metrics JSONB)
  - [ ] `QbrReportService`: 분기별 지표 집계 (MRR · churn · 신규/활성 조직 · 분석 처리량 · 모델별 비용)
  - [ ] `qbr-deck.html` Thymeleaf 템플릿 (커버 + 매출 차트 + Top 10 조직 표 + Vuln/MTTR 트렌드 + 다음 분기 목표)
  - [ ] `GET /api/v1/admin/master/qbr/{quarter}/pdf` — `ROLE_MASTER` 전용 + 감사 로그
  - [ ] `app/admin/master/qbr/page.tsx`: 분기 선택 + 미리보기 + PDF 다운로드
- **테스트 체크리스트**
  - [ ] 🛡️ Master 권한 외 접근 시 403 + 감사 로그 기록
  - [ ] 🔬 분기 경계(3/31, 6/30, 9/30, 12/31) 데이터 집계 정확성
  - [ ] ✅ PDF에 매출 라인차트, Top 10 표, 트렌드가 깨짐 없이 렌더링

---

## Sprint 18 — Hardening Sprint (품질 자동화 + 운영 안정성)
> Week 37-38 | 목표: 정식 GA 출시 전 품질 게이트 자동화 및 운영 안정성 확보  
> **참고**: 기존 "Hardening Sprint 로드맵 (미배정)" 섹션을 정식 Sprint로 승격

### TASK-1801 🔴 E2E 테스트 자동화 (Playwright)
- **중요도**: 🔴 Critical | **순서**: 1번째
- **배경**: 프론트엔드 단위 테스트만 있고 E2E 부재. 회원가입 → 분석 → 패치 적용 전체 플로우의 회귀 자동 검증 수단 없음.
- **하위 할일**
  - [ ] `apps/frontend/playwright.config.ts` + 의존성 설치
  - [ ] 핵심 시나리오 5개: ① 회원가입+이메일 인증 ② 로그인+2FA ③ GitHub 레포 스캔 ④ 패치 적용 ⑤ 팀 초대
  - [ ] GitHub Actions 워크플로우 — PR 시 자동 실행, 실패 시 차단
  - [ ] 비디오/스크린샷 아티팩트 자동 보관
- **테스트 체크리스트**
  - [ ] 🔬 PR 생성 시 Playwright 5개 시나리오 자동 실행 + 통과
  - [ ] ✅ 실패 시 스크린샷/비디오로 디버깅 가능 확인

### TASK-1802 🟠 접근성 자동 검사 (axe-core + Lighthouse CI)
- **중요도**: 🟠 High | **순서**: 2번째
- **배경**: Enterprise 입찰 시 WCAG 2.1 AA 준수 증빙이 자주 요구됨. 현재 수동 검증조차 없음.
- **하위 할일**
  - [ ] `@axe-core/playwright` 통합 — TASK-1801 시나리오마다 접근성 위반 검사
  - [ ] Lighthouse CI — 성능 90+ / 접근성 95+ / 모범 사례 90+ 점수 게이트
  - [ ] 다크 모드 / 라이트 모드 양쪽 검사
- **테스트 체크리스트**
  - [ ] 🔬 axe-core Critical 위반 0건 게이트
  - [ ] ✅ Lighthouse 점수 PR 코멘트 자동 게시

### TASK-1803 🟠 Secrets Detection 강화 (FEAT-SEC-004)
- **중요도**: 🟠 High | **순서**: 3번째
- **배경**: 현재 Sprint 10 시크릿 탐지는 AWS Key + GitHub PAT만 지원. 실제 운영에서 발견되는 50+ 패턴 미커버.
- **하위 할일**
  - [ ] 패턴 라이브러리 확장: Stripe (sk_live_*), GCP Service Account, Slack Bot Token, OpenAI Key, JWT Secret, 신용카드 번호(Luhn), 개인정보(주민번호) 등 50+
  - [ ] 엔트로피 기반 미상 시크릿 검출 (Shannon > 4.5)
  - [ ] 실시간 마스킹 — 코드 업로드 시 검출 즉시 클라이언트에 알림
- **테스트 체크리스트**
  - [ ] 🧪 각 패턴별 정규식 검출 정확도 단위 테스트 (50+ 테스트 케이스)
  - [ ] 🛡️ 검출된 시크릿 원본 값은 절대 로그 출력 안 됨

### TASK-1804 🟡 Sentry 에러 추적 통합 (Java + Python + Frontend) — 🟢 **완료**(`795c1e0`, Stage6)
> ⏫ **V5.5: Sprint 12로 편입** — 베타 1일차부터 예외 수집 필요.
- **중요도**: 🟡 Medium | **순서**: 4번째
- **하위 할일**
  - [x] Sentry 프로젝트 3개 생성 — secureai-backend / secureai-ai-engine / secureai-frontend (외부 계정 작업, 사용자 — DSN 발급 후 env 설정)
  - [x] Spring Boot: `sentry-spring-boot-starter-jakarta` 의존성 + DSN 환경변수(env-gated)
  - [x] Python: `sentry-sdk[fastapi]` (main.py init, DSN 미설정 시 스킵)
  - [x] Next.js: `@sentry/nextjs` (client/server config, DSN 미설정 시 스킵)
  - [x] Trace ID 연계 — Jaeger 트레이스 → Sentry 이벤트 링크 (부분, 풀스택 수동검증)
- **테스트 체크리스트**
  - [x] 🔬 의도적 예외 발생 → Sentry에 스택 트레이스 + 사용자 컨텍스트 도착 확인 (실 DSN 필요 — 수동검증)
  - [x] 🛡️ 민감 데이터(JWT, 비밀번호, Authorization/X-Internal-Key/cookie/set-cookie) 필터링 — `before_send` 단위테스트 py16+java15 + frontend beforeSend

### TASK-1805 🟡 Swagger UI 보안 노출 (springdoc-openapi)
- **중요도**: 🟡 Medium | **순서**: 5번째
- **배경**: `springdoc-openapi-starter-webmvc-ui:2.8.8` 의존성은 있으나 `/swagger-ui` 보안 통제 미설정.
- **하위 할일**
  - [ ] `application.yaml`: 프로덕션에서 `/swagger-ui`, `/v3/api-docs` 비활성화 또는 `ROLE_ADMIN` 강제
  - [ ] 모든 Controller에 `@Tag` / `@Operation` / `@ApiResponse` 어노테이션 보강
  - [ ] OpenAPI YAML export → `docs/api/openapi.yaml` 정적 호스팅
- **테스트 체크리스트**
  - [ ] 🛡️ 프로덕션 빌드에서 `/swagger-ui` 익명 접근 시 403/404
  - [ ] ✅ 개발 환경에서 모든 엔드포인트가 Swagger UI에 표시됨

### TASK-1806 🟢 Chaos Engineering 기초 (선택)
- **중요도**: 🟢 Low | **순서**: 6번째 (선택)
- **하위 할일**
  - [ ] AI Engine 강제 종료 시나리오 — Circuit Breaker가 정상 동작하는지 자동 검증
  - [ ] Redis 일시 정지 시 ShedLock 동작 확인
  - [ ] PostgreSQL 일시 단절 시 Connection Pool 복구 시간 측정

### TASK-1807 🟠 공개 Status Page (status.secureai.dev)
- **중요도**: 🟠 High | **순서**: 7번째 | **출처**: 신규 UX 스펙
- **배경**: 장애 발생 시 사용자가 "현재 서비스가 죽었나?" 확인할 외부 페이지 없음 → 고객 지원 문의 폭주. GitHub/Vercel/Cloudflare가 표준 채택한 패턴.
- **하위 할일**
  - [ ] V067: `service_health_checks` 테이블 (service_name, status: UP|DEGRADED|DOWN, latency_ms, checked_at)
  - [ ] `HealthCheckJob.java`: `@Scheduled(fixedRate=60000)` — Backend/AI Engine/MCP/Frontend 각 `/health` 호출 + Prometheus 메트릭 푸시
  - [ ] V068: `incidents` 테이블 (title, status: investigating|identified|monitoring|resolved, affected_services TEXT[], updates JSONB)
  - [ ] `POST /api/v1/admin/incidents` — 관리자가 수동으로 인시던트 게시 + 업데이트 (감사 로그)
  - [ ] **별도 정적 사이트**: `apps/status/` (Next.js Static Export 또는 단순 HTML) — 90일 가동시간 그래프 + 최근 인시던트 + RSS feed
  - [ ] DNS — `status.secureai.dev` CNAME 분리 호스팅 (장애 시에도 본 서비스와 독립)
- **테스트 체크리스트**
  - [ ] 🔬 Backend 강제 종료 → 60초 이내 status.secureai.dev에 DOWN 반영 확인
  - [ ] 🛡️ status 페이지는 인증 없이 공개 — 단, 내부 IP/사용자 ID 노출 없음 확인
  - [ ] ✅ RSS feed 구독자가 인시던트 알림 수신


---

## EPIC-MISC — 독립 기능 (스프린트 비종속)


> 스프린트 사이클과 독립적으로 개발되는 기능들.  
> 각 기능은 별도 브랜치에서 개발 후 main에 PR.

---

### TASK-MISC-002 🟠 보안 문서 자동 생성 (EPIC-SEC-DOC) ✅ 완료 (2026-05-22, Level 1)
- **브랜치**: `feat/sec-doc`
- **현재 상태**: Level 1 완료 — 2026-05-22
- **대상 사용자**: 보안 전문가, 사내 보안 담당자, 바이브코더(상사 보고용)

> SAST 분석 결과를 정부 제출 문서·사내 보고서·국제 표준 증적으로 자동 변환.  
> Level 1(템플릿 매핑)부터 시작, Level 2(LangGraph 아키텍처 추출)로 확장.

**Level 1 — 템플릿 기반 (SAST 결과 → 문서)** | **Flyway**: V040

하위 할일
- [x] `build.gradle.kts` 의존성: `spring-boot-starter-thymeleaf` + `io.github.openhtmltopdf:openhtmltopdf-pdfbox:1.1.37` (Flying Saucer 사용 금지 — HTML5 비호환). PDFBox 기반으로 안정적
- [x] `V040__create_security_doc_requests.sql` — 생성 이력, 다운로드 토큰
- [x] `POST /api/v1/projects/{id}/reports/security?docType=CISO|HANAFOS|ISMS` + `GET` 상태/다운로드 엔드포인트
- [x] `SecurityDocService.java` + `SecurityDocAsyncProcessor.java` — SAST 결과 → Thymeleaf → OpenHTMLtoPDF. 기존 `PdfReportGenerator.java`(OpenPDF) 건드리지 않음
- [x] `SecurityDocController.java`
- [x] Thymeleaf 템플릿 3종:
  - `ciso-report.html` — 취약점 현황, 위험도 분포, 미조치 항목 (사내 CISO/팀장 보고)
  - `hanafos-checklist.html` — 행안부 SW개발보안 가이드 43개 항목 매핑 (공공기관 제출)
  - `isms-p-evidence.html` — ISMS-P 개발보안 통제항목 이행현황 (인증 심사 증적)
- [x] 프론트엔드: `SecurityDocPage.tsx` 문서 유형 선택 카드 + 생성 상태 폴링 + 다운로드

**Level 2 — LangGraph 아키텍처 추출 (코드 → 보안 아키텍처 문서)**

> MCP Filesystem이 이미 소스 전체를 읽고 SAST 파이프라인이 보안 패턴을 추적하므로,  
> `extract_security_architecture` 노드 추가만으로 구현 가능 (FEAT-AI-001 Taint Analysis와 시너지).

하위 할일
- [ ] LangGraph `security_arch_extractor` 노드 — 인증방식·암호화 알고리즘·접근통제·외부 API 호출·민감 데이터 흐름 추출
- [ ] `SecurityArchDocument.java` 스키마 (AuthMethod, EncryptionUsage, NetworkBoundary, SensitiveDataFlow)
- [ ] `security-arch-report.html` 템플릿 (접근통제 매트릭스, 암호화 현황, 아키텍처 다이어그램 텍스트)

**테스트 체크리스트**
- [x] 🧪 SecurityDocServiceTest — 10개 단위 테스트 통과 (소유권 거부, 만료 토큰, DocType 매핑 등)
- [x] 🛡️ 타 사용자 프로젝트 문서 생성 요청 → 403 차단 (ProjectService.isMember 검증)
- [ ] 🔬 CISO 보고서 — 취약점 severity 분포·미조치 수 정확성 검증
- [ ] 🔬 행안부 체크리스트 — SAST 결과 → 43개 항목 매핑 정확성
- [ ] 🔬 ISMS-P 증적 — 통제항목 준수/미준수 판정 로직
- [ ] 🔬 문서 생성 → 30초 이내 PDF 완성
- [ ] ✅ 생성된 PDF — 행안부 양식 항목 누락 없음 육안 확인
- [ ] ✅ CISO 보고서 — 경영진이 읽기 적합한 수준 가독성 확인

---

### TASK-MISC-001 🟡 다국어 지원 (i18n)
- **브랜치**: `feat/i18n`
- **현재 상태**: 한국어/영어 번역 기능 구현 완료, main 미머지

**하위 할일**
- [x] displayLanguage 설정 UI
- [x] 취약점 설명 한국어 번역 (AI 번역)
- [x] 번역 캐시 localStorage 영속화
- [ ] 추가 번역 대상 확장
- [ ] main 브랜치 머지

**테스트 체크리스트**
- [ ] ✅ 언어 전환 시 UI 즉시 반영 확인
- [ ] ✅ 번역 캐시 새로고침 후 유지 확인

---

## 미래 기능 후보 (Future Backlog)

> 특정 Sprint에 배치되지 않은 항목들. 우선순위와 리소스에 따라 Sprint에 편입.
> ⚠️ 아래 표 중 일부는 **이미 스프린트에 배정**되어 이중 등재 상태다. 배정 매핑은 다음과 같으며, 해당 항목은 스프린트 섹션이 정본:

| Future ID | 배정 | 비고 |
|-----------|------|------|
| FEAT-SEC-001 (2FA) / FEAT-SEC-002 (IP Allowlist) | ✅ Sprint 8 (806/807) | 완료 |
| FEAT-OPS-001 (OTEL) / FEAT-OPS-002 (Prometheus) / FEAT-COMP-001 (GDPR) | ✅ Sprint 8~9 | 완료 |
| FEAT-COMP-003 (감사 로그 불변성) | → Sprint 12 TASK-1202a | 해시 체이닝 |
| FEAT-SEC-003 (세션 이력) | → Sprint 12 TASK-1202b | |
| FEAT-SEC-004 (Secrets Detection 강화) | → Sprint 18 TASK-1803 | |
| FEAT-AI-001 (멀티파일/API 경로) | → Sprint 13 TASK-1301 (MVP: Sprint 11 TASK-1106) | |
| FEAT-AI-002 (패치 PR) / FEAT-AI-005 (패치 검증) / FEAT-AI-006 (자동 롤백) | → Sprint 14 (1401/1402/1403) | |
| FEAT-AI-003 (오탐 학습) | → Sprint 13 TASK-1302 | |
| FEAT-API-002 (Export SARIF) / FEAT-API-003 (Outbound Webhook) | → Sprint 15 TASK-1502 | |
| MCP-001/002 (PostgreSQL/Docker MCP) | → Sprint 15 (미구현, Sprint 9에서 이관) | |
| MCP-003/004 (Redis/Brave MCP) | → Sprint 15 TASK-1501 | |
| FEAT-FE-007 (DAST 시뮬레이터) | → Sprint 16 TASK-1601 | |
| **나머지 (FEAT-OPS-003·004·005·006, FEAT-PERF-001·002, FEAT-COMP-004, FEAT-AI-004·007·008, FEAT-IDE-*, FEAT-MOB-001, FEAT-FE-006, FEAT-INFRA-*)** | 미배정 | 우선순위에 따라 편입 |

### MCP 서버 추가

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| MCP-003 | Redis MCP | 🟠 High | AI Agent가 캐시 히트율 확인, 분산 락 상태 조회, SSE 채널 상태 디버깅 |
| MCP-004 | Brave Search / Exa MCP | 🟠 High | AI Agent가 CVE 정보·보안 권고 실시간 검색. NVD API 캐시 미스 시 웹 검색으로 보완 |
| MCP-005 | GitHub MCP 확장 | 🟠 High | PR diff 직접 읽기 (토큰 절감), GitHub Security Advisory 조회, Dependabot Alert 교차 검증 |
| MCP-006 | Slack MCP | 🟡 Medium | Critical 취약점 발견 시 `#security-alerts` 채널 즉시 알림, 모니터링 결과 자동 발송 |
| MCP-007 | Filesystem MCP 확장 | 🟡 Medium | `.gitignore` 패턴 자동 반영, 샌드박스 경로 제한 강화, 바이너리 자동 스킵 |
| MCP-008 | Sentry MCP | 🟢 Low | 운영 에러 트래킹 데이터 AI Agent 조회 → 자동 버그 분류·취약점 연관성 확인 |

### 보안 강화

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-SEC-003 | 세션 활동 이력 조회 | 🟠 High | 사용자 활성 세션(기기별) 확인·강제 로그아웃. `user_sessions` 테이블, 동시 접속 기기 제한 |
| FEAT-SEC-004 | Secrets Detection 강화 | 🟠 High | 코드 업로드 시 시크릿 패턴 즉시 감지 (AWS키, GCP SA키, GitHub PAT, Stripe키 등 50+ 패턴) |
| FEAT-SEC-005 | 취약점 SLA 관리 | 🟡 Medium | 취약점 수정 기한 설정 및 초과 알림. Critical 3일, High 7일, Medium 30일, Low 90일 기본값 |
| FEAT-SEC-007 | 2FA 강제 리셋 관리자 API | 🟠 High | 관리자가 특정 사용자의 2FA를 강제 비활성화하는 API. 사용자가 TOTP 디바이스 분실 + 복구 코드 소진 시 계정 잠금 해제. `POST /api/v1/admin/users/{userId}/2fa/reset`. 감사 로그(`AuditLog`) 기록 필수. Admin 전용 엔드포인트 — `ROLE_ADMIN` 권한 체크. (주의: FEAT-SEC-006은 pgvector 임베딩으로 사용됨) |
| FEAT-SEC-008 | SSO/SAML 싱글 사인온 연동 | 🟠 High | Okta, Azure AD, Google Workspace 등 기업용 계정 관리 시스템과 로그인 연동 |
| FEAT-SEC-009 | 프로젝트 권한 모델(RBAC) 세분화 | 🟠 High | 팀 단위 결제 및 특정 마이크로서비스 폴더에만 개발자 접근 권한을 매핑하는 RBAC 스키마 확장 |


### API 기능 보완

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-API-001 | 분석 비교 API (Diff) | 🟠 High | 두 세션 간 취약점 증감 비교. `newVulnerabilities`, `fixedVulnerabilities`, `securityScoreDelta` 반환 |
| FEAT-API-002 | 취약점 내보내기 (Export) | 🟠 High | CSV, JSON, SARIF (GitHub Code Scanning), JIRA XML 포맷 추가 |
| FEAT-API-003 | Outbound Webhook | 🟠 High | `analysis.completed`, `vulnerability.critical_found`, `sla.breached` 이벤트를 외부 시스템으로 발송 |
| FEAT-API-004 | SBOM 다운로드 포맷 추가 | 🟡 Medium | SPDX 2.3 (NTIA 준수), CycloneDX XML, CSV 포맷 추가 |
| FEAT-API-005 | 분석 스케줄링 API | 🟡 Medium | 정기 자동 분석 예약. `POST /projects/{id}/analysis/schedule`, cronExpression 지원 |
| FEAT-API-006 | 양방향 Slack App ChatOps Bot | 🟠 High | Slack 커맨드 스캔 트리거 및 알림 메시지 내 버튼 클릭을 통한 패치 승인/반려 기능 |


### AI Agent 고도화

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-AI-001 | 멀티 파일 컨텍스트 분석 (API 호출 흐름 추적) | 🔴 Critical | API 엔트리 포인트(Controller/Axios/Swagger)를 선분석하여 호출 경로를 추출하고, 연관 파일(Service->Repository)을 우선적으로 추적·스캔하는 Taint Analysis 파이프라인. 스캔 진행 시 API 경로 매핑 상황을 실시간 SSE progress로 스트리밍. |
| FEAT-AI-002 | 패치 자동 적용 (PR 생성) | 🟠 High | 패치 승인 → GitHub API로 브랜치 생성 → 파일 수정 커밋 → PR 자동 생성. `POST /patches/{id}/create-pr` |
| FEAT-AI-003 | 취약점 오탐 학습 & 산업 도메인 커스텀 | 🟠 High | 오탐 패턴을 프로젝트별로 학습해 재분석 시 Negative Few-shot으로 활용하는 `false_positive_patterns` 테이블 및 산업 도메인별 가이드라인(RAG)을 프롬프트 컨텍스트에 주입하는 기능. |
| FEAT-AI-004 | 다국어 코드 지원 확장 | 🟡 Medium | 현재 Java/TypeScript/Python에서 Go, Rust, C/C++, PHP, Ruby 추가 |
| FEAT-AI-005 | 패치 검증 자동화 | 🟡 Medium | 생성된 패치 코드를 임시 컨테이너에서 자동으로 단위 테스트 실행 후 pass 여부를 `patchSuggestions.verificationStatus`에 저장. 패치 생성 시 테스트 코드를 Claude API로 동시 생성 → 도커 컨테이너에서 실행 → 검증 통과(Verified) 패치만 사용자에게 추천. VC 피드백(AI 환각 제어) 핵심 구현 항목. `patch_suggestions.verified_at`, `test_code` 컬럼 추가 필요 (Flyway 미배정) |
| FEAT-AI-007 | AI 음성 답변 (TTS) | 🟢 Low | preferences에 "Sprint 8 예정" 명시되었으나 미구현. ElevenLabs/OpenAI TTS 연동, 성별/톤/속도 슬라이더 제공. 모바일에서 핸즈프리 보안 브리핑 시나리오 |
| FEAT-AI-008 | AI Chat History (검색·북마크·공유) | 🟠 High | 사용자가 수행한 모든 AI 대화를 `ai_chat_sessions` 테이블에 누적. 전문 검색(pgvector embedding), 즐겨찾기, 팀원에게 링크 공유. 동일 취약점에 대한 과거 대화 자동 추천 |


### VSCode Extension 고도화 (IDE 내 조치 완결)

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-IDE-001 | Quick Fix (IDE 원클릭 패치 적용) | 🟠 High | 코드 내 취약점 밑줄(squiggly line)에 마우스를 올리고 "Quick Fix" 클릭 시, AI 제안 패치를 해당 파일에 즉시 적용하는 기능. |
| FEAT-IDE-002 | WebView Chat Panel (IDE 내 대화형 조치) | 🟠 High | 브라우저 이동 없이 VSCode 사이드바의 웹뷰 패널에서 AI Agent와 취약점 조치 관련 실시간 질의응답 및 수정 코드 조율. |
| FEAT-IDE-003 | Status Bar Integration | 🟢 Low | 현재 활성화된 프로젝트의 보안 스코어와 분석 상태를 에디터 하단 상태 표시줄에 실시간 노출. |


### AI 에이전트 자가 제어 및 안전장치

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-AI-006 | 패치 자동 롤백 및 이력 관리 | 🟠 High | 적용된 패치로 인해 빌드가 깨지거나 테스트가 실패할 경우 Git Revert 커밋을 자동 개설하여 패치를 이전 상태로 롤백하는 안전장치. |


### 컴플라이언스

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-COMP-002 | 컴플라이언스 매핑 리포트 | 🟡 Medium | 취약점을 ISO 27001, NIST CSF, PIMS, PCI-DSS 프레임워크에 매핑. 현재 OWASP Top 10만 지원 |
| FEAT-COMP-003 | 감사 로그 불변성 보장 | 🟡 Medium | 로그 항목마다 이전 항목 해시 체이닝. 또는 AWS CloudTrail/Azure Monitor 외부 전송. 무결성 검증 API 추가 |

### 프론트엔드 Pagori 리디자인 구현 현황 (2026-05-19 분석)

> `frontend-refactoring/Pagori Redesign.html` 기준 — `apps/frontend/src/` 구현 여부 대조

| 화면 | 디자인 파일 컴포넌트 | 구현 상태 | 경로 | Sprint 배정 |
|------|---------------------|----------|------|------------|
| 대시보드 | Dashboard, KpiCard, SecurityScoreRing, SeverityBarChart, TrendLineChart, FileHeatmap, OwaspCoverageMatrix | ✅ 완료 | `components/dashboard/` | — |
| 코드 에디터 | EditorLayout, FileTree, InlineHighlight, SuggestionPanel, SessionLog | ✅ 완료 | `components/editor/` | — |
| 프로젝트 목록 | ProjectCard, CreateProjectModal | ✅ 완료 | `components/project/` | — |
| 로그인 / 회원가입 | LoginForm, RegisterForm, GitHubOAuthButton | ✅ 완료 | `app/auth/` | — |
| PDF 리포트 모달 | PdfReportModal (포맷 선택, 상태 폴링) | ✅ 완료 | `components/analysis/PdfReportModal.tsx` | — |
| 커밋 시크릿 스캔 | CommitSecretScanModal | ✅ 완료 | `components/analysis/CommitSecretScanModal.tsx` | — |
| SBOM & CVE | SbomPage (컴포넌트 테이블, CVE 매핑) | ✅ 완료 | `components/analysis/SbomPage.tsx` + `app/projects/[projectId]/sbom/page.tsx` | — |
| GitHub 레포 스캔 | GitHubScanModal (URL·브랜치 입력 → 직접 분석 트리거) | ❌ 미구현 | 신규 필요 (FEAT-FE-002) | **Sprint 10** (TASK-501/502 GitHub Integration 연계) |
| 컴플라이언스 리포트 | CompliancePage (ISO 27001 / NIST CSF 매핑 표) | ❌ 미구현 | 신규 필요 (FEAT-FE-003) | **Sprint 10** (FEAT-COMP-002 백엔드와 동시 구현) |
| 팀 관리 | TeamManagementPage (초대, 권한 설정) | ❌ 미구현 | 신규 필요 | **Sprint 10** (Enterprise TASK-1002 팀 대시보드와 연계) |
| 설정 | SettingsPage (알림·플랜·API 키) | ❌ 미구현 | 신규 필요 | **Sprint 10** (Enterprise 플랜 관리 UI 필수) |
| 알림 센터 | NotificationsPage (FCM/In-App 알림 목록) | ❌ 미구현 | 신규 필요 | **EPIC-MISC** (FCM 푸시 인프라 미구축 — 인프라 구축 후 편입) |
| 분석 비교 | DiffPage (두 세션 취약점 증감 비교) | ❌ 미구현 | FEAT-API-001 백엔드 선행 필요 | **EPIC-MISC** (FEAT-API-001 Diff API 백엔드 완료 후 편입) |
| 워크스페이스 모드 | Onboarding Step 0 (개발자 vs 보안팀 모드 온보딩 및 맞춤형 UI 제공) | ❌ 미구현 | 신규 필요 (FEAT-FE-004) | **Sprint 10** (Stage 5 프론트엔드 연계 및 모드 전환) |
| 스캔 시뮬레이터 | DastVisualSimulator (SSE 기반 모의 침투 및 DB 접근 라이브 애니메이션) | ❌ 미구현 | 신규 필요 (FEAT-FE-007) | **EPIC-MISC** (AI Engine 실시간 상세 SSE 연계) |

**미구현 화면 6개** (원문 "7개"는 집계 오류) — Sprint 10: 4개, EPIC-MISC: 2개로 배정 완료 (2026-05-23).

---

### 프론트엔드 리팩토링 중 발견된 누락 API

#### FEAT-FE-001 SBOM 컴포넌트 조회 API ✅ 완료 (2026-05-22)

- **엔드포인트**: `GET /api/v1/projects/{projectId}/sbom/components?sessionId={sessionId}` (인증 필수 — SecurityConfig HttpMethod.POST 명시로 GET 차단 완료)
- **필요 파일**:
  - `apps/backend/src/main/java/io/secureai/backend/domain/sbom/controller/SbomController.java` (GET 엔드포인트 추가)
  - `apps/backend/src/main/java/io/secureai/backend/domain/sbom/dto/SbomComponentResponse.java` (신규 DTO)
  - `apps/backend/src/main/java/io/secureai/backend/domain/sbom/repository/DependencyComponentRepository.java` (findBySessionId 메서드 추가)
  - `apps/frontend/src/components/analysis/SbomPage.tsx` (신규 — SBOM & CVE 화면)
- **설명**: 현재 SBOM 컨트롤러는 저장(POST)만 지원. 프론트엔드 SBOM 화면이 세션별 의존성 목록(이름, 버전, 생태계, CVE ID 목록)을 조회하려면 GET 엔드포인트 필요. CVE 상세는 기존 `/api/v1/cve/search?packageName=` 재활용 가능.
- **응답 예시**:
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "name": "next-auth",
        "version": "4.22.1",
        "ecosystem": "npm",
        "license": "ISC",
        "cveIds": ["CVE-2024-22020"],
        "isDirect": true
      }
    ]
  }
  ```

#### FEAT-FE-002 GitHub 레포 스캔 트리거 API

- **엔드포인트**: `POST /api/v1/projects/{projectId}/analysis/github-scan`
- **필요 파일**:
  - `apps/backend/src/main/java/io/secureai/backend/domain/analysis/controller/GitHubWebhookController.java` (직접 스캔 트리거 엔드포인트 추가)
  - `apps/frontend/src/components/analysis/GitHubScanModal.tsx` (신규)
- **설명**: GitHub 레포 URL + 브랜치를 입력받아 분석 세션을 생성하고 AI Engine에 위임. 현재 `GitHubWebhookController`는 웹훅 이벤트만 처리하므로 UI에서 직접 트리거하는 엔드포인트 추가 필요.

#### FEAT-FE-003 컴플라이언스 매핑 리포트 API

- **엔드포인트**: `GET /api/v1/projects/{projectId}/compliance?framework=ISO27001`
- **필요 파일**:
  - `apps/backend/src/main/java/io/secureai/backend/domain/compliance/controller/ComplianceController.java` (신규)
  - `apps/backend/src/main/java/io/secureai/backend/domain/compliance/service/ComplianceMappingService.java` (신규)
  - `apps/frontend/src/components/compliance/CompliancePage.tsx` (신규)
- **설명**: Pagori 디자인에 ISO 27001·NIST CSF 컨트롤별 준수 여부 표가 존재하나 백엔드/프론트엔드 모두 미구현. 현재 OWASP Top 10 매핑만 지원. 지원 프레임워크: ISO 27001, NIST CSF, PCI-DSS, PIMS.
- **응답 예시**:
  ```json
  {
    "data": {
      "framework": "ISO27001",
      "controls": [
        { "controlId": "A.8.1", "name": "취약점 관리", "status": "compliant", "relatedVulnIds": [] },
        { "controlId": "A.12.6", "name": "기술적 취약점 관리", "status": "non_compliant", "relatedVulnIds": ["uuid1"] }
      ]
    }
  }
  ```

#### FEAT-FE-004 워크스페이스 모드 전환 및 온보딩 API

- **엔드포인트**: `PATCH /api/v1/users/me/workspace-mode`
- **필요 파일**:
  - `apps/backend/src/main/java/io/secureai/backend/domain/user/entity/User.java` (workspaceMode 필드 추가 및 기본값 DEVELOPER)
  - `apps/backend/src/main/java/io/secureai/backend/domain/user/controller/UserController.java` (모드 전환 API 추가)
  - `apps/frontend/src/store/useAuthStore.ts` (AuthUser 타입 및 persist 스토어 확장)
  - `apps/frontend/src/app/onboarding/page.tsx` (Step 0 페르소나 선택 UI 추가)
- **설명**: 가입 시 사용자가 개발자 또는 보안 관리자 중 선호하는 모드를 선택하게 하며, 선택에 따라 Next.js 라우팅(/editor vs /dashboard) 및 사이드바 메뉴가 자동으로 분기됩니다.
- **요청 예시**:
  ```json
  {
    "workspaceMode": "SECURITY_MANAGER"
  }
  ```

---


### 인프라 & 운영 자동화

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-INFRA-001 | GuidelineSyncJob 스케줄러 | 🟡 Medium | `docs/security/*.md` 파일이 변경될 때마다 `security_guidelines` 테이블을 자동 동기화. 현재는 `generate_guidelines_sql.py`를 수동 실행해야 하므로 가이드라인 최신화가 지연됨. `@Scheduled` Job 또는 Git Webhook 트리거로 구현. `source_path` 컬럼의 마지막 동기화 시각과 파일 수정 시각 비교 후 `UPSERT` 실행 |
| FEAT-OPS-003 | 온콜 로테이션 (On-Call Rotation) | 🟠 High | PagerDuty 스타일 — 시간대별 알림 담당자 지정. `oncall_schedules` 테이블 (org_id, user_id, start_at, end_at, escalation_level). Critical 인시던트 발생 시 1차 담당자 미응답 15분 후 2차 담당자에게 자동 에스컬레이션. Slack/SMS 발송 |
| **FEAT-OPS-004** | **시크릿 관리 + 암호화 키 로테이션** (V5.5 갭) | 🔴 Critical | 현재 `.env`/환경변수 직접 사용 + AES 키 단일 버전. AWS Secrets Manager/Vault 전환 + **key versioning**(`v1:{ciphertext}`)으로 운영 키 로테이션 가능하게. 키 교체 시 기존 데이터 복호화 보장. 베타 → SaaS 승격 전 필수 |
| **FEAT-OPS-005** | **피처 플래그 / 킬 스위치** (V5.5 갭) | 🟠 High | 위험 기능(자동 패치 PR `1401`·자동 롤백 `1403`·야간 스캔 `1001`)을 런타임에 끄고 켤 수단 부재. 조직/사용자 단위 플래그 테이블 + 관리자 토글. 베타에서 사고 시 즉시 비활성화 — 자동화 기능 출시의 전제 조건 |
| **FEAT-INFRA-002** | **DB 마이그레이션 CI 검증 + Flyway baseline** (V5.5 갭) | 🟠 High | CI에서 fresh DB로 V001~최신 전체 마이그레이션 실행 검증(현재 미검증 — V047 CHECK 충돌류 사고 재발 가능). 47개 단일 체인 → `V050 baseline` squash로 신규 환경 초기화 가속 |
| **FEAT-OPS-006** | **Rate Limit 플랜별 적용 검증 + SLO/알림 정책** (V5.5 갭) | 🟠 High | `RateLimitInterceptor`·플랜별 한도(10/60/120 rpm) 정의는 있으나 실제 적용 자동 검증 부재. + Prometheus/Grafana는 있으나 SLO·알림 임계(에러율·p95·큐 적체) 정책 미정의 → `docs/runbooks/slo.md` |

### 성능 & 부하 (신규 — V5.5 갭)

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| **FEAT-PERF-001** | **AI Engine·Anthropic API 부하/동시성 테스트** | 🔴 Critical | 현 k6는 Backend만 검증. 실제 병목은 **Claude API 동시 호출 한도·토큰 처리량**. AI Engine 동시 세션 N개 시 큐 적체·타임아웃·Anthropic 429 백오프 거동 측정. 비용 통제(`1204`)와 직결 |
| **FEAT-PERF-002** | **데이터 보존/파티션 용량 모델** | 🟡 Medium | `analysis_sessions`·`audit_logs`·`monitoring_results` 월별 파티션은 있으나 베타 트래픽 기준 디스크 증가율·보존 기간(GDPR 90일 외)·아카이브 정책 수치 미정의 |

### 컴플라이언스·법무 (신규 — V5.5 갭)

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| **FEAT-COMP-004** | **데이터 처리 위탁(DPA)·데이터 잔류(residency)** | 🟠 High | 법적 페이지(`1104`)는 동의 수집만 커버. EU 고객 대상 GDPR Art.28 DPA 템플릿, 하위 처리자(Anthropic·AWS) 목록 공개, 데이터 저장 리전 명시 필요. Enterprise 영업(`1705`)의 보안 실사 대응 항목 |

### 사용자 경험 (UX) 보강

| ID | 항목 | 우선순위 | 설명 |
|----|------|---------|------|
| FEAT-FE-006 | 사용자 프로필 + 단축키 커스텀 | 🟡 Medium | `/profile`에 "키보드 단축키" 섹션 추가. 에디터 액션(분석 시작 / 패치 적용 / AI 채팅 토글)에 사용자별 단축키 매핑 (`user_keybindings` 테이블). VS Code 패턴 (Cmd/Ctrl+K 입력 후 키 캡처). 충돌 감지 + 기본값 복원 |
| FEAT-MOB-001 | 모바일 AI 채팅 플로팅 + 크기 조절 | 🟢 Low | Android Compose — 풀스크린 채팅을 오른쪽 아래 원형 플로팅 버튼으로 전환. 클릭 시 말풍선 팝업 (M 사이즈 기본). 좌측 하단 드래그 핸들로 L 사이즈 확장 시 폰트 11→15px 자동. 에디터와 동일한 green-bordered 패치 카드 표시 |

---

## Hardening Sprint 로드맵 (미배정)

> Sprint 10 이후, 제품 안정화 단계에서 전체 1~2 Sprint를 보안·성능·품질 강화에 집중 투입.  
> 아래 항목들을 하나의 "Hardening Sprint"로 묶어 처리할 것을 권장함 (2026-05-23 로드맵 편입).

### 보안 강화 대상

| 항목 | 출처 | 세부 내용 |
|------|------|---------|
| ADR-016 전환 — Backend API 경유 | ADR-016 임시 결정 | `_fetch_prev_vuln_context()` + `_fetch_prev_patch_example()` f-string SQL → `GET /internal/v1/projects/{id}/vuln-context` Backend API 경유로 전환. SQL 파라미터 바인딩 원칙 완전 복원 |
| 감사 로그 불변성 (FEAT-COMP-003) | 미래 기능 후보 | AuditLog 항목마다 이전 항목 해시 체이닝. 외부 SIEM(CloudTrail/Azure Monitor) 연동 |
| FEAT-SEC-003 세션 활동 이력 | 미래 기능 후보 | 사용자 활성 세션(기기별) 확인·강제 로그아웃 |
| FEAT-SEC-004 Secrets Detection 강화 | 미래 기능 후보 | 50+ 시크릿 패턴 (AWS Key, GCP SA Key, GitHub PAT, Stripe Key 등) |

### 성능 & 품질 대상

| 항목 | 세부 내용 |
|------|---------|
| Flyway 마이그레이션 통합 테스트 | CI 파이프라인에서 `flyway:migrate` + 롤백 시나리오 자동화 |
| AI 파이프라인 병목 프로파일링 | Jaeger 트레이싱 기반 `sast_node` p99 지연 측정 + asyncio 병렬화 개선 |
| k6 부하 테스트 자동화 | `make perf-test` → CI/CD 파이프라인 통합 (p95 < 500ms 게이트) |
| OWASP ZAP 자동화 | `ghcr.io/zaproxy/zaproxy:stable` → CI 파이프라인 통합 (Critical 0건 게이트). 로컬 실행 하니스(`make zap-scan`)는 **TASK-1203b**, CI 연결은 **TASK-1203** |

---

*관련 문서: `08_CHECKPOINT_FLOW.md` (체크포인트 상세 설계), `00_ARCHITECTURE_DECISIONS.md` (아키텍처 결정 사항), `14_SECURITY_TEAM_FEATURES.md` (보안팀 전용 기능)*
