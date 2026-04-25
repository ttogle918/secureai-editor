# Sprint 2 미해결 항목 (Revision)

---

## TASK-201 — LangGraph 보안 감사 그래프 구축

### ⏳ 수동 검증 보류

| 항목 | 이유 | 확인 시점 |
|------|------|-----------|
| ✅ LangSmith 대시보드에 실행 트레이스 표시 | Docker Compose 환경 + `LANGCHAIN_API_KEY`, `LANGCHAIN_TRACING_V2=true` 설정 필요 | TASK-203 완료 후 Docker 통합 실행 시 |

---

## TASK-202 — MCP Filesystem Tool → SAST 노드 연동

### ⏳ 통합 테스트 보류 (Docker 환경 + 실제 Claude API 필요)

| 항목 | 이유 | 확인 시점 |
|------|------|-----------|
| 🔬 취약한 Java 파일 → SQL Injection JSON 반환 | 실제 Claude API 호출 필요 | TASK-203 완료 후 Docker 통합 실행 시 |
| 🔬 캐시 히트 시나리오 (동일 파일 재분석 시 Claude 미호출) | Redis 실동작 필요 | 동일 |
| 🔬 MCP 서버 다운 시 오류 처리 | MCP 서브프로세스 kill 시나리오 필요 | 동일 |
| ✅ UserController.java 취약 버전 분석 → CWE-89, A03 분류 확인 | 수동 검증 | 동일 |

---

## 공통 통합 테스트 확인 방법
```bash
# docker-compose 실행 후
curl -X POST http://localhost:8001/agent/analyze \
  -H "X-Internal-Key: $INTERNAL_API_KEY" \
  -d '{"session_id":"test-001","project_id":"proj-001","workspace_root":"/workspace","files":[]}'

# LangSmith 대시보드 → secureai-agent 프로젝트 → 트레이스 확인
```
