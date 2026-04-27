# [2026-04-28] 작업 세션 요약

**브랜치**: `feat/task206-task207-checkpointer-and-resolve_interrupt`  
**작업 범위**: 문서 정비 (V2 docs) + MCP 파일시스템 스캔 파이프라인 완성 + E2E SAST 검증

---

## 1. 설계 문서 vs 실제 구현 비교 → V2 문서 생성

### 주요 불일치 사항 (발견)

| 항목 | 설계안 | 실제 구현 |
|------|--------|---------|
| Java 버전 | 25 (README 오기) | **21** |
| Spring Boot | 3.x | **4.0.5** |
| AI Agent 패키지명 | `ai-agent/` | `apps/ai_engine/` |
| Java `agent/` 패키지 | LangGraph4j 노드 존재 | **미구현** — Python 전담 |
| Circuit Breaker | Resilience4j | **수동 구현** (AtomicBoolean) |
| Flyway | V001~V021 적용 중 | **비활성화** — Spring Boot 4.0.5 bean 순서 이슈로 주석 처리, `ddl-auto:update` 사용 |
| MCP Server | docker-compose 서비스 | **AI Engine subprocess** (stdio) |

### 생성/수정 파일

| 파일 | 내용 |
|------|------|
| `docs/02_API_DESIGN_V2.md` | Sprint 2 추가 API (resume, progress-log, AI Engine 3종) |
| `docs/03_DOCKER_INFRA_V2.md` | 실제 Docker 구성 (Node.js, MCP 볼륨, WORKSPACE_PATH, 체크포인터) |
| `docs/06_REPOSITORY_STRUCTURE_V2.md` | Sprint 2 정오표 추가, 루트 디렉토리명 수정 |
| `README.md` | Java 21, Sprint 2 ✅ 완료, Flyway 상태 주석, V2 docs 링크 |
| `apps/README.md` | LangGraph4j → Python LangGraph 수정 |

---

## 2. MCP 파일시스템 스캔 파이프라인 완성

### 2.1 Docker 재빌드 (Node.js + MCP 볼륨)

`apps/ai_engine/Dockerfile`에 Node.js 설치 추가 및 `docker-compose.yml`에 볼륨 마운트 추가는  
이전 세션에서 코드 반영 완료, 오늘 `docker compose build ai_engine && up` 으로 최초 적용.

```
✅ Node.js v20.19.2 in container
✅ /app/mcp_server/dist/ mounted
✅ /workspace → C:/Users/ttogl/workspace/secureai-editor mounted
```

### 2.2 버그 수정 1 — MCP listDir 무한 탐색 (`apps/mcp_server/src/index.ts`)

**원인**: `listDir()` / `searchFiles()`가 `node_modules/`, `.git/`, `.next/` 등을 필터링 없이 재귀 탐색 → 수만 개 파일 처리 시도 → 컨테이너 행.

**수정**: `SKIP_DIRS` 집합 추가, 탐색 전 제외.

```typescript
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out",
  "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
  "target", ".gradle", ".idea", ".vscode",
  ".android", ".kotlin", "androidTest", "coverage", ".nyc_output",
]);
```

**결과**: `/workspace` 전체 재귀 탐색 → 642개 엔트리 (이전: 무한 행)

### 2.3 버그 수정 2 — MCP 응답 파싱 오류 (`apps/ai_engine/agent/tools/mcp_filesystem_tools.py`)

**원인**: `langchain_mcp_adapters` 툴이 `str`이 아닌 `list[dict]`를 반환.  
`str()` 변환 시 내부 `\n`이 `\\n`으로 이스케이프되어 `splitlines()`가 파일 목록을 추출 못함 → `files_to_scan = []` → 그래프 즉시 종료.

```python
# 실제 반환 형태
[{'type': 'text', 'text': 'apps/\ndocs/\n...', 'id': 'lc_xxx'}]
```

**수정**: `_extract_text()` 헬퍼 추가.

```python
def _extract_text(result) -> str:
    if isinstance(result, str):
        return result
    if isinstance(result, list):
        return "\n".join(
            item["text"] for item in result
            if isinstance(item, dict) and item.get("type") == "text"
        )
    return str(result)
```

**결과**: 200개 스캔 가능 소스 파일 탐지

### 2.4 버그 수정 3 — Claude 모델 ID (`.env`)

**원인**: `.env`의 `CLAUDE_MODEL=claude-3-haiku-20240307` (폐기된 모델) → API 404

**수정**: `CLAUDE_MODEL=claude-haiku-4-5-20251001`

> **주의**: `.env`는 gitignore 대상. 팀원 공유 시 `.env.example`도 함께 업데이트 필요.

---

## 3. E2E SAST 분석 검증

### 3.1 파이프라인 흐름 확인

```
POST /agent/analyze
  → scan_files_node  : MCP list_directory("/workspace", recursive=True) → 200 files
  → cache_check_node : SHA256 캐시 확인
  → sast_node        : MCP read_file() → Claude analyze_for_sast() → parse_sast_response()
  → aggregate_node   : 결과 집계
```

### 3.2 검증 대상 파일

`apps/backend/src/main/java/io/secureai/backend/domain/auth/controller/AuthController.java`  
(5,481 bytes, Java)

### 3.3 발견된 취약점 (3건)

| # | 타입 | 심각도 | 라인 | CWE | OWASP |
|---|------|--------|------|-----|-------|
| 1 | OPEN_REDIRECT | 🔴 HIGH | 103 | CWE-601 | A03:2021 |
| 2 | OPEN_REDIRECT | 🔴 HIGH | 99 | CWE-601 | A03:2021 |
| 3 | NULL_POINTER_DEREFERENCE | 🟡 MEDIUM | 90 | CWE-476 | A06:2021 |

**상세**

```
[1] line 103 — Origin 헤더를 검증 없이 리다이렉트 URL로 사용
    request.getHeader("Origin") → 공격자가 임의 사이트로 리다이렉트 가능

[2] line 99 — Access Token이 URL 파라미터에 노출
    /auth/callback?accessToken=xxx → 브라우저 히스토리·서버 로그·Referer에 토큰 잔존
    → 실제 취약점. 쿠키 또는 응답 바디로 전달해야 함.

[3] line 90 — state null 체크 후에도 String 연산에서 NPE 가능성
    String stateKey = OAUTH_STATE_PREFIX + state;
```

---

## 4. 현재 상태 요약

| 항목 | 상태 |
|------|------|
| MCP 파일시스템 스캔 | ✅ 동작 (642 엔트리, 200 소스 파일) |
| Claude SAST 분석 | ✅ 동작 (`claude-haiku-4-5-20251001`) |
| 결과 DB 저장 | ⚠️ 실제 backend 세션 필요 (프론트에서 분석 시작 시 자동) |
| Flyway | ⚠️ 비활성화 (Sprint 3에서 재활성화 예정) |
| `dist/`는 gitignore | `npm run build` 필수 (deploy/CI에서 별도 실행) |

---

## 5. 다음 세션에서 할 것

- [ ] 커밋 2개 push (아래 커밋 메시지 참고)
- [ ] 프론트엔드에서 실제 세션 생성 → 전체 200파일 SAST 실행
- [ ] `AuthController.java` 취약점 2건 실제 수정 (특히 URL 토큰 노출)
- [ ] Flyway 재활성화 (Spring Boot 4.0.5 bean 순서 이슈 원인 파악)
- [ ] `.env.example` CLAUDE_MODEL 업데이트
