# [2026-06-24] 작업 세션 요약

**브랜치**: `main` (fix 브랜치 `fix/sprint14-runtime-defects` --no-ff 머지 후)
**작업 범위**: Sprint 14 런타임 결함 일괄 수정 + 패치 PR 파일손상 근본수정 + 이메일 dev 폴백 + Audit 프로바이더 변경 + 벌크 트리아지 API 신규 + 분석/DAST 파이프라인 검증·데모 논의

---

## 1. 완료 작업

| 항목 | 주요 파일 | 커밋 |
|------|---------|------|
| 런타임 결함 4종 수정 (WebGoat 포트, 패치검증 샌드박스, AST 가드 라벨, PR 파일손상) | `apps/ai_engine/benchmarks/`, `patch_test_runner.py`, `Dockerfile.patch-verify`, `validate_findings_node.py`, `PatchPrService.java` | `65e356d` |
| PR 파일손상 근본수정 + 이메일 dev 폴백 (GitHub API 재구성, LoggingEmailSender) | `GitHubRestClient.java`, `PatchPrService.java`, `LoggingEmailSender.java`, `application.yaml` | `cdd4820` → `5017ceb` (--no-ff 머지) |
| 패치검증 테스트 보강 (patchedSnippet 누락 케이스) | `PatchPrServiceTest.java` | `c4f7a7d` |
| Audit 프로바이더 기본값 변경 (gemini → anthropic/Haiku) | `apps/ai_engine/config/settings.py` | `dc16418` |
| 벌크 트리아지 API 신규 (`PATCH /api/v1/vulnerabilities/bulk-triage`) | `BulkTriageRequest/Response`, `VulnerabilityController`, `VulnerabilityService`, `VulnerabilityServiceTest.java` | `a4cfe9e` |

---

## 2. 의논 내용 & 결정 맥락

### 시나리오 검증 & 데모 전략
- `user_test_scenario.md`는 Sprint 1~14 사용자대면 플로우를 부분 커버하나, 크레딧/플랜게이팅/관리자/커밋스캔/CVE/야간스캔은 미포함
- **데모 권장 흐름**: Phase 2~3(SSE SAST + AST 가드 + 트리아지)을 메인으로, 클라이맥스는 제품 **DAST 워크스페이스(라이브 SSE 익스플로잇)**
- 근거: `proven_exploit` 스코어카드 실제 숫자로 설득력 확보
- **라이브 시연 비추천**: Phase 5 패치검증(외부 GitHub 의존), Phase 1 메일(SMTP 의존)

### 분석 파이프라인 아키텍처 (중요 검증사항)
- **SAST 그래프** (`graph_builder.py`): scan_files → api_discovery → planning → [cache_check → (sast|validate)] 루프 → aggregate → patch → patch_verify
- **DAST는 별도 그래프** (`dast_graph_builder.py`, dast_node 재시도 → notify)
  - `POST /agent/dast/start`: 취약점 **단위** user-triggered (SAST 자동후속 아님)
- `proven_exploit`: 제품 외부 벤치마크, 엔드투엔드 검증용
- **전문가 지침**: DB 테이블 `security_guidelines`에 적재
  - `scripts/sync_guidelines.py`가 `docs/security/**/*.md` 읽어 적재 + fastembed 임베딩
  - 마이그레이션: V015/V028
  - **참조처**: `sast_node` (스택별 `load_guidelines`) · `dast_node` (pgvector 의미검색)
  - ⚠️ **critical**: `planning_node`는 지침 미참조 (파일 스테이지 순서만) / `sync_guidelines`는 수동 스크립트 (자동 시드 미포함)
    - 미실행 시 테이블 비어 지침 없이 탐지 → 시연 전 `python scripts/sync_guidelines.py` 필수 실행

### Audit 모델 선택
- 기존: 기본 `audit_provider=gemini` (시나리오 "Audit=Haiku"는 폴백일 때만 맞음)
- 변경: 사용자 요청에 따라 `anthropic`으로 변경 (Claude Haiku 기반)
- 설정: `apps/ai_engine/config/settings.py`에서 기본값 조정 완료

### 배치 처리 (DAST 최적화 논의)
- **DAST 배치 우선순위 결정**:
  1. ✅ **벌크 트리아지 먼저** (가볍고 데모효과 큼) → 구현 완료
  2. 배치 DAST (다음 세션): vuln_type 그룹핑이 효율적 (지침 1회 재사용)
- **DAST 배치 구현 전략**:
  - RAM 아닌 대상 과부하 & 도커-per-익스플로잇 리스크 → **Semaphore 동시성 제어** (3~5 범위)
  - **단일 SSE** (각 클라이언트 1개 스트림)
  - `proven_exploit` 집계 재사용 (중복 호출 회피)

### Reviewer 게이트 (블로커 0)
- 3회 PASS: fix batch 1 → fix batch 2 → 벌크트리아지
- **적용된 권고사항**:
  - getFileContent 404 케이스 주석 추가
  - 고아 브랜치 방지 위해 `buildPatchedFileContent`를 브랜치 생성 전으로 이동
- **비차단 권고** (다음 세션 우선):
  - `02_API_DESIGN`에 triage 엔드포인트(단건/벌크) 등재

### 형상관리
- fix 커밋들: `fix/sprint14-runtime-defects` 브랜치 → `5017ceb` --no-ff 머지
- 이후 커밋 (`dc16418`, `a4cfe9e`): main 직접 커밋
- **전부 로컬 main 미푸시** — 사용자 푸시 결정 대기

---

## 3. 버그 수정 / 특이사항

| 이슈 | 설명 | 트러블슈팅 문서 |
|-----|------|-----------------|
| 패치검증 샌드박스 항상 FAILED | pytest 선설치 부재 + PyPI 도달 불가(--read-only + dast-isolated-net) + pipe 종료코드 손실 | `docs/troubleshooting/2026-06-24_patch-verification-sandbox-failure.md` |
| 패치 PR이 파일 손상 | originalSnippet 구간만 치환해야 하나 전체 파일을 덮어씀 | `docs/troubleshooting/2026-06-24_patch-pr-file-corruption.md` |

---

## 4. 다음 세션에서 할 것

- [ ] **배치 DAST 엔드포인트** (backend + ai_engine)
  - `POST /api/v1/dast/batch`: vuln_type 그룹핑 · 그룹당 지침 1회 · Semaphore(3~5 동시성) · 단일 SSE · proven_exploit 집계 재사용 · 상한/개별실패 skip
  - `POST /agent/dast/batch`: 대응 그래프 노드 확장
- [ ] **프론트 벌크 트리아지 UI** (Claude design 핸드오프)
  - `VulnPanel.tsx` 멀티셀렉트 + "이 유형 N건 선택" 배너 + 벌크 액션바
  - `useSecureStore`에 선택상태 + `optimisticUpdateManyVulnStatus` + rollback
  - `apiClient.patch('/vulnerabilities/bulk-triage')` 호출 + skip 재조정 토스트
- [ ] **시연 전 선행조건** (필수 체크)
  - `python scripts/sync_guidelines.py` 실행 (지침 적재 확인: `SELECT count(*) FROM security_guidelines`)
  - `secureai-patch-verify` 이미지 빌드
  - WebGoat 8081 포트 + `dast-isolated-net` 네트워크 생성 (`make infra`)
  - `EMAIL_PROVIDER=log` 환경 변수 설정
- [ ] **API 설계 문서화** (비차단 권고)
  - `02_API_DESIGN`에 triage 엔드포인트(단건/벌크) 명세 등재
- [ ] **푸시 여부 결정** (현재 전부 로컬 main 미푸시)

---

**테스트 결과**:
- AI Engine 단위테스트: 51 + 12(PatchPrService) + 4(VulnerabilityService) 통과
- 백엔드 컴파일: OK
- 백엔드 전체 테스트: `DomainVerificationRedisIT` 4건 실패 (로컬 Redis 미기동 환경 의존, pre-existing)
