[⬅️ Back to Home](../README.md)

# 📂 Repository Structure

| Category | Folder/File | Description | Notes |
| :--- | :--- | :--- | :--- |
| **Root** | `apps/` | Collection of active services | |
| | `docs/` | Business plans, API specs, design docs | |
| **Frontend** | `apps/frontend/` | Next.js 15 dashboard & editor UI | Monaco Editor, Zustand |
| **Backend** | `apps/backend/` | Spring Boot 4 main API server | SSE streams, session mgmt, REST |
| **AI Engine** | `apps/ai_engine/` | Python LangGraph SAST/DAST pipeline | scan → api_discovery → cache → sast → validate → aggregate → patch |
| **MCP Server** | `apps/mcp_server/` | Local file & DB context provider | MCP Protocol, stdio subprocess |
| **DAST Runner** | `apps/dast_runner/` | DAST 격리 러너 이미지(dast-isolated-net) | SQLi·XSS·IDOR·SSRF·Auth Bypass executor |
| **Android** | `apps/android/` | Kotlin + Jetpack Compose 모바일 앱 | SSE 채팅·FCM 푸시·Room |
| **VSCode Ext** | `apps/vscode_ext/` | VSCode 확장(인라인 취약점 Diagnostic) | `.vsix` 빌드 |

## 🏗️ MSA & MCP Based Architecture

This project adopts a modern architecture combining **Microservices Architecture (MSA)** and **Model Context Protocol (MCP)** to maximize scalability and flexibility.

- **MSA (Microservices Architecture)**: Functions are decoupled into independent services (Frontend, Backend, AI Engine, DAST Runner). This ensures efficient development, deployment, and fault isolation across the system.
- **MCP (Model Context Protocol)**: Provides a standardized way for AI models to access various contexts such as local file systems and databases. The `mcp_server` enables the AI Engine to gain a deeper understanding of the source code and infrastructure for more accurate analysis.

## 🚀 Roadmap

**완료**: SAST 파이프라인(AST 할루시네이션 가드 포함) · DAST 익스플로잇 5종 · SAST→DAST proven_exploitable 연결 · 패치 자동 PR(PR-only) · 패치 Docker 검증 · 트리아지 피드백(독점 학습데이터) · OWASP Benchmark 평가 하니스(`make eval`) · 멀티프로바이더 BYOK · 관측성 스택(Jaeger/Prometheus/Grafana/Loki).

**진행/예정**:
1.  **IR 검증 수치화**: OWASP Benchmark 대표런(탐지율·오탐률·Youden) → 단위원가·CWE/언어 커버리지 → 실CVE 재현·도구비교(Semgrep/CodeQL).
2.  **DAST 격리 강화**: 제품 DAST executor를 `dast-isolated-net` 전용 러너로 분리해 SSRF 측면이동 차단(TASK-1227).
3.  **확장 MCP 통합**: NVD/AST/협업(Jira·Slack) 등 추가 MCP 서버로 컨텍스트 확장.
4.  **수익화·GA**: 결제(Stripe/Toss) + Hardening(E2E·a11y·시크릿 로테이션·Status Page).