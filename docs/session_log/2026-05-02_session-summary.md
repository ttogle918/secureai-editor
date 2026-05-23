# [2026-05-02] 작업 세션 요약

**브랜치**: `feat/sprint3`  
**작업 범위**: Sprint 3 Stage 3 — TASK-304, TASK-305 + .claude/ 토큰 최적화

---

## 1. 완료 태스크

| TASK | 제목 | 테스트 | 주요 파일 |
|------|------|--------|---------|
| TASK-304 | 패치 에이전트 구현 | 🧪17/17 | diff_generator.py, patch_node.py, PatchSuggestion.java, V011 |
| TASK-305 | CVE DB & SBOM 파서 | 🧪13/13 | NvdApiClient.java, 4종 파서, V009/V010/V012 |

---

## 2. 핵심 구현 사항

### TASK-304 — 패치 에이전트
- `diff_generator.py` — `PatchResult` 데이터클래스, `generate_unified_diff`(difflib), `parse_patch_response`. 순수 함수 모듈 (I/O 없음)
- `patch_node.py` — LangGraph 노드. Redis 캐시 키 `secureai:patch:{vuln_type}:{ext}` TTL 24h. 개별 오류 skip 패턴
- `patch_generation.jinja2` — Jinja2 프롬프트 템플릿
- `V011__create_patch_suggestions.sql` — patch_suggestions 테이블 (vuln_id FK, is_applied, applied_at, applied_by)
- `PatchService.java` / `PatchController.java` — 저장·적용 처리
- `AiAgentClient` 인터페이스 분리 (ISP) → `DefaultAiAgentClient` 구현체 분리

### TASK-305 — CVE DB & SBOM 파서
- `NvdApiClient.java` — NVD API 2.0, 429 backoff 30s/60s, 페이지 순회
- `NvdSyncJob.java` — `@Scheduled(cron="0 0 3 * * *")` 일별 동기화
- SBOM 파서 Strategy+Factory 패턴: MavenPomParser (XXE 방어), NpmPackageParser, PipRequirementsParser, CargoTomlParser
- `V009/V010/V012.sql` — cve_data, dependency_components, cve_component_mapping 테이블

### Flyway 마이그레이션 정비
- Sprint 2 갭 보완: `V007__create_vulnerabilities.sql`, `V008__create_analysis_progress_log.sql`
- 전체 순서: V001→V012 갭 없이 정렬 완료 (ddl-auto: none 환경 대응)

---

## 3. 버그 수정 / 특이사항

| 버그 | 원인 | 해결 |
|------|------|------|
| `AiAgentClientTest` 컴파일 오류 | `AiAgentClient`가 인터페이스로 리팩토링되어 `new AiAgentClient()` 불가 | 테스트 필드 타입을 `DefaultAiAgentClient`로 변경 |
| pytest 114개 중 collect error | `fastapi` 로컬 미설치로 `test_analyze_route.py` import 실패 | 기존 환경 이슈. `tests/agent/`, `tests/infrastructure/` 110개 정상 통과 확인 |

---

## 4. .claude/ 토큰 최적화

| 파일 | 변경 | 절감 |
|------|------|------|
| `CLAUDE.md` | `@docs/00_ARCHITECTURE_DECISIONS.md` `@` 제거 | **매 대화 ~300줄 절감** |
| `CLAUDE.md` | 스프린트 번호 Sprint 2 → Sprint 3 수정 | 오정보 제거 |
| `docs/11_CLAUDE_CODE_GUIDE.md` | 453줄 → 55줄 (섹션 3-10, 부록 제거) | `@` 로드 시 ~400줄 절감 |
| `.claude/skills/done.md` | Step 3.5·Step 5에 브랜치·git add·커밋 명령어 추가 | 기능 추가 |
| `.claude/skills/done.md` | Step 6 세션 로그 기록 단계 추가 | 기능 추가 |
| `.claude/agents/dev.md` | 패키지 경로 `com.secureai` → `io.secureai.backend.domain` 수정 | 오류 수정 |
| `.claude/skills/sprint.md` | Sprint 2 stale 지침 제거 | 소폭 절감 |

---

## 5. 다음 세션에서 할 것

- [ ] TASK-304/305 파일 `git add` 후 커밋 (커밋 메시지는 sprint-3.md 내 각 태스크 섹션 참고)
- [ ] `make backend` 또는 `./gradlew bootRun` 실행 → Flyway V001-V012 무결 적용 확인 (Docker 필요)
- [ ] Sprint 3 완료 기준 점검: 통합 테스트 pending 항목 실환경 실행
- [ ] Sprint 4 시작 (`/sprint 4`)
