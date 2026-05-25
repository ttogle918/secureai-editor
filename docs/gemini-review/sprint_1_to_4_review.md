# SecureAI Sprint 1~4 리뷰 및 기능 요약

이 문서는 Sprint 1에서 Sprint 4까지 구현된 주요 기능들의 구현 위치(Backend, AI Engine 등)를 요약하고, 관련 테스트 스크립트의 존재 여부 및 시나리오 플로우를 Mermaid 다이어그램으로 제공합니다.

## 1. 기능 구현 요약

### 1) AI 에이전트 & SAST 파이프라인 (Sprint 2, 3)
*   **코드 청킹 및 분석 병렬화**
    *   **AI Engine**: `apps/ai_engine/agent/nodes/code_chunker.py` - `_analyze_chunks()`, `_dedup_vulns()`
*   **취약점 분류 및 CWE/OWASP 자동 매핑**
    *   **AI Engine**: `apps/ai_engine/agent/nodes/vuln_classifier.py` - `normalize_vuln()`, `classify_and_enrich()`
    *   **AI Engine**: `apps/ai_engine/agent/nodes/vuln_classifier.py` - `build_call_chain()`
*   **파일 배치 기반 SAST 스캔**
    *   **AI Engine**: `apps/ai_engine/agent/nodes/sast_node.py`
    *   **Backend**: `apps/backend/.../VulnerabilityQueryService.java` - `countBySeverity()`, `countByFilePath()`

### 2) GitHub 연동 (Sprint 3)
*   **GitHub 레포지토리 API 기반 코드 스캔**
    *   **Backend**: `apps/backend/.../GitHubRestClient.java`, `GitHubApiService.java`
    *   **MCP Server**: `apps/mcp_server/src/github/github_client.ts` - `getContents()`
    *   **MCP Server**: `apps/mcp_server/src/github/list_directory.ts` - `handleListDirectory()`
    *   **AI Engine**: `apps/ai_engine/agent/nodes/scan_files_node.py`

### 3) 패치 생성 및 SBOM (Sprint 3)
*   **자동 패치 코드 생성**
    *   **AI Engine**: `apps/ai_engine/agent/nodes/diff_generator.py` - `generate_unified_diff()`, `parse_patch_response()`
    *   **AI Engine**: `apps/ai_engine/agent/nodes/patch_node.py`
    *   **Backend**: `apps/backend/.../patch/PatchService.java` - `savePatchResults()`, `applyPatch()`
*   **CVE DB 및 SBOM 파싱**
    *   **Backend**: `apps/backend/.../cve/NvdApiClient.java`, `NvdSyncJob.java`
    *   **Backend**: `apps/backend/.../sbom/MavenPomParser.java` (및 Npm/Pip/Cargo 등 파서) - `parse()`

### 4) 프론트엔드 UI 및 SSE 실시간 스트리밍 (Sprint 4)
*   **SSE 실시간 진행률 및 취약점 스트리밍**
    *   **Backend**: `apps/backend/.../SseEmitterService.java`
    *   **Frontend**: `useSse.ts` - `fetch` + `ReadableStream`
*   **진행률 체크리스트 및 Markdown 다운로드**
    *   **Backend**: `apps/backend/.../ProgressLogService.java` - `getSummary()`
    *   **Frontend**: `ProgressPanel.tsx`, `useSecureStore.ts`
*   **취약점 필터 및 상세 패널**
    *   **Frontend**: `useVulnFilter.ts`, `FilterBar.tsx`, `VulnDetailPanel.tsx`
*   **AI 채팅 API**
    *   **AI Engine**: `apps/ai_engine/api/routes/chat.py`, `chat_client.py` - `stream()`
    *   **Backend**: `apps/backend/.../ChatService.java`, `ChatController.java`
    *   **Frontend**: `useChat.ts`, `ChatPanel.tsx`

---

## 2. 테스트 스크립트 구성 및 시나리오 검증

구현된 기능에 대응하는 테스트 스크립트는 각 모듈의 기능과 시나리오를 반영하여 구성되어 있습니다.

### AI Engine (`apps/ai_engine/tests/`)
*   **단위 테스트**
    *   `test_code_chunker.py` (13개): 큰 파일의 슬라이딩 윈도우 분할 및 경계 처리 시나리오
    *   `test_vuln_classifier.py` (27개): CWE/OWASP 자동 매핑, CallChain 추출 정규화 시나리오
    *   `test_diff_generator.py` (12개): 패치 생성 시 원본과 수정본의 unified diff 처리 시나리오
    *   `test_chat_route.py` (3개): AI 채팅의 다중 턴 유지 및 스트리밍 시나리오
*   **통합 테스트** (`tests/integration/`)
    *   `test_sprint3_integration.py` (7개): Redis 캐시 히트/미스 및 Claude API 연동 전체 파이프라인
    *   `test_backend_sprint3.py` (9개): DB 스키마 구조와 JSONB/GIN 인덱스 테스트

### Backend (`apps/backend/src/test/java/io/secureai/backend/`)
*   **단위/통합 테스트**
    *   `VulnerabilityQueryServiceTest.java`: CQRS 기반의 읽기 전용 쿼리 로직 시나리오
    *   `GitHubRestClientTest.java` / `GitHubApiServiceTest.java`: Rate Limit 처리 및 토큰 복호화 시나리오 (에러 및 재시도 검증)
    *   `PatchServiceTest.java` (5개): 생성된 패치의 상태(is_applied) 변경 및 이력 검증
    *   `SbomParserTest.java` (`MavenPomParserTest` 등): XXE 공격 방어가 적용된 DOM 파싱 및 의존성 추출 시나리오
    *   `ProgressLogServiceTest.java` (5개): 진행률 집계 로직
    *   `SseEmitterServiceTest.java` (6개): 이벤트 스트림 연결 타임아웃 및 에러 핸들링

---

## 3. 시나리오별 유즈케이스 Flow 다이어그램 (Mermaid)

### 시나리오 1: 로컬 파일 기반 SAST 스캔 파이프라인
사용자가 에디터에서 코드 분석을 요청하고, 분석 진행률과 결과를 실시간으로 확인하는 흐름입니다.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant AI Engine
    participant DB

    User->>Frontend: SAST 분석 요청 시작
    Frontend->>Backend: 분석 세션 생성 API 호출
    Backend->>DB: AnalysisSession 엔티티 생성
    Backend-->>Frontend: Session ID 반환
    Frontend->>Backend: SSE 스트림 연결 (/stream)
    Backend-->>Frontend: EventSource 연결 수립
    Backend->>AI Engine: 분석 작업 큐잉/트리거
    
    loop 파일별 분석
        AI Engine->>AI Engine: Code Chunker (슬라이딩 분할)
        AI Engine->>LLM: 분석 프롬프트 및 코드 청크 전송
        LLM-->>AI Engine: 취약점 내역 반환
        AI Engine->>AI Engine: Vuln Classifier (CWE/OWASP 매핑)
        AI Engine->>Backend: 취약점 발견 이벤트 전송
        Backend->>DB: 취약점 내역 저장
        Backend-->>Frontend: SSE (vuln_found 이벤트) 푸시
        Frontend->>User: UI에 실시간 취약점 리스트 갱신
        
        AI Engine->>AI Engine: Patch Generator 구동
        AI Engine->>Backend: 추천 패치 제안 전송
        Backend->>DB: PatchSuggestion 저장
    end
    
    AI Engine->>Backend: 진행률 업데이트
    Backend-->>Frontend: SSE (progress 업데이트) 푸시
    Frontend->>User: 체크리스트 진행 바 갱신
    
    AI Engine->>Backend: 분석 완료 이벤트
    Backend-->>Frontend: SSE (completed 이벤트) 푸시
    Frontend->>User: 결과 리포트 활성화
```

### 시나리오 2: GitHub Repository 스캔 연동
사용자가 GitHub 리포지토리 URL을 입력하여 프로젝트 전체 코드를 불러오고 스캔하는 흐름입니다.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant MCPServer(GitHub)
    participant AI Engine

    User->>Frontend: GitHub URL 및 토큰 입력 스캔 요청
    Frontend->>Backend: StartAnalysisRequest (source_type=github)
    Backend->>Backend: GitHubApiService (토큰 복호화 및 검증)
    Backend->>AI Engine: 스캔 작업 시작 (source_type=github 전달)
    
    AI Engine->>MCPServer(GitHub): list_directory.ts 호출 (재귀적 파일 탐색)
    MCPServer(GitHub)-->>AI Engine: 파일 구조 및 목록 반환
    
    loop 대상 소스 파일
        AI Engine->>MCPServer(GitHub): get_repo_contents.ts 호출 (파일 내용)
        MCPServer(GitHub)-->>AI Engine: Base64 디코딩된 소스 반환
        AI Engine->>AI Engine: 파일 내용 청킹 및 SAST 분석 수행
    end
    
    AI Engine->>Backend: 분석 결과 종합 및 리포팅
    Backend-->>Frontend: 분석 완료 통지
```

### 시나리오 3: SBOM 추출 및 CVE 매칭
프로젝트 내부의 의존성 관리 파일(pom.xml 등)을 파싱하여 취약한 컴포넌트를 식별하는 흐름입니다.

```mermaid
flowchart TD
    A[프로젝트 소스 스캔] --> B{의존성 파일 존재 여부}
    B -- "pom.xml, package.json 등" --> C[SbomService 팩토리 라우팅]
    B -- 없음 --> Z[종료]
    C --> D[MavenPomParser / NpmPackageParser 실행]
    D --> E[종속성(DependencyComponent) 추출]
    E --> F[Redis 캐시 또는 NVD CVE DB 조회]
    F -- 캐시/DB 내 매칭 존재 --> G[cve_component_mapping 에 등록]
    F -- 미존재 --> H[NvdApiClient NVD 외부 연동]
    H --> I[CveData 저장]
    I --> G
    G --> J[프론트엔드 대시보드에 SBOM 리포트 표시]
```

### 시나리오 4: AI 대화형 질의 (채팅 패널)
사용자가 특정 취약점이나 패치 제안에 대해 질문을 하면 AI가 답변하는 흐름입니다.

```mermaid
sequenceDiagram
    participant User
    participant ChatPanel (FE)
    participant Backend (ChatService)
    participant AI Engine (Chat API)
    participant LLM (Claude)

    User->>ChatPanel (FE): "이 취약점 패치 방법 설명해 줘" 전송
    ChatPanel (FE)->>Backend (ChatService): POST /chat (세션 ID + 메시지)
    Backend (ChatService)->>Backend (ChatService): 사용자 및 세션 권한(Auth) 검증
    Backend (ChatService)->>AI Engine (Chat API): SSE 스트리밍 요청 릴레이
    AI Engine (Chat API)->>AI Engine (Chat API): 최대 10턴 이력 컨텍스트 조합
    AI Engine (Chat API)->>LLM (Claude): 프롬프트 전송
    
    loop 실시간 스트리밍
        LLM (Claude)-->>AI Engine (Chat API): 답변 Chunk 반환
        AI Engine (Chat API)-->>Backend (ChatService): SSE Event (delta)
        Backend (ChatService)-->>ChatPanel (FE): 스트림 청크 전달
        ChatPanel (FE)->>User: 타이핑 효과로 응답 표시
    end
    
    LLM (Claude)-->>AI Engine (Chat API): 완료 신호
    AI Engine (Chat API)-->>Backend (ChatService): [DONE] 이벤트
    Backend (ChatService)-->>ChatPanel (FE): 스트림 종료 처리
```
