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

### 직전 §4 이월분 (미착수)
- [ ] **프론트 벌크 트리아지 UI**
  - `VulnPanel.tsx` 멀티셀렉트 + "이 유형 N건 선택" 배너 + 벌크 액션바
  - `useSecureStore` optimistic/rollback
- [ ] **시연 전 선행조건** (필수)
  - `python scripts/sync_guidelines.py` 실행
  - 이미지 빌드, 포트/네트워크 확인
  - `EMAIL_PROVIDER=log` 설정
- [ ] **SAST→DAST 핸드오프 설계** (보류, 논의 후)
  - 권장안 (A)/(B)/(C) 중 우선순위 확정
  - 스코프 평가

### 형상관리
- [ ] **푸시 여부 결정** (현재 3커밋 로컬 미푸시)
  - origin/main과 비교 후 push 또는 보류

---

**최종 상태**:
- 배치 DAST API 구현 + 문서화 완료
- Reviewer PASS (코드 변경 필요 없음)
- 테스트 그린
- 로컬 main 준비 완료, 푸시 대기
