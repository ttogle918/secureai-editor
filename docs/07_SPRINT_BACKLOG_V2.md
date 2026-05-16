> 최신 버전: `docs/07_SPRINT_BACKLOG_V3.md` 참조

# SecureAI — 스프린트 & 백로그 v2.0
> 기준일: 2026-04-19 | 버전: v2.0  
> 변경사항 v1.0 → v2.0:  
>   ✅ 각 TASK에 **테스트 체크리스트** 추가 (수동 검증 + 자동 테스트)  
>   ✅ **체크포인트 관련 TASK 3개 추가** (TASK-206, TASK-207, TASK-406)  
>   ✅ **스프린트별 테스트 마일스톤** 섹션 추가

---

## 전체 로드맵 한눈에 보기

```
Sprint 0  (Week 01-02): 환경 세팅 & 인프라 기반
Sprint 1  (Week 03-04): 인증 & 프로젝트 관리
Sprint 2  (Week 05-06): AI Agent 기반 & MCP + 체크포인트 시스템 ⭐
Sprint 3  (Week 07-08): SAST 파이프라인 & GitHub 레포 스캔 (API 기반)
Sprint 4  (Week 09-10): 웹 에디터 UI & 실시간 SSE + 진행 체크리스트 UI ⭐
Sprint 5  (Week 11-12): GitHub Layer 2 완성
Sprint 6  (Week 13-14): DAST 엔진 & Docker 샌드박스
Sprint 7  (Week 15-16): 리포트 & 대시보드 & Android MVP
Sprint 8  (Week 17-18): 안정화 & 성능 최적화 & 런칭 준비
Sprint 9  (Week 19-20): VSCode Extension & 지속 모니터링
```

---

## 📘 테스트 표기 범례

각 TASK에는 다음 형식으로 테스트 체크리스트를 포함합니다:

- 🧪 **단위 테스트** — 각 개발자가 작성하는 자동화 테스트
- 🔬 **통합 테스트** — 여러 컴포넌트 조합 동작 검증
- ✅ **수동 검증** — 사람이 실제로 확인해야 하는 항목 (demo용)
- 🛡️ **보안 검증** — 보안 관점 확인 항목

---

## Sprint 0 — 환경 세팅 & 인프라 기반
> Week 01-02 | 목표: 전체 서비스가 docker compose up 하나로 실행

### EPIC-0: 프로젝트 기반 구축

---

#### TASK-001 🔴 모노레포 Git 초기화 및 디렉토리 구조 생성
- **중요도**: 🔴 Critical | **순서**: 1번째

**📋 하위 할일**
- [ ] GitHub 레포지토리 생성 (private 권장)
- [ ] 6개 서비스 디렉토리 골격 생성
- [ ] `.gitignore` 작성 (`.env`, `*.db`, `build/`, `__pycache__`, `node_modules/`, `*.keystore`, `google-services.json`)
- [ ] Branch protection rule 설정 (main: PR 필수, 리뷰 1명 이상)
- [ ] `Makefile` 단축 명령어 작성
- [ ] `README.md` 기본 작성

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: `git clone` 후 디렉토리 구조가 `06_REPOSITORY_STRUCTURE_V2.md`와 일치
- [ ] ✅ **수동 검증**: `make dev` 명령어가 오류 없이 인식됨 (실제 실행은 TASK-002 이후)
- [ ] ✅ **수동 검증**: main 브랜치에 직접 push 시도 → 차단되는지 확인
- [ ] 🛡️ **보안 검증**: `.env`, `*.keystore` 파일이 실수로 커밋되지 않는지 `.gitignore` 정상 동작 확인

---

#### TASK-002 🔴 Docker Compose 전체 서비스 구성
- **중요도**: 🔴 Critical | **순서**: 2번째

**📋 하위 할일**
- [ ] `docker-compose.yml` 전체 서비스 정의
- [ ] PostgreSQL 15 헬스체크, 볼륨, 초기화 스크립트
- [ ] Redis 7 `redis.conf` 설정
- [ ] 네트워크 3개 정의 (app-net, data-net, dast-isolated-net)
- [ ] `.env.example` 전체 환경변수 목록
- [ ] `docker-compose.prod.yml` 오버라이드 파일 초안

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: `docker compose up -d` 실행 → 모든 서비스 healthy 상태 확인
- [ ] ✅ **수동 검증**: `docker compose ps` → 6개 서비스 모두 Up (healthy)
- [ ] 🔬 **통합 테스트**: backend 컨테이너에서 `psql -h postgres` 접속 성공
- [ ] 🔬 **통합 테스트**: backend 컨테이너에서 `redis-cli -h redis PING` → PONG
- [ ] 🔬 **통합 테스트**: 네트워크 격리 확인 — frontend에서 postgres 직접 접근 불가
- [ ] ✅ **수동 검증**: `docker compose down -v` 후 재시작 시 데이터 초기화 확인
- [ ] 🛡️ **보안 검증**: Redis `requirepass` 설정되어 비밀번호 없이 접속 불가

---

#### TASK-003 🔴 Spring Boot 프로젝트 초기화
- **중요도**: 🔴 Critical | **순서**: 3번째

**📋 하위 할일**
- [ ] Spring Initializr 프로젝트 생성 (패키지: `io.secureai`)
- [ ] `build.gradle.kts` 의존성 정의
- [ ] `application.yml` (Virtual Thread 활성화 포함)
- [ ] Flyway V001~V005 마이그레이션 파일
- [ ] `AsyncConfig.java` Thread Pool 5종
- [ ] `GlobalExceptionHandler.java` + `ErrorCode.java`

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: `GET /actuator/health` → 200 OK, status=UP
- [ ] ✅ **수동 검증**: Flyway 실행 후 PostgreSQL `flyway_schema_history` 테이블에 V001~V005 기록
- [ ] ✅ **수동 검증**: `\dt` 명령으로 plans, users, refresh_tokens, projects, team_members 테이블 존재 확인
- [ ] 🧪 **단위 테스트**: `GlobalExceptionHandler`가 `BusinessException` → 표준 에러 응답 변환
- [ ] 🔬 **통합 테스트**: Thread Pool 5종 빈 주입 성공 (`@Autowired` 확인)
- [ ] ✅ **수동 검증**: 애플리케이션 로그에 "Using Virtual Threads" 메시지 확인

---

#### TASK-004 🔴 Python AI Agent 서비스 초기화
- **중요도**: 🔴 Critical | **순서**: 3번째 병렬

**📋 하위 할일**
- [ ] `requirements.txt` 의존성 고정
- [ ] `main.py` FastAPI 앱
- [ ] `config/settings.py` Pydantic Settings
- [ ] `api/middleware/internal_key_auth.py`
- [ ] `infrastructure/langsmith_tracer.py`
- [ ] Dockerfile

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: `GET /health` → 200 OK, `{"status": "healthy"}`
- [ ] ✅ **수동 검증**: LangSmith 대시보드에 "secureai-agent" 프로젝트 연결 확인
- [ ] 🔬 **통합 테스트**: 잘못된 `X-Internal-Key` 헤더 요청 시 → 401 반환
- [ ] 🛡️ **보안 검증**: `X-Internal-Key` 없이 `/agent/*` 접근 시 → 401
- [ ] 🧪 **단위 테스트**: Pydantic Settings가 필수 환경변수 누락 시 앱 시작 실패

---

#### TASK-005 🟠 MCP Server 초기화 (Node.js)
- **중요도**: 🟠 High | **순서**: 4번째

**📋 하위 할일**
- [ ] `package.json` + TypeScript 설정
- [ ] `src/index.ts` MCP Server (stdio 모드)
- [ ] Filesystem Tool 4개 구현
- [ ] `path_validator.ts` 경로 탈출 방지
- [ ] `file_filter.ts` 바이너리·대용량 필터

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: `path_validator.ts` — `../../etc/passwd` 같은 경로 차단
- [ ] 🧪 **단위 테스트**: `path_validator.ts` — rootPath 외부 접근 차단
- [ ] 🧪 **단위 테스트**: `file_filter.ts` — 10MB 초과 파일 제외
- [ ] 🧪 **단위 테스트**: `file_filter.ts` — `.exe`, `.jar` 등 바이너리 제외
- [ ] 🔬 **통합 테스트**: AI Agent에서 MCP `read_file` 호출 → 파일 내용 반환
- [ ] 🔬 **통합 테스트**: AI Agent에서 MCP `list_directory` 호출 → 디렉토리 트리 반환
- [ ] 🛡️ **보안 검증**: 심볼릭 링크 탈출 시도 차단
- [ ] 🛡️ **보안 검증**: `.env` 파일 읽기 시 마스킹 규칙 적용

---

#### TASK-006 🟠 Next.js 프론트엔드 초기화
- **중요도**: 🟠 High | **순서**: 3번째 병렬

**📋 하위 할일**
- [ ] Next.js 15 프로젝트 생성
- [ ] Tailwind 다크 테마 CSS 변수
- [ ] `lib/api/client.ts` Axios 기본 설정
- [ ] `store/useAuthStore.ts` 골격
- [ ] TypeScript 타입 파일

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: `http://localhost:3000` 접속 시 SecureAI 다크 테마 표시
- [ ] ✅ **수동 검증**: 브라우저 콘솔에 에러 없음
- [ ] ✅ **수동 검증**: `npm run build` 빌드 성공
- [ ] ✅ **수동 검증**: `tsc --noEmit` 타입 체크 통과
- [ ] 🧪 **단위 테스트**: Axios 인스턴스 baseURL 환경변수 바인딩 확인

---

#### TASK-007 🟡 GitHub Actions CI 파이프라인 기본 설정
- **중요도**: 🟡 Medium | **순서**: 5번째

**📋 하위 할일**
- [ ] `ci-backend.yml` (Gradle 빌드 + 단위 테스트)
- [ ] `ci-ai-agent.yml` (pytest)
- [ ] `ci-frontend.yml` (타입체크 + lint + 빌드)
- [ ] Branch Protection에 CI 통과 조건 연결

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: 일부러 실패 PR 생성 → CI 실패 → PR 머지 차단 확인
- [ ] ✅ **수동 검증**: CI 성공 PR → 머지 가능 확인
- [ ] ✅ **수동 검증**: CI 실행 시간 < 5분 (개발 생산성 저하 방지)

---

### 🎯 Sprint 0 완료 기준
- [ ] **전체 환경 구성 완료**: `git clone` → `cp .env.example .env` → `make dev` → 모든 서비스 healthy
- [ ] **문서화**: `README.md`에 빠른 시작 가이드, 아키텍처 다이어그램 포함
- [ ] **CI 동작**: PR 생성 시 3개 워크플로우 자동 실행
- [ ] **보안 기본선**: `.env`, `*.keystore` 등 민감 파일 Git 제외 확인

---

## Sprint 1 — 인증 & 프로젝트 관리
> Week 03-04 | 목표: 회원가입/로그인/프로젝트 CRUD API 완성

### EPIC-1: 사용자 인증

---

#### TASK-101 🔴 JWT 인증 시스템 구현
- **중요도**: 🔴 Critical | **순서**: 1번째

**📋 하위 할일**
- [ ] `User.java`, `Plan.java` 엔티티 + Flyway V002, V003
- [ ] `AuthService.java` (Bcrypt rounds=12, 5회 실패 잠금)
- [ ] `TokenService.java` JWT Rotation (Redis 토큰 해시 저장)
- [ ] `JwtAuthenticationFilter.java`
- [ ] `RefreshToken` 엔티티 + Repository
- [ ] `AuthController.java` 전체 엔드포인트
- [ ] `EmailService.java` @Async 이메일 발송

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: Bcrypt 해시 검증 (정상 비밀번호, 틀린 비밀번호)
- [ ] 🧪 **단위 테스트**: JWT 토큰 생성·검증·만료 처리
- [ ] 🧪 **단위 테스트**: Refresh Token Rotation — 구 토큰 재사용 시 전체 세션 무효화
- [ ] 🧪 **단위 테스트**: 로그인 실패 5회 누적 → 계정 잠금 15분
- [ ] 🔬 **통합 테스트**: 회원가입 → 이메일 인증 토큰 발송 → 인증 → 로그인 성공 전체 플로우
- [ ] 🔬 **통합 테스트**: Access Token 만료 후 → Refresh Token으로 갱신 → 새 Access Token 정상 발급
- [ ] 🔬 **통합 테스트**: 로그아웃 후 구 Refresh Token 재사용 시도 → 401 반환
- [ ] 🛡️ **보안 검증**: 이메일/username 동일 값 대소문자만 다르게 입력 시 중복 체크
- [ ] 🛡️ **보안 검증**: 로그인 실패 시 "이메일 없음"과 "비밀번호 틀림" 구분하지 않음 (타이밍 공격 방어)
- [ ] 🛡️ **보안 검증**: Refresh Token이 HttpOnly, Secure, SameSite=Strict 쿠키로 설정
- [ ] ✅ **수동 검증**: Postman으로 전체 인증 플로우 시연

---

#### TASK-102 🔴 GitHub OAuth 연동
- **중요도**: 🔴 Critical | **순서**: 2번째

**📋 하위 할일**
- [ ] GitHub OAuth App 등록
- [ ] `AesEncryptionConverter.java` AES-256-GCM
- [ ] `GitHubOAuthService.java`
- [ ] `AuthController` GitHub 콜백
- [ ] 프론트엔드 OAuth 버튼 + 콜백 페이지

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: AES-256-GCM 암호화 → 복호화 → 원본 일치
- [ ] 🧪 **단위 테스트**: 같은 평문이라도 IV 랜덤으로 매번 다른 암호문 생성
- [ ] 🔬 **통합 테스트**: DB에 저장된 `github_token` BYTEA 컬럼이 평문이 아닌지 확인
- [ ] 🔬 **통합 테스트**: GitHub OAuth 콜백 → 신규 사용자 생성 → 로그인 성공
- [ ] 🔬 **통합 테스트**: 기존 이메일 사용자가 GitHub OAuth 시도 → 계정 연결
- [ ] 🛡️ **보안 검증**: OAuth state 파라미터 검증 (CSRF 방어)
- [ ] 🛡️ **보안 검증**: 암호화 키 환경변수 누락 시 앱 시작 실패
- [ ] ✅ **수동 검증**: 브라우저에서 GitHub 로그인 → SecureAI 대시보드 진입 성공

---

#### TASK-103 🔴 플랜 체계 및 Rate Limit 구현
- **중요도**: 🔴 Critical | **순서**: 3번째

**📋 하위 할일**
- [ ] Flyway V021 plans 시드 데이터
- [ ] `PlanChecker.java`
- [ ] `RateLimitInterceptor.java`
- [ ] `AuditLogAspect.java`

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: Free 플랜 사용자 `canUseDast()` → false
- [ ] 🧪 **단위 테스트**: Pro 플랜 사용자 `canUseDast()` → true
- [ ] 🧪 **단위 테스트**: SAST 사용량 50회 도달 Free 사용자 `canStartAnalysis()` → false
- [ ] 🔬 **통합 테스트**: Free 플랜 DAST 엔드포인트 호출 → 403 반환
- [ ] 🔬 **통합 테스트**: 1분에 10회 초과 요청 시 429 반환 (Free 플랜)
- [ ] 🔬 **통합 테스트**: Rate Limit 응답 헤더 정상 반환 (`X-RateLimit-*`)
- [ ] 🔬 **통합 테스트**: AuditLog AOP 동작 — `@AuditLog` 메서드 실행 후 audit_logs 레코드 생성
- [ ] ✅ **수동 검증**: Redis CLI로 `secureai:ratelimit:{userId}:api` 카운터 증가 확인

---

#### TASK-104 🟠 프로젝트 CRUD API
- **중요도**: 🟠 High | **순서**: 4번째

**📋 하위 할일**
- [ ] `Project.java`, `TeamMember.java` + Flyway V004, V005
- [ ] `ProjectService.java` CRUD + 멤버 관리
- [ ] `ProjectController.java`
- [ ] `ProjectRepository` @EntityGraph
- [ ] 소프트 딜리트 + @Async 72시간 하드 딜리트
- [ ] `ProjectDeletedEvent.java`

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: 프로젝트 소유자가 아닌 사용자가 삭제 시도 → 403
- [ ] 🧪 **단위 테스트**: 플랜 멤버 수 초과 시 초대 실패
- [ ] 🔬 **통합 테스트**: 프로젝트 목록 조회 시 N+1 쿼리 발생하지 않음 (@EntityGraph)
- [ ] 🔬 **통합 테스트**: 프로젝트 삭제 → deleted_at 설정 (soft delete), 72시간 후 하드 삭제
- [ ] 🔬 **통합 테스트**: ProjectDeletedEvent 발행 → 관련 리스너 호출 확인
- [ ] ✅ **수동 검증**: 프로젝트 생성 → 팀 멤버 초대 → 목록 조회 API 전체 흐름

---

#### TASK-105 🟡 사용자 정보 API & 프론트엔드 인증 UI
- **중요도**: 🟡 Medium | **순서**: 5번째

**📋 하위 할일**
- [ ] `UserController.java`, `UserService.java`
- [ ] 프론트엔드 로그인/회원가입 페이지
- [ ] `useAuth.ts` 훅
- [ ] `useAuthStore.ts` 완성
- [ ] Axios 인터셉터 자동 토큰 갱신

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: 프론트엔드 로그인 폼 → 성공 시 대시보드 리다이렉트
- [ ] ✅ **수동 검증**: 비밀번호 틀림 → 인라인 에러 메시지 표시
- [ ] ✅ **수동 검증**: Access Token 만료 후 API 호출 → 자동 갱신 → 재시도 성공 (사용자 체감 무중단)
- [ ] ✅ **수동 검증**: 로그아웃 후 보호된 페이지 접근 → 로그인 페이지 리다이렉트
- [ ] 🛡️ **보안 검증**: Access Token이 localStorage에 저장되지 않음 (메모리만)
- [ ] 🛡️ **보안 검증**: XSS 테스트 — `<script>` 입력 시 이스케이프 처리

---

### 🎯 Sprint 1 완료 기준
- [ ] **인증 완성**: 회원가입 → 이메일 인증 → 로그인 → 토큰 갱신 → 로그아웃 전체 플로우 동작
- [ ] **GitHub 연동**: GitHub 계정으로 로그인 가능
- [ ] **플랜 제한 동작**: Free 플랜 사용자가 Pro 기능 호출 시 403
- [ ] **프로젝트 관리**: CRUD + 팀 멤버 초대 가능
- [ ] **보안 기본선**: JWT 만료, Rate Limit, 암호화 모두 동작

---

## Sprint 2 — AI Agent 기반 & MCP + 체크포인트 시스템 ⭐
> Week 05-06 | 목표: LangGraph 파이프라인 + PostgresSaver 중단·재개 기능 완성

### EPIC-3: AI 에이전트 기반 + 체크포인트

---

#### TASK-201 🔴 LangGraph 보안 감사 그래프 구축
- **중요도**: 🔴 Critical | **순서**: 1번째

**📋 하위 할일**
- [ ] `agent_state.py` TypedDict
- [ ] `security_audit_graph.py` 노드·엣지
- [ ] `graph_builder.py` 컴파일·캐싱
- [ ] 조건부 엣지 3개
- [ ] LangSmith 연결

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: 각 엣지 함수 — 조건별 다음 노드 반환 검증
- [ ] 🧪 **단위 테스트**: AgentState TypedDict 직렬화/역직렬화 정상 동작
- [ ] 🔬 **통합 테스트**: 빈 AgentState로 그래프 컴파일 성공
- [ ] 🔬 **통합 테스트**: 단순 dry-run 실행 → 노드 순서대로 실행 로그 확인
- [ ] ✅ **수동 검증**: LangSmith 대시보드에 실행 트레이스 표시

---

#### TASK-202 🔴 MCP Filesystem Tool → SAST 노드 연동
- **중요도**: 🔴 Critical | **순서**: 2번째

**📋 하위 할일**
- [ ] `mcp_filesystem_tools.py` Tool 3개
- [ ] `mcp_client.py` stdio 연결
- [ ] SAST 프롬프트 작성
- [ ] `claude_client.py` Anthropic SDK 래퍼
- [ ] `response_parser.py` JSON 복구
- [ ] `sast_node.py` + `cache_check_node.py`

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: Claude 응답 JSON 파싱 — 정상 JSON, 잘린 JSON 복구
- [ ] 🧪 **단위 테스트**: 파일 SHA-256 해시 계산 일관성
- [ ] 🔬 **통합 테스트**: 취약한 Java 파일 입력 → SAST 분석 → SQL Injection 취약점 JSON 반환
- [ ] 🔬 **통합 테스트**: 캐시 히트 시나리오 — 동일 파일 재분석 시 Claude 호출 없이 결과 반환
- [ ] 🔬 **통합 테스트**: MCP 서버 다운 시 오류 적절히 처리
- [ ] 🛡️ **보안 검증**: MCP 요청 경로가 프로젝트 루트 외부로 탈출 시도 시 차단
- [ ] ✅ **수동 검증**: 테스트 파일(`UserController.java` 취약 버전) 분석 → CWE-89, A03 분류 확인

---

#### TASK-203 🔴 Spring Boot ↔ AI Agent HTTP 연동 & SSE 브릿지
- **중요도**: 🔴 Critical | **순서**: 3번째

**📋 하위 할일**
- [ ] `AnalysisSession.java` + Flyway V006
- [ ] `AnalysisService.java`
- [ ] `AiAgentClient.java` Circuit Breaker
- [ ] `RedisPublisher`, `RedisSubscriber`
- [ ] `SseEmitterService.java`
- [ ] `AnalysisController.java`
- [ ] ai-agent `analyze.py` 라우트

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: Circuit Breaker 동작 — 연속 실패 시 OPEN 상태 전환
- [ ] 🧪 **단위 테스트**: Circuit Open 상태에서 fallback 메서드 호출 확인
- [ ] 🔬 **통합 테스트**: 분석 요청 → AI Agent 시작 → Redis 이벤트 발행 → SSE 수신 확인
- [ ] 🔬 **통합 테스트**: AI Agent 일부러 다운 → Circuit Breaker OPEN → 30초 후 HALF_OPEN → 복구 확인
- [ ] 🔬 **통합 테스트**: SSE 연결 → 여러 이벤트 순차 수신 → 연결 종료
- [ ] 🔬 **통합 테스트**: 두 사용자가 동일 프로젝트 SSE 구독 → 각자에게만 이벤트 전달 확인
- [ ] ✅ **수동 검증**: cURL로 SSE 스트림 구독 → 진행 이벤트 실시간 수신

---

#### TASK-204 🟠 취약점 저장 파이프라인 & Spring 이벤트
- **중요도**: 🟠 High | **순서**: 4번째

**📋 하위 할일**
- [ ] `Vulnerability.java` + Flyway V007
- [ ] `VulnerabilityService.java` + 지문 중복 체크
- [ ] `VulnerabilityFoundEvent.java` + Listener
- [ ] `VulnerabilityController.java`
- [ ] AI Agent `backend_api_client.py`

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: 동일 파일+라인+유형 → 지문 해시 동일
- [ ] 🧪 **단위 테스트**: 지문 중복 시 중복 저장 방지 동작
- [ ] 🔬 **통합 테스트**: 취약점 저장 → VulnerabilityFoundEvent 발행 → 세션 집계 컬럼 자동 업데이트
- [ ] 🔬 **통합 테스트**: callChain JSONB GIN 인덱스 사용 여부 EXPLAIN 확인
- [ ] 🔬 **통합 테스트**: 취약점 필터 API — severity + apiGroup AND 조건 정확히 동작
- [ ] ✅ **수동 검증**: 취약점 10개 동시 저장 시 집계 동기화 경쟁 조건 없음 (트리거 검증)

---

#### TASK-205 🔴 진행 로그 시스템 구축 ⭐ NEW
- **설명**: `analysis_progress_log` 테이블 생성. 각 파이프라인 단계에서 로그 기록 서비스 구현. AI Agent가 Backend API로 진행 단계 전송.
- **중요도**: 🔴 Critical
- **순서**: 5번째
- **완료 조건**: 분석 실행 시 `analysis_progress_log`에 단계별 레코드 쌓임

**📋 하위 할일**
- [ ] `AnalysisProgressLog.java` 엔티티 + Flyway V008
- [ ] `AnalysisProgressLogRepository.java`
- [ ] `ProgressLogService.java` (log, getBySessionId 메서드)
- [ ] `POST /api/v1/internal/progress-log` Backend 내부 엔드포인트
- [ ] AI Agent `progress_log_client.py` Backend 호출 래퍼
- [ ] 각 노드 시작/완료 시 `progress_log_client.log()` 호출

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: 동일 세션+단계+대상 중복 로그 저장 시 UNIQUE 제약 위반 처리
- [ ] 🔬 **통합 테스트**: 분석 실행 → progress_log에 단계별 레코드 시간순 저장 확인
- [ ] 🔬 **통합 테스트**: step_order 필드가 실행 순서와 일치
- [ ] 🔬 **통합 테스트**: duration_ms 계산 정확성 (completed_at - started_at)
- [ ] ✅ **수동 검증**: SQL 쿼리로 특정 세션의 단계별 소요 시간 조회 가능

---

#### TASK-206 🔴 LangGraph Checkpointer 통합 ⭐ NEW
- **설명**: `PostgresSaver`로 LangGraph State 자동 저장. thread_id = session_id. AI Agent 재시작 후에도 마지막 체크포인트부터 재개 가능.
- **중요도**: 🔴 Critical
- **순서**: 6번째
- **완료 조건**: 분석 중단 시 `agent_checkpoints` 테이블에 State 저장, 재개 시 정확히 해당 지점부터 재실행

**📋 하위 할일**
- [ ] `langgraph-checkpoint-postgres` 의존성 추가
- [ ] `graph_builder.py` PostgresSaver 싱글턴 설정
- [ ] `graph.compile(checkpointer=...)` 연결
- [ ] 분석 실행 시 `config={"configurable": {"thread_id": session_id}}` 전달
- [ ] `POST /agent/resume/{session_id}` 재개 엔드포인트 (AI Agent)
- [ ] 재개 시 `graph.astream(None, config)` 호출로 마지막 체크포인트부터 실행

**🧪 테스트 체크리스트**
- [ ] 🔬 **통합 테스트**: 분석 중간에 AI Agent 프로세스 kill → 재시작 → `agent_checkpoints`에 State 보존 확인
- [ ] 🔬 **통합 테스트**: 재개 API 호출 → 마지막 완료 노드 다음부터 실행
- [ ] 🔬 **통합 테스트**: 완료 후 24시간 경과 시뮬레이션 → ExpiredDataCleanupJob → 체크포인트 삭제
- [ ] 🔬 **통합 테스트**: thread_id(session_id) 격리 — 두 세션의 체크포인트 섞이지 않음
- [ ] ✅ **수동 검증**: 10개 파일 분석 중 5번째 파일에서 AI Agent 컨테이너 재시작 → 재개 시 6번째 파일부터 처리
- [ ] 🛡️ **보안 검증**: 체크포인트에 포함된 코드 스니펫이 DB에 암호화 저장되는지 확인 (AES 컨버터 적용)

---

#### TASK-207 🔴 중단 감지 및 재개 API ⭐ NEW
- **설명**: Backend에서 AI Agent 장애 감지 → 세션 status='interrupted' 자동 전환. 사용자가 재개 버튼 클릭 시 AI Agent resume 호출.
- **중요도**: 🔴 Critical
- **순서**: 7번째
- **완료 조건**: 분석 중 장애 발생 시 사용자가 재개 버튼으로 복구 가능

**📋 하위 할일**
- [ ] `POST /api/v1/analysis/sessions/{id}/resume` Backend 엔드포인트
- [ ] `AnalysisService.resumeSession()` 구현
- [ ] AI Agent Circuit Breaker OPEN 상태 감지 → 세션 `status='interrupted'` 업데이트 스케줄러 (또는 이벤트)
- [ ] 세션 취소 엔드포인트 `POST /sessions/{id}/cancel` (AI Agent graph 중단 시그널)
- [ ] `ErrorCode.SESSION_NOT_RESUMABLE` 추가
- [ ] 재개 시 progress_log에 'session_resumed' 기록

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: 이미 완료된 세션 재개 시도 → `SESSION_NOT_RESUMABLE` 예외
- [ ] 🧪 **단위 테스트**: 다른 사용자의 세션 재개 시도 → 403
- [ ] 🔬 **통합 테스트**: AI Agent 컨테이너 강제 종료 → 30초 내 세션 status='interrupted' 전환
- [ ] 🔬 **통합 테스트**: 중단 후 재개 → 마지막 체크포인트부터 재실행 → 최종 완료
- [ ] 🔬 **통합 테스트**: 중단된 세션 7일 경과 → ExpiredDataCleanupJob → 체크포인트 삭제
- [ ] ✅ **수동 검증**: 중단 시나리오 시연 — 10개 파일 분석 중간 중단 → 재개 → 완료

---

### 🎯 Sprint 2 완료 기준
- [ ] **AI 분석 동작**: 단일 파일 입력 → SAST → 취약점 JSON 반환
- [ ] **SSE 실시간**: 클라이언트가 진행률 이벤트 실시간 수신
- [ ] **Circuit Breaker**: AI Agent 장애 시 서비스 전체 다운 없음
- [ ] **중단 재개 ⭐**: 분석 중단 → `agent_checkpoints` 보존 → 재개 API로 복구
- [ ] **진행 로그 ⭐**: 모든 단계가 `analysis_progress_log`에 기록

---

## Sprint 3 — SAST 파이프라인 완성 & GitHub 레포 스캔 (Layer 1+2 기초)
> Week 07-08 | 목표: 전체 프로젝트 SAST + GitHub API 기반 스캔

### EPIC-4: SAST 파이프라인 완성

---

#### TASK-301 🔴 파일 배치 SAST — 전체 프로젝트 스캔
- **중요도**: 🔴 Critical | **순서**: 1번째

**📋 하위 할일**
- [ ] `sast_node.py` 파일 배치 처리 (asyncio.gather)
- [ ] `cache_check_node.py` 파일별 HIT/MISS 분기
- [ ] `code_chunker.py` 컨텍스트 윈도우 분할
- [ ] 진행률 계산 + SSE 이벤트 발행
- [ ] `VulnerabilityQueryService.java` CQRS Read

**🧪 테스트 체크리스트**
- [x] 🧪 **단위 테스트**: CodeChunker — 10000 line 파일 분할 정확성
- [ ] 🔬 **통합 테스트**: 10개 파일 프로젝트 전체 스캔 → 모든 파일의 취약점 수집  *(이월: Sprint 4 UI 검증 시)*
- [x] 🔬 **통합 테스트**: 5개 파일 캐시 HIT, 5개 MISS 혼재 시나리오 → Claude 호출 5회만 발생
- [x] 🔬 **통합 테스트**: 진행률 SSE 이벤트 — 파일 수 기반 계산 정확성 (5/10 = 50%)
- [x] 🔬 **통합 테스트**: 병렬 처리 스루풋 — 10개 파일 순차 vs 병렬 처리 시간 비교
- [ ] ✅ **수동 검증**: 100 라인·500 라인·2000 라인 파일 각 1개씩 분석 성공  *(이월)*

---

#### TASK-302 🔴 CWE/OWASP 분류 자동 매핑 & API 호출 체인 구성
- **중요도**: 🔴 Critical | **순서**: 2번째

**📋 하위 할일**
- [ ] `vuln_classifier.py`
- [ ] callChain JSON 구성 알고리즘
- [ ] CWE/OWASP 매핑 상수 테이블

**🧪 테스트 체크리스트**
- [x] 🧪 **단위 테스트**: SQL Injection → CWE-89, OWASP A03:2021 매핑
- [x] 🧪 **단위 테스트**: XSS → CWE-79, OWASP A03:2021 매핑
- [x] 🧪 **단위 테스트**: IDOR → CWE-284, OWASP A01:2021 매핑
- [x] 🧪 **단위 테스트**: callChain 구성 — Frontend → Controller → Service → Repository 순서
- [x] 🔬 **통합 테스트**: 실제 분석 결과에서 callChain JSONB 저장 → GIN 인덱스로 특정 노드 검색

---

#### TASK-303 🔴 GitHub 레포지토리 API 기반 코드 스캔 (Layer 2 — 1단계)
- **중요도**: 🔴 Critical | **순서**: 3번째

**📋 하위 할일**
- [ ] `mcp-server/src/tools/github/get_repo_contents.ts`
- [ ] `mcp-server/src/tools/github/list_directory.ts`
- [ ] `ai-agent/agent/tools/mcp_github_tools.py` 래퍼
- [ ] `GitHubRestClient.java`
- [ ] `GitHubApiService.java` 토큰 복호화 + 호출
- [ ] AI Agent `source_type=github` 분기
- [ ] GitHub API rate limit 처리 (429 → exponential backoff)
- [ ] 바이너리·대용량 제외 필터

**🧪 테스트 체크리스트**
- [x] 🧪 **단위 테스트**: GitHub Token 복호화 → API 헤더에 정상 주입
- [x] 🧪 **단위 테스트**: Rate limit 429 응답 → exponential backoff (1s, 2s, 4s) 동작
- [ ] 🔬 **통합 테스트**: **GitHub API 연동 완료 점검** — GitHub 토큰으로 실제 저장소 파일 목록 조회 성공  *(이월: Sprint 5)*
- [ ] 🔬 **통합 테스트**: **GitHub Repository 디렉토리 구조 정리 완료** — 파일 트리 JSON 반환 확인  *(이월: Sprint 5)*
- [ ] 🔬 **통합 테스트**: **API 1점검 완료** — `get_repo_contents` Tool로 단일 파일 내용 조회 성공  *(이월: Sprint 5)*
- [ ] 🔬 **통합 테스트**: 공개 GitHub 레포 → SAST 분석 전체 플로우 성공  *(이월: Sprint 5)*
- [ ] 🔬 **통합 테스트**: 비공개 GitHub 레포 → 유효한 토큰으로 분석 성공  *(이월: Sprint 5)*
- [ ] 🔬 **통합 테스트**: 비공개 레포 무효 토큰 → 403 적절히 처리  *(이월: Sprint 5)*
- [ ] 🔬 **통합 테스트**: 10MB 초과 파일 자동 스킵 확인  *(이월: Sprint 5)*
- [ ] 🔬 **통합 테스트**: 바이너리 파일 (.jar, .exe) 자동 제외  *(이월: Sprint 5)*
- [ ] ✅ **수동 검증**: GitHub URL 입력 → 전체 분석 → 취약점 목록 표시  *(이월)*

---

#### TASK-304 🟠 패치 에이전트 구현
- **중요도**: 🟠 High | **순서**: 4번째

**📋 하위 할일**
- [ ] `patch_generation.jinja2` 프롬프트
- [ ] `patch_node.py` + `diff_generator.py`
- [ ] `PatchSuggestion.java` + Flyway V011
- [ ] `PatchService.java` + `PatchController.java`
- [ ] Redis 패치 템플릿 캐시

**🧪 테스트 체크리스트**
- [x] 🧪 **단위 테스트**: unified diff 형식 생성 정확성
- [x] 🔬 **통합 테스트**: SQL Injection → PreparedStatement 패치 코드 생성 확인  *(Claude mock)*
- [x] 🔬 **통합 테스트**: 동일 취약점 유형 두 번째 요청 시 패치 템플릿 캐시 HIT
- [x] 🔬 **통합 테스트**: 패치 적용 처리 → is_applied=true, applied_at, applied_by 업데이트
- [ ] ✅ **수동 검증**: 생성된 패치 코드가 실제 컴파일·실행 가능한지 확인  *(이월)*

---

#### TASK-305 🟠 CVE 기초 데이터베이스 & SBOM 파서 인터페이스
- **중요도**: 🟠 High | **순서**: 4번째 병렬

**📋 하위 할일**
- [ ] `CveData.java`, `DependencyComponent.java` + Flyway V012~V014
- [ ] `NvdApiClient.java` + `NvdSyncJob.java`
- [ ] SBOM 파서 4종 (Maven, npm, pip, Cargo)
- [ ] `SbomService.java`

**🧪 테스트 체크리스트**
- [x] 🧪 **단위 테스트**: MavenPomParser — sample pom.xml → 의존성 목록 추출
- [x] 🧪 **단위 테스트**: NpmPackageParser — package.json → dependencies + devDependencies 구분
- [x] 🧪 **단위 테스트**: PipRequirementsParser — `==`, `>=`, `~=` 버전 스펙 파싱
- [ ] 🔬 **통합 테스트**: NvdSyncJob 실행 → Redis 캐시 채워짐 → 다음 조회 시 캐시 HIT  *(이월: Sprint 6 — NVD 실호출 운영 검증 시)*
- [x] 🔬 **통합 테스트**: 의존성 파일 입력 → CVE 매칭 → vulnerability_components 저장
- [ ] ✅ **수동 검증**: 실제 Spring Boot 프로젝트의 pom.xml 분석 → 50개 이상 컴포넌트 추출  *(이월)*

---

#### TASK-306 🔴 보안 지식 베이스(SKB) 구축 및 초기 동기화 ⭐ NEW
- **설명**: `docs/security/` 하위의 전문가 노트를 DB로 이전하고, RAG의 기반이 되는 동적 보안 지식 저장소를 구축함.
- **중요도**: 🔴 Critical
- **순서**: 5번째
- **완료 조건**: MD 파일 수정 후 동기화 스크립트 실행 시 DB 테이블(`security_guidelines`)에 내용이 최신화됨.

**📋 하위 할일**
- [ ] `security_guidelines` 테이블 생성 (Flyway V015)
- [ ] MD 파일 파싱 및 DB Upsert 스크립트 작성 (`sync_guidelines.py`)
- [ ] AI Engine에서 DB 지침을 조회하는 기초 로직 마련
- [ ] 초기 데이터 동기화 실행

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: MD 파일 파서 — 제목, 본문, 메타데이터 추출 정확성
- [ ] 🔬 **통합 테스트**: 스크립트 실행 → DB 레코드 생성 및 업데이트(Upsert) 확인
- [ ] ✅ **수동 검증**: SQL로 특정 취약점 유형(SQLi 등)의 지침 조회 성공

---

### 🎯 Sprint 3 완료 기준
- [ ] **로컬 프로젝트 SAST**: 10개 이상 파일 프로젝트 전체 분석 성공  *(이월: Sprint 4 UI)*
- [ ] **GitHub 레포 API 스캔**: 공개/비공개 GitHub 레포 SAST 분석 성공 ⭐  *(이월: Sprint 5)*
- [x] **패치 자동 생성**: 취약점별 패치 코드 생성 및 Redis 캐시 활용
- [ ] **CVE 데이터**: NVD에서 최소 10,000건 이상 CVE 동기화  *(이월: Sprint 6 — 실 NVD 동기화)*
- [x] **테스트 커버리지**: 단위 테스트 커버리지 60% 이상  *(pytest 147/147 통과)*

---

## Sprint 4 — 웹 에디터 UI & 실시간 SSE + 진행 체크리스트 ⭐
> Week 09-10 | 목표: Monaco 에디터 + 실시간 표시 + 체크리스트 MD UI

### EPIC-5: 웹 프론트엔드 핵심 UI

---

#### TASK-401 🔴 Monaco 에디터 통합 & 취약점 인라인 하이라이팅
- **중요도**: 🔴 Critical | **순서**: 1번째

**📋 하위 할일**
- [ ] `@monaco-editor/react` 설치 + dynamic import
- [ ] `CodeEditor.tsx` 래퍼
- [ ] `themes.ts` SecureAI Dark
- [ ] `decorations.ts` 전체 정의
- [ ] `useMonaco.ts`
- [ ] `DiffViewer.tsx`

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: 취약점 데이터 주입 시 해당 라인에 빨간 배경+글로우 효과 표시
- [ ] ✅ **수동 검증**: 라인 호버 시 취약점 툴팁 (CWE, 설명) 표시
- [ ] ✅ **수동 검증**: 파일 전환 시 이전 파일 데코레이션 초기화 (잔재 없음)
- [ ] ✅ **수동 검증**: DiffViewer — before/after 좌우 분할 정상 표시
- [ ] ✅ **수동 검증**: SSR 방지 — 페이지 첫 로드 시 Monaco 에러 없음

---

#### TASK-402 🔴 SSE 실시간 구독 & 취약점 실시간 표시
- **중요도**: 🔴 Critical | **순서**: 2번째

**📋 하위 할일**
- [ ] `useSse.ts` + 자동 재연결
- [ ] `useSecureStore.ts` `addVuln()`
- [ ] `SseIndicator.tsx`
- [ ] `Toast.tsx` + `useToast.ts`
- [ ] `AnalysisLoadingOverlay.tsx`

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: `useSse.ts` — 연결 끊김 시 exponential backoff 재연결
- [ ] ✅ **수동 검증**: 분석 시작 → 취약점이 실시간으로 에디터에 하나씩 추가됨
- [ ] ✅ **수동 검증**: 네트워크 끊김 시뮬레이션 → 자동 재연결 → 이벤트 계속 수신
- [ ] ✅ **수동 검증**: Toast 알림 — 새 Critical 취약점 발견 시 즉시 팝업
- [ ] ✅ **수동 검증**: SseIndicator 점멸 효과 — 연결 상태 시각화
- [ ] 🛡️ **보안 검증**: 타 사용자 세션 SSE URL 접근 시 권한 거부

---

#### TASK-403 🔴 VSCode 스타일 에디터 레이아웃 & 파일 트리
- **중요도**: 🔴 Critical | **순서**: 2번째 병렬

**📋 하위 할일**
- [ ] `EditorLayout.tsx` 3패널
- [ ] `useResizablePanel.ts` / `ResizeHandle.tsx`
- [ ] `FileTree.tsx` + 취약점 도트
- [ ] `EditorTabs.tsx`
- [ ] `useEditorStore.ts`

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: 사이드바 드래그 → 160px ~ 400px 범위 내 리사이즈
- [ ] ✅ **수동 검증**: 우측 패널 드래그 → 280px ~ 640px 범위 내 리사이즈
- [ ] ✅ **수동 검증**: 파일 트리에서 취약점 파일 → 빨간/주황 도트 표시
- [ ] ✅ **수동 검증**: 파일 클릭 → 탭 생성 + 에디터 내용 로드
- [ ] ✅ **수동 검증**: 여러 탭 열기 → 탭 전환 시 에디터 상태 유지
- [ ] ✅ **수동 검증**: 패널 크기 새로고침 후 유지 (localStorage 아님, Zustand persist)

---

#### TASK-404 🟠 취약점 상세 패널 & AI 채팅 패널
- **중요도**: 🟠 High | **순서**: 3번째

**📋 하위 할일**
- [ ] `VulnDetailPanel.tsx` 토글 UI
- [ ] `CallChainView.tsx` + 글로우
- [ ] `ChatPanel.tsx` 스트리밍
- [ ] `FilterBar.tsx` API 그룹 필터
- [ ] `useVulnFilter.ts` AND 조건

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: `useVulnFilter` AND 조건 — severity + apiGroup 정확성
- [ ] ✅ **수동 검증**: 취약점 항목 클릭 → 토글 펼침/접힘 애니메이션
- [ ] ✅ **수동 검증**: CallChainView 노드 클릭 → 해당 파일 해당 라인으로 에디터 점프
- [ ] ✅ **수동 검증**: 취약 노드 빨간 글로우 효과 표시
- [ ] ✅ **수동 검증**: API 그룹 필터 + 심각도 필터 동시 적용 → AND 조건 정확
- [ ] ✅ **수동 검증**: "기타 (API 없음)" 필터 → API 무관 파일 취약점만 표시

---

#### TASK-405 🟠 AI 채팅 API 및 UI
- **중요도**: 🟠 High | **순서**: 4번째

**📋 하위 할일**
- [ ] `chat_system.txt` 프롬프트
- [ ] `ai-agent/api/routes/chat.py` + 이력 관리
- [ ] `ChatService.java` + `ChatController.java`
- [ ] 프론트엔드 스트리밍 텍스트 표시

**🧪 테스트 체크리스트**
- [ ] 🔬 **통합 테스트**: 채팅 메시지 전송 → SSE 스트리밍 응답 청크 수신
- [ ] 🔬 **통합 테스트**: 한국어 질문 → 한국어 응답
- [ ] 🔬 **통합 테스트**: 영어 질문 → 영어 응답 (자동 언어 감지)
- [ ] 🔬 **통합 테스트**: 10번 대화 후 11번째 대화 → 이전 이력 10턴까지만 컨텍스트에 포함
- [ ] ✅ **수동 검증**: "SQL Injection 어떻게 고쳐?" 질문 → 패치 코드 포함 응답
- [ ] ✅ **수동 검증**: 응답이 실시간으로 타이핑되듯 표시

---

#### TASK-406 🔴 진행 체크리스트 MD 자동 생성 & UI ⭐ NEW
- **설명**: Backend `ChecklistMarkdownService` 구현. 실시간으로 analysis_progress_log 기반 MD 생성. 프론트엔드에서 SSE 이벤트마다 MD 재조회·렌더링. 중단 시 "재개하기" 버튼 표시.
- **중요도**: 🔴 Critical
- **순서**: 5번째
- **완료 조건**: 분석 중 체크리스트 UI가 실시간으로 체크박스 상태를 갱신

**📋 하위 할일**
- [ ] `ChecklistMarkdownService.java` 구현
- [ ] `GET /api/v1/analysis/sessions/{id}/checklist` 엔드포인트 (text/markdown)
- [ ] 프론트엔드 `ProgressChecklist.tsx` 컴포넌트
- [ ] `marked` 라이브러리로 MD → HTML 렌더링
- [ ] SSE 이벤트(progress, vuln_found, completed)마다 체크리스트 재조회
- [ ] 중단 상태 시 "재개하기" 버튼 표시 (POST /resume 호출)
- [ ] 체크리스트 MD 다운로드 버튼 (분석 완료 후)

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: `ChecklistMarkdownService` — 진행 로그 0건일 때 모든 체크박스 unchecked
- [ ] 🧪 **단위 테스트**: 파일 5/10 완료 시 "5/10" 표기 정확성
- [ ] 🧪 **단위 테스트**: 세션 status별 출력 차이 (pending/running/completed/interrupted)
- [ ] 🔬 **통합 테스트**: 분석 진행 중 `/checklist` 호출 → 현재 상태 MD 반환
- [ ] 🔬 **통합 테스트**: 분석 완료 후 `/checklist` 호출 → 모든 체크박스 checked
- [ ] 🔬 **통합 테스트**: 중단된 세션 `/checklist` → "분석이 중단되었습니다" 섹션 + 재개 링크 포함
- [ ] ✅ **수동 검증**: 실제 분석 시연 — 체크리스트 UI가 5초 간격으로 자동 업데이트
- [ ] ✅ **수동 검증**: 체크리스트 MD 다운로드 → 에디터로 열어 구조 확인
- [ ] ✅ **수동 검증**: 중단 시나리오 — 재개 버튼 클릭 → 분석 재개 → 체크리스트 계속 진행

---

#### TASK-407 🟠 로컬 폴더 열기 (showDirectoryPicker) ⭐ NEW
- **설명**: 브라우저 `showDirectoryPicker()` API로 OS 폴더 선택 → 파일 내용을 백엔드에 업로드 → Redis에 임시 저장(24h) → 에디터/파일 트리에 실제 코드 표시. 배포 후 모든 사용자가 사용 가능.
- **중요도**: 🟠 High
- **순서**: 6번째 (Sprint 4 마지막)
- **완료 조건**: "폴더 열기" 클릭 → OS 폴더 선택창 → 에디터에 실제 파일 표시

**📋 하위 할일**
- [ ] `WorkspaceController.java` — `POST /api/workspace`, `GET /api/workspace/{id}/tree`, `GET /api/workspace/{id}/file`
- [ ] `WorkspaceService.java` — Redis 저장/조회 (TTL 24h), 파일 트리 JSON 생성
- [ ] `WorkspaceRequest.java` / `WorkspaceResponse.java` DTO
- [ ] Security config에 `/api/workspace/**` 인증 예외 또는 허용 추가
- [ ] 프론트엔드 `useWorkspace.ts` — `showDirectoryPicker()` + 재귀 파일 읽기 + 업로드
- [ ] `FileTree.tsx` — workspace 로드 시 실제 파일 트리로 교체
- [ ] `EditorLayout.tsx` — "폴더 열기" 버튼 추가, 파일 내용 API 연동

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: "폴더 열기" → OS 폴더 선택창 → 파일 트리에 실제 구조 표시
- [ ] ✅ **수동 검증**: 파일 트리에서 파일 클릭 → 에디터에 실제 코드 로드
- [ ] ✅ **수동 검증**: node_modules, .git 등 제외 확인
- [ ] ✅ **수동 검증**: 새로고침 후 workspaceId로 파일 유지 (24h TTL)
- [ ] 🛡️ **보안 검증**: 500KB 초과 파일 자동 제외, 바이너리 파일 제외

---

#### TASK-408 🟠 크레딧 시스템 & BYOK & 모델 선택 ⭐ NEW
- **설명**: 토큰 기반 크레딧 과금 시스템 구현. Anthropic API 키 직접 연결(BYOK) 시 크레딧 소모 없이 무제한 분석 지원. 사용자가 분석 모델(Haiku/Sonnet/Opus)을 선택할 수 있도록 전 스택(Backend → AI Engine → Frontend) 연동.
- **중요도**: 🟠 High
- **순서**: 7번째 (Sprint 4 최종)
- **완료 조건**: 설정 페이지에서 BYOK 키 저장 + 모델 선택 → 실제 분석 시 해당 설정 적용

**📋 하위 할일**
- [x] `V016__add_credit_and_byok.sql` — `credit_balance`, `anthropic_api_key`(BYTEA), `preferred_model` 컬럼 + `credit_transactions` 테이블
- [x] `ModelConstants.java` — 모델 ID 상수 + 파일당 크레딧 비용 맵 (Haiku 1, Sonnet 5, Opus 20)
- [x] `CreditTransaction.java` 엔티티 + `CreditTransactionRepository.java`
- [x] `CreditService.java` — `deductForScan()`, `grantMonthly()`, `grantSignupBonus()`, `hasEnough()`
- [x] `User.java` / `Plan.java` 필드 추가 (`creditBalance`, `anthropicApiKey`, `preferredModel`, `monthlyCredits`)
- [x] `SaveApiKeyRequest.java` / `UpdateSettingsRequest.java` / `CreditSummaryResponse.java` DTO
- [x] `UserService.java` — `getCredits()`, `saveApiKey()`, `removeApiKey()`, `updateSettings()`, `getAnalysisSettings()`
- [x] `UserController.java` — `GET /me/credits`, `PUT /me/settings`, `PUT /me/api-key`, `DELETE /me/api-key`
- [x] `UserMeResponse.java` — `CreditInfo` 내부 클래스 추가 (`balance`, `hasByok`, `preferredModel`)
- [x] `AiAgentClient.java` / `DefaultAiAgentClient.java` — `preferredModel`, `userApiKey` 파라미터 추가
- [x] `AnalysisService.java` — 분석 시작 전 `getAnalysisSettings()` 조회 후 AI 엔진에 전달
- [x] `agent_state.py` — `preferred_model`, `user_api_key` 필드 추가
- [x] `claude_client.py` — BYOK 키 제공 시 1회용 `AsyncAnthropic` 클라이언트 생성, 모델 오버라이드
- [x] `sast_node.py` — state에서 모델/키 읽어 `_analyze_chunks()` → `analyze_for_sast()` 에 전달
- [x] `chat_client.py` — `stream_chat()` 모델·키 오버라이드 지원
- [x] `analyze.py` / `chat.py` — `AnalyzeRequest` / `ChatRequest` 에 `preferred_model`, `user_api_key` 추가
- [x] `useAuth.ts` — `UserMeData` 인터페이스에 `credits` 필드 추가
- [x] `AppHeader.tsx` — 설정 아이콘(Settings) 추가 → `/settings` 링크
- [x] `middleware.ts` — `/settings/:path*` 보호 경로 추가
- [x] `app/settings/page.tsx` — 크레딧 잔액 카드, BYOK API 키 입력(AES 암호화 안내), 모델 선택 UI (파일당 크레딧 비용 표시)
- [x] `app/page.tsx` — 랜딩 가격 섹션 (Free/Pro/Team 플랜 카드 + BYOK 안내)

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: 설정 페이지 진입 → 크레딧 잔액·BYOK 상태·현재 모델 표시 정상
- [ ] ✅ **수동 검증**: `sk-ant-` 형식 API 키 저장 → "API 키가 연결되어 있습니다" 상태로 전환
- [ ] ✅ **수동 검증**: BYOK 제거 → 상태 초기화 정상
- [ ] ✅ **수동 검증**: 모델 선택(Sonnet) 저장 → 다음 분석 시 해당 모델로 요청 전송
- [ ] ✅ **수동 검증**: 랜딩 가격 섹션 — Free/Pro/Team 플랜 카드 레이아웃 정상
- [ ] 🛡️ **보안 검증**: `anthropic_api_key` 컬럼 — DB에 AES-256-GCM 암호화 값 저장 확인
- [ ] 🛡️ **보안 검증**: API 키 값 서버 로그에 평문 출력 없음 (user_api_key 로그 금지 규칙)

---

### 🎯 Sprint 4 완료 기준
- [ ] **Monaco 에디터 동작**: 취약점 인라인 하이라이팅 완성
- [ ] **SSE 실시간**: 취약점 실시간 표시 + 자동 재연결
- [ ] **3패널 레이아웃**: 드래그 리사이즈 완전 동작
- [ ] **AI 채팅**: 스트리밍 응답 UI 완성
- [ ] **체크리스트 UI ⭐**: 실시간 진행 상태 + 중단 시 재개 버튼
- [ ] **크레딧·BYOK·모델 선택 ⭐**: 설정 페이지 + 랜딩 가격 섹션 완성

---

## Sprint 5 — GitHub Layer 2 완성
> Week 11-12 | 목표: GitHub 레포 전체 완성

### EPIC-6: GitHub 레포지토리 전체 스캔

---

#### TASK-501 🔴 GitHub 커밋 히스토리 시크릿 스캔
- **중요도**: 🔴 Critical | **순서**: 1번째

**📋 하위 할일**
- [ ] `list_commits.ts`, `get_commit_diff.ts` MCP Tool
- [ ] `mcp_github_tools.py` 커밋 Tool 래퍼
- [ ] 시크릿 탐지 프롬프트 + 전용 노드
- [ ] `CommitHistoryScanner.java` @Async 페이지네이션
- [ ] 병렬 처리 최적화

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: 시크릿 패턴 정규식 정확성 (AWS Key, GitHub Token, JWT 등)
- [ ] 🔬 **통합 테스트**: 일부러 시크릿 커밋 후 삭제한 테스트 레포 → 삭제된 시크릿 탐지
- [ ] 🔬 **통합 테스트**: 100개 이상 커밋 레포 → 페이지네이션 처리 완료
- [ ] 🔬 **통합 테스트**: GitHub API rate limit 도달 시 backoff 동작
- [ ] ✅ **수동 검증**: 실제 공개 레포의 최근 30개 커밋 스캔 → 결과 리포트 검토

---

#### TASK-502 🔴 GitHub PR Webhook 자동 보안 리뷰
- **중요도**: 🔴 Critical | **순서**: 2번째

**📋 하위 할일**
- [ ] `GitHubWebhookController.java` HMAC 검증
- [ ] `GitHubWebhookService.java` PR 처리
- [ ] 변경 파일(diff)만 선택 스캔
- [ ] `create_pr_comment.ts` MCP Tool
- [ ] `PrReviewHistory.java` + Flyway V015
- [ ] GitHub Check Run API 연동
- [ ] `GitHubConfig.java` Webhook 설정

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: HMAC-SHA256 검증 — 올바른 서명 통과, 잘못된 서명 거부
- [ ] 🔬 **통합 테스트**: GitHub PR 생성 → Webhook 수신 → 자동 분석 시작
- [ ] 🔬 **통합 테스트**: PR 변경 파일만 스캔 (전체 파일 X)
- [ ] 🔬 **통합 테스트**: 분석 완료 → GitHub PR에 보안 리뷰 코멘트 자동 등록
- [ ] 🔬 **통합 테스트**: blockMergeOnCritical=true + Critical 발견 → Check Run failed
- [ ] 🔬 **통합 테스트**: 동일 PR 여러 번 push → pr_review_history에 각 head_sha별 기록
- [ ] 🛡️ **보안 검증**: 잘못된 HMAC 서명으로 Webhook 요청 → 400 반환
- [ ] ✅ **수동 검증**: 실제 GitHub 레포에 Webhook 등록 → PR 생성 → 코멘트 자동 등록 확인

---

#### TASK-503 🟠 GitHub 레포 나머지 파일 전체 SAST 최적화
- **중요도**: 🟠 High | **순서**: 3번째

**📋 하위 할일**
- [ ] 파일 타입별 우선순위 정렬
- [ ] 파일 크기·바이너리 필터 강화
- [ ] asyncio.gather 병렬 처리
- [ ] 진행률 SSE 정확도 개선

**🧪 테스트 체크리스트**
- [ ] 🔬 **통합 테스트**: 100개 파일 레포 스캔 시간 < 15분
- [ ] 🔬 **통합 테스트**: 우선순위 — 코드 파일 먼저, 설정 파일 나중에
- [ ] ✅ **수동 검증**: 대형 레포 (500+ 파일) 스캔 → 메모리 사용량 모니터링

---

#### TASK-504 🟠 SBOM 완성 & CVE 매칭
- **중요도**: 🟠 High | **순서**: 3번째 병렬

**📋 하위 할일**
- [ ] 의존성 파일 자동 감지
- [ ] SBOM 파서 4종 완성
- [ ] CVE 매칭 + Flyway V015
- [ ] CycloneDX JSON 내보내기

**🧪 테스트 체크리스트**
- [ ] 🔬 **통합 테스트**: Spring Boot 레포 → pom.xml 파싱 → Spring Core CVE 매칭
- [ ] 🔬 **통합 테스트**: CycloneDX JSON 형식 유효성 (schema validator 통과)
- [ ] 🔬 **통합 테스트**: 동일 패키지+버전 재분석 시 CVE 매칭 캐시 HIT
- [ ] ✅ **수동 검증**: 생성된 SBOM JSON → 외부 SBOM 뷰어로 열어 확인

---

#### TASK-505 🟡 GitHub 연동 설정 UI
- **중요도**: 🟡 Medium | **순서**: 4번째

**📋 하위 할일**
- [ ] GitHub 설정 섹션
- [ ] `PrReviewHistory.tsx` 테이블
- [ ] 저장소 목록 드롭다운

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: GitHub 저장소 목록 → 선택 → Webhook 자동 등록
- [ ] ✅ **수동 검증**: PR 리뷰 이력 테이블 정렬·필터 동작
- [ ] ✅ **수동 검증**: blockMergeOnCritical 토글 → 저장 후 재조회 시 유지

---

### 🎯 Sprint 5 완료 기준
- [ ] **커밋 히스토리 스캔**: 삭제된 시크릿도 탐지 ⭐
- [ ] **PR Webhook**: PR 생성 → 자동 분석 → PR 코멘트 등록 ⭐
- [ ] **전체 파일 스캔**: GitHub 레포 100개+ 파일 15분 내 완료
- [ ] **SBOM 완성**: 4개 생태계 파서 + CVE 매칭
- [ ] **GitHub 3단계 검사 완료 ⭐**: (1) API 기반 코드 (2) 나머지 파일 (3) 히스토리 모두 동작

---

## Sprint 6 — DAST 엔진 & Docker 샌드박스
> Week 13-14 | 목표: Docker 샌드박스 DAST 실행

### EPIC-7: DAST 동적 분석

---

#### TASK-601 🔴 Docker 샌드박스 DAST 컨테이너
- **중요도**: 🔴 Critical | **순서**: 1번째

**📋 하위 할일**
- [ ] `executors/` 5개 익스플로잇
- [ ] `dast_runner.py`
- [ ] `DockerSandboxManager.java`
- [ ] `ContainerConfig.java`
- [ ] `ExploitResult.java` + Flyway V008
- [ ] 300초 타임아웃 강제 종료

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: 각 executor 5종 독립 동작 (SQLi, XSS, IDOR, SSRF, Auth Bypass)
- [ ] 🔬 **통합 테스트**: DAST 요청 → Docker 컨테이너 생성 → 실행 → 결과 수집 → 컨테이너 삭제
- [ ] 🔬 **통합 테스트**: 300초 초과 시 컨테이너 강제 종료
- [ ] 🔬 **통합 테스트**: 메모리 512MB 초과 시 OOMKilled
- [ ] 🛡️ **보안 검증**: 컨테이너에서 host 네트워크 접근 시도 → 차단
- [ ] 🛡️ **보안 검증**: 컨테이너에서 Docker Socket 접근 시도 → 차단
- [ ] 🛡️ **보안 검증**: 실행 로그 AES-256-GCM 암호화 저장 확인
- [ ] ✅ **수동 검증**: 동시 3개 컨테이너 생성 → 격리 네트워크 확인

---

#### TASK-602 🔴 도메인 소유권 확인 & DAST Rate Limit
- **중요도**: 🔴 Critical | **순서**: 2번째

**📋 하위 할일**
- [ ] `DomainVerificationService.java` DNS + HTTP
- [ ] `ScanTarget.java` + Flyway V011
- [ ] `DistributedLockService.java` Redis SETNX
- [ ] Rate Limit Redis 카운터
- [ ] 면책 동의 처리

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: DNS TXT 조회 로직 단위 테스트 (DNS 모킹)
- [ ] 🧪 **단위 테스트**: Redis 분산 락 — 두 스레드 동시 획득 시 하나만 성공
- [ ] 🔬 **통합 테스트**: 소유권 미확인 도메인 DAST → 403
- [ ] 🔬 **통합 테스트**: 동일 도메인 1시간 4회 요청 → 4번째 429
- [ ] 🔬 **통합 테스트**: 동일 도메인 동시 DAST 2회 → 두 번째 요청 409 (락 대기 없이)
- [ ] 🛡️ **보안 검증**: 면책 동의 미체크 시 DAST 실행 거부
- [ ] 🛡️ **보안 검증**: consent_ip 기록 → 법적 증거 보존

---

#### TASK-603 🔴 DAST 에이전트 (Python LangGraph)
- **중요도**: 🔴 Critical | **순서**: 3번째

**📋 하위 할일**
- [ ] `dast_payload.jinja2` 프롬프트
- [ ] `dast_node.py`
- [ ] `notify_node.py` DAST 로그 SSE
- [ ] `docker_tool.py`
- [ ] `after_dast.py` 재시도 엣지
- [ ] `DastController.java` + `DastResultHandler.java`

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: `after_dast` 엣지 — success/retry/give_up 분기 정확성
- [ ] 🔬 **통합 테스트**: SQL Injection 취약점 → DAST 실행 → 익스플로잇 성공 판정
- [ ] 🔬 **통합 테스트**: DAST 실패 → 페이로드 재생성 → 2번째 시도
- [ ] 🔬 **통합 테스트**: 3회 실패 → 해당 취약점 dast_failed 표시 → 다음 노드 진행
- [ ] 🔬 **통합 테스트**: DAST 로그 SSE 실시간 수신 (페이로드, 결과)
- [ ] ✅ **수동 검증**: 테스트 취약한 앱 DVWA로 실제 DAST 시연

---

#### TASK-604 🟠 DAST 터미널 UI & 결과 표시
- **중요도**: 🟠 High | **순서**: 4번째

**📋 하위 할일**
- [ ] `DastTerminal.tsx` 실시간 로그
- [ ] 취약점 상세 DAST 섹션
- [ ] 익스플로잇 성공/실패 뱃지

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: DAST 실행 시 터미널에 실시간 로그 스트리밍
- [ ] ✅ **수동 검증**: ANSI 컬러 코드 정상 렌더링
- [ ] ✅ **수동 검증**: 자동 스크롤 동작
- [ ] ✅ **수동 검증**: 익스플로잇 성공 시 빨간 뱃지, 실패 시 회색 뱃지

---

### 🎯 Sprint 6 완료 기준
- [ ] **DAST 엔진 동작**: 5종 익스플로잇 실제 실행
- [ ] **격리 완벽**: Docker 컨테이너 외부 접근 차단
- [ ] **재시도 루프**: 최대 3회 재시도 후 포기
- [ ] **UI 실시간**: DAST 터미널에 실시간 로그 스트리밍

---

## Sprint 7 — 리포트 & 대시보드 & Android MVP
> Week 15-16 | 목표: PDF 리포트 + 대시보드 + Android 앱 MVP

### EPIC-8: 리포트 & 대시보드

---

#### TASK-701 🔴 PDF 리포트 생성 (iText7)
- **중요도**: 🔴 Critical | **순서**: 1번째

**📋 하위 할일**
- [ ] iText7 의존성 + `PdfGeneratorService.java` @Async
- [ ] `Report.java` + Flyway V010
- [ ] `PdfReportGenerator.java` / `JsonReportGenerator.java`
- [ ] `ReportService.java` + `ReportController.java`
- [ ] 다운로드 토큰 + 파일 삭제 연동
- [ ] 프론트엔드 UI

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: Template Method — PdfReportGenerator 섹션 순서 정확성
- [ ] 🔬 **통합 테스트**: 리포트 생성 → 30초 이내 완료
- [ ] 🔬 **통합 테스트**: 다운로드 토큰 만료 (24시간) → 접근 거부
- [ ] 🔬 **통합 테스트**: 90일 후 리포트 파일 자동 삭제
- [ ] 🛡️ **보안 검증**: 다른 사용자 리포트 downloadToken 직접 접근 시 거부
- [ ] 🛡️ **보안 검증**: 공개 공유 링크 활성화 시만 인증 없이 접근 가능
- [ ] ✅ **수동 검증**: 생성된 PDF 파일 열어 취약점 목록, 패치 코드, 차트 확인
- [ ] ✅ **수동 검증**: JSON 리포트 → CycloneDX 호환 스키마 검증

---

#### TASK-702 🟠 대시보드 차트 완성
- **중요도**: 🟠 High | **순서**: 2번째

**📋 하위 할일**
- [ ] SecurityScoreRing, SeverityBarChart, TrendLineChart, FileHeatmap, OwaspCoverageMatrix
- [ ] `VulnerabilityQueryService` 집계 쿼리
- [ ] `GET /projects/{id}/vulnerabilities/trend` API
- [ ] `dashboard/page.tsx` 완성

**🧪 테스트 체크리스트**
- [ ] 🔬 **통합 테스트**: trend API — 7일간 일별 집계 정확성
- [ ] 🔬 **통합 테스트**: 대시보드 로딩 시간 < 2초 (Redis 캐시)
- [ ] ✅ **수동 검증**: SecurityScoreRing — 0, 50, 100 점수 각 시각화
- [ ] ✅ **수동 검증**: OWASP 매트릭스 A01~A10 → 색상 코딩 정확
- [ ] ✅ **수동 검증**: FileHeatmap → 취약점 많은 파일이 빨간색

---

### EPIC-9: Android MVP

---

#### TASK-703 🔴 Android 프로젝트 초기화 & 인증
- **중요도**: 🔴 Critical | **순서**: 3번째 병렬

**📋 하위 할일**
- [ ] Android 프로젝트 (Compose, Hilt)
- [ ] `NetworkModule.kt` 인증서 피닝
- [ ] `TokenStorage.kt` EncryptedSharedPreferences
- [ ] `LoginScreen.kt`, `RegisterScreen.kt`
- [ ] `AuthViewModel.kt` + `AuthRepository.kt`
- [ ] `NavGraph.kt`

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: `TokenStorage` 암호화 저장·복원 정확성
- [ ] 🧪 **단위 테스트**: `AuthRepository` 로그인 성공/실패 분기
- [ ] 🔬 **통합 테스트**: 인증서 피닝 — 잘못된 인증서 서버 응답 시 연결 실패
- [ ] ✅ **수동 검증**: 실제 디바이스에서 로그인 성공 → 대시보드 진입
- [ ] 🛡️ **보안 검증**: APK 루팅 기기에서 실행 시 경고 (RootDetector)
- [ ] 🛡️ **보안 검증**: 토큰이 평문으로 SharedPreferences에 저장되지 않음
- [ ] 🛡️ **보안 검증**: 네트워크 스니핑 도구로 API 통신 확인 시 TLS 암호화

---

#### TASK-704 🟠 Android 대시보드 & 취약점 목록
- **중요도**: 🟠 High | **순서**: 4번째

**📋 하위 할일**
- [ ] DashboardScreen, VulnListScreen, VulnDetailScreen
- [ ] `SecurityScoreGauge.kt` Canvas
- [ ] Room DB 엔티티 + DAO
- [ ] Repository (Remote + Room)

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: Room DAO — 프로젝트 CRUD 정확성
- [ ] 🔬 **통합 테스트**: 네트워크 끊김 → Room 캐시에서 마지막 데이터 표시
- [ ] ✅ **수동 검증**: 대시보드 → 취약점 목록 → 상세 네비게이션 흐름
- [ ] ✅ **수동 검증**: SecurityScoreGauge 애니메이션 부드러움

---

#### TASK-705 🟠 FCM Push & OkHttp SSE
- **중요도**: 🟠 High | **순서**: 5번째

**📋 하위 할일**
- [ ] Firebase 프로젝트 + google-services.json
- [ ] `FcmPushService.java` Backend
- [ ] `SecureAiFcmService.kt`
- [ ] `SseClient.kt` Flow
- [ ] `AnalysisViewModel.kt` 이중 처리

**🧪 테스트 체크리스트**
- [ ] 🔬 **통합 테스트**: 세션 완료 → Backend `SessionCompletedEvent` → FCM Push 발송
- [ ] 🔬 **통합 테스트**: Android 앱 foreground — SSE 구독 동작
- [ ] 🔬 **통합 테스트**: Android 앱 background — FCM Push 수신 → 알림 표시
- [ ] ✅ **수동 검증**: 앱 종료 상태에서 분석 완료 → Push 알림 수신
- [ ] ✅ **수동 검증**: 알림 클릭 → 앱 실행 → 해당 세션 화면 딥링크
- [ ] ✅ **수동 검증**: 앱 foreground → background 전환 시 SSE 해제, FCM만 동작

---

### 🎯 Sprint 7 완료 기준
- [ ] **PDF 리포트**: 30초 내 생성, 다운로드 토큰 동작
- [ ] **대시보드**: 5개 차트 모두 완성, 2초 내 로딩
- [ ] **Android MVP**: 로그인 + 대시보드 + 취약점 목록 + 알림 동작
- [ ] **FCM + SSE 이중 전략**: foreground/background 모두 알림 정상

---

## Sprint 8 — 안정화 & 성능 최적화 & 런칭 준비
> Week 17-18

### EPIC-10: 안정화

---

#### TASK-801 🔴 스케줄러 전체 완성 & ShedLock
- **중요도**: 🔴 Critical

**📋 하위 할일**
- [ ] ShedLock + Redis Provider
- [ ] 6개 Job `@SchedulerLock` 적용
- [ ] `ExpiredDataCleanupJob` 완성 (체크포인트 삭제 포함)
- [ ] `PartitionMaintenanceJob`
- [ ] `SastUsageResetJob`

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: 각 Job 실행 로직 단위 테스트
- [ ] 🔬 **통합 테스트**: 다중 인스턴스 환경 시뮬레이션 → ShedLock으로 1회만 실행
- [ ] 🔬 **통합 테스트**: ExpiredDataCleanupJob — 30일 초과 exploit_results, 90일 리포트, 24h 체크포인트 삭제
- [ ] 🔬 **통합 테스트**: 매월 1일 → 모든 사용자 sast_usage_this_month 0으로 리셋
- [ ] 🔬 **통합 테스트**: PartitionMaintenanceJob → 다음 달 파티션 미리 생성
- [ ] ✅ **수동 검증**: 실제 스케줄 cron 동작 확인 (테스트 환경에서 시간 앞당기기)

---

#### TASK-802 🔴 Resilience4j Circuit Breaker 전체 적용
- **중요도**: 🔴 Critical

**📋 하위 할일**
- [ ] `ResilienceConfig.java`
- [ ] AI Agent / GitHub / NVD fallback
- [ ] `CircuitBreakerTest.java`

**🧪 테스트 체크리스트**
- [ ] 🧪 **단위 테스트**: 각 Circuit Breaker fallback 메서드
- [ ] 🔬 **통합 테스트**: AI Agent 강제 종료 → 연속 실패 10회 → Circuit OPEN
- [ ] 🔬 **통합 테스트**: Circuit OPEN 상태 → 사용자 요청 → fallback 응답
- [ ] 🔬 **통합 테스트**: 30초 후 HALF_OPEN → 1회 시도 → 성공 시 CLOSED 복구
- [ ] ✅ **수동 검증**: GitHub API 403 응답 시 → 캐시 응답 반환

---

#### TASK-803 🟠 성능 테스트 & 캐시 최적화
- **중요도**: 🟠 High

**📋 하위 할일**
- [ ] k6 주요 API 부하 테스트
- [ ] Redis 캐시 히트율 측정
- [ ] N+1 쿼리 제거
- [ ] GitHub 스캔 병렬화

**🧪 테스트 체크리스트**
- [ ] 🔬 **통합 테스트**: 주요 API p95 응답 시간 < 500ms
- [ ] 🔬 **통합 테스트**: 동시 100명 로그인 → 성공률 > 99%
- [ ] 🔬 **통합 테스트**: Redis 캐시 히트율 > 80% (SAST 결과, 패치 템플릿)
- [ ] 🔬 **통합 테스트**: JPA SQL 로그에서 N+1 패턴 없음
- [ ] ✅ **수동 검증**: 프로젝트 목록 API — 10개 프로젝트 조회 시 쿼리 3개 이하

---

#### TASK-804 🟠 보안 강화 & 자체 OWASP ZAP 스캔
- **중요도**: 🟠 High

**📋 하위 할일**
- [ ] Nginx 보안 헤더
- [ ] DTO `@Valid` 전수 확인
- [ ] OWASP ZAP 자체 스캔
- [ ] Android cleartext 차단

**🧪 테스트 체크리스트**
- [ ] 🛡️ **보안 검증**: OWASP ZAP Full Scan → Critical/High 0건
- [ ] 🛡️ **보안 검증**: CSP, HSTS, X-Frame-Options, X-Content-Type 헤더 확인 (securityheaders.com)
- [ ] 🛡️ **보안 검증**: 모든 POST/PATCH API DTO에 `@Valid` 적용
- [ ] 🛡️ **보안 검증**: SQL Injection 시도 — 모든 입력 필드 안전
- [ ] 🛡️ **보안 검증**: XSS 시도 — 모든 사용자 입력 출력 시 이스케이프
- [ ] 🛡️ **보안 검증**: CSRF — 상태 변경 API는 POST+JWT 인증
- [ ] 🛡️ **보안 검증**: Android 앱 cleartext HTTP 요청 차단 (network_security_config)

---

#### TASK-805 🟡 Nginx API Gateway 완성 & SSL
- **중요도**: 🟡 Medium

**📋 하위 할일**
- [ ] `nginx.conf` 라우팅
- [ ] `limit_req_zone`
- [ ] Let's Encrypt
- [ ] 보안 헤더

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: `/api/*` → backend 라우팅
- [ ] ✅ **수동 검증**: HTTP → HTTPS 강제 리다이렉트
- [ ] ✅ **수동 검증**: SSL 인증서 A 등급 (SSL Labs)
- [ ] 🔬 **통합 테스트**: 분당 100회 초과 요청 시 Nginx 수준 차단

---

#### TASK-806 🟡 Prometheus + Grafana 모니터링
- **중요도**: 🟡 Medium

**📋 하위 할일**
- [ ] `prometheus.yml`
- [ ] Grafana 대시보드 JSON
- [ ] 커스텀 메트릭

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: Prometheus 타겟 모두 UP
- [ ] ✅ **수동 검증**: Grafana 대시보드 — 분석 처리량, 에러율, DAST 실행시간 표시
- [ ] ✅ **수동 검증**: 커스텀 메트릭 — 분석 세션 수, 취약점 발견 수 정상 집계

---

### 🎯 Sprint 8 완료 기준
- [ ] **스케줄러 안정**: ShedLock으로 중복 실행 방지
- [ ] **Circuit Breaker**: 모든 외부 호출 장애 격리
- [ ] **성능 목표 달성**: p95 < 500ms, 캐시 히트율 > 80%
- [ ] **보안 기본선**: OWASP ZAP Critical 0건
- [ ] **운영 준비**: Grafana 대시보드 가동

---

## Sprint 9 — VSCode Extension & 지속 모니터링 (Phase 3)
> Week 19-20

### EPIC-11: Phase 3

---

#### TASK-901 🟡 지속 모니터링 서비스
- **중요도**: 🟡 Medium

**📋 하위 할일**
- [ ] `MonitoringJob` + `MonitoringService`
- [ ] `MonitoringResult` + 파티션 테이블
- [ ] Slack Webhook
- [ ] SSL 만료 알림

**🧪 테스트 체크리스트**
- [ ] 🔬 **통합 테스트**: 매시 정각 → 활성화된 모니터링 대상 Passive 스캔
- [ ] 🔬 **통합 테스트**: SSL 만료 30일 전 → Slack/이메일 알림
- [ ] 🔬 **통합 테스트**: 새 CVE 발표 → 영향 받는 프로젝트 자동 재점검
- [ ] ✅ **수동 검증**: Slack 채널에 알림 포스팅 확인

---

#### TASK-902 🟢 VSCode Extension 기초
- **중요도**: 🟢 Low

**📋 하위 할일**
- [ ] `vsce` 프로젝트 초기화
- [ ] Backend API 재사용
- [ ] Diagnostic API 취약점 표시
- [ ] Marketplace 배포 준비

**🧪 테스트 체크리스트**
- [ ] 🔬 **통합 테스트**: VSCode에서 분석 실행 → Problems 탭에 취약점 표시
- [ ] ✅ **수동 검증**: Extension 설치 → API 키 입력 → 분석 성공
- [ ] ✅ **수동 검증**: Diagnostic 표시 — 라인에 빨간 밑줄

---

#### TASK-903 🟢 Android 고도화
- **중요도**: 🟢 Low

**📋 하위 할일**
- [ ] `ChatScreen.kt` 스트리밍
- [ ] PDF 공유 (FileProvider)
- [ ] 알림 채널 세분화

**🧪 테스트 체크리스트**
- [ ] ✅ **수동 검증**: Android AI 채팅 → 스트리밍 응답 표시
- [ ] ✅ **수동 검증**: PDF 리포트 → 다른 앱으로 공유 (Gmail, Drive 등)
- [ ] ✅ **수동 검증**: 알림 채널별 사운드/진동 다르게 설정

---

### 🎯 Sprint 9 완료 기준
- [ ] **지속 모니터링**: 24/7 자동 스캔 동작
- [ ] **VSCode Extension**: Marketplace 등록 가능 수준
- [ ] **Android 완성도**: 채팅·리포트·알림 고도화

---

## 📊 백로그 우선순위 & Story Points 요약

| Sprint | 핵심 테마 | Critical | High | Medium | Low | 총 SP |
|--------|----------|----------|------|--------|-----|------|
| 0 | 기반 구축 | 4 | 2 | 1 | 0 | 29 |
| 1 | 인증·프로젝트 | 3 | 1 | 1 | 0 | 28 |
| 2 | AI Agent·체크포인트 ⭐ | 5 | 1 | 0 | 0 | 52 |
| 3 | SAST·GitHub 기초 | 3 | 2 | 0 | 0 | 42 |
| 4 | 웹 UI·체크리스트 ⭐ | 4 | 2 | 0 | 0 | 47 |
| 5 | GitHub Layer 2 | 2 | 2 | 1 | 0 | 42 |
| 6 | DAST 엔진 | 3 | 1 | 0 | 0 | 39 |
| 7 | 리포트·대시보드·Android | 2 | 3 | 0 | 0 | 45 |
| 8 | 안정화 | 2 | 2 | 2 | 0 | 32 |
| 9 | Phase 3 | 0 | 0 | 1 | 2 | 26 |
| **합계** | - | **28** | **16** | **6** | **2** | **382 SP** |

---

## 📝 테스트 체크리스트 전체 수 통계

| 테스트 유형 | 개수 |
|------------|------|
| 🧪 단위 테스트 | 45+ |
| 🔬 통합 테스트 | 110+ |
| ✅ 수동 검증 | 75+ |
| 🛡️ 보안 검증 | 35+ |
| **전체** | **265+** |

---

*관련 문서: `08_CHECKPOINT_FLOW.md` (체크포인트 상세 설계)*
