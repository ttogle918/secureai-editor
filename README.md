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
| backend | Spring Boot 4.0, Java 21, JPA/Hibernate 7, ddl-auto:update | 8080 |
| frontend | Next.js 15, Monaco Editor, Tailwind, Zustand | 3000 |
| ai_engine | Python 3.12, FastAPI, LangGraph, Claude API | 8000 |
| mcp_server | Node.js 20, TypeScript, MCP SDK | stdio (subprocess) |
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

| Sprint | 상태 | 주요 완료 항목 |
|--------|------|--------------|
| Sprint 1 — Auth & User Foundation | ✅ 완료 | 회원가입·이메일인증·로그인·JWT·Refresh Token Rotation·GitHub OAuth(CSRF 방어)·비밀번호 재설정·프로필 API |
| Sprint 2 — Project & AI Pipeline | ✅ 완료 | 프로젝트 CRUD·팀 멤버 초대, AI Agent HTTP/SSE 브릿지, SAST 취약점 파이프라인, 진행 로그, LangGraph PostgreSQL 체크포인터, 세션 중단/재개 API |
| Sprint 3 — SAST 파이프라인 & GitHub 스캔 | ✅ 완료 | SAST 파이프라인 완성, GitHub 레포 스캔 |
| Sprint 4 — Frontend & Remediation | ✅ 완료 | Monaco 취약점 시각화, AI 채팅(SSE), `patch_node` 자동 패치 생성, i18n 번역, BYOK |
| Sprint 5 — SBOM & Secret Scan | ✅ 완료 | SBOM 파싱(CycloneDX)·CVE 매칭, 커밋 시크릿 스캔, SAST 파일 우선순위 최적화 |
| Sprint 6 — DAST Engine | ✅ 완료 | Docker 샌드박스 DAST(SQLi·XSS·IDOR·SSRF·Auth Bypass), 도메인 소유권 검증, pgvector 임베딩 |
| Sprint 7 — Reports & Multi-client | ✅ 완료 | PDF 리포트, 대시보드 집계 API, Android MVP, FCM Push + SSE 이중 전략 |
| Sprint 8 — Stabilization & Security | ✅ 완료 | OpenTelemetry 분산추적, ShedLock, Circuit Breaker, GDPR Export/Delete, 2FA TOTP, IP Allowlist, 보안 헤더(CSP·HSTS), Nginx 게이트웨이 |
| Sprint 9 — Observability & Monitoring | ✅ 완료 | Prometheus + Grafana, 지속 모니터링(SSL·헬스체크), 보안문서 자동생성(CISO·행안부·ISMS-P), VSCode 확장, Android 고도화 |
| Sprint 10+ — Reports & Production Prep | 🚧 진행 중 | 멀티 형식 리포트(HTML·Markdown), 이메일 인프라, 프로덕션 준비 |

> 스프린트별 상세 진행 상황·백로그는 [`docs/07_SPRINT_BACKLOG_V4_260523.md`](docs/07_SPRINT_BACKLOG_V4_260523.md)를 참고하세요.

> **DB 마이그레이션**: Flyway 단독 관리 — `V001`~`V047` 마이그레이션 적용, `spring.jpa.hibernate.ddl-auto: none`. (초기 Spring Boot 4.0.x bean 초기화 이슈로 잠시 `ddl-auto`를 병행했으나, 현재는 Flyway로 일원화되어 있습니다.)

---

## Development Guide

See [`docs/11_CLAUDE_CODE_GUIDE.md`](docs/11_CLAUDE_CODE_GUIDE.md) for the full development guide, sprint order, and coding rules.

Key documents:
- [`docs/00_ARCHITECTURE_DECISIONS.md`](docs/00_ARCHITECTURE_DECISIONS.md) — ADR (why we chose each technology)
- [`docs/05_ARCHITECTURE_PHILOSOPHY.md`](docs/05_ARCHITECTURE_PHILOSOPHY.md) — 아키텍처 철학
- [`docs/17_ARCHITECTURE_CURRENT_V2_260523.md`](docs/17_ARCHITECTURE_CURRENT_V2_260523.md) — 현재 아키텍처 (최신 정본)
- [`docs/01_ERD_V3_260523.md`](docs/01_ERD_V3_260523.md) — Database schema (ERD)
- [`docs/02_API_DESIGN_V5_260523.md`](docs/02_API_DESIGN_V5_260523.md) — REST API reference
- [`docs/03_DOCKER_INFRA_V3_260523.md`](docs/03_DOCKER_INFRA_V3_260523.md) — Docker 인프라 구성
- [`docs/06_REPOSITORY_STRUCTURE_V2.md`](docs/06_REPOSITORY_STRUCTURE_V2.md) — 레포지토리 구조
- [`docs/07_SPRINT_BACKLOG_V4_260523.md`](docs/07_SPRINT_BACKLOG_V4_260523.md) — Sprint backlog

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
| Backend | Spring Boot 4.0.5, Java 21, Spring Security 7, JPA/Hibernate 7 |
| Auth | JWT (JJWT 0.12), BCrypt(12), AES-256-GCM, Refresh Token Rotation |
| Database | PostgreSQL 15, Flyway V001~V047 (단독 관리, ddl-auto: none), Redis 7, pgvector |
| AI Agent | Python 3.12, FastAPI, LangGraph, Anthropic Claude API, LangSmith, psycopg3 |
| Checkpointer | LangGraph AsyncPostgresSaver — PostgreSQL 기반 세션 체크포인트 |
| MCP | Node.js 20, TypeScript, MCP SDK (@modelcontextprotocol/sdk) — stdio subprocess |
| Frontend | Next.js 15, TypeScript, Tailwind CSS, Monaco Editor, Zustand |
| Infra | Docker, Docker Compose, GitHub Actions CI |
