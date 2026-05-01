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
| — | — | — | — |

## 이월 태스크
| TASK | 이유 |
|------|------|
| — | — |

---

<!-- 각 TASK 완료 후 /done 스킬이 아래 섹션을 자동 추가합니다 -->
