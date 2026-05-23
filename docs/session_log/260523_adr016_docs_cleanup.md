# ADR-016 전환 + 설계 문서 정리 세션 로그 (2026-05-23)

**브랜치**: `refactor/docs-cleanup`  
**작업 범위**: `docs/feedback/260523-14-docs.md` 평가 보고서 10개 액션 아이템 전 처리 완료

---

## 세션 배경

Sprint 9 완료 후 설계 문서 종합 평가 보고서(`260523-14-docs.md`)가 작성되었고,
이 세션에서 보고서의 🔴 즉시 / 🟠 단기 / 🟡 중기 액션 아이템 10개를 순서대로 처리했다.
중간에 ADR-016의 "임시 결정"을 실제 코드 전환으로 마무리했다.

---

## 처리한 액션 아이템 전체 목록

| # | 우선순위 | 항목 | 커밋 |
|---|---------|------|------|
| 1 | 🔴 즉시 | ADR-004 스케줄 목록 현행화 — `SslCertChecker` → `MonitoringJob` | `f7c0f71` |
| 2 | 🔴 즉시 | ADR-016 MCP PostgreSQL 쿼리 전략 ADR 신규 기록 | `a51478b` |
| 3 | 🔴 즉시 | Sprint 5 이월(TASK-501~505) 처리 방향 결정 | `021883a` |
| 4 | 🟠 단기 | `FEAT-SEC-007: 2FA 강제 리셋 관리자 API` 백로그 등록 | `d8adfb3` |
| 5 | 🟠 단기 | 프론트엔드 미구현 7개 화면 Sprint 10 배정 결정 | `8ba5f02` |
| 6 | 🟠 단기 | `17_ARCHITECTURE_CURRENT_V2` Sprint 9 완료 내용 반영 | `38b72ea` |
| 7 | 🟡 중기 | `FEAT-AI-005` 패치 검증 자동화 + `FEAT-INFRA-001` GuidelineSyncJob + Hardening Sprint 로드맵 | `96a32e2` |
| 8 | 🟠 단기 | ERD/API 문서 버전 정본 지정 + 구버전 삭제·아카이브 | `8f0176d` |
| 9 | 🔴 즉시 | **ADR-016 코드 전환**: f-string SQL → Backend 내부 API 경유 | `4211b50` |
| 10 | 문서 | GitHub Projects V2 YAML 버전 이력 헤더 정비 | `36cf5fb` |

---

## 핵심 의사결정: ADR-016 전환 (항목 #9)

### 왜 이 시점에 전환했나?

평가 보고서에서 "SQL 파라미터 바인딩 필수" 규칙의 예외가 ADR에 기록만 됐고
실제 구현이 f-string SQL이라는 사실을 지적했다. 선택지는 다음 세 가지였다:

| 대안 | 파라미터 바인딩 | 평가 |
|------|----------------|------|
| **A. Backend API 경유 (채택)** | ✅ JPQL | 기존 `backend_api_client.py` 패턴 재사용, 추가 인프라 없음 |
| B. asyncpg 직접 연결 | ✅ `$1` 플레이스홀더 | "AI는 MCP를 통해서만 DB 접근" 일관성 저해 |
| C. f-string + UUID 검증 (현 상태) | ❌ 원칙 위반 | 즉시 구현 가능하나 보안 규칙 예외 |

A 방안을 선택한 이유: AI Engine은 이미 `BACKEND_INTERNAL_URL` + `X-Internal-Key`로
Backend를 호출하는 `backend_api_client.py` 패턴을 사용 중이어서 추가 인프라 변경 없이
JPQL 파라미터 바인딩 기반 안전한 쿼리를 즉시 확보할 수 있었다.

### 구현 범위

**Backend 신규 추가 (총 8개 변경)**
- `VulnContextItem`, `PatchExampleItem` — record DTO 2개
- `VulnerabilityRepository.findVulnTypeSummaryByProjectId()` — JPQL GROUP BY 집계
- `VulnerabilityQueryService.getVulnTypeSummary()` — 서비스 위임 메서드
- `VulnerabilityController` — `GET /api/v1/internal/projects/{id}/vuln-context`
- `PatchSuggestionRepository.findRecentByVulnTypeAndLangSuffix()` — JPQL LIKE 파라미터 바인딩
- `PatchService.getPatchExamples()` — 서비스 메서드
- `PatchController` — `GET /api/v1/internal/patch-examples`

**AI Engine 수정 (총 3개 파일)**
- `backend_api_client.py` — `get_vuln_context()`, `get_patch_examples()` 추가
- `sast_node.py` — `_fetch_prev_vuln_context(project_id)` 전면 교체  
  - `get_tool()` 호출 + f-string SQL 삭제  
  - `session_id` 매개변수 제거 (더 이상 불필요)  
  - Backend API 응답 → `"vulnType | count: N | max_severity: X"` 포맷팅
- `patch_node.py` — `_fetch_prev_patch_example(vuln_type, language)` 전면 교체  
  - `get_tool()` import 삭제  
  - Backend API 응답 → Before/After/Explanation 블록 포맷팅

**테스트**
- `test_adr016_backend_api.py` 신규 작성: 13개 단위 테스트, 전체 통과
- `test_mcp_postgres_tools.py`: 구 MCP 기반 테스트 8개 제거 → `get_tool()` 3개 유지

### 부수 효과 (긍정적)

구 MCP 기반에서 `patch_results` 테이블의 `original_code` / `patched_code` 컬럼을
참조하는 f-string SQL이 있었으나, 실제 엔티티는 `original_snippet` / `patched_snippet`이었다.
→ **기존 MCP 쿼리 자체가 잘못된 컬럼명을 사용하고 있었음** (런타임 오류 잠재).
Backend API 전환으로 이 버그도 함께 해소됐다.

---

## 문서 정리 요약 (항목 #1~#8, #10)

### ADR-004 스케줄 목록 현행화
- 독립 Job이었던 `SslCertChecker(매주 월 09:00)`가 Sprint 9에서 `MonitoringJob(매시)`으로 통합됨
- ADR-004 스케줄 현행 목록 9개로 갱신, 폐기 항목 표 별도 분리

### Sprint 5 이월 처리
- `TASK-501~504` → Sprint 10 편입 (GitHub 통합 코어로 분류)
- `TASK-505` (기업 보안 정책 이메일) → `EPIC-MISC` 재분류

### Sprint 10 백로그 보강 (`07_SPRINT_BACKLOG_V4_260523.md`)
- `FEAT-SEC-007`: 2FA 강제 리셋 관리자 API (`POST /api/v1/admin/users/{id}/2fa/reset`)
- `FEAT-AI-005`: 패치 검증 단위 테스트 자동 생성 + 임시 컨테이너 실행
- `FEAT-INFRA-001`: GuidelineSyncJob (주 1회 MD 변경 감지 + 임베딩 재생성)
- 프론트엔드 미구현 7개 화면 → Sprint 10(4개) / EPIC-MISC(2개) 배정 완료
- Hardening Sprint 로드맵 섹션 신규 추가 (E2E 자동화, ADR-016 전환, FEAT-COMP-003 등)

### `17_ARCHITECTURE_CURRENT_V2` 갱신
- 시스템 다이어그램: VSCode Extension, Android 클라이언트, Prometheus/Grafana subgraph 추가
- MCP 서버 위치 명확화: "외부 노드"가 아닌 "AI Engine 내부 stdio subprocess"
- Sprint 5~9 완료 내역 추가, 기술 스택 섹션 현행화, 관측성 스택(11.5) 신규

### 문서 버전 정리 (`8f0176d`)
- `01_ERD.md` → rename to `01_ERD_V3_260523.md` (V3 정본)
- `02_API_DESIGN.md`, V2, V3 삭제 → `02_API_DESIGN_V5_260523.md` 정본
- `03_DOCKER_INFRA.md`, V2 삭제 → `03_DOCKER_INFRA_V3_260523.md` 정본
- `16_ARCHITECTURE_CURRENT.md` → rename to `17_ARCHITECTURE_CURRENT_V2_260523.md`
- `07_GITHUB_PROJECTS.yml` 삭제 → V2로 통합
- `sprint00_revision.md`, `sprint02_revision.md`, `sprint1_test_guide.md` 삭제

---

## 수동 검증 체크리스트 (서버 기동 후)

다음 두 엔드포인트는 통합 테스트 환경에서 수동 확인 권장.

```bash
# vuln-context 조회 (X-Internal-Key 필요)
curl -H "X-Internal-Key: $INTERNAL_API_KEY" \
  http://localhost:8080/api/v1/internal/projects/{projectId}/vuln-context

# patch-examples 조회
curl -H "X-Internal-Key: $INTERNAL_API_KEY" \
  "http://localhost:8080/api/v1/internal/patch-examples?vulnType=SQL_INJECTION&language=java"
```

---

## 다음 단계

- ✅ `refactor/docs-cleanup` 브랜치 작업 완료
- 📌 `main` merge 후 Sprint 10 (`feat/sprint10`) 착수
- Sprint 10 핵심 태스크: GitHub Integration(TASK-501~504) + Enterprise B2B 기능
