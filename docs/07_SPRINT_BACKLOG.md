# SecureAI — 스프린트 & 백로그 전체 설계서
> 기준일: 2026-04-19 | 방법론: Scrum | 스프린트 단위: 2주  
> 우선순위: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low  
> 상태: 📋 Backlog / 🏃 In Progress / 🔍 Review / ✅ Done  
> GitHub Projects 칸반: Backlog → In Progress → Review → Done

---

## 전체 로드맵 한눈에 보기

```
Sprint 0  (Week 01-02): 환경 세팅 & 인프라 기반
Sprint 1  (Week 03-04): 인증 & 프로젝트 관리 (Backend Core)
Sprint 2  (Week 05-06): AI Agent 기반 & MCP 연동
Sprint 3  (Week 07-08): SAST 파이프라인 & GitHub 레포 스캔
Sprint 4  (Week 09-10): 웹 에디터 UI & 실시간 SSE
Sprint 5  (Week 11-12): GitHub Layer 2 완성 (PR Webhook, SBOM, 히스토리)
Sprint 6  (Week 13-14): DAST 엔진 & Docker 샌드박스
Sprint 7  (Week 15-16): 리포트 & 대시보드 & Android MVP
Sprint 8  (Week 17-18): 안정화 & 성능 최적화 & 런칭 준비
Sprint 9  (Week 19-20): VSCode Extension & 모니터링 (Phase 3)
```

---

## Sprint 0 — 환경 세팅 & 인프라 기반
> 기간: Week 01-02 | 목표: 모든 서비스가 로컬에서 docker compose up 하나로 실행되는 상태

### EPIC-0: 프로젝트 기반 구축

---

#### TASK-001 🔴 모노레포 Git 초기화 및 디렉토리 구조 생성
- **설명**: 전체 6개 서비스(backend, ai-agent, mcp-server, frontend, android, dast-sandbox) 디렉토리 생성. `.gitignore`, `README.md`, `Makefile` 초안 작성. GitHub 레포지토리 생성 및 branch 전략 설정(main/develop/feature/*).
- **중요도**: 🔴 Critical
- **순서**: 1번째 (모든 작업의 전제)
- **완료 조건**: `git clone` 후 `make dev`로 전체 컨테이너 실행 가능
- **하위 할일**:
  - [ ] GitHub 레포지토리 생성 (public/private 결정)
  - [ ] 디렉토리 골격 생성 (6개 서비스 폴더)
  - [ ] `.gitignore` 작성 (`.env`, `*.db`, `build/`, `__pycache__`, `node_modules/`, `*.keystore`)
  - [ ] Branch protection rule 설정 (main: PR 필수, CI 통과 필수)
  - [ ] `Makefile` 단축 명령어 작성 (dev/stop/logs/test/clean)
  - [ ] `README.md` 기본 작성 (아키텍처 다이어그램 포함)

---

#### TASK-002 🔴 Docker Compose 전체 서비스 구성
- **설명**: `docker-compose.yml`에 postgres, redis, mcp-server, ai-agent, backend, frontend 6개 서비스 정의. Docker 네트워크 3개(app-net, data-net, dast-isolated-net) 분리. 헬스체크 설정으로 서비스 시작 순서 보장.
- **중요도**: 🔴 Critical
- **순서**: 2번째 (TASK-001 완료 후)
- **완료 조건**: `docker compose up -d` 후 전체 서비스 healthy 상태
- **하위 할일**:
  - [ ] `docker-compose.yml` 전체 서비스 정의
  - [ ] PostgreSQL 15: 헬스체크, 볼륨, 초기화 스크립트 연결
  - [ ] Redis 7: `redis.conf` (maxmemory 512mb, allkeys-lru, requirepass)
  - [ ] 네트워크 3개 정의 및 서비스별 네트워크 할당
  - [ ] `.env.example` 전체 환경변수 목록 작성
  - [ ] `docker-compose.prod.yml` 오버라이드 파일 초안

---

#### TASK-003 🔴 Spring Boot 프로젝트 초기화
- **설명**: Spring Boot 3.3, Java 21, Gradle Kotlin DSL로 프로젝트 초기화. JPA, Security, Redis, Validation, Actuator 의존성 설정. Flyway 설정 및 V001(plans 테이블) 마이그레이션 첫 파일 작성. Virtual Thread 활성화.
- **중요도**: 🔴 Critical
- **순서**: 3번째
- **완료 조건**: `/actuator/health` 200 응답, Flyway 마이그레이션 성공
- **하위 할일**:
  - [ ] Spring Initializr로 프로젝트 생성 (패키지명: `io.secureai`)
  - [ ] `build.gradle.kts` 의존성 전체 정의
  - [ ] `application.yml` 기본 설정 (DB, Redis, JWT, Virtual Thread)
  - [ ] `application-local.yml` / `application-prod.yml` 프로파일 분리
  - [ ] Flyway V001 ~ V005 마이그레이션 파일 작성 (plans, users, refresh_tokens, projects, team_members)
  - [ ] `AsyncConfig.java` Thread Pool 5종 설정
  - [ ] `GlobalExceptionHandler.java` 기본 예외 핸들러

---

#### TASK-004 🔴 Python AI Agent 서비스 초기화
- **설명**: FastAPI, LangGraph, Anthropic SDK, Pydantic Settings로 AI Agent 서비스 초기화. `/health` 엔드포인트, 내부 API Key 인증 미들웨어, LangSmith 트레이싱 기본 설정.
- **중요도**: 🔴 Critical
- **순서**: 3번째 (TASK-002와 병렬)
- **완료 조건**: `GET /health` 200, LangSmith 대시보드에 서비스 연결 확인
- **하위 할일**:
  - [ ] `requirements.txt` 의존성 정의 (langgraph, anthropic, fastapi, uvicorn, redis, pydantic-settings)
  - [ ] `main.py` FastAPI 앱 생성, 라우터 등록
  - [ ] `config/settings.py` Pydantic Settings (환경변수 검증)
  - [ ] `api/middleware/internal_key_auth.py` 내부 API Key 검증
  - [ ] `infrastructure/langsmith_tracer.py` LangSmith 기본 설정
  - [ ] Dockerfile 작성 (python:3.12-slim, gunicorn)

---

#### TASK-005 🟠 MCP Server 초기화
- **설명**: Node.js + TypeScript + `@modelcontextprotocol/sdk`로 MCP Server 초기화. Filesystem Tool 4개(read_file, list_directory, search_files, get_file_info) 기본 구현. 경로 탈출 방지 보안 검증 포함.
- **중요도**: 🟠 High
- **순서**: 4번째 (TASK-004 이후)
- **완료 조건**: AI Agent에서 `read_file` Tool 호출 시 파일 내용 반환
- **하위 할일**:
  - [ ] `package.json` 의존성 정의 및 TypeScript 설정
  - [ ] `src/index.ts` MCP Server 진입점, stdio 모드 설정
  - [ ] `src/tools/filesystem/` 4개 Tool 구현
  - [ ] `src/security/path_validator.ts` 경로 탈출 방지
  - [ ] `src/security/file_filter.ts` 바이너리·과대 파일 필터
  - [ ] AI Agent `mcp_client.py` stdio 연결 테스트

---

#### TASK-006 🟠 Next.js 프론트엔드 초기화
- **설명**: Next.js 15 App Router, TypeScript strict, Tailwind CSS, ESLint+Security 플러그인 초기화. 다크 테마 CSS 변수 정의. Axios 인스턴스, Zustand 스토어 골격 생성.
- **중요도**: 🟠 High
- **순서**: 3번째 (병렬 가능)
- **완료 조건**: `http://localhost:3000` 접속 시 SecureAI 로딩 화면 표시
- **하위 할일**:
  - [ ] Next.js 15 프로젝트 생성 (App Router, TypeScript strict)
  - [ ] Tailwind CSS 다크 테마 색상 토큰 정의
  - [ ] `src/lib/api/client.ts` Axios 인스턴스 기본 설정
  - [ ] `src/store/useAuthStore.ts` 인증 스토어 골격
  - [ ] `src/types/` 도메인별 TypeScript 타입 정의
  - [ ] 글로벌 CSS (VSCode 다크 테마 변수)

---

#### TASK-007 🟡 GitHub Actions CI 파이프라인 기본 설정
- **설명**: backend, ai-agent, frontend 각각 CI 워크플로우 작성. PR 생성 시 빌드+테스트 자동 실행. self-scan 워크플로우 초안(추후 완성).
- **중요도**: 🟡 Medium
- **순서**: 5번째
- **하위 할일**:
  - [ ] `ci-backend.yml` (Gradle 빌드 + 단위 테스트)
  - [ ] `ci-ai-agent.yml` (pytest)
  - [ ] `ci-frontend.yml` (타입체크 + lint + 빌드)
  - [ ] Branch Protection에 CI 통과 조건 연결

---

## Sprint 1 — 인증 & 프로젝트 관리
> 기간: Week 03-04 | 목표: 회원가입/로그인/프로젝트 CRUD가 동작하는 API 완성

### EPIC-1: 사용자 인증 시스템

---

#### TASK-101 🔴 JWT 인증 시스템 구현 (Spring Boot)
- **설명**: 회원가입, 로그인, Access Token(15분)/Refresh Token(30일) 발급, Refresh Token Rotation 구현. Bcrypt 해싱(rounds=12), 로그인 실패 5회 잠금, HttpOnly Cookie Refresh Token 처리. Redis에 Refresh Token 해시 저장.
- **중요도**: 🔴 Critical
- **순서**: 1번째 (모든 API의 전제)
- **완료 조건**: Postman으로 로그인 → 토큰 발급 → 갱신 → 로그아웃 전 과정 성공
- **하위 할일**:
  - [ ] `User.java`, `Plan.java` 엔티티 + Flyway V002, V003
  - [ ] `AuthService.java` 회원가입·로그인 핵심 로직
  - [ ] `TokenService.java` JWT 생성·검증·Rotation
  - [ ] `JwtAuthenticationFilter.java` 요청별 토큰 검증 필터
  - [ ] `RefreshToken.java` 엔티티 + `RefreshTokenRepository`
  - [ ] `AuthController.java` 전체 엔드포인트
  - [ ] 이메일 인증 토큰 생성 + `EmailService.java` 발송
  - [ ] 단위 테스트 (토큰 생성·만료·재사용 탐지)

---

#### TASK-102 🔴 GitHub OAuth 연동
- **설명**: GitHub OAuth App 등록, 인증 코드 → Access Token 교환, GitHub 사용자 정보 조회 후 계정 생성/연결. GitHub 토큰 AES-256-GCM 암호화 저장.
- **중요도**: 🔴 Critical
- **순서**: 2번째 (TASK-101 이후)
- **완료 조건**: 브라우저에서 GitHub 로그인 → SecureAI 계정 생성·로그인 성공
- **하위 할일**:
  - [ ] GitHub OAuth App 등록 (Client ID/Secret)
  - [ ] `AesEncryptionConverter.java` AES-256-GCM JPA 컨버터
  - [ ] `GitHubOAuthService.java` 토큰 교환 + 사용자 조회
  - [ ] `AuthController` GitHub 콜백 엔드포인트 추가
  - [ ] 프론트엔드 GitHub OAuth 버튼 + 콜백 페이지

---

#### TASK-103 🔴 플랜 체계 및 Rate Limit 구현
- **설명**: 4개 플랜(Free/Pro/Team/Enterprise) DB 시드 데이터. `PlanChecker.java` 빈으로 @PreAuthorize 플랜 제한. `RateLimitInterceptor.java` Redis 카운터 기반 req/min 제한.
- **중요도**: 🔴 Critical
- **순서**: 3번째
- **완료 조건**: Free 플랜 사용자가 DAST 엔드포인트 호출 시 403 반환
- **하위 할일**:
  - [ ] Flyway V021 plans 시드 데이터
  - [ ] `PlanChecker.java` 플랜별 기능 판단 로직 + Redis 캐시
  - [ ] `RateLimitInterceptor.java` + `WebConfig` 등록
  - [ ] `AuditLogAspect.java` 기본 감사 로그

---

### EPIC-2: 프로젝트 관리 API

---

#### TASK-104 🟠 프로젝트 CRUD API
- **설명**: 프로젝트 생성/조회/수정/삭제(소프트 딜리트). 팀 멤버 초대/제거. 플랜별 멤버 수 제한. 프로젝트 목록 조회 시 최근 세션 요약 @EntityGraph JOIN.
- **중요도**: 🟠 High
- **순서**: 4번째 (TASK-101 이후)
- **완료 조건**: 프로젝트 생성 → 팀 멤버 초대 → 목록 조회 API 전부 동작
- **하위 할일**:
  - [ ] `Project.java`, `TeamMember.java` 엔티티 + Flyway V004, V005
  - [ ] `ProjectService.java` CRUD + 멤버 관리
  - [ ] `ProjectController.java` 전체 엔드포인트
  - [ ] 소프트 딜리트 + 72시간 후 하드 딜리트 `@Async` 등록

---

#### TASK-105 🟡 사용자 정보 API & 프론트엔드 인증 UI
- **설명**: `GET /users/me` (플랜·사용량 포함), `PATCH /users/me`, `DELETE /users/me`. 프론트엔드 로그인/회원가입/콜백 페이지 구현. Axios 인터셉터 자동 토큰 갱신.
- **중요도**: 🟡 Medium
- **순서**: 5번째
- **하위 할일**:
  - [ ] `UserController.java`, `UserService.java` 구현
  - [ ] 프론트엔드 `(auth)/login/page.tsx` UI
  - [ ] 프론트엔드 `(auth)/register/page.tsx` UI
  - [ ] `useAuth.ts` 훅, `useAuthStore.ts` 완성
  - [ ] Axios 인터셉터 401 → 토큰 갱신 자동화

---

## Sprint 2 — AI Agent 기반 & MCP 연동
> 기간: Week 05-06 | 목표: LangGraph 파이프라인이 단일 파일을 분석하고 취약점을 반환

### EPIC-3: AI 에이전트 파이프라인 기반

---

#### TASK-201 🔴 LangGraph 보안 감사 그래프 구축
- **설명**: `security_audit_graph.py`에 전체 그래프 정의. `AgentState` TypedDict 설계. cache_check → sast → dast → patch → report → notify 노드 골격 생성 (각 노드는 stub). 조건부 엣지 함수 구현. LangSmith 트레이싱 연결.
- **중요도**: 🔴 Critical
- **순서**: 1번째
- **완료 조건**: 빈 AgentState로 그래프 컴파일 성공, LangSmith에서 실행 추적 확인
- **하위 할일**:
  - [ ] `agent/pipeline/agent_state.py` TypedDict 완전 정의
  - [ ] `agent/pipeline/security_audit_graph.py` 그래프 노드·엣지 정의
  - [ ] `agent/pipeline/graph_builder.py` 컴파일·캐싱
  - [ ] `agent/edges/` 3개 조건부 엣지 함수
  - [ ] LangSmith 프로젝트 연결 + 트레이싱 확인

---

#### TASK-202 🔴 MCP Filesystem Tool → SAST 노드 연동
- **설명**: `mcp_filesystem_tools.py`에 LangGraph Tool 정의. `sast_node.py`에서 MCP Tool로 파일 읽기 → Claude API로 분석 요청 → JSON 응답 파싱 → Vulnerability 객체 생성. Claude 프롬프트 템플릿 작성.
- **중요도**: 🔴 Critical
- **순서**: 2번째
- **완료 조건**: 단일 취약한 Java 파일 입력 시 SQL Injection 취약점이 포함된 JSON 반환
- **하위 할일**:
  - [ ] `agent/tools/mcp_filesystem_tools.py` Tool 3개 구현
  - [ ] `mcp/mcp_client.py` stdio 모드 MCP 연결
  - [ ] `prompts/sast_system.txt`, `sast_user.jinja2` 프롬프트 작성
  - [ ] `llm/claude_client.py` Claude API 호출 래퍼
  - [ ] `llm/response_parser.py` JSON 파싱·복구 로직
  - [ ] `agent/nodes/sast_node.py` 핵심 구현
  - [ ] `agent/nodes/cache_check_node.py` SHA-256 해시 계산 + Redis 조회

---

#### TASK-203 🔴 Spring Boot ↔ AI Agent HTTP 연동
- **설명**: `AiAgentClient.java` 구현 (WebClient + Resilience4j Circuit Breaker). 분석 세션 DB 모델 생성. `POST /analysis/sessions` API 구현 (즉시 202 반환, @Async 분석 시작). Redis Pub/Sub SSE 브릿지 기본 구현.
- **중요도**: 🔴 Critical
- **순서**: 3번째
- **완료 조건**: Spring Boot에서 분석 요청 시 AI Agent가 분석 시작, Redis에 이벤트 발행 확인
- **하위 할일**:
  - [ ] `AnalysisSession.java` 엔티티 + Flyway V006 (파티션 테이블)
  - [ ] `AnalysisService.java` 세션 생성 + AI Agent 호출 오케스트레이션
  - [ ] `AiAgentClient.java` Circuit Breaker + Retry 설정
  - [ ] `RedisPublisher.java`, `RedisSubscriber.java` Pub/Sub 구현
  - [ ] `SseEmitterService.java` Redis → SseEmitter 브릿지
  - [ ] `AnalysisController.java` POST /sessions + GET /stream 엔드포인트
  - [ ] AI Agent `api/routes/analyze.py` 요청 수신 + 파이프라인 호출

---

#### TASK-204 🟠 취약점 저장 파이프라인
- **설명**: AI Agent가 분석 완료 시 Backend REST API로 취약점 전송. `Vulnerability.java` 엔티티 생성. `VulnerabilityFoundEvent` Spring 이벤트로 세션 집계 자동 업데이트. Redis Pub/Sub으로 SSE `vuln_found` 이벤트 발행.
- **중요도**: 🟠 High
- **순서**: 4번째
- **완료 조건**: 분석 완료 시 취약점이 DB에 저장되고 SSE로 클라이언트에 전달
- **하위 할일**:
  - [ ] `Vulnerability.java` 엔티티 + Flyway V007
  - [ ] `VulnerabilityService.java` 저장 + 지문 중복 체크
  - [ ] `VulnerabilityFoundEvent.java` + Listener 구현
  - [ ] `VulnerabilityController.java` 기본 조회 API
  - [ ] AI Agent `infrastructure/backend_api_client.py` 취약점 전송

---

## Sprint 3 — SAST 파이프라인 완성 & GitHub 레포 스캔 (Layer 1+2 기초)
> 기간: Week 07-08 | 목표: 로컬 코드 전체 SAST 완성 + GitHub 레포 API 기반 코드 스캔 시작

### EPIC-4: SAST 파이프라인 완성

---

#### TASK-301 🔴 파일 배치 SAST (전체 프로젝트 스캔)
- **설명**: 단일 파일이 아닌 전체 프로젝트 파일 목록을 MCP로 읽어 병렬 SAST. `CodeChunker.py`로 큰 파일을 Claude 컨텍스트 윈도우에 맞게 분할. 언어별 파서 필터 (`.java`, `.ts`, `.py`, `.go` 등). 진행률 SSE 실시간 전송.
- **중요도**: 🔴 Critical
- **순서**: 1번째
- **완료 조건**: 10개 파일 프로젝트 전체 스캔 → 취약점 목록 반환, 진행률 SSE 수신
- **하위 할일**:
  - [ ] `agent/nodes/sast_node.py` 파일 배치 처리 로직
  - [ ] `agent/nodes/cache_check_node.py` 파일별 캐시 HIT/MISS 분기
  - [ ] `llm/code_chunker.py` 파일 청크 분할 유틸
  - [ ] 진행률(progressPct) 계산 및 `notify_node.py` 이벤트 발행
  - [ ] `VulnerabilityQueryService.java` CQRS Read 전용 서비스 (대시보드 집계)

---

#### TASK-302 🔴 CWE/OWASP 분류 자동 매핑
- **설명**: Claude AI 응답에서 취약점 유형 → CWE ID, OWASP Top 10 카테고리 자동 매핑. `VulnClassifier.py` 구현. API 호출 체인(callChain) JSON 구성 로직.
- **중요도**: 🔴 Critical
- **순서**: 2번째
- **완료 조건**: SQL Injection → CWE-89, OWASP A03:2021 자동 분류
- **하위 할일**:
  - [ ] `agent/nodes/vuln_classifier.py` 분류 매핑 로직
  - [ ] callChain JSON 구성 알고리즘 (Frontend → Controller → Service → Vuln)
  - [ ] CWE/OWASP 매핑 상수 테이블

---

#### TASK-303 🔴 GitHub 레포지토리 API 기반 코드 스캔 (Layer 2 — 1단계)
- **설명**: GitHub REST API로 저장소의 파일 목록과 코드 내용을 읽어와 SAST 분석. MCP GitHub Tool 구현 (`get_repo_contents`, `list_dir`). API rate limit 처리 (GitHub Token 헤더, 5000 req/h). 기본 파일 타입 필터링 후 AI Agent로 SAST 위임. 프로젝트 source_type='github' 처리 분기.
- **중요도**: 🔴 Critical
- **순서**: 3번째 (TASK-301 병렬)
- **완료 조건**: GitHub URL 입력 → 저장소 파일 자동 조회 → SAST 분석 완료
- **하위 할일**:
  - [ ] `mcp-server/src/tools/github/get_repo_contents.ts` MCP Tool 구현
  - [ ] `mcp-server/src/tools/github/list_directory.ts` MCP Tool
  - [ ] `ai-agent/agent/tools/mcp_github_tools.py` Tool 래퍼
  - [ ] `GitHubRestClient.java` 저장소 파일 목록·내용 조회 API
  - [ ] `GitHubApiService.java` GitHub Token 복호화 + API 호출
  - [ ] AI Agent GitHub 파일 스캔 경로 (`source_type=github` 분기)
  - [ ] GitHub API rate limit 처리 (429 대응, exponential backoff)
  - [ ] 이진 파일·대용량 파일 제외 필터

---

#### TASK-304 🟠 패치 에이전트 구현
- **설명**: `patch_node.py`에서 취약점별 패치 코드 생성 (Claude API). 패치 템플릿 캐시 (`secureai:patch:template:{key}`, TTL 7일). `PatchSuggestion.java` 엔티티 및 API 구현.
- **중요도**: 🟠 High
- **순서**: 4번째
- **완료 조건**: SQL Injection 취약점에 대한 PreparedStatement 패치 코드 자동 생성
- **하위 할일**:
  - [ ] `prompts/patch_generation.jinja2` 프롬프트
  - [ ] `agent/nodes/patch_node.py` + `agent/nodes/diff_generator.py`
  - [ ] `PatchSuggestion.java` 엔티티 + Flyway V009
  - [ ] `PatchService.java` + `PatchController.java`
  - [ ] Redis 패치 템플릿 캐시 로직

---

#### TASK-305 🟠 CVE 기초 데이터베이스 및 SBOM 기반
- **설명**: NVD API로 CVE 데이터 초기 동기화 (NvdSyncJob). `CveData.java` 엔티티. SBOM 파서 4종(Maven, npm, pip, Cargo) 인터페이스와 기본 구현. 의존성 → CVE 매칭 기초 구현.
- **중요도**: 🟠 High
- **순서**: 4번째 (병렬)
- **하위 할일**:
  - [ ] `CveData.java`, `DependencyComponent.java` 엔티티 + Flyway V014~V016
  - [ ] `NvdApiClient.java` + 초기 동기화 구현
  - [ ] `NvdSyncJob.java` @Scheduled 등록
  - [ ] SBOM 파서 4종 인터페이스 + 기본 구현
  - [ ] `SbomService.java` 비동기 처리

---

## Sprint 4 — 웹 에디터 UI & 실시간 SSE
> 기간: Week 09-10 | 목표: Monaco 에디터에 취약점 인라인 하이라이팅, SSE 실시간 수신

### EPIC-5: 웹 프론트엔드 핵심 UI

---

#### TASK-401 🔴 Monaco 에디터 통합 & 취약점 인라인 하이라이팅
- **설명**: `@monaco-editor/react` 설치. `CodeEditor.tsx` 래퍼 구현. `lib/monaco/decorations.ts`에 심각도별 라인 하이라이팅·글리프 마진 아이콘·호버 툴팁 정의. 취약 라인 빨간 글로우 CSS.
- **중요도**: 🔴 Critical
- **순서**: 1번째
- **완료 조건**: 취약점 데이터로 에디터 라인 46에 빨간 배경+글로우 효과 표시
- **하위 할일**:
  - [ ] `@monaco-editor/react` 설치 + dynamic import (SSR 비활성화)
  - [ ] `CodeEditor.tsx` Monaco 래퍼 컴포넌트
  - [ ] `lib/monaco/themes.ts` SecureAI Dark 테마
  - [ ] `lib/monaco/decorations.ts` 취약점 데코레이션 전체 정의
  - [ ] `useMonaco.ts` 훅 (파일 전환 시 데코레이션 재적용)
  - [ ] Monaco Diff 에디터 연동 (`DiffViewer.tsx`)

---

#### TASK-402 🔴 SSE 실시간 구독 & 취약점 실시간 표시
- **설명**: `useSse.ts` 훅으로 EventSource 구독 관리. 이벤트 타입별 처리 (progress → 진행률, vuln_found → 스토어에 취약점 추가 + Monaco 데코레이션 즉시 추가, completed → Toast 알림). 자동 재연결 (최대 5회 exponential backoff).
- **중요도**: 🔴 Critical
- **순서**: 2번째
- **완료 조건**: 분석 시작 → SSE로 취약점 실시간 에디터에 표시
- **하위 할일**:
  - [ ] `useSse.ts` EventSource 구독·재연결 훅
  - [ ] `useSecureStore.ts` `addVuln()` 실시간 추가 액션
  - [ ] `SseIndicator.tsx` 연결 상태 점멸 아이콘
  - [ ] `Toast.tsx` + `useToast.ts` 취약점 발견 알림
  - [ ] `AnalysisLoadingOverlay.tsx` 분석 중 오버레이

---

#### TASK-403 🔴 VSCode 스타일 에디터 레이아웃 & 파일 트리
- **설명**: `EditorLayout.tsx` 3패널 구조 (사이드바+에디터+우측패널). `ResizeHandle.tsx` + `ResizablePanel.tsx` 드래그 리사이즈. `FileTree.tsx` MCP 파일 트리 (취약점 도트 표시). `EditorTabs.tsx` 멀티 탭.
- **중요도**: 🔴 Critical
- **순서**: 2번째 (TASK-401과 병렬)
- **하위 할일**:
  - [ ] `EditorLayout.tsx` 3패널 CSS Grid 레이아웃
  - [ ] `useResizablePanel.ts` / `ResizeHandle.tsx` 드래그 리사이즈 훅+컴포넌트
  - [ ] `FileTree.tsx` 파일 트리 + 취약점 색상 도트
  - [ ] `EditorTabs.tsx` 열린 탭 관리
  - [ ] `useEditorStore.ts` 파일 선택 상태

---

#### TASK-404 🟠 취약점 상세 패널 & AI 채팅 패널
- **설명**: `VulnDetailPanel.tsx` 취약점 토글 (설명+API콜체인+Diff+AutoFix). `CallChainView.tsx` 콜체인 트리 (취약 노드 글로우, 클릭 시 에디터 점프). `ChatPanel.tsx` AI 채팅 (스트리밍 응답). `FilterBar.tsx` API 그룹 필터 (AND 조건).
- **중요도**: 🟠 High
- **순서**: 3번째
- **하위 할일**:
  - [ ] `VulnDetailPanel.tsx` 토글 애니메이션 + 전체 구조
  - [ ] `CallChainView.tsx` 트리 렌더링 + 글로우 효과
  - [ ] `ChatPanel.tsx` SSE 스트리밍 응답 표시
  - [ ] `FilterBar.tsx` API 그룹 칩 필터
  - [ ] `useVulnFilter.ts` AND 조건 필터 훅

---

#### TASK-405 🟠 AI 채팅 API (Spring Boot + AI Agent)
- **설명**: `ChatController.java` POST /chat/sessions/{id}/message. `ChatService.java`에서 AI Agent로 메시지 전달, SSE 스트리밍 응답 중계. 대화 이력 Redis 저장 (최근 10턴). `prompts/chat_system.txt` 프롬프트 완성.
- **중요도**: 🟠 High
- **순서**: 4번째
- **하위 할일**:
  - [ ] `prompts/chat_system.txt` 보안 전문가 페르소나 프롬프트
  - [ ] `ai-agent/api/routes/chat.py` + 대화이력 관리
  - [ ] `ChatService.java` + `ChatController.java`
  - [ ] 프론트엔드 채팅 SSE 스트리밍 표시

---

## Sprint 5 — GitHub Layer 2 완성
> 기간: Week 11-12 | 목표: GitHub 레포 검사 전체 완성 (나머지 파일 스캔, 히스토리, PR Webhook, SBOM)

### EPIC-6: GitHub 레포지토리 전체 스캔

---

#### TASK-501 🔴 GitHub 커밋 히스토리 시크릿 스캔
- **설명**: `CommitHistoryScanner.java`에서 GitHub API로 커밋 목록 페이지네이션 조회 → 각 커밋의 diff를 `mcp-server/github/get_commit_diff.ts` MCP Tool로 가져옴 → AI Agent가 시크릿(API 키, 비밀번호, 토큰) 패턴 탐지 (삭제된 히스토리도 포함). 탐지된 시크릿을 취약점으로 저장.
- **중요도**: 🔴 Critical
- **순서**: 1번째
- **완료 조건**: 과거 커밋에서 삭제된 API 키 탐지 → 취약점으로 등록
- **하위 할일**:
  - [ ] `mcp-server/src/tools/github/list_commits.ts` MCP Tool
  - [ ] `mcp-server/src/tools/github/get_commit_diff.ts` MCP Tool
  - [ ] `ai-agent/agent/tools/mcp_github_tools.py` 커밋 diff Tool 래퍼
  - [ ] AI Agent 시크릿 탐지 프롬프트 + 분석 노드
  - [ ] `CommitHistoryScanner.java` @Async 페이지네이션 처리
  - [ ] GitHub API 커밋 diff 요청 최적화 (병렬 처리, 캐싱)

---

#### TASK-502 🔴 GitHub PR Webhook 자동 보안 리뷰
- **설명**: GitHub Webhook 등록 API (`GitHubApiService.java`). `GitHubWebhookController.java`에서 HMAC-SHA256 서명 검증 후 PR 이벤트 비동기 처리. PR의 변경 파일만 SAST → PR에 자동 코멘트 작성. `blockMergeOnCritical` 설정 시 GitHub Check Status 실패 처리.
- **중요도**: 🔴 Critical
- **순서**: 2번째
- **완료 조건**: PR 생성 시 자동 SAST → GitHub PR에 보안 리뷰 코멘트 자동 등록
- **하위 할일**:
  - [ ] `GitHubWebhookController.java` HMAC 검증 + 비동기 위임
  - [ ] `GitHubWebhookService.java` PR 이벤트 처리 + 세션 생성
  - [ ] PR 변경 파일(diff)만 스캔하는 최적화 로직
  - [ ] `mcp-server/src/tools/github/create_pr_comment.ts` MCP Tool
  - [ ] `PrReviewHistory.java` 엔티티 + Flyway V013
  - [ ] GitHub Check Run API 연동 (상태 보고)
  - [ ] `GitHubConfig.java` Webhook 설정 저장 + `GitHubController.java` 설정 API

---

#### TASK-503 🟠 GitHub 레포 나머지 파일 전체 SAST
- **설명**: API 기반 파일 조회(TASK-303)에 이어 GitHub 레포의 config 파일(`.env.example`, `docker-compose.yml`, `*.yaml` 등)과 스크립트 파일도 SAST 분석. 대용량 레포 처리 최적화 (파일 크기 제한, 언어별 우선순위 정렬).
- **중요도**: 🟠 High
- **순서**: 3번째
- **완료 조건**: 100개 파일 GitHub 레포 전체 스캔 완료 (15분 이내)
- **하위 할일**:
  - [ ] GitHub 파일 타입별 우선순위 설정 (코드 > 설정 > 기타)
  - [ ] 파일 크기 필터 (10MB 초과 제외), 바이너리 파일 제외
  - [ ] 병렬 SAST 처리 최적화 (asyncio.gather)
  - [ ] 분석 진행률 SSE 정확도 개선 (파일 수 기반)

---

#### TASK-504 🟠 SBOM 완성 & CVE 매칭 리포트
- **설명**: GitHub 레포의 의존성 파일(pom.xml, package.json, requirements.txt) 자동 감지 + SBOM 생성. CVE 매칭 결과를 취약점으로 등록. CycloneDX JSON 형식 내보내기.
- **중요도**: 🟠 High
- **순서**: 3번째 (병렬)
- **하위 할일**:
  - [ ] GitHub 레포에서 의존성 파일 자동 감지
  - [ ] SBOM 파서 4종 완성 (Maven, npm, pip, Cargo)
  - [ ] CVE 매칭 + `vulnerability_cve_mapping` 저장
  - [ ] CycloneDX JSON 내보내기
  - [ ] `CveController.java` + `SbomController.java` API

---

#### TASK-505 🟡 GitHub 연동 설정 UI (프론트엔드)
- **설명**: 프로젝트 설정 페이지의 GitHub 연동 섹션. Webhook 등록 버튼, 자동 리뷰 설정 토글, PR 리뷰 이력 테이블 `PrReviewHistory.tsx`.
- **중요도**: 🟡 Medium
- **순서**: 4번째
- **하위 할일**:
  - [ ] `settings/page.tsx` GitHub 설정 섹션
  - [ ] `PrReviewHistory.tsx` PR 리뷰 이력 테이블
  - [ ] GitHub 저장소 목록 드롭다운 (`GET /github/repos`)

---

## Sprint 6 — DAST 엔진 & Docker 샌드박스
> 기간: Week 13-14 | 목표: Docker 샌드박스에서 실제 DAST 실행, SSE 실시간 로그

### EPIC-7: DAST 동적 분석

---

#### TASK-601 🔴 Docker 샌드박스 DAST 컨테이너
- **설명**: `dast-sandbox/` Python 컨테이너 완성 (5개 익스플로잇 유형). `DockerSandboxManager.java`로 컨테이너 동적 생성·실행·로그 수집·종료. 격리 네트워크 설정. AES-256-GCM으로 페이로드·로그 암호화 저장.
- **중요도**: 🔴 Critical
- **순서**: 1번째
- **완료 조건**: DAST 요청 시 Docker 컨테이너 생성 → 페이로드 실행 → 결과 반환 → 컨테이너 삭제
- **하위 할일**:
  - [ ] `dast-sandbox/executors/` 5개 익스플로잇 구현
  - [ ] `dast-sandbox/dast_runner.py` 진입점 완성
  - [ ] `DockerSandboxManager.java` 컨테이너 생명주기 관리
  - [ ] `ContainerConfig.java` 격리 설정 (메모리 512MB, 네트워크 격리)
  - [ ] `ExploitResult.java` 엔티티 + Flyway V008 (30일 TTL)
  - [ ] 타임아웃 300초 강제 종료 로직

---

#### TASK-602 🔴 도메인 소유권 확인 & DAST Rate Limit
- **설명**: DNS TXT 레코드 조회 또는 `/.well-known/secureai.txt` HTTP GET으로 도메인 소유권 확인. Redis 분산 락 (동일 도메인 중복 실행 방지). 도메인당 1시간 3회 Rate Limit.
- **중요도**: 🔴 Critical
- **순서**: 2번째
- **완료 조건**: 소유권 미확인 도메인 DAST 요청 시 403, 동일 도메인 동시 실행 방지
- **하위 할일**:
  - [ ] `DomainVerificationService.java` DNS TXT + HTTP 파일 검증
  - [ ] `ScanTarget.java` 엔티티 + Flyway V011
  - [ ] `DistributedLockService.java` Redis SETNX 락
  - [ ] DAST Rate Limit Redis 카운터
  - [ ] 면책 동의 체크박스 API 처리

---

#### TASK-603 🔴 DAST 에이전트 (Python LangGraph)
- **설명**: `dast_node.py`에서 취약점별 공격 페이로드 생성 (Claude API) → Docker 샌드박스 실행 → 결과 판정. `ExploitJudgeAgent` 성공/실패 판단. 실패 시 페이로드 재생성 (최대 3회 루프). 실행 결과 SSE 실시간 로그 스트리밍.
- **중요도**: 🔴 Critical
- **순서**: 3번째
- **완료 조건**: SQL Injection 취약점에 대한 DAST 실행 → 익스플로잇 성공 판정 → SSE 로그 수신
- **하위 할일**:
  - [ ] `prompts/dast_payload.jinja2` 페이로드 생성 프롬프트
  - [ ] `agent/nodes/dast_node.py` 핵심 구현
  - [ ] `agent/nodes/notify_node.py` DAST 로그 SSE 이벤트
  - [ ] `agent/tools/docker_tool.py` Docker SDK Tool
  - [ ] `after_dast.py` 재시도 엣지 함수
  - [ ] `DastController.java` + `DastService.java` + `DastResultHandler.java`

---

#### TASK-604 🟠 DAST 터미널 UI & 결과 표시 (프론트엔드)
- **설명**: `DastTerminal.tsx` SSE 실시간 로그 (ANSI 컬러, 스크롤 고정). 취약점 상세 패널에 DAST 결과 섹션 추가 (익스플로잇 성공 뱃지, 페이로드 요약).
- **중요도**: 🟠 High
- **순서**: 4번째
- **하위 할일**:
  - [ ] `DastTerminal.tsx` 실시간 로그 터미널 컴포넌트
  - [ ] 취약점 상세 패널 DAST 결과 섹션
  - [ ] 익스플로잇 성공/실패 시각화

---

## Sprint 7 — 리포트 & 대시보드 & Android MVP
> 기간: Week 15-16 | 목표: PDF 리포트 생성, 대시보드 차트 완성, Android 앱 MVP

### EPIC-8: 리포트 & 대시보드

---

#### TASK-701 🔴 PDF 리포트 생성
- **설명**: `PdfGeneratorService.java` iText7으로 PDF 생성 (취약점 목록, DAST 결과, 패치 코드, OWASP 커버리지). 비동기 생성 → Redis 상태 업데이트 → 다운로드 토큰 발급 (UUID, 24h TTL). 공개 공유 링크 생성.
- **중요도**: 🔴 Critical
- **순서**: 1번째
- **완료 조건**: 리포트 생성 요청 → 30초 이내 PDF 다운로드 링크 반환
- **하위 할일**:
  - [ ] `Report.java` 엔티티 + Flyway V010
  - [ ] iText7 의존성 추가 + `PdfGeneratorService.java`
  - [ ] `ReportService.java` + `ReportController.java`
  - [ ] `PdfReportGenerator.java`, `JsonReportGenerator.java` (Template Method)
  - [ ] 다운로드 토큰 발급 + 만료 처리
  - [ ] 프론트엔드 리포트 생성·다운로드 UI

---

#### TASK-702 🟠 대시보드 차트 완성 (프론트엔드)
- **설명**: recharts 기반 차트 5종 구현 (SecurityScoreRing, SeverityBarChart, TrendLineChart, FileHeatmap, OwaspCoverageMatrix). `VulnTrendResponse` API 연동. 대시보드 페이지 완성.
- **중요도**: 🟠 High
- **순서**: 2번째
- **하위 할일**:
  - [ ] recharts 설치 + 5개 차트 컴포넌트
  - [ ] `VulnerabilityQueryService.java` 집계 쿼리 최적화
  - [ ] `GET /projects/{id}/vulnerabilities/trend` API
  - [ ] `dashboard/page.tsx` 완성

---

### EPIC-9: Android MVP

---

#### TASK-703 🔴 Android 프로젝트 초기화 & 인증
- **설명**: Kotlin + Jetpack Compose + Hilt 프로젝트 초기화. `NetworkModule.kt` OkHttp 인증서 피닝 설정. `EncryptedSharedPreferences` 토큰 저장. `AuthViewModel.kt` + 로그인·회원가입 화면.
- **중요도**: 🔴 Critical
- **순서**: 3번째 (병렬 가능)
- **완료 조건**: Android 앱에서 로그인 성공 → 프로젝트 목록 화면 진입
- **하위 할일**:
  - [ ] Android 프로젝트 생성 (minSdk 26, Compose)
  - [ ] Hilt 의존성 주입 설정
  - [ ] `NetworkModule.kt` 인증서 피닝 + Retrofit
  - [ ] `TokenStorage.kt` EncryptedSharedPreferences
  - [ ] `LoginScreen.kt`, `RegisterScreen.kt` Compose UI
  - [ ] `AuthViewModel.kt` + `AuthRepository.kt`

---

#### TASK-704 🟠 Android 대시보드 & 취약점 목록
- **설명**: `DashboardScreen.kt` 프로젝트 목록 + 보안 점수 카드. `VulnListScreen.kt` 필터 칩 + 스와이프. `VulnDetailScreen.kt` 취약점 상세. Room DB 로컬 캐시 (오프라인 지원).
- **중요도**: 🟠 High
- **순서**: 4번째
- **하위 할일**:
  - [ ] `DashboardScreen.kt`, `VulnListScreen.kt`, `VulnDetailScreen.kt`
  - [ ] `SecurityScoreGauge.kt` Canvas 원형 게이지
  - [ ] Room DB `ProjectEntity`, `VulnerabilityEntity` + DAO
  - [ ] `ProjectRepository.kt`, `VulnerabilityRepository.kt` (Remote + Room)

---

#### TASK-705 🟠 FCM Push & SSE (Android)
- **설명**: `google-services.json` 설정. `SecureAiFcmService.kt` 구현 (Push 수신 → 알림 표시 → 딥링크). `SseClient.kt` OkHttp SSE → Kotlin Flow 변환. Foreground: SSE, Background: FCM 이중 전략. Spring Boot `FcmPushService.java` 연동.
- **중요도**: 🟠 High
- **순서**: 5번째
- **하위 할일**:
  - [ ] Firebase 프로젝트 생성 + `google-services.json`
  - [ ] `FcmConfig.java` + `FcmPushService.java` (Spring Boot)
  - [ ] `SecureAiFcmService.kt` + 딥링크 처리
  - [ ] `SseClient.kt` Flow<SseEvent> 구현
  - [ ] `AnalysisViewModel.kt` FCM/SSE 이중 처리

---

## Sprint 8 — 안정화 & 성능 최적화 & 런칭 준비
> 기간: Week 17-18 | 목표: 서비스 품질 확보, 운영 준비

### EPIC-10: 안정화 & 최적화

---

#### TASK-801 🔴 스케줄러 전체 완성 & ShedLock 적용
- **설명**: 6개 스케줄 작업 완성 (NvdSync, ExpiredDataCleanup, MonitoringJob, SastUsageReset, PartitionMaintenance, SslCertCheck). ShedLock으로 다중 인스턴스 중복 실행 방지.
- **중요도**: 🔴 Critical
- **순서**: 1번째
- **하위 할일**:
  - [ ] ShedLock 의존성 + Redis Provider 설정
  - [ ] 6개 Job 전체 `@SchedulerLock` 적용
  - [ ] `ExpiredDataCleanupJob.java` 완성 (exploit 30일, 리포트 90일)
  - [ ] `PartitionMaintenanceJob.java` 자동 파티션 생성

---

#### TASK-802 🔴 Resilience4j 회로 차단기 전체 적용
- **설명**: AI Agent, GitHub API, NVD API 호출에 Circuit Breaker + Retry + Bulkhead 설정. 각 fallback 동작 정의. 회로 차단 시 사용자에게 명확한 에러 메시지 반환.
- **중요도**: 🔴 Critical
- **순서**: 2번째
- **하위 할일**:
  - [ ] `ResilienceConfig.java` 전체 Circuit Breaker 설정
  - [ ] AI Agent 호출 fallback (세션 failed 처리)
  - [ ] GitHub API fallback (캐시 응답)
  - [ ] NVD API fallback (캐시 CVE 데이터)

---

#### TASK-803 🟠 성능 테스트 & 캐시 최적화
- **설명**: 주요 API 응답 시간 측정. SAST 결과 Redis 캐시 효율 측정. DB 쿼리 N+1 문제 탐지 및 수정. GitHub API 레포 스캔 처리 시간 최적화.
- **중요도**: 🟠 High
- **순서**: 3번째
- **하위 할일**:
  - [ ] JMeter / k6로 주요 API 부하 테스트
  - [ ] Redis 캐시 히트율 측정 (목표 80% 이상)
  - [ ] N+1 쿼리 탐지 (`hibernate.show_sql=true` 검토)
  - [ ] GitHub 레포 스캔 병렬화 최적화

---

#### TASK-804 🟠 보안 강화 & 침투 테스트 준비
- **설명**: OWASP ZAP으로 SecureAI 자체 API 스캔. 모든 입력값 검증 재확인. SQL 쿼리 파라미터화 전수 검토. 보안 헤더 설정 (CSP, HSTS, X-Frame-Options).
- **중요도**: 🟠 High
- **순서**: 4번째
- **하위 할일**:
  - [ ] Nginx 보안 헤더 설정 완성
  - [ ] 모든 입력 DTO `@Valid` 어노테이션 전수 확인
  - [ ] OWASP ZAP으로 자체 스캔 실행
  - [ ] Android Network Security Config cleartext 차단 확인

---

#### TASK-805 🟡 Nginx API Gateway 완성 & SSL 설정
- **설명**: Nginx `nginx.conf` 완성 (라우팅, Rate Limit, 보안 헤더). Let's Encrypt SSL 인증서 설정. 모바일 인증서 피닝 헤더 추가.
- **중요도**: 🟡 Medium
- **순서**: 5번째
- **하위 할일**:
  - [ ] `nginx.conf` 전체 라우팅 설정
  - [ ] `limit_req_zone` API Rate Limiting
  - [ ] Let's Encrypt certbot 자동화
  - [ ] 보안 헤더 전체 설정

---

#### TASK-806 🟡 모니터링 기반 구축 (Prometheus + Grafana)
- **설명**: Spring Boot Actuator → Prometheus 스크레이핑. Grafana 대시보드 (분석 처리량, 에러율, AI Agent 응답시간, DAST 실행시간).
- **중요도**: 🟡 Medium
- **순서**: 6번째
- **하위 할일**:
  - [ ] `prometheus.yml` 스크레이핑 설정
  - [ ] Grafana 대시보드 JSON 작성
  - [ ] 핵심 비즈니스 메트릭 커스텀 등록 (분석 세션 수, 취약점 발견 수)

---

## Sprint 9 — VSCode Extension & 지속 모니터링 (Phase 3)
> 기간: Week 19-20 | 목표: VSCode Extension MVP, 24/7 모니터링 기초

### EPIC-11: Phase 3 기능

---

#### TASK-901 🟡 지속 모니터링 서비스 (Phase 3)
- **설명**: `MonitoringJob.java` 완성 (매시 Passive 스캔). SSL 인증서 만료 체크. 새 CVE 발표 시 영향 받는 프로젝트 자동 재점검. Slack/이메일 알림.
- **중요도**: 🟡 Medium
- **순서**: 1번째
- **하위 할일**:
  - [ ] `MonitoringJob.java` + `MonitoringService.java` 완성
  - [ ] `MonitoringResult.java` 엔티티 + 파티션 테이블
  - [ ] Slack Webhook 알림 연동
  - [ ] SSL 만료 30일 전 알림

---

#### TASK-902 🟢 VSCode Extension 기초 (Phase 3)
- **설명**: VSCode Extension API로 SecureAI 백엔드 API 재사용. 에디터에서 직접 SAST 분석 요청. 취약점 인라인 표시 (Diagnostic API). SecureAI 사이드바 패널.
- **중요도**: 🟢 Low
- **순서**: 2번째
- **하위 할일**:
  - [ ] `vsce` 프로젝트 초기화
  - [ ] Backend API 연동 (기존 REST API 재사용)
  - [ ] Diagnostic API로 취약점 인라인 표시
  - [ ] Extension Marketplace 배포 준비

---

#### TASK-903 🟢 Android 고도화 (Phase 3)
- **설명**: AI 채팅 화면, 리포트 뷰어 (PDF 공유), 알림 설정 화면 추가.
- **중요도**: 🟢 Low
- **순서**: 3번째
- **하위 할일**:
  - [ ] `ChatScreen.kt` 스트리밍 응답 + 코드 블록
  - [ ] PDF 리포트 공유 (FileProvider)
  - [ ] 알림 채널 세분화 (취약점 발견 / 분석 완료 / 모니터링 경고)

---

## 백로그 우선순위 요약

| Sprint | EPIC | Critical | High | Medium | Low |
|--------|------|----------|------|--------|-----|
| 0 | 기반 구축 | 4 | 2 | 1 | 0 |
| 1 | 인증·프로젝트 | 3 | 1 | 1 | 0 |
| 2 | AI Agent·MCP | 3 | 1 | 0 | 0 |
| 3 | SAST·GitHub 기초 | 2 | 2 | 0 | 0 |
| 4 | 웹 UI·SSE | 3 | 2 | 0 | 0 |
| 5 | GitHub Layer 2 완성 | 2 | 2 | 1 | 0 |
| 6 | DAST 엔진 | 3 | 1 | 0 | 0 |
| 7 | 리포트·대시보드·Android | 2 | 3 | 0 | 0 |
| 8 | 안정화 | 2 | 2 | 2 | 0 |
| 9 | Phase 3 | 0 | 0 | 1 | 2 |

---

*다음 파일: [07_GITHUB_PROJECTS.yml] — GitHub Projects 자동 등록 YAML*
