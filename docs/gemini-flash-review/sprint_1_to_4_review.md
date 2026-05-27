# SecureAI Sprint 1~4 상세 리뷰 및 기능 명세

이 문서는 Sprint 1에서 Sprint 4까지 구현된 주요 기능들의 구현 위치(Backend, AI Engine, Frontend, MCP Server)를 구체적인 파일 및 메소드 레벨로 요약하고, 관련 테스트 스크립트의 상세 경로 및 시나리오 검증 현황을 정리하며, 시나리오별 유즈케이스 Flow를 Mermaid 시퀀스/플로우 다이어그램으로 제공합니다.

---

## 1. 기능 구현 요약 및 코드 매핑

### 1) JWT & OAuth 인증 (Sprint 1)
*   **회원가입, 일반 로그인 및 로그아웃**
    *   **Backend Controller**: `apps/backend/src/main/java/io/secureai/backend/domain/auth/controller/AuthController.java`
        *   `register()`: 회원 등록
        *   `login()`: JWT 발급 및 로그인 처리 (`@AuditLog` 기록)
        *   `logout()`: 로그아웃 및 Redis 토큰 취소
    *   **Backend Service**: `apps/backend/src/main/java/io/secureai/backend/domain/auth/service/AuthService.java`
        *   `register()`, `login()`, `logout()`, `refresh()`
*   **GitHub OAuth 연동 및 JWT 교환**
    *   **Backend Controller**: `apps/backend/src/main/java/io/secureai/backend/domain/auth/controller/AuthController.java`
        *   `githubLogin()`: OAuth 인가 요청 리다이렉트 (CSRF 방어 state 생성)
        *   `githubCallback()`: 콜백 수신 및 일회용 코드 발급 (Redis 60s TTL)
        *   `exchangeOAuthCode()`: 일회용 코드를 프론트엔드 Access Token으로 교환
    *   **Backend Service**: `apps/backend/src/main/java/io/secureai/backend/domain/auth/service/GitHubOAuthService.java`
        *   `buildAuthorizationUrl()`, `handleCallback()`

### 2) 프로젝트 CRUD & 멤버 초대 (Sprint 1)
*   **프로젝트 생성, 조회, 수정 및 삭제**
    *   **Backend Controller**: `apps/backend/src/main/java/io/secureai/backend/domain/project/controller/ProjectController.java`
        *   `listProjects()`, `createProject()`, `getProject()`, `updateProject()`, `deleteProject()`
    *   **Backend Service**: `apps/backend/src/main/java/io/secureai/backend/domain/project/service/ProjectService.java`
        *   `listProjects()`, `createProject()`, `getProject()`, `updateProject()`, `deleteProject()`
*   **프로젝트 멤버 관리 (초대/추방)**
    *   **Backend Controller**: `apps/backend/src/main/java/io/secureai/backend/domain/project/controller/ProjectController.java`
        *   `listMembers()`, `inviteMember()`, `removeMember()`
    *   **Backend Service**: `apps/backend/src/main/java/io/secureai/backend/domain/project/service/ProjectService.java`
        *   `listMembers()`, `inviteMember()`, `removeMember()`

### 3) AI 에이전트 & SAST 파이프라인 (Sprint 2, 3)
*   **코드 청킹 및 분석 병렬화 (Code Chunker)**
    *   **AI Engine Chunker**: `apps/ai_engine/agent/nodes/code_chunker.py`
        *   `_analyze_chunks()`: 300라인 기준 슬라이딩 윈도우 분할
        *   `_dedup_vulns()`: (line, type) 기준 취약점 중복 제거
*   **취약점 분류 및 CWE/OWASP 자동 매핑**
    *   **AI Engine Classifier**: `apps/ai_engine/agent/nodes/vuln_classifier.py`
        *   `normalize_vuln()`: 취약점 타입 소문자/구분자 정규화
        *   `build_call_chain()`: 경로 기반 MVC 계층 감지 및 가상 체인 생성
        *   `classify_and_enrich()`: CWE/OWASP 매핑 테이블 매치 및 체인 주입
*   **배치 SAST 스캔 노드**
    *   **AI Engine Node**: `apps/ai_engine/agent/nodes/sast_node.py`
        *   `analyze_for_sast()`: 파일별 분석 순회 및 Progress SSE 이벤트 브로드캐스트
    *   **Backend Query Service**: `apps/backend/src/main/java/io/secureai/backend/domain/analysis/service/VulnerabilityQueryService.java`
        *   `countBySeverity()`, `countByFilePath()`: CQRS 읽기 전용 통계 조회

### 4) GitHub API 기반 원격 레포 스캔 (Sprint 3)
*   **GitHub 파일 탐색 및 조회 (MCP Server & Wrapper)**
    *   **MCP Server (Node.js)**: `apps/mcp_server/src/github/github_client.ts` - `getContents()` (Rate limit 지수 백오프)
    *   **MCP Server (Node.js)**: `apps/mcp_server/src/github/list_directory.ts` - `handleListDirectory()` (MAX_DEPTH=3)
    *   **AI Engine Wrapper**: `apps/ai_engine/agent/nodes/mcp_github_tools.py`
        *   `list_github_files()`, `get_github_file_content()`
*   **원격 분석 분기 오케스트레이션**
    *   **AI Engine Node**: `apps/ai_engine/agent/nodes/scan_files_node.py`
        *   `scan_files_node()`: `source_type=github`에 따른 파일 수집 분기
    *   **Backend Service**: `apps/backend/src/main/java/io/secureai/backend/domain/analysis/service/GitHubApiService.java`
        *   `validateAccess()`: DB에 암호화된 토큰 복호화 및 GitHub 접근권 검증

### 5) 패치 생성 및 SBOM (Sprint 3)
*   **자동 패치 코드 생성 및 적용**
    *   **AI Engine Diff Generator**: `apps/ai_engine/agent/nodes/diff_generator.py`
        *   `generate_unified_diff()`: 원본과 수정본의 unified diff 포맷 생성
        *   `parse_patch_response()`: LLM 응답 마크다운 제거 및 JSON 파싱
    *   **AI Engine Patch Node**: `apps/ai_engine/agent/nodes/patch_node.py`
        *   `patch_node()`: Redis 캐시(`secureai:patch:{type}:{ext}`) 적용 및 패치 자동 생성
    *   **Backend Service**: `apps/backend/src/main/java/io/secureai/backend/domain/patch/service/PatchService.java`
        *   `savePatchResults()`, `applyPatch()`: 패치 이력 저장 및 적용 상태 업데이트
*   **CVE DB 및 SBOM 파싱 (Strategy 패턴)**
    *   **Backend CVE Client**: `apps/backend/src/main/java/io/secureai/backend/domain/cve/service/NvdApiClient.java`
        *   `syncCveData()`: NVD API v2 증분 갱신 및 429 backoff 처리
    *   **Backend SBOM strategy**: `apps/backend/src/main/java/io/secureai/backend/domain/sbom/service/parser/MavenPomParser.java` (DOM XXE 방어 적용)
    *   **Backend SBOM strategy**: `NpmPackageParser.java`, `PipRequirementsParser.java`, `CargoTomlParser.java`
    *   **Backend SBOM Service**: `apps/backend/src/main/java/io/secureai/backend/domain/sbom/service/SbomService.java`
        *   `saveSbomComponents()`: 파서 팩토리를 통해 적합한 파서 자동 매핑 및 components 수집

### 6) 프론트엔드 UI & SSE 실시간 스트리밍 & AI 채팅 (Sprint 4)
*   **SSE 실시간 진행률 및 취약점 스트리밍**
    *   **Backend Service**: `apps/backend/src/main/java/io/secureai/backend/domain/analysis/service/SseEmitterService.java`
        *   `subscribe()`, `send()`, `complete()`: Redis Pub/Sub을 SSE로 중계
    *   **Frontend Hook**: `apps/frontend/src/hooks/useSse.ts`
        *   `useSse()`: fetch + ReadableStream으로 JWT Authorization 헤더 전달 및 지수 백오프 자동 재연결
*   **진행률 체크리스트 및 Markdown 생성**
    *   **Backend Service**: `apps/backend/src/main/java/io/secureai/backend/domain/analysis/service/ProgressLogService.java`
        *   `getSummary()`: 세션 로그 취합 및 % 단위 계산
    *   **Frontend UI**: `apps/frontend/src/components/analysis/ProgressPanel.tsx`
        *   `ProgressPanel`: 진행 바 렌더링 및 `.md` 형식 클라이언트 사이드 다운로드
*   **AI 채팅 API & UI (Multi-turn 대화)**
    *   **AI Engine Router**: `apps/ai_engine/api/routes/chat.py`
        *   `chat_stream()`: SSE 엔드포인트 릴레이
    *   **AI Engine Client**: `apps/ai_engine/chat_client.py`
        *   `stream()`: Anthropic Prompt Caching 및 최대 10턴 컨텍스트 관리
    *   **Backend Service**: `apps/backend/src/main/java/io/secureai/backend/domain/analysis/service/ChatService.java`
        *   `sendChatMessage()`: RestClient + Virtual Thread 기반 동기 SSE relay (성능 최적화)
    *   **Frontend UI**: `apps/frontend/src/components/analysis/ChatPanel.tsx` (스트리밍 버블 타이핑 효과)

---

## 2. 테스트 스크립트 구성 및 시나리오 검증 현황

각 기능별 비즈니스 시나리오를 검증하기 위한 자동화 테스트 스크립트는 아래 경로에 구성되어 있습니다.

### 1) Backend (JUnit 5 + Spring Boot Test)
*   **`io.secureai.backend.domain.auth.service.AuthServiceTest`**
    *   **검증 시나리오**: 회원가입 시 중복 이메일 예외 처리, 로그인 성공 시 Access/Refresh Token 쌍 생성 및 Refresh Token Rotation 검증.
*   **`io.secureai.backend.domain.project.service.ProjectServiceTest`**
    *   **검증 시나리오**: 비멤버의 프로젝트 접근 시 `AccessDeniedException` 발생 여부 및 CRUD 비즈니스 로직.
*   **`io.secureai.backend.domain.analysis.service.SseEmitterServiceTest`**
    *   **검증 시나리오**: 클라이언트 다중 구독 분리 전송, 타임아웃 이벤트 시 에러 핸들링 및 리소스 회수.
*   **`io.secureai.backend.domain.analysis.service.ProgressLogServiceTest`**
    *   **검증 시나리오**: 복수 노드의 상태 변경 이벤트 기록 시 진행률 퍼센트의 비선형 산출 및 예외 상황 로깅.
*   **`io.secureai.backend.domain.patch.service.PatchServiceTest`**
    *   **검증 시나리오**: 패치 적용 API 호출 시 `is_applied` 상태 및 적용 시점(`applied_at`) 필드가 정확히 업데이트되는지 검증.
*   **`io.secureai.backend.domain.sbom.service.SbomServiceSaveTest`**
    *   **검증 시나리오**: Maven/Npm/Pip 파서들의 XXE 공격 페이로드 방어(DOCTYPE 선언 무시) 및 의존성 추출 단위 테스트.

### 2) AI Engine (Pytest + Mocking)
*   **`apps/ai_engine/tests/agent/test_code_chunker.py`** (13개)
    *   **검증 시나리오**: 대용량 파일 분할 시 경계선 오버랩(25라인)이 보장되는지, 윈도우 슬라이싱이 정상 동작하는지 테스트.
*   **`apps/ai_engine/tests/agent/test_vuln_classifier.py`** (27개)
    *   **검증 시나리오**: PascalCase 변환 에러 수정 검증 및 CWE/OWASP 매핑 정확성, 소스 파일 내 MVC 패턴 키워드에 따른 Call Chain 추론 시나리오.
*   **`apps/ai_engine/tests/agent/test_diff_generator.py`** (12개)
    *   **검증 시나리오**: Claude API의 unified diff 누락 시 원본/수정본 기반 보완 및 unified diff 파싱 정확성 검증.
*   **`apps/ai_engine/tests/agent/test_sast_node.py`**
    *   **검증 시나리오**: 분석 노드 진행 시 Redis progress publish 연동 및 Exception 발생 시 세션 전체 실패가 아닌 skip & log가 정상 수행되는지 검증.
*   **`apps/ai_engine/tests/api/test_chat_route.py`** (3개)
    *   **검증 시나리오**: 10턴 이력 제한 초과 시 컨텍스트 윈도우 내 오래된 대화가 정상 트리밍되는지 및 SSE delta 스트리밍.

---

## 3. 시나리오별 유즈케이스 Flow 다이어그램 (Mermaid)

### 시나리오 1: 사용자 JWT/OAuth 로그인 및 토큰 발급/교환
```mermaid
sequenceDiagram
    autonumber
    participant User as 사용자/브라우저
    participant FE as Frontend (React/Next)
    participant BE as Backend (Spring Boot)
    participant GitHub as GitHub OAuth Server
    participant Redis as Redis (캐시/세션)

    %% 일반 로그인 플로우
    rect rgb(240, 248, 255)
        note right of User: [일반 로그인 플로우]
        User->>FE: 아이디/비밀번호 입력 & 로그인 클릭
        FE->>BE: POST /api/v1/auth/login
        BE->>Redis: Refresh Token Rotation 정보 기록
        BE-->>FE: JWT Token (Access & Refresh Token) 반환
    end

    %% GitHub OAuth 로그인 플로우
    rect rgb(245, 245, 245)
        note right of User: [GitHub OAuth 로그인 플로우]
        User->>FE: "GitHub로 로그인" 버튼 클릭
        FE->>BE: GET /api/v1/auth/github
        BE->>Redis: CSRF 방어용 State 생성 & 보관 (10m TTL)
        BE-->>User: GitHub 인가 코드(Code) 요청 URL 리다이렉트
        User->>GitHub: GitHub 계정 인증 및 앱 승인
        GitHub-->>BE: 콜백 리다이렉트 (GET /github/callback?code=xxx&state=yyy)
        BE->>Redis: State 검증 및 삭제
        BE->>GitHub: Access Token 요청 (인가 코드 전달)
        GitHub-->>BE: Access Token 발급
        BE->>GitHub: 사용자 프로필 조회
        GitHub-->>BE: 이메일 및 유저 ID 반환
        BE->>BE: DB에 사용자 가입/매핑 처리 및 JWT 발급
        BE->>Redis: 일회용 교환 코드(OAuth Code) 저장 (60s TTL)
        BE-->>FE: 콜백 리다이렉트 (/auth/callback?code=oauth_code)
        FE->>BE: GET /api/v1/auth/exchange/{oauth_code} (JWT 교환 요청)
        BE->>Redis: OAuth Code 검증 및 즉시 삭제
        BE-->>FE: 최종 Access Token 반환
    end
```

### 시나리오 2: 프로젝트 CRUD 및 멤버 초대
```mermaid
sequenceDiagram
    autonumber
    participant User as 프로젝트 소유자 (Admin)
    participant Member as 초대 대상 사용자
    participant FE as Frontend UI
    participant BE as Backend Service
    participant DB as PostgreSQL DB

    %% 프로젝트 CRUD
    rect rgb(240, 255, 240)
        note right of User: [프로젝트 관리]
        User->>FE: 새 프로젝트 정보 입력 & 생성 요청
        FE->>BE: POST /api/v1/projects (CreateProjectRequest)
        BE->>DB: Project 엔티티 및 멤버 권한(ADMIN) 저장
        BE-->>FE: 생성 완료 응답 (ProjectResponse)
        FE-->>User: 에디터 대시보드 진입
    end

    %% 멤버 초대
    rect rgb(255, 240, 245)
        note right of User: [멤버 초대 및 관리]
        User->>FE: 멤버 이메일 주소 입력 & 초대 클릭
        FE->>BE: POST /api/v1/projects/{id}/members/invite
        BE->>DB: 대상 사용자의 프로젝트 멤버십 기록 (MEMBER 권한)
        BE-->>FE: 초대 성공 (TeamMemberResponse)
        
        Member->>FE: 프로젝트 목록 페이지 요청
        FE->>BE: GET /api/v1/projects (listProjects)
        BE->>DB: 멤버십 관계 쿼리 수행
        BE-->>FE: 참여 중인 프로젝트 페이징 데이터 반환
        FE-->>Member: 초대된 프로젝트 카드 렌더링
    end
```

### 시나리오 3: 로컬 파일 기반 SAST 스캔 및 실시간 SSE 스트리밍
```mermaid
sequenceDiagram
    autonumber
    participant User as 사용자
    participant FE as Frontend (useSse)
    participant BE as Backend (AnalysisService)
    participant AI as AI Engine (FastAPI)
    participant Redis as Redis Pub/Sub
    participant DB as PostgreSQL DB

    User->>FE: "로컬 코드 스캔 시작" 클릭
    FE->>BE: POST /api/v1/analysis/sessions (StartAnalysisRequest)
    BE->>DB: AnalysisSession 생성 (Status: PENDING)
    BE->>AI: 비동기 스캔 트리거 (POST /agent/analyze)
    AI-->>BE: 202 Accepted 응답
    BE-->>FE: Session ID 반환
    
    FE->>BE: GET /api/v1/analysis/sessions/{id}/stream (SSE 연결)
    BE->>Redis: Redis Pub/Sub 채널 구독 시작 (secureai:progress:{id})
    BE-->>FE: SSE 연결 수립 완료 (EventSource)

    rect rgb(255, 250, 240)
        note right of AI: [AI Engine 백그라운드 분석 루프]
        AI->>Redis: Event: "started" publish
        Redis-->>BE: Subscribed Event 수신
        BE-->>FE: SSE: progress (status = started)
        
        loop 파일 단위 분석
            AI->>AI: Code Chunker (슬라이딩 윈도우 분할)
            AI->>AI: LLM 기반 SAST 스캔 & 중복 제거
            AI->>AI: Vuln Classifier (CWE/OWASP 매핑)
            AI->>Redis: Event: "progress" (node = sast, file = xxx) publish
            Redis-->>BE: Event 수신
            BE-->>FE: SSE: progress (진행률 %, 현재 파일명)
            FE->>User: UI 진행률 체크리스트 실시간 갱신
        end

        AI->>AI: Patch Generator (추천 패치 및 diff 생성)
        AI->>BE: 취약점 분석 결과 일괄 저장 API 호출
        BE->>DB: Vulnerabilities 및 Patch Suggestions 벌크 저장
        AI->>Redis: Event: "completed" publish
        Redis-->>BE: Event 수신
        BE-->>FE: SSE: completed
    end

    FE->>BE: GET /api/v1/sessions/{id}/patches (분석 결과 렌더링용)
    BE->>DB: 취약점 및 패치 목록 조회
    BE-->>FE: 결과 리스트 반환
    FE-->>User: Monaco 에디터 내 빨간 밑줄 하이라이트 및 패널 출력
```

### 시나리오 4: GitHub Repository 기반 비동기 스캔
```mermaid
sequenceDiagram
    autonumber
    participant User as 사용자
    participant FE as Frontend UI
    participant BE as Backend (GitHubApiService)
    participant AI as AI Engine (scan_files_node)
    participant MCP as MCP Server (GitHub Client)
    participant DB as PostgreSQL DB

    User->>FE: GitHub 레포 URL 및 브랜치 입력 후 스캔 클릭
    FE->>BE: POST /api/v1/analysis/sessions (github 스캔 타입)
    BE->>DB: 암호화된 사용자 GitHub Token 조회 및 복호화
    BE->>BE: GitHub API 호출을 통해 레포 접근권 유효성 검증
    BE->>AI: 비동기 스캔 위임 (POST /agent/analyze)
    AI-->>BE: 202 Accepted
    BE-->>FE: 세션 생성 응답
    
    rect rgb(240, 255, 255)
        note right of AI: [AI Engine GitHub 파일 순회 분석]
        AI->>MCP: list_directory.ts 호출 (owner, repo, branch)
        MCP->>MCP: Rate limit 지수 백오프 대기 & GitHub API 호출
        MCP-->>AI: 전체 Scannable 파일 목록 반환 (최대 depth 3)
        
        loop 파일별 분석
            AI->>MCP: get_repo_contents.ts 호출 (특정 파일 경로)
            MCP-->>AI: Base64 소스 파일 데이터 반환
            AI->>AI: 디코딩 & 코드 청킹 및 SAST 분석 실행
        end
        AI->>BE: 최종 취약점 목록 전송 및 완료 보고
        BE->>DB: 결과 영속화
    end
```

### 시나리오 5: SBOM 추출 및 CVE 캐시/NVD API 매칭
```mermaid
flowchart TD
    Start([프로젝트 파일 스캔]) --> Detect{의존성 파일 감지}
    
    %% 의존성 감지 라우팅
    Detect -- "pom.xml" --> Maven[MavenPomParser 실행 - DOM XXE 방어]
    Detect -- "package.json" --> Npm[NpmPackageParser 실행]
    Detect -- "requirements.txt" --> Pip[PipRequirementsParser 실행]
    Detect -- "Cargo.toml" --> Cargo[CargoTomlParser 실행]
    Detect -- 없음 --> End([종료])
    
    %% 파싱 및 패키지 식별
    Maven & Npm & Pip & Cargo --> Extract[DependencyComponent 리스트 추출]
    Extract --> QueryCache{Redis 캐시 조회}
    
    %% 캐시 히트/미스 분기
    QueryCache -- "HIT (6h TTL)" --> Match[cve_component_mapping 에 매핑 저장]
    QueryCache -- "MISS" --> QueryDB{PostgreSQL CVE DB 조회}
    
    QueryDB -- "HIT" --> WriteCache[Redis 캐시에 적재]
    QueryDB -- "MISS" --> NvdCall[NvdApiClient NVD API v2 실호출]
    
    %% NVD API 및 저장
    NvdCall --> Check429{HTTP 429 감지?}
    Check429 -- "Yes" --> Backoff[30s/60s 지수 백오프 후 재시도] --> NvdCall
    Check429 -- "No" --> SaveDB[CveData DB에 벌크 저장]
    SaveDB --> WriteCache
    WriteCache --> Match
    Match --> UI[프론트엔드 SBOM/CVE 대시보드 갱신]
```

### 시나리오 6: 에디터 내 AI 채팅 (다중 턴 스트리밍)
```mermaid
sequenceDiagram
    autonumber
    participant User as 사용자
    participant FE as Frontend (useChat)
    participant BE as Backend (ChatService)
    participant AI as AI Engine (FastAPI)
    participant LLM as Claude API (Anthropic)

    User->>FE: "이 취약점을 안전하게 패치하려면 어떻게 하나요?" 전송
    FE->>BE: POST /api/v1/analysis/sessions/{id}/chat (질문 내용)
    BE->>BE: Spring Security 세션 소유 및 접근 권한 검증
    BE->>AI: SSE HTTP 스트리밍 요청 릴레이 (Virtual Thread 할당)
    
    AI->>AI: Redis로부터 이전 대화 이력 로드 (최대 10턴 제한 트리밍)
    AI->>LLM: 프롬프트 캐싱 및 컨텍스트 전달 (System Prompt + 이전 대화 + 질문)
    
    loop 스트리밍 응답 (delta)
        LLM-->>AI: Text Chunk 반환
        AI-->>BE: SSE event (delta chunk)
        BE-->>FE: HTTP chunked stream 전달
        FE->>User: 타이핑 효과로 챗 버블 실시간 표시
    end
    
    LLM-->>AI: 완료 신호 (stop_reason)
    AI->>AI: 최종 응답 Redis 캐시에 대화 이력 누적
    AI-->>BE: SSE [DONE] 이벤트
    BE-->>FE: 연결 닫기
    FE-->>User: 대화 입력창 재활성화
```
