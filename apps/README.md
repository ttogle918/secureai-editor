[⬅️ Back to Home](file:///c:/Users/ttogl/workspace/secureaiengine/README.md)

# 📂 Repository Structure

| Category | Folder/File | Description | Notes |
| :--- | :--- | :--- | :--- |
| **Root** | `apps/` | Collection of active services | |
| | `packages/` | Shared logic and type definitions | |
| | `docs/` | Business plans, API specs, design docs | |
| **Frontend** | `apps/frontend/` | Next.js-based dashboard & editor UI | Includes Monaco Editor |
| **Backend** | `apps/backend/` | Spring Boot main API server | SSE streams, session mgmt |
| **AI Engine** | `apps/ai_engine/` | Python LangGraph SAST pipeline | scan → cache → sast → aggregate nodes |
| **MCP Server** | `apps/mcp_server/` | Local file & DB context provider | MCP Protocol compliant |
| **Sandbox** | `apps/sandbox/` | Isolated Docker environment for DAST | |

## 🏗️ MSA & MCP Based Architecture

This project adopts a modern architecture combining **Microservices Architecture (MSA)** and **Model Context Protocol (MCP)** to maximize scalability and flexibility.

- **MSA (Microservices Architecture)**: Functions are decoupled into independent services (Frontend, Backend, AI Engine, Sandbox). This ensures efficient development, deployment, and fault isolation across the system.
- **MCP (Model Context Protocol)**: Provides a standardized way for AI models to access various contexts such as local file systems and databases. The `mcp_server` enables the AI Engine to gain a deeper understanding of the source code and infrastructure for more accurate analysis.

## 🚀 Future Plans (Roadmap)

1.  **Enhance Detection Precision**: Improve SAST and DAST node logic to reduce false positives and perform more granular vulnerability assessments.
2.  **Auto-Remediation Workflow**: Complete the workflow where the AI proposes secure code patches and automatically applies them after verification.
3.  **Expanded MCP Tool Integration**: Develop additional MCP servers to provide broader context, such as external API data and cloud infrastructure details.
4.  **Real-time Monitoring Dashboard**: Enhance the SSE-based visualization to provide a seamless user experience for tracking analysis progress.