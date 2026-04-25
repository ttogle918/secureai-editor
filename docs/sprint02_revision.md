# Sprint 2 미해결 항목 (Revision)

---

## TASK-201 — LangGraph 보안 감사 그래프 구축

### ⏳ 수동 검증 보류

| 항목 | 이유 | 확인 시점 |
|------|------|-----------|
| ✅ LangSmith 대시보드에 실행 트레이스 표시 | Docker Compose 환경 + `LANGCHAIN_API_KEY`, `LANGCHAIN_TRACING_V2=true` 설정 필요 | TASK-203 완료 후 Docker 통합 실행 시 |

### 확인 방법
```bash
# docker-compose 실행 후
curl -X POST http://localhost:8001/agent/analyze \
  -H "X-Internal-Key: $INTERNAL_API_KEY" \
  -d '{"session_id":"test-001","project_id":"proj-001","workspace_root":"/workspace","files":[]}'

# LangSmith 대시보드 → secureai-agent 프로젝트 → 트레이스 확인
```
