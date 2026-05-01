# 🛠️ Git Collaboration Guidelines

To maintain a clean and professional project history, we follow the **Conventional Commits** standard and a structured branching strategy.

---

## 📝 Commit Message Convention

We use the format: `<type>(<scope>): <description>`

### 1. Commit Types

| Type | Purpose | Example |
| :--- | :--- | :--- |
| **`feat`** | A new feature | `feat(TASK-201): add LangGraph graph skeleton` |
| **`fix`** | A bug fix | `fix(TASK-203): resolve SSE timeout issue` |
| **`test`** | Adding or updating tests only | `test(TASK-201): add agent state dry-run tests` |
| **`docs`** | Documentation only changes | `docs: update sprint2 revision notes` |
| **`style`** | Formatting, no logic change | `style(TASK-201): reformat graph_builder` |
| **`refactor`** | Code change with no feature or fix | `refactor(TASK-202): extract mcp client` |
| **`chore`** | Maintenance, build configs, dependencies | `chore: add pytest-asyncio to requirements` |

### 2. Scope Convention

- **TASK 작업**: scope는 `TASK-NNN` 형식 사용 (e.g., `feat(TASK-201): ...`)
- **TASK 무관 변경**: 대상 서비스명 사용 (e.g., `docs`, `chore`, `fix(backend)`)

### 3. Best Practices

- Use the **imperative mood** ("add" instead of "added").
- Keep the first line under **50 characters**.
- Use the body for a more detailed explanation if necessary.

### 4. Commit Body & Footer

상세 내용은 본문에, 미확인 항목은 `Pending:` 한 줄로 표기한다.

```
feat(TASK-201): add LangGraph security audit graph

- AgentState TypedDict (session/file/cache/result fields)
- 5 nodes + 3 conditional edges
- get_graph() singleton, checkpointer hook ready for TASK-206

Pending: LangSmith trace verification (manual, requires Docker)
```

> `Pending:` 항목은 `docs/sprint0N_revision.md`에도 동일하게 기록한다.

---

## 🌿 Branching Strategy

| Branch | Purpose |
| :--- | :--- |
| **`main`** | Production-ready code (stable). |
| **`feat/sprintN`** | Sprint 통합 브랜치. Sprint 완료 후 `main`으로 PR. |
| **`feat/sprintN/taskNNN-<name>`** | 개별 TASK 개발 브랜치. 완료 후 `feat/sprintN`으로 PR. |
| **`fix/*`** | Bug fix branches (e.g., `fix/sse-timeout`). |

### Workflow

```
main
└── feat/sprint2                        ← Sprint 완료 후 main으로 PR
    ├── feat/sprint2/task201-langgraph  ← TASK 완료 후 feat/sprint2로 PR
    ├── feat/sprint2/task202-mcp-sast
    ├── feat/sprint2/task203-sse-bridge
    └── ...
```

### Step-by-Step

```bash
# 1. Sprint 통합 브랜치 생성 (Sprint 시작 시 1회)
git checkout main && git pull
git checkout -b feat/sprint2

# 2. TASK 브랜치 생성
git checkout -b feat/sprint2/task201-langgraph

# 3. 작업 후 커밋
git commit -m "feat(TASK-201): add LangGraph security audit graph"

# 4. feat/sprint2 로 PR → Squash merge
# 5. 다음 TASK는 feat/sprint2 기준으로 분기
git checkout feat/sprint2 && git pull
git checkout -b feat/sprint2/task202-mcp-sast
```

### Rollback 단위

| 범위 | 방법 |
| :--- | :--- |
| 단일 TASK | `feat/sprintN/taskNNN` 브랜치 PR을 닫거나 `git revert` |
| Sprint 전체 | `feat/sprintN` 브랜치를 `main`에 머지하지 않으면 됨 |

---

*Consistent history makes debugging and collaboration much easier!*
