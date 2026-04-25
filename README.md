# SecureAI Engine

**Next-Generation AI Security Auditor — SAST · DAST · Auto-Remediation**

Combines static analysis, dynamic testing, and AI-powered patch generation into a single autonomous pipeline using Microservices Architecture and Model Context Protocol (MCP).

---

## Architecture

```
┌─────────────┐   REST/SSE   ┌──────────────────┐   Internal   ┌──────────────────┐
│  Next.js 15  │ ──────────► │  Spring Boot 4   │ ──────────► │  Python AI Agent │
│  (Frontend)  │             │  (Backend)        │             │  FastAPI/LangGraph│
└─────────────┘             └──────────────────┘             └──────────────────┘
                                      │                                  │
                              ┌───────┴───────┐                 ┌───────┴──────┐
                              │  PostgreSQL 15 │                 │  MCP Server  │
                              │  Redis 7       │                 │  (Node.js)   │
                              └───────────────┘                 └──────────────┘
```

| Service | Stack | Port |
|---------|-------|------|
| backend | Spring Boot 4.0, Java 25, JPA/Hibernate 7, ddl-auto:update | 8080 |
| frontend | Next.js 15, Monaco Editor, Tailwind, Zustand | 3000 |
| ai_engine | Python 3.12, FastAPI, LangGraph, Claude API | 8000 |
| mcp_server | Node.js 20, TypeScript, MCP SDK | stdio |
| postgres | PostgreSQL 15 | 5432 |
| redis | Redis 7 | 6379 |

---

## Quick Start

### Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- `make` (comes with most Unix-like environments; Windows: Git Bash or WSL)

### 1. Clone & configure

```bash
git clone <repo-url>
cd secureai-editor
cp .env.example .env
```

Edit `.env` and fill in:
- `DB_PASSWORD` — any secure password
- `REDIS_PASSWORD` — any secure password
- `JWT_SECRET` — 64+ character random string
- `SECUREAI_ENCRYPTION_KEY` — exactly 32 bytes (base64-encoded)
- `CLAUDE_API_KEY` — from console.anthropic.com
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from GitHub OAuth App settings
- `MAIL_*` — SMTP credentials (can be left blank to skip email features)

### 2. Start infrastructure only (fastest for backend development)

```bash
make infra        # starts postgres:5432 + redis:6379
make backend      # runs Spring Boot locally via ./gradlew bootRun
```

Verify: `curl http://localhost:8080/actuator/health`

### 3. Start all services via Docker

```bash
make dev
```

| URL | Service |
|-----|---------|
| http://localhost:3000 | Frontend |
| http://localhost:8080/actuator/health | Backend health |
| http://localhost:8080/swagger-ui/index.html | Swagger UI (REST API docs) |
| http://localhost:8000/health | AI Agent health |

### 4. Other useful commands

```bash
make down          # stop all containers
make clean         # stop + delete volumes (resets database)
make logs          # stream all logs
make logs-backend  # stream backend logs only
make rebuild       # rebuild & restart backend image
make db            # open psql inside postgres container
make redis-cli     # open redis-cli inside redis container
```

---

## Sprint Status

| Sprint | 기간 | 상태 | 주요 완료 항목 |
|--------|------|------|--------------|
| Sprint 1 — Auth & User Foundation | 2026-04-19 ~ 2026-04-25 | ✅ 완료 | 회원가입·이메일인증·로그인·JWT·Refresh Token Rotation·GitHub OAuth(CSRF 방어)·비밀번호 재설정·프로필 API |
| Sprint 2 — Project & Repository Management | 예정 | 🔜 대기 | 프로젝트 CRUD, GitHub Repo 연동, 팀 멤버 초대 |
| Sprint 3 — SAST AI Pipeline | 예정 | 🔜 대기 | LangGraph 에이전트, Claude API 연동, 취약점 탐지 |
| Sprint 4 — DAST & Remediation | 예정 | 🔜 대기 | Docker 샌드박스 DAST, 자동 패치 생성 |

> **현재 인프라 상태**: DB 마이그레이션 도구로 Flyway 대신 `spring.jpa.hibernate.ddl-auto=update` 사용 중 (Sprint 1 범위).  
> Sprint 2 착수 전 Flyway로 전환 예정 (`docs/00_ARCHITECTURE_DECISIONS.md` ADR-011 참조).

---

## Development Guide

See [`docs/11_CLAUDE_CODE_GUIDE.md`](docs/11_CLAUDE_CODE_GUIDE.md) for the full development guide, sprint order, and coding rules.

Key documents:
- [`docs/00_ARCHITECTURE_DECISIONS.md`](docs/00_ARCHITECTURE_DECISIONS.md) — ADR (why we chose each technology)
- [`docs/01_ERD.md`](docs/01_ERD.md) — Database schema (18 tables)
- [`docs/02_API_DESIGN.md`](docs/02_API_DESIGN.md) — REST API reference (50+ endpoints)
- [`docs/07_SPRINT_BACKLOG_V2.md`](docs/07_SPRINT_BACKLOG_V2.md) — Sprint backlog

---

## Security

- GitHub tokens are encrypted at rest (AES-256-GCM) in the database
- Refresh tokens are stored as SHA-256 hashes; reuse triggers full session revocation
- Rate limiting per user via Redis
- DAST sandbox is network-isolated (`dast-isolated-net`, internal only)
- Never commit `.env`, `*.keystore`, or any credential files

To report a security vulnerability, use the [security vulnerability template](.github/ISSUE_TEMPLATE/security_vulnerability.md) (private disclosure).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Spring Boot 4.0, Java 25, Spring Security 7, JPA/Hibernate 6 |
| Auth | JWT (JJWT 0.12), BCrypt(12), AES-256-GCM, Refresh Token Rotation |
| Database | PostgreSQL 15, Flyway migrations, Redis 7 |
| AI Agent | Python 3.12, FastAPI, LangGraph, Anthropic Claude API, LangSmith |
| MCP | Node.js 20, TypeScript, MCP SDK (@modelcontextprotocol/sdk) |
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Monaco Editor, Zustand |
| Infra | Docker, Docker Compose, GitHub Actions CI |
