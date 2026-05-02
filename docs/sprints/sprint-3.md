# Sprint 3 — SAST 파이프라인 완성 & GitHub 레포 스캔
**기간**: 2026-05-19 ~ 2026-06-01 (Week 07–08)  
**목표**: 전체 프로젝트 파일 배치 SAST + GitHub API 기반 스캔 + 패치 에이전트 + CVE 기초 DB

---

## 실행 계획

### 현황 파악

**Sprint 2 이월 확인**
- `sprint-2.md`에 완료 기록 없음 (템플릿만 존재)
- 구현 파일은 존재: `security_audit_graph.py`, `checkpointer.py`, `SseEmitterService.java` 등 Sprint 2 코드는 구현됨
- **결론**: Sprint 2 코드는 구현되었으나 `/done` 처리 미수행 → Sprint 3 진행에 영향 없음

**Sprint 3 착수 전 갭 분석**
| 파일 | 상태 |
|------|------|
| `code_chunker.py` | ❌ 미구현 |
| `VulnerabilityQueryService.java` (CQRS Read) | ❌ 미구현 |
| `vuln_classifier.py` | ❌ 미구현 |
| MCP GitHub tools (`.ts`) | ❌ 미구현 |
| `GitHubRestClient.java` | ❌ 미구현 |
| `patch_node.py`, `diff_generator.py` | ❌ 미구현 |
| `PatchSuggestion.java` + Flyway V011 | ❌ 미구현 |
| `CveData.java` + Flyway V007~V014 | ❌ 미구현 (V006까지 존재) |
| SBOM 파서 4종 | ❌ 미구현 |

### 실행 순서

| 순서 | TASK | 제목 | 선행 | 에이전트 | 복잡도 |
|------|------|------|------|---------|--------|
| 1 | TASK-301 | 파일 배치 SAST — 전체 프로젝트 스캔 | — | Dev+Tester | 높음 |
| 1 | TASK-303 (MCP부분) | GitHub MCP Tools — `get_repo_contents`, `list_directory` | — | Dev | 중간 |
| 2 | TASK-302 | CWE/OWASP 분류 자동 매핑 & callChain | TASK-301 | Dev+Tester | 중간 |
| 2 | TASK-303 (백엔드·에이전트) | GitHub API 연동 전체 + rate limit | TASK-301 | Dev+Tester | 높음 |
| 3 | TASK-304 | 패치 에이전트 구현 | TASK-302 | Dev+Tester | 높음 |
| 3 | TASK-305 | CVE DB & SBOM 파서 인터페이스 | Flyway V007~V010 정비 후 | Dev+Tester | 높음 |

### 병렬 실행 그룹

```
1단계 (동시 시작)
├── TASK-301: code_chunker.py · VulnerabilityQueryService · 진행률 SSE
└── TASK-303 MCP: get_repo_contents.ts · list_directory.ts (mcp_server 독립)

         ↓ TASK-301 완료 후

2단계 (동시 진행)
├── TASK-302: vuln_classifier.py · CWE/OWASP 매핑 · callChain JSON
└── TASK-303 나머지: GitHubRestClient.java · GitHubApiService.java · source_type=github 분기

         ↓ TASK-302 완료 후

3단계 (동시 진행)
├── TASK-304: patch_node.py · PatchSuggestion.java · Flyway V011
└── TASK-305: CveData.java · NvdApiClient.java · SBOM 파서 · Flyway V012~V014
```

### 리스크

| 항목 | 리스크 | 대응 |
|------|--------|------|
| Flyway 갭 (V007~V010) | Sprint 2 엔티티가 ddl-auto=update 상태 — Sprint 3 전 정비 필요 | TASK-301 착수 전 V007~V010 작성 |
| GitHub Rate Limit | 429 응답 시 backoff 미구현 → 대규모 레포 스캔 실패 | TASK-303에 필수 구현 항목으로 포함 |
| code_chunker 경계 절단 | 2000 라인 파일 분할 시 취약점 컨텍스트 손실 가능 | 오버랩 청크(overlap=50 lines) 전략 검토 |
| Flyway 순서 충돌 | TASK-304(V011) → TASK-305(V012~V014) 순서 의존성 | TASK-304 번호 확정 후 TASK-305 착수 |

### 테스트 마일스톤

| 마일스톤 | 기준 | TASK |
|---------|------|------|
| M1: 배치 스캔 | 10개 파일 전체 분석 성공, 캐시 HIT/MISS 정확 | TASK-301 |
| M2: 분류 완성 | SQL Injection → CWE-89 / OWASP A03 자동 매핑 | TASK-302 |
| M3: GitHub 스캔 ⭐ | 공개 + 비공개 레포 SAST 전체 플로우 성공 | TASK-303 |
| M4: 패치 생성 | PreparedStatement 패치 생성 + 캐시 HIT | TASK-304 |
| M5: CVE 동기화 | NVD 10,000건 이상 + SBOM 50+ 컴포넌트 추출 | TASK-305 |

---

<!-- 태스크 완료 시 /done TASK-XXX 스킬로 아래 형식의 섹션이 추가됩니다 -->

## 완료 태스크
| TASK | 제목 | 완료일 | 테스트 결과 |
|------|------|--------|------------|
| TASK-301 | 파일 배치 SAST — code_chunker + VulnerabilityQueryService | 2026-05-02 | pytest 76/76 pass (code_chunker 13, agent 전체) |
| TASK-302 | CWE/OWASP 분류 — vuln_classifier.py + callChain | 2026-05-02 | pytest 27/27 pass |
| TASK-303 MCP | GitHub MCP Tools — get_repo_contents.ts + list_directory.ts | 2026-05-02 | Jest 33/33 pass |
| TASK-303 Backend | GitHub API 연동 — GitHubRestClient + GitHubApiService + source_type 분기 | 2026-05-02 | Gradle 15/15 pass |

## 이월 태스크
| TASK | 이유 |
|------|------|
| — | — |

---

<!-- 각 TASK 완료 후 /done 스킬이 아래 섹션을 자동 추가합니다 -->

---

## TASK-301: 파일 배치 SAST — 전체 프로젝트 스캔
**완료일**: 2026-05-02  
**Epic**: EPIC-3 | **Sprint**: 3

### 구현 내용
- `code_chunker.py` — 300라인 기준 슬라이딩 윈도우 분할 (max_lines=250, overlap=25). 단일 청크면 직접 호출, 복수 청크면 `asyncio.gather` 병렬 호출 후 `_dedup_vulns`로 (line, type) 기준 중복 제거
- `sast_node.py` — `_analyze_chunks()` 추가로 대용량 파일 병렬 처리. `progress_percent = (idx+1)/total_files*100` SSE 이벤트 발행
- `VulnerabilityQueryService.java` — `@Transactional(readOnly=true)` CQRS Read 전용 서비스. `countBySeverity`, `countByFilePath` 집계 쿼리 제공

### 설계 결정
- **청크 오버랩 25라인**: 경계에서 취약점 컨텍스트 손실 방지. 청크 단위가 아닌 (line, type) 기준 중복 제거로 정확도 유지
- **순차 루프 내 병렬 청크**: LangGraph 체크포인트 호환성 유지를 위해 파일 순회는 순차 유지. 파일 내부 청크만 병렬 처리
- **CQRS 분리**: `VulnerabilityService`(쓰기)와 `VulnerabilityQueryService`(읽기) 분리로 `@Transactional(readOnly=true)` 최적화 적용

### 적용된 CS 원칙
- **SRP**: sast_node는 분석 책임만, code_chunker는 분할 책임만 담당
- **OCP**: 새 파일 유형 추가 시 `_analyze_chunks` 수정 없이 확장 가능
- **DIP**: `analyze_for_sast` 인터페이스에 의존, Claude 클라이언트 구체 구현 직접 참조 없음

### 테스트 결과
- 🧪 단위 테스트: 13개 통과 (code_chunker 전체 경계 케이스)
- 🔬 통합 테스트: 실환경 pending (Claude API + Redis 필요)
- ✅ 수동 검증: pending (100·500·2000 라인 파일 실분석)

### 참고
- `apps/ai_engine/agent/nodes/code_chunker.py` (신규)
- `apps/ai_engine/tests/agent/test_code_chunker.py` (신규, 13개)
- `apps/backend/…/VulnerabilityQueryService.java` (신규)

---

## TASK-302: CWE/OWASP 분류 자동 매핑 & callChain 구성
**완료일**: 2026-05-02  
**Epic**: EPIC-3 | **Sprint**: 3

### 구현 내용
- `vuln_classifier.py` — `_CWE_OWASP_MAP` 딕셔너리로 23개 취약점 타입 → (CWE, OWASP Top 10 2021) 자동 매핑
- `normalize_vuln(vuln)` — type 대소문자 정규화 후 기존 cwe/owasp 값 우선, 없으면 매핑 테이블에서 보완. 원본 dict 불변(`{**vuln, ...}`)
- `build_call_chain(vuln, file_path)` — 파일 경로 키워드(`controller`, `service`, `repository`, `mapper`, `component` 등) 기반 계층 감지 → 감지 계층부터 Repository까지 체인 구성
- `classify_and_enrich(vulns, file_path)` — 두 함수를 취약점 목록에 일괄 적용
- `sast_node.py` — `_analyze_chunks` 결과에 `classify_and_enrich` 적용 추가
- `backend_api_client.py` — `callChain` 키 우선, `call_chain` 하위 호환 유지

### 설계 결정
- **매핑 테이블 기반 Strategy**: `_CWE_OWASP_MAP`에 항목만 추가하면 새 취약점 타입 지원. 기존 코드 수정 없음 (OCP)
- **`_to_pascal_case` 단일 단어 예외 처리**: `capitalize()`가 PascalCase를 소문자화하는 버그 수정. 구분자 없으면 첫 글자만 대문자 보장
- **callChain 추론값 철학**: 정확도보다 일관된 형식 우선. 빈 리스트보다 추론된 체인이 항상 더 유용

### 적용된 CS 원칙
- **SRP**: `vuln_classifier.py`는 분류/정규화만, 저장은 `backend_api_client.py`
- **OCP**: 매핑 테이블에 항목 추가만으로 확장, 기존 로직 불변
- **순수 함수 패턴**: 외부 I/O 없음, 모든 함수가 입력 → 출력 변환만 수행 (`code_chunker.py`와 동일 패턴)

### 테스트 결과
- 🧪 단위 테스트: 27개 통과 (CWE/OWASP 매핑 14개, callChain 8개, classify_and_enrich 5개)
- 🔬 통합 테스트: 1개 pending (callChain JSONB GIN 인덱스 검색)
- ✅ 수동 검증: 없음

### 참고
- `apps/ai_engine/agent/nodes/vuln_classifier.py` (신규)
- `apps/ai_engine/tests/agent/test_vuln_classifier.py` (신규, 27개)
- 버그 수정: `_to_pascal_case` — `capitalize()` PascalCase 소문자화 문제

---

## TASK-303: GitHub 레포지토리 API 기반 코드 스캔
**완료일**: 2026-05-02  
**Epic**: EPIC-3 | **Sprint**: 3

### 구현 내용
**MCP 서버 (Node.js/TypeScript)**
- `github_client.ts` — `getContents(owner, repo, path, ref?, token?)`. 429/x-ratelimit-remaining=0 감지 후 지수 백오프 (1s→2s→4s, MAX_RETRY=3). 경로 순회 방지, 10MB·바이너리 확장자 필터
- `get_repo_contents.ts` — `handleGetFileContent` MCP 툴. base64 디코딩(개행 제거 후 처리)
- `list_directory.ts` — `handleListDirectory` MCP 툴. `recursive=true` 시 MAX_DEPTH=3 제한, 서브 디렉토리 오류는 silent skip

**백엔드 (Spring Boot)**
- `GitHubRestClient.java` — GitHub REST API HTTP 클라이언트 (단일 책임: 접근 검증만)
- `GitHubApiService.java` — URL 파싱 + 토큰 복호화(JPA `@Convert` 자동) + 접근 검증 조합
- `StartAnalysisRequest.java` — `sourceType`, `githubRepoUrl`, `githubRef` 필드 추가
- `AnalysisService.java` — `source_type` 분기로 local/github 경로 분리

**AI 엔진 (Python)**
- `mcp_github_tools.py` — `list_github_files`, `get_github_file_content` MCP 툴 래퍼. `SCANNABLE_EXTENSIONS` frozenset으로 소스 파일만 필터
- `scan_files_node.py` — `source_type` 분기 (github/local)
- `sast_node.py` — `source_type=github` 시 `get_github_file_content`로 파일 읽기
- `AgentState` — `source_type`, `github_owner/repo/ref/token` 필드 추가

### 설계 결정
- **SRP로 GitHubRestClient/GitHubApiService 분리**: HTTP 호출(RestClient)과 비즈니스 로직(토큰 복호화, URL 파싱)을 별도 클래스로 분리. 단독 테스트 가능
- **토큰은 로그 출력 전면 금지**: 백엔드·AI 엔진·MCP 서버 모든 계층에서 `github_token` 변수명 로그 제외 명시
- **편의 오버로드(하위 호환)**: `startAnalysis(session, project, workspaceRoot)` 유지로 기존 로컬 분석 경로 수정 없음

### 적용된 CS 원칙
- **SRP**: GitHubRestClient(HTTP 검증), GitHubApiService(비즈니스 조합), scan_files_node(파일 목록), sast_node(분석) 각자 단일 책임
- **OCP**: `source_type` 분기를 scan_files_node에 집중. 새 source_type 추가 시 노드 내부만 수정
- **보안**: 사용자 입력(GitHub URL)은 Controller/Service 경계에서만 검증, 토큰 로그 금지 준수

### 테스트 결과
- 🧪 단위 테스트: Jest 33개, Gradle 15개, pytest 17개 — 전체 65개 통과
- 🔬 통합 테스트: 5개 pending (실제 GitHub API 연동, 전체 SAST 플로우)
- ✅ 수동 검증: 1개 pending (GitHub URL → 분석 → 취약점 표시)
- 🛡️ 보안: 토큰 로그 미노출, 경로 순회 방어, 10MB·바이너리 필터 구현

### 참고
- 버그 수정: `AiAgentClientTest` TC-4/TC-5 — 제네릭 `body(T)` Mockito 스텁에 `any()` → `any(Object.class)` 필요
- `apps/mcp_server/src/github/` (3개 파일 신규)
- `apps/backend/…/GitHubRestClient.java`, `GitHubApiService.java` (신규)
