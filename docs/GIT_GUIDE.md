# 🛠️ Git Collaboration Guidelines

To maintain a clean and professional project history, we follow the **Conventional Commits** standard and a structured branching strategy.

---

## 📝 Commit Message Convention

We use the format: `<type>(<scope>): <description>`

### 1. Commit Types
- **`feat`**: A new feature (e.g., `feat(frontend): add Monaco editor`)
- **`fix`**: A bug fix (e.g., `fix(backend): resolve SSE timeout issue`)
- **`docs`**: Documentation only changes (e.g., `docs: update API overview`)
- **`style`**: Changes that do not affect code logic (e.g., formatting, semi-colons)
- **`refactor`**: Code change that neither fixes a bug nor adds a feature
- **`chore`**: Maintenance tasks, build configs, dependencies (e.g., `chore: update .gitignore`)

### 2. Best Practices
- Use the **imperative mood** ("add" instead of "added").
- Keep the first line under **50 characters**.
- Use the body for a more detailed explanation if necessary.

---

## 🌿 Branching Strategy

| Branch | Purpose |
| :--- | :--- |
| **`main`** | Production-ready code (stable). |
| **`develop`** | Integration branch for features (unstable). |
| **`feat/*`** | Feature development (e.g., `feat/auth-login`). |
| **`fix/*`** | Bug fix branches (e.g., `fix/ui-layout`). |

### Workflow Examples
1. Create a branch: `git checkout -b feat/frontend-setup`
2. Commit changes: `git commit -m "feat(frontend): initial project setup"`
3. Merge to develop/main via Pull Request.

---

*Consistent history makes debugging and collaboration much easier!*
