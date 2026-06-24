# [2026-06-24] 배치 DAST API + 문서화 세션

**브랜치**: `feat/batch-dast` → `main` (--no-ff 머지 후 로컬)
**작업 범위**: 직전 세션 §4 "다음 세션 할 일" 중 ①배치 DAST 엔드포인트 + ②API 설계 문서화 구현

---

## 1. 완료 작업

| 항목 | 커밋 | 주요 파일 |
|------|------|---------|
| 배치 DAST 엔드포인트 (backend + ai_engine) | `20d3240` (feat) | `apps/ai_engine/api/routes/dast.py` (POST `/agent/dast/batch`), `apps/ai_engine/tests/api/test_dast_route.py` (배치/SSE 테스트 11건), backend `DastController.postDastBatch`, `DastExecutionService.executeDastBatch`, `AiAgentClient.startDastBatchSession`, `DefaultAiAgentClient` (신규 메서드), DTO `DastBatchRequest`/`DastBatchTarget` |
| API 설계 문서화 (Triage 단건/벌크 + DAST start/batch) | `38e8683` (docs) | `docs/02_API_DESIGN_V5_260523.md` (§8A Triage API 단건/벌크, §12.3 DAST start, §12.4 DAST batch) |
| 머지 | `6123d60` | `feat/batch-dast` --no-ff → main |

---

## 2. 의논 내용 & 결정 맥락

### 배치 DAST 설계 & 구현 방식

1. **vuln_type 그룹핑 최적화**
   - 기존 단건(start): 요청당 DAST 지침 벡터검색 1회
   - 배치: 타깃 수십 건, vuln_type별 그룹화 → 그룹당 지침 검색 **1회만**
   - 예: SQLi 5건 + XSS 3건 → `dast_guidelines` 캐시 8회→2회 감소
   - 구현: backend에서 `DastBatchRequest` 파싱 후 vuln_type 그룹핑, ai_engine에 `batch` 플래그 전달

2. **동시성 제어 (Semaphore)**
   - 라이브 익스플로잇 도커/네트워크 과부하 방지
   - 선정: `asyncio.Semaphore(_BATCH_CONCURRENCY=4)` 
   - 근거: Stage 2 Reviewer 권고 범위(3~5), 로컬테스트(4 무난)

3. **단일 SSE 해결 (배치 조기종료 결함 수정)**
   - **1차 구현 결함**: `_sse_generator`가 첫 `dast_result` 후 break → 배치의 각 타깃이 같은 세션 채널로 `notify_node` PUBLISH → 첫 타깃 완료 시 스트림 닫혀 나머지 + `dast_batch_complete` 유실
   - **원인**: "단일 SSE 전체 구독" 요구(§사전결정)와 기존 단건 로직 혼재
   - **수정**: `GET /agent/dast/logs/{session_id}?batch=true` 쿼리파라미터 도입
     - `batch=True`: 개별 `dast_result`에서 종료 X → 최종 `dast_batch_complete` 또는 치명 `dast_error`에서만 종료
     - `batch=True`: 시작 시 `dast_result` 캐시 무시 (재구독 조기종료 방어)
   - **마스터 코드리뷰 중 적발** → Dev 재호출로 해결

4. **개별 타깃 실패 처리**
   - `asyncio.gather(return_exceptions=True)` → 개별 실패 skip&log
   - 배치 전체 중단 X, 결과 요약에만 실패 건수 표시
   - 상한: `targets` 50건

5. **보안 (CLAUDE.md 준수)**
   - consentGiven · assertDastAllowed(도메인 소유권) 게이트는 단건과 동일 재사용
   - `target_url` / `params` 로그 금지
   - 입력검증: Controller(공개 엔드포인트) Bean Validation / Pydantic(ai_engine 가드)
   - 레이어별 상태코드:
     - Backend 공개 엔드포인트: `400` (Bean Validation @NotEmpty/@NotBlank/@Size)
     - AI Engine 내부: `422` (Pydantic validation_error, 공개 응답 아님)
   - 문서에 레이어 구분 명문화

### Reviewer 게이트 (1차 FAIL → 재검토 PASS)

- **1차 블로커**: 문서 422/400 상태코드 불명확 → 각 레이어에서 정확했으나 문서 모호함
  - 수정: API_DESIGN에 "레이어별 상태코드"절 추가, backend/ai_engine 분명 구분
  - **코드 변경 없음** (이미 올바른 구현)
- **비차단 권고 3건** (합당한 사유로 보류):
  1. `_run_dast_batch` 32줄 / `_sse_generator` 60줄 → 함수길이 기준 검토 필요 (배치 로직 복잡도 타당, 분리 시 상태공유 비용↑)
  2. Java `@Size(max=50)` 매직넘버 → `DastBatchRequest.MAX_TARGETS = 50` 상수화 권고 (다음 정리)
  3. `params: Map<String,Object>` vs `Map<String,String>` 타입 → OpenAPI 기준 Object 유지(String만으로는 배열/복합값 표현 불가, 실측 필요)

### 의논: SAST→DAST 핸드오프 (보류, 논의 더 필요)

- **사용자 질문**: "SAST 취약점을 DAST에 자동 연결할 수 있나?"
- **코드 실측 결과**:
  - SAST: `api_discovery_node`가 `api_groups` 생성 (파일↔API 매핑) → 취약점 엔티티와 연결·영속화 **X**
  - Backend `Vulnerability` 엔티티: endpoint/method/params 컬럼 **없음**
  - Frontend: `vulnUtils.deriveEndpoint` 등 휴리스틱 재추론 + DVWA 하드코딩 포함 → DAST 워크스페이스 Request Builder는 사실상 수동입력
  - **결론**: SAST→DAST 엔드포인트 핸드오프가 실데이터 아니라 추론/목업 수준
- **권장안 (보류, 논의 후 착수)**:
  1. (A) api_discovery 결과를 vuln에 영속화: filePath+line ↔ api_group.files 매칭 → endpoint/method/params 부여
  2. (B) DAST 시작폼 prefill(실행은 user-triggered 유지)
  3. (C) 취약점 카드에 SAST 의심 + DAST proven 통합 뷰
  - 스코프 규모 미정, 다음 세션 설계 논의 필요

---

## 2.1 연장 세션: SAST 산출 강화 설계 + 데모 전략 결정

### 배경 및 질문
- **핵심 사용자 질문**: SAST가 탐지하고 "왜 위험한가" 결론까지 내는데, 그 추론 중간 정보가 산출물에 담기지 않는 것 아닌가? 
  - DAST에 더 넘길 정보는? 
  - 사용자에 참고 자료로 줄 것은? 
  - 문제코드 위치·스니펫·수정안까진 나오지 않나?

### 코드 실측 결과 (근거: `agent/claude_client.py` + `response_parser.py` + `Vulnerability` 엔티티)

1. **SAST 출력 스키마 제한**
   - System prompt가 강제하는 8필드만: `type·severity·category·cwe·owasp·line·description·code_snippet`
   - `response_parser.parse_sast_response`가 그대로 통과, `file_path`만 추가 부착
   - **사용자 가정 일부만 맞음**: 수정안(patch_suggestion)은 sast_node가 아닌 **별도 patch_node**(aggregate→patch→patch_verify)에서만, patch 단계까지 도달한 finding에 한해서만 생성됨 → SAST 결과 자체에는 없음

2. **SAST→DAST 엔드포인트 핸드오프 실상**
   - `api_discovery_node`가 `api_groups`(url+method) 생성하나 취약점 엔티티와 연결·영속화 안 됨
   - Backend `Vulnerability` 엔티티에 endpoint/method/params 컬럼 **없음**
   - Frontend `vulnUtils.deriveEndpoint`/`deriveApiGroup` (DVWA 하드코딩 포함)가 휴리스틱 재추론
   - DAST 워크스페이스 Request Builder 실제 운영 = 사실상 수동입력

### 설계 결정: 선별 확장 + 영속화 + prefill (자동연결 금지)

**목표**: SAST 산출 품질 ↑(참고자료+추론근거) / 사용자 DAST 진입장벽 ↓(prefill) / 환각↑·토큰비용↑ 트레이드오프 수용

**결정 내용**:
1. **출력 스키마 선별 확장** (전부 캡처 금지, 기존 8필드 + 신규 선택)
   - 신규 추가 필드 후보: `references` (무비용, CWE/OWASP ID 렌더), `tainted_parameters` (AST 근거), `data_flow_summary` (추론 요약 1줄)
   - 근거: 기존 cwe/owasp는 URL만 제공, 상세 설명·개선방안 없음 → references + tainted로 보강
   - 수정안(patch_suggestion): SAST에서 추진 X (patch_node 전담 유지)

2. **취약점-엔드포인트 영속화** (backend Vulnerability 스키마 확장)
   - filePath+line을 api_discovery 결과의 api_group.files와 매칭 → endpoint/method/params 부여
   - 게이트: consent + assertDastAllowed(도메인 소유권 검증) 유지 (자동 DAST 실행은 금지)

3. **DAST 시작폼 prefill** (user-triggered, 자동 실행 아님)
   - 취약점 카드 [DAST 테스트] 버튼 → prefill된 Request Builder 제시
   - target_url/method/params 사전입력 / 사용자 확인·수정 후 실행

4. **토큰·환각 트레이드오프**
   - tainted_parameters/data_flow는 VAL-3 AST 교차검증으로 환각 억제
   - references는 무비용(CWE/OWASP 구조화 ID 렌더링)

### 산출 문서 (커밋 `5f8f5eb`)

#### ADR-017 (Architecture Decision Record)
- 파일: `docs/00_ARCHITECTURE_DECISIONS.md` → 신규 ADR-017
- 내용: 
  - **배경**: SAST 산출이 추론 근거를 유실하고 DAST 핸드오프가 휴리스틱/목업에 의존
  - **문제**: 사용자가 수정안 없음, 참고자료 부실로 신뢰↓ / DAST prefill 수동 재입력
  - **결정**: 스키마 확장(references+tainted+data_flow) + 엔드포인트 영속화 + prefill (자동연결 금지)
  - **트레이드오프**: 토큰비용↑ / 환각↑(→AST 교차검증으로 완화)
  - **영향**: Sprint 15 VAL-18로 구현, frontend/backend/ai_engine 3계층

#### VAL-18 (EPIC-VAL 상세명세 등재)
- 파일: `docs/07_SPRINT_BACKLOG_V4_260523.md` → VAL-18 섹션 추가
- 내용:
  - **타이틀**: SAST 산출 강화(references+tainted+data_flow) + 엔드포인트 영속화 + prefill
  - **변경파일**: `response_parser.py`, `Vulnerability` 엔티티, `VulnerabilityController`, frontend `VulnPanel.tsx`
  - **단계로직**:
    - **Stage 1**: Claude prompt 재설계 + output schema 확장 (references/tainted) + unit test
    - **Stage 2**: Backend Vulnerability 스키마 확장 + api_discovery 매칭 로직 + API spec 업데이트
    - **Stage 3**: Frontend prefill UI + 데이터 플로우 + E2E 검증
  - **DoD**: SAST 산출 8필드→11필드, references 링크 클릭가능, prefill form 완성도, AST 교차검증 활성화
  - **사이즈**: **L** (3계층, 신규 필드 5개, E2E 검증 필요)
  - **우선순위**: Sprint 15 후보 (데모 이후 착수, VAL-4/ECON 메인 경로 블로킹 아님)
  - **선행조건**: VAL-4 런타임 수동검증(proven 라벨링) — VAL-18의 AST 교차검증 기초

### Sprint 14 재계획 여부 (결론: 불필요)

**사용자 질문**: Sprint 14 계획에 백로그 항목 안 넣은 게 있나? 재계획 필요?

**확인 결과**:
- 누락이 아니라 **의도적 이월** (근거: sprint-14.md에 기록)
  - **VAL-5**: 자동롤백(PR-only), 프로덕션 조건 불성립
  - **VAL-8/13/16**: 데모·평가 필수 아님, 이월 우선순위 낮음
  - **VAL-9**: 선행조건 VAL-4 미완료

**결론**: 완료 스프린트 소급수정 부적절 → 이월분 + VAL-18을 **/sprint 15**로 편성 권고

### 데모 타이밍 & 스코프 결정 (결론: Sprint 15 기다리지 말 것)

**데모 클라이맥스**:
- 핵심 시연 흐름 = "탐지(SAST) → 증명(proven) → 패치 → 원가절감" = **Sprint 14 + EPIC-ECON 묶음**
- Sprint 15(EPIC-WEDGE 컴플라이언스)는 VC 마일스톤 ①(ISMS-P)인데 Sprint 8 보안문서로 이미 시연 가능 → 데모 핵심에 거의 보탬 없고 촬영만 지연

**실제 게이트 (필수 vs 최적)**:
1. **(필수) 시연 선행조건 4종**:
   - `python scripts/sync_guidelines.py` 실행(기가이드 최신화)
   - patch-verify 이미지 빌드
   - `dast-isolated-net` 도커 네트워크 확인
   - `EMAIL_PROVIDER=log` 환경변수 설정
   
2. **(필수) VAL-4 런타임 수동검증**:
   - WebGoat proven 실증 (exploit 성공, proven 라벨 확인)
   - scorecard (impact·cost 계산) 동작 확인
   
3. **(최적) EPIC-ECON 당겨 원가 숫자**:
   - AI/인프라 비용 감소율 정량화 → 데모 ROI 극대화

**VAL-18의 위치**:
- 데모 폴리시(공격시나리오 노출 + DAST prefill 편의)의 한 부분
- 블로커 아님 → 데모 v1 촬영 후 Sprint 15에서 구현
- VAL-18 없이도 현재 기능(SAST 탐지+DAST 수동 시작)으로 데모 핵심 시연 가능

**Frontend 스코프 확인** (사용자 질문: "frontend만 수정하면 되지?"):
- **이번 커밋까지 완료된 것**:
  - 배치 DAST API (backend + ai_engine 완료)
  - SAST 설계 논의 (backend entity 확장 미정)
- **남은 frontend 스코프**:
  - 벌크 트리아지 UI (`VulnPanel.tsx` 멀티셀렉트 + 배너) — frontend-only, 이월
  - 배치 DAST 실행 UI 연동 — frontend-only, 이월
  - VAL-18 prefill form — cross-stack(frontend만으로 불가, backend entity+API 필요)
- **데모 v1 결론**: 코드보다 **인프라 선행조건 + VAL-4 런타임 검증**이 게이트. Frontend 벌크/배치 UI 없이도 postman/curl로 시연 가능

---

## 3. 테스트 결과

### AI Engine
- `tests/api/test_dast_route.py`: **24/24 통과**
  - 기존 단건 13건 (start 요청/응답/SSE)
  - 신규 배치 11건 (batch 요청/응답/SSE/그룹핑/실패처리/Semaphore/캐시무시)

### Backend
- `DastControllerTest`: 배치 4건 통과 (start/batch 기본/오류)
- `VulnerabilityServiceTest`: 벌크 트리아지 테스트 기존 모두 통과
- `DefaultAiAgentClient` 타깃 테스트 통과
- 컴파일: **OK**
- 전체 스위트: Redis IT pre-existing 이슈 별개 (미실행)

---

## 4. 형상관리

- **3커밋 모두 로컬 main, 미푸시**
  - feat 커밋 `20d3240` + docs 커밋 `38e8683` → --no-ff 머지 `6123d60`
  - 직전 세션 미푸시분 포함 origin 대비 ahead
- **병행 편집 문서**: `docs/memo/2026-06-21_ai-engine-architecture-v2-plan.md` (untracked, 미터치)

---

## 5. 다음 세션에서 할 것

### 우선순위 1 — 데모 시연 (v1, Sprint 14 완성도)
- [ ] **시연 선행조건 4종 셋업** (필수, 현재 상태 미확인)
  - `python scripts/sync_guidelines.py` 실행
  - patch-verify 이미지 빌드 (`docker build -t patch-verify ...`)
  - `dast-isolated-net` 도커 네트워크 생성 확인
  - `EMAIL_PROVIDER=log` 환경변수 설정
  
- [ ] **VAL-4 런타임 수동검증** (필수, WebGoat 기반)
  - exploit 성공 + proven 라벨 확인
  - scorecard 동작 확인 (impact·cost 계산)
  
- [ ] **EPIC-ECON 당겨 원가 숫자** (선택, 데모 최적화)
  - AI/인프라 비용 감소율 정량화

- [ ] **데모 v1 촬영** (Sprint 14 기능만 사용)
  - 흐름: 코드업로드 → SAST 탐지 → proven 확인 → DAST(수동) → 패치 → 원가

### 우선순위 2 — Frontend 이월 스코프 (데모 v1 불필요, 추후)
- [ ] **프론트 벌크 트리아지 UI**
  - `VulnPanel.tsx` 멀티셀렉트 + "이 유형 N건 선택" 배너 + 벌크 액션바
  - `useSecureStore` optimistic/rollback
  
- [ ] **배치 DAST UI 연동**
  - 벌크 선택 → [DAST 배치 실행] 버튼 → 결과 스트림

### 우선순위 3 — Sprint 15 설계 (데모 이후)
- [ ] **VAL-18 (SAST 산출 강화) Sprint 15 편성**
  - `/sprint 15` 명령 → VAL-18 + 이월분 편성
  - 3단계 분할: schema 확장 → 엔드포인트 영속화 → prefill UI
  - AST 교차검증 기초 마련

### 형상관리
- [ ] **5커밋 푸시 여부 결정** (현재 로컬 미푸시)
  - `20d3240` (배치 DAST 기능)
  - `38e8683` (API 문서)
  - `6123d60` (배치 DAST 머지)
  - `02daad6` (벌크 트리아지 API)
  - `5f8f5eb` (ADR-017 + VAL-18 설계)

---

**현재 상태 (2026-06-24 연장 세션 종료 시점)**:
- 배치 DAST API 구현 + 테스트 완료
- SAST 산출 강화 설계 + ADR-017 + VAL-18 명세 완료
- Sprint 14 → Sprint 15 이월 경계 명확화 (재계획 불필요)
- 데모 우선순위 결정 (Sprint 15 기다리지 말 것, v1 촬영 시작)
- 5커밋 로컬 준비 완료, 푸시 대기
