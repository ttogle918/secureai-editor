# SecureAI — 레포지토리 구조 v2.0
> 작성자: 보안 전문가 · AI 전문가 · 앱 개발자 · 시니어 백엔드 공동 확정  
> 작성일: 2026-04-19 | 이전 버전: v1.0 (단일 Spring Boot)  
> 변경 요약: Python AI Agent 분리 / MCP Server 명시 / Android 앱 추가 / API Gateway 추가

> ⚠️ **Sprint 2 실제 구현 기준 정오표** (2026-04-28)
>
> 이 문서는 Sprint 1 설계안입니다. 실제 구현과 다른 주요 차이:
>
> | 항목 | 설계안 (이 문서) | 실제 구현 |
> |------|---------------|---------|
> | 디렉토리 구조 | `backend/`, `ai-agent/`, `mcp-server/` | `apps/backend/`, `apps/ai_engine/`, `apps/mcp_server/` |
> | Spring Boot 버전 | 3.x | **4.0.5** |
> | Java 버전 | 21 | **21** ✅ |
> | AI Agent 패키지명 | `ai-agent/` | `apps/ai_engine/` |
> | Java `agent/` 패키지 | LangGraph4j 노드 다수 존재 | **미구현** — 모든 LangGraph 로직은 Python AI Engine에 있음 |
> | Circuit Breaker | Resilience4j (`ResilienceConfig.java`) | **수동 구현** (`AtomicBoolean circuitOpen`) — Resilience4j 미사용 |
> | analysis 도메인 | vulnerability, dast, patch, report, github, cve 별도 패키지 | **단일 analysis 도메인** — VulnerabilityController, ProgressLogController, SessionInterruptionScheduler 포함 |
> | Flyway 마이그레이션 | V001~V021 | **V001~V006** |
> | MCP Server | docker-compose 서비스 | **AI Engine subprocess** (stdio 모드) |
>
> Sprint 2에서 추가된 파일: `docs/02_API_DESIGN_V2.md`, `docs/03_DOCKER_INFRA_V2.md` 참조.

---

## 목차

1. [모노레포 루트](#1-모노레포-루트)
2. [backend/ — Spring Boot (모듈러 모놀리스)](#2-backend--spring-boot-모듈러-모놀리스)
3. [ai-agent/ — Python FastAPI + LangGraph](#3-ai-agent--python-fastapi--langgraph)
4. [mcp-server/ — MCP Server (Node.js)](#4-mcp-server--mcp-server-nodejs)
5. [frontend/ — Next.js 15 (웹)](#5-frontend--nextjs-15-웹)
6. [android/ — Kotlin + Jetpack Compose](#6-android--kotlin--jetpack-compose)
7. [dast-sandbox/ — Python DAST 격리 컨테이너](#7-dast-sandbox--python-dast-격리-컨테이너)
8. [infra/ — Docker / 인프라](#8-infra--docker--인프라)
9. [docs/ — 설계 문서](#9-docs--설계-문서)
10. [핵심 파일 상세 설명](#10-핵심-파일-상세-설명)

---

## 1. 모노레포 루트

```
secureai/                                             # Git 루트 — 전체 프로젝트 모노레포
│
├── .github/                                          # GitHub 설정
│   ├── workflows/
│   │   ├── ci-backend.yml                            # 백엔드 CI: Gradle 빌드 → 테스트 → Docker 이미지 Push
│   │   ├── ci-ai-agent.yml                           # AI Agent CI: pytest → Docker 이미지 Push
│   │   ├── ci-mcp-server.yml                         # MCP Server CI: npm test → Docker 이미지 Push
│   │   ├── ci-frontend.yml                           # 웹 프론트엔드 CI: lint → 타입체크 → Next.js 빌드
│   │   ├── ci-android.yml                            # 안드로이드 CI: Gradle → APK 빌드 → 단위 테스트
│   │   └── self-scan.yml                             # SecureAI가 자기 자신을 SAST 분석 (먹이사슬 CI)
│   ├── PULL_REQUEST_TEMPLATE.md                      # PR 템플릿: 보안 체크리스트 + 변경 서비스 명시
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── security_vulnerability.md                 # 보안 취약점 신고 템플릿 (비공개 제출 안내 포함)
│
├── apps/
│   ├── backend/                                      # Spring Boot 4.0.5 / Java 21 백엔드 서비스 (섹션 2)
│   ├── ai_engine/                                    # Python 3.12 FastAPI + LangGraph AI Agent (섹션 3)
│   ├── mcp_server/                                   # MCP Server Node.js 20 — AI Engine subprocess (섹션 4)
│   └── frontend/                                     # Next.js 15 웹 클라이언트 (섹션 5)
├── infra/                                            # 인프라 설정 (섹션 8)
├── docs/                                             # 설계 문서 (섹션 9)
│
├── .env.example                                      # 전체 서비스 환경변수 템플릿 (민감값 제외)
├── .gitignore                                        # .env, *.db, build/, __pycache__, node_modules/ 제외
├── docker-compose.yml                                # ⭐ 개발 환경: 전체 6개 서비스 단일 실행
├── docker-compose.prod.yml                           # 운영 오버라이드: 리소스 제한, 재시작 정책
├── Makefile                                          # 개발자 단축 명령어 (make dev / test / logs / clean)
└── README.md                                         # 프로젝트 소개, 아키텍처 다이어그램, 빠른 시작
```

---

## 2. backend/ — Spring Boot (모듈러 모놀리스)

```
backend/
│
├── Dockerfile                                        # 멀티스테이지: JDK21 빌드 → JRE21 실행 (경량화)
├── build.gradle.kts                                  # ⭐ Gradle 빌드 스크립트 — 의존성 전체 정의
├── settings.gradle.kts                               # Gradle 프로젝트명 설정
├── gradlew / gradlew.bat                             # Gradle Wrapper (버전 고정, 팀 일관성)
│
└── src/
    ├── main/
    │   ├── java/io/secureai/
    │   │   │
    │   │   ├── SecureAiApplication.java              # Spring Boot 진입점 (@SpringBootApplication)
    │   │   │
    │   │   ├── config/                               # ─── 전역 설정 ───────────────────────────────
    │   │   │   ├── AsyncConfig.java                  # @Async Thread Pool 5종 정의 (analysis/dast/report/email/aiCall)
    │   │   │   ├── CacheConfig.java                  # Redis CacheManager + 도메인별 TTL 정책 설정
    │   │   │   ├── SecurityConfig.java               # ⭐ Spring Security 7: JWT 필터체인, CORS, CSRF, 엔드포인트 권한
    │   │   │   ├── JwtConfig.java                    # JWT 서명 키, 만료시간 프로퍼티 바인딩 (@ConfigurationProperties)
    │   │   │   ├── RedisConfig.java                  # RedisTemplate 빈, Pub/Sub MessageListenerContainer 설정
    │   │   │   ├── DockerConfig.java                 # Docker Java SDK DockerClient 빈 등록 (DAST용 Socket 연결)
    │   │   │   ├── WebConfig.java                    # MVC 인터셉터 등록 (RateLimit, AuditLog), 메시지 컨버터
    │   │   │   ├── ResilienceConfig.java             # ⭐ Resilience4j: Circuit Breaker / Retry / Bulkhead 설정
    │   │   │   ├── FcmConfig.java                    # Firebase Admin SDK 초기화 (Android Push 발송용)
    │   │   │   └── OpenApiConfig.java                # Swagger/OpenAPI 3 문서 자동 생성 설정
    │   │   │
    │   │   ├── domain/                               # ─── 핵심 비즈니스 도메인 (패키지별 완전 격리) ──────
    │   │   │   │
    │   │   │   ├── auth/                             # 인증/인가 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── AuthController.java       # POST /auth/{login,register,refresh,logout,verify-email}
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── AuthService.java          # 로그인·회원가입 핵심 로직, 잠금 정책 (5회 실패 → 15분 잠금)
    │   │   │   │   │   └── TokenService.java         # JWT 생성/검증, Refresh Token Rotation, Redis 토큰 저장
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── LoginRequest.java         # 이메일, 비밀번호
    │   │   │   │   │   ├── LoginResponse.java        # accessToken, expiresIn, 사용자 기본 정보
    │   │   │   │   │   ├── RegisterRequest.java      # 이메일, 비밀번호, username, displayName
    │   │   │   │   │   └── TokenRefreshResponse.java # 새 accessToken + expiresIn
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── RefreshToken.java         # refresh_tokens 테이블 JPA 엔티티
    │   │   │   │   ├── repository/
    │   │   │   │   │   └── RefreshTokenRepository.java # 토큰 해시 조회, 사용자별 전체 무효화
    │   │   │   │   ├── oauth/
    │   │   │   │   │   ├── GitHubOAuthService.java   # GitHub code → token → 사용자정보 교환 흐름
    │   │   │   │   │   └── GitHubUserInfo.java       # GitHub /user API 응답 DTO
    │   │   │   │   └── filter/
    │   │   │   │       └── JwtAuthenticationFilter.java # ⭐ 매 요청 JWT 파싱·검증 → SecurityContext 주입
    │   │   │   │
    │   │   │   ├── user/                             # 사용자 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── UserController.java       # GET·PATCH /users/me, DELETE /users/me
    │   │   │   │   ├── service/
    │   │   │   │   │   └── UserService.java          # 사용자 조회·수정, SAST 월별 사용량 증가·리셋, 플랜 캐시 조회
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── UserResponse.java         # 사용자 + 플랜 정보 + 월별 사용량 통합 응답
    │   │   │   │   │   └── UserUpdateRequest.java    # displayName, timezone, locale 수정
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── User.java                 # users 테이블 엔티티 (Soft Delete, GitHub Token 암호화 컨버터)
    │   │   │   │   │   └── Plan.java                 # plans 테이블 엔티티 (기능 플래그 컬럼 모음)
    │   │   │   │   ├── repository/
    │   │   │   │   │   ├── UserRepository.java       # 이메일·GitHub ID 조회, Soft Delete 필터 포함
    │   │   │   │   │   └── PlanRepository.java       # 플랜 목록 (변경 거의 없음 → @Cacheable 적용)
    │   │   │   │   └── event/
    │   │   │   │       └── UserDeletedEvent.java     # 계정 탈퇴 이벤트 (다른 도메인 데이터 정리 트리거)
    │   │   │   │
    │   │   │   ├── project/                          # 프로젝트 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── ProjectController.java    # CRUD /projects, 팀 멤버 초대·삭제
    │   │   │   │   ├── service/
    │   │   │   │   │   └── ProjectService.java       # 프로젝트 생성·수정·삭제, 보안점수 갱신, 멤버 권한 검증
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── ProjectCreateRequest.java # name, sourceType, githubRepoFullName 등
    │   │   │   │   │   ├── ProjectResponse.java      # 프로젝트 전체 + 최근 세션 요약 응답
    │   │   │   │   │   └── ProjectListResponse.java  # 목록용 경량 DTO (latestScore, sessionSummary만)
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── Project.java              # projects 테이블 엔티티
    │   │   │   │   │   └── TeamMember.java           # team_members 테이블 엔티티 (role: owner/admin/viewer)
    │   │   │   │   ├── repository/
    │   │   │   │   │   ├── ProjectRepository.java    # 소유자별 목록, @EntityGraph로 최근 세션 JOIN
    │   │   │   │   │   └── TeamMemberRepository.java # 프로젝트·사용자 복합 조회
    │   │   │   │   └── event/
    │   │   │   │       └── ProjectDeletedEvent.java  # 프로젝트 삭제 이벤트 (세션·리포트 정리 트리거)
    │   │   │   │
    │   │   │   ├── analysis/                         # ⭐ 분석 세션 통합 도메인 (Sprint 2 실제 구현)
    │   │   │   │   ├── controller/
    │   │   │   │   │   ├── AnalysisController.java   # POST /sessions, GET /sessions, GET /sessions/{id}, GET /sessions/{id}/stream, POST /{id}/resume, POST /{id}/cancel
    │   │   │   │   │   ├── VulnerabilityController.java # POST /internal/vulnerabilities (내부), GET /vulnerabilities, GET /vulnerabilities/{id}
    │   │   │   │   │   └── ProgressLogController.java # POST /internal/progress-logs (내부), GET /sessions/{id}/progress-logs
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── AnalysisService.java      # 세션 생성·조회·재개·취소, AI Agent 호출 오케스트레이션
    │   │   │   │   │   ├── AiAgentClient.java        # ⭐ AI Agent HTTP 클라이언트 — 수동 Circuit Breaker (AtomicBoolean, 3회 실패 → OPEN, 30초 후 HALF-OPEN)
    │   │   │   │   │   ├── SseEmitterService.java    # Redis SUBSCRIBE → SseEmitter 브릿지
    │   │   │   │   │   ├── RedisPublisher.java       # Redis 채널 발행
    │   │   │   │   │   ├── RedisSubscriber.java      # Redis Pub/Sub 수신 → SseEmitter 전달
    │   │   │   │   │   ├── VulnerabilityService.java # 취약점 저장(중복 fingerprint 스킵)·조회, VulnerabilityFoundEvent 발행
    │   │   │   │   │   ├── ProgressLogService.java   # 진행 로그 저장·조회
    │   │   │   │   │   └── SessionInterruptionScheduler.java # @Scheduled(30s): CB OPEN 감지 → 실행 중 세션 interrupted 전환
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── StartAnalysisRequest.java # projectId, workspaceRoot
    │   │   │   │   │   ├── AnalysisSessionResponse.java # 세션 상태 응답
    │   │   │   │   │   ├── SaveVulnerabilitiesRequest.java # AI Agent → Backend 취약점 배치 저장
    │   │   │   │   │   ├── VulnerabilityResponse.java # 취약점 응답
    │   │   │   │   │   ├── SaveProgressLogRequest.java # 진행 로그 저장 요청
    │   │   │   │   │   └── ProgressLogResponse.java  # 진행 로그 응답
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── AnalysisSession.java      # analysis_sessions 테이블 (Flyway V006)
    │   │   │   │   │   ├── Vulnerability.java        # vulnerabilities 테이블 (fingerprint 중복 방지)
    │   │   │   │   │   └── AnalysisProgressLog.java  # analysis_progress_logs 테이블
    │   │   │   │   ├── repository/
    │   │   │   │   │   ├── AnalysisSessionRepository.java
    │   │   │   │   │   ├── VulnerabilityRepository.java
    │   │   │   │   │   └── AnalysisProgressLogRepository.java
    │   │   │   │   └── event/
    │   │   │   │       ├── VulnerabilityFoundEvent.java        # 신규 취약점 저장 시 발행
    │   │   │   │       └── VulnerabilityFoundEventListener.java # 수신 → 세션 카운터 업데이트
    │   │   │   │
    │   │   │   ├── dast/                             # DAST 동적 분석 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── DastController.java       # POST /dast/targets, /verify, /run; GET /stream, /result
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── DastService.java          # 대상 등록, Rate Limit 체크, AI Agent에 DAST 위임
    │   │   │   │   │   ├── DomainVerificationService.java # DNS TXT 레코드 조회 / HTTP 파일 GET으로 소유권 확인
    │   │   │   │   │   └── DastResultHandler.java    # AI Agent 반환 DAST 결과 → DB 저장 + 취약점 상태 업데이트
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── DastTargetRequest.java    # targetUrl, consentAccepted
    │   │   │   │   │   ├── DastTargetResponse.java   # targetId, verificationToken, 인증 방법 안내
    │   │   │   │   │   ├── DastRunRequest.java       # sessionId, targetId, scanProfile, options
    │   │   │   │   │   └── DastResultResponse.java   # 익스플로잇 결과 목록 (payloadSummary, isSuccess 등)
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── ScanTarget.java           # scan_targets 테이블 (URL 암호화 컨버터 적용)
    │   │   │   │   │   └── ExploitResult.java        # exploit_results 테이블 (payload·log 암호화, 30일 만료)
    │   │   │   │   └── repository/
    │   │   │   │       ├── ScanTargetRepository.java # 호스트별 중복 조회, 모니터링 대상 next_scan_at 조회
    │   │   │   │       └── ExploitResultRepository.java # 취약점별 결과 조회, 만료 데이터 벌크 삭제
    │   │   │   │
    │   │   │   ├── patch/                            # 패치 제안 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── PatchController.java      # GET /patches, POST /generate (AI 위임), PATCH /apply
    │   │   │   │   ├── service/
    │   │   │   │   │   └── PatchService.java         # 패치 조회·적용, AI Agent HTTP로 패치 생성 요청, 템플릿 캐시 활용
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── PatchResponse.java        # originalCode, patchedCode, diffUnified, explanation
    │   │   │   │   │   └── PatchApplyRequest.java    # appliedManually, notes
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── PatchSuggestion.java      # patch_suggestions 테이블 엔티티
    │   │   │   │   └── repository/
    │   │   │   │       └── PatchSuggestionRepository.java # 취약점별 패치 조회, 템플릿 키 기반 캐시 조회
    │   │   │   │
    │   │   │   ├── report/                           # 리포트 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── ReportController.java     # POST /reports, GET /{id}/status, GET /download, POST /share
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── ReportService.java        # 리포트 생성 요청·조회·공유링크, Redis 상태 업데이트
    │   │   │   │   │   └── PdfGeneratorService.java  # @Async: iText7 PDF 생성 → 파일 저장 → 다운로드 토큰 발급
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── ReportCreateRequest.java  # sessionId, format, title, options (includeExploit 등)
    │   │   │   │   │   └── ReportResponse.java       # status, downloadUrl, tokenExpiresAt
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── Report.java               # reports 테이블 엔티티 (summaryJson JSONB)
    │   │   │   │   ├── repository/
    │   │   │   │   │   └── ReportRepository.java     # 프로젝트별 목록, downloadToken으로 단건 조회
    │   │   │   │   └── template/                     # 리포트 생성 전략 (Template Method Pattern)
    │   │   │   │       ├── ReportGenerator.java      # 추상 클래스: 공통 섹션(헤더/요약/푸터) + 추상 섹션
    │   │   │   │       ├── PdfReportGenerator.java   # PDF 구현체 (iText7)
    │   │   │   │       └── JsonReportGenerator.java  # JSON 구현체 (표준 내보내기)
    │   │   │   │
    │   │   │   ├── github/                           # GitHub 연동 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── GitHubController.java     # GET /github/repos, POST /github-config, POST /scan/history
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── GitHubApiService.java     # GitHub REST API WebClient 래퍼 (저장소/PR/커밋/Webhook 등록)
    │   │   │   │   │   ├── GitHubWebhookService.java # PR 이벤트 HMAC 검증 → 분석 세션 자동 생성 트리거
    │   │   │   │   │   └── CommitHistoryScanner.java # @Async: 커밋 히스토리 페이징 조회 → AI Agent로 시크릿 탐지 위임
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── GitHubRepoResponse.java   # 저장소 목록 응답 DTO
    │   │   │   │   │   └── GitHubConfigRequest.java  # autoReviewEnabled, blockMergeOnCritical 등 설정
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── GitHubConfig.java         # github_configs 테이블 엔티티
    │   │   │   │   │   └── PrReviewHistory.java      # pr_review_history 테이블 엔티티
    │   │   │   │   └── repository/
    │   │   │   │       ├── GitHubConfigRepository.java    # 프로젝트별 GitHub 설정 단건 조회
    │   │   │   │       └── PrReviewHistoryRepository.java # PR번호+SHA 중복 방지 조회
    │   │   │   │
    │   │   │   ├── cve/                              # CVE / SBOM 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── CveController.java        # GET /cve/{id}, POST /sbom (생성 요청), GET /sbom (조회)
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── CveService.java           # CVE 조회 (Redis 6h 캐시 우선 → NVD API 폴백)
    │   │   │   │   │   └── SbomService.java          # @Async: 의존성 파싱 → CVE 매칭 → CycloneDX JSON 생성
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── CveResponse.java          # CVE ID, CVSS 점수, 영향 패키지 목록
    │   │   │   │   │   └── SbomResponse.java         # 컴포넌트 목록 + 취약 패키지 집계
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── CveData.java              # cve_data 테이블 (affectedPackages JSONB, GIN 인덱스)
    │   │   │   │   │   └── DependencyComponent.java  # dependency_components 테이블 (purl, 생태계, 버전)
    │   │   │   │   ├── repository/
    │   │   │   │   │   ├── CveDataRepository.java    # CVE ID 조회, 패키지명+버전 영향 여부 JSONB 검색
    │   │   │   │   │   └── DependencyComponentRepository.java # 세션별 컴포넌트, 취약 컴포넌트 필터
    │   │   │   │   └── parser/                       # Strategy Pattern: 의존성 파일 파서
    │   │   │   │       ├── SbomParserStrategy.java   # 파서 인터페이스
    │   │   │   │       ├── MavenPomParser.java       # pom.xml 파싱 → 컴포넌트 목록 추출
    │   │   │   │       ├── NpmPackageParser.java     # package.json 파싱
    │   │   │   │       ├── PipRequirementsParser.java # requirements.txt 파싱
    │   │   │   │       └── CargoTomlParser.java      # Cargo.toml 파싱 (Rust)
    │   │   │   │
    │   │   │   ├── monitoring/                       # 지속 모니터링 도메인 (Phase 3)
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── MonitoringController.java # POST /enable, GET /results, PUT /notifications
    │   │   │   │   ├── service/
    │   │   │   │   │   └── MonitoringService.java    # 모니터링 활성화, 결과 저장, Slack·이메일 알림 발송
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── MonitoringResult.java     # monitoring_results 파티션 테이블 엔티티
    │   │   │   │   └── repository/
    │   │   │   │       └── MonitoringResultRepository.java # 대상별 최근 결과, 미알림 건 조회
    │   │   │   │
    │   │   │   └── chat/                             # AI 채팅 도메인
    │   │   │       ├── controller/
    │   │   │       │   └── ChatController.java       # POST /chat/sessions/{id}/message (SSE 스트리밍 응답)
    │   │   │       ├── service/
    │   │   │       │   └── ChatService.java          # AI Agent로 메시지 전달, 스트리밍 응답 중계, 대화이력 Redis 관리
    │   │   │       └── dto/
    │   │   │           ├── ChatMessageRequest.java   # 사용자 메시지 + 취약점 컨텍스트 (파일경로, CWE)
    │   │   │           └── ChatHistoryResponse.java  # 최근 10턴 대화 이력 배열
    │   │   │
    │   │   ├── infrastructure/                       # ─── 외부 시스템 연동 (인프라 레이어) ─────────────
    │   │   │   │
    │   │   │   ├── redis/
    │   │   │   │   ├── RedisPublisher.java           # Redis PUBLISH (AI Agent SSE 이벤트 → 채널 발행)
    │   │   │   │   ├── RedisSubscriber.java          # Redis SUBSCRIBE → SseEmitter 이벤트 전달
    │   │   │   │   └── DistributedLockService.java   # SETNX 기반 분산 락 (DAST 중복 실행 방지)
    │   │   │   │
    │   │   │   ├── docker/
    │   │   │   │   ├── DockerSandboxManager.java     # ⭐ Docker SDK: DAST 컨테이너 생성·실행·로그수집·강제종료
    │   │   │   │   └── ContainerConfig.java          # 샌드박스 파라미터 (메모리 512MB, 네트워크 격리, 타임아웃 300s)
    │   │   │   │
    │   │   │   ├── github/
    │   │   │   │   └── GitHubRestClient.java         # WebClient 기반 GitHub API HTTP 클라이언트 (토큰 복호화 후 주입)
    │   │   │   │
    │   │   │   ├── nvd/
    │   │   │   │   └── NvdApiClient.java             # NVD REST API v2 클라이언트 (CVE 조회, 페이지네이션 처리)
    │   │   │   │
    │   │   │   ├── fcm/
    │   │   │   │   └── FcmPushService.java           # ⭐ Firebase Admin SDK: Android FCM Push 메시지 발송
    │   │   │   │
    │   │   │   └── email/
    │   │   │       └── EmailService.java             # @Async: JavaMailSender로 인증·알림 이메일 발송
    │   │   │
    │   │   ├── scheduler/                            # ─── 스케줄 배치 작업 ────────────────────────────
    │   │   │   ├── NvdSyncJob.java                   # 매일 03:00 | NVD CVE 동기화 + Redis 캐시 갱신
    │   │   │   ├── ExpiredDataCleanupJob.java        # 매일 04:30 | 30일 익스플로잇 로그 삭제, 90일 리포트 파일 삭제
    │   │   │   ├── MonitoringJob.java                # 매시 정각 | 모니터링 대상 Passive 스캔 (Phase 3)
    │   │   │   ├── SastUsageResetJob.java            # 매월 1일 | 사용자 월별 SAST 사용량 초기화
    │   │   │   ├── PartitionMaintenanceJob.java      # 매월 25일 | 다음 달 DB 파티션 자동 생성
    │   │   │   └── SslCertCheckJob.java              # 매주 월요일 | 모니터링 대상 SSL 만료 30일 전 알림 (Phase 3)
    │   │   │
    │   │   ├── security/                             # ─── 보안 공통 컴포넌트 ─────────────────────────
    │   │   │   ├── PlanChecker.java                  # ⭐ @PreAuthorize용 플랜별 기능 허용 판단 빈 (Redis 캐시 활용)
    │   │   │   ├── AesEncryptionConverter.java       # ⭐ JPA AttributeConverter: AES-256-GCM 자동 암/복호화
    │   │   │   ├── RateLimitInterceptor.java         # Redis 카운터 기반 API Rate Limit (플랜별 req/min 제한)
    │   │   │   ├── InternalApiKeyFilter.java         # AI Agent 내부 API Key 검증 필터 (X-Internal-Key 헤더)
    │   │   │   └── AuditLogAspect.java               # @AuditLog AOP: 민감 작업 자동 감사 로그 기록
    │   │   │
    │   │   ├── webhook/
    │   │   │   └── GitHubWebhookController.java      # POST /webhooks/github: HMAC-SHA256 서명 검증 → 비동기 처리
    │   │   │
    │   │   ├── admin/
    │   │   │   └── AdminController.java              # ROLE_ADMIN 전용: 통계 조회, Job 수동 실행, 플랜 변경
    │   │   │
    │   │   └── common/                               # ─── 공통 유틸 ──────────────────────────────────
    │   │       ├── exception/
    │   │       │   ├── GlobalExceptionHandler.java   # @RestControllerAdvice: 전역 예외 → 표준 에러 응답 변환
    │   │       │   ├── BusinessException.java        # 비즈니스 예외 기반 클래스 (errorCode 포함)
    │   │       │   └── ErrorCode.java                # 에러 코드 enum (PLAN_LIMIT_EXCEEDED, DAST_LOCK_FAILED 등 전체)
    │   │       ├── response/
    │   │       │   ├── ApiResponse.java              # 표준 응답 래퍼 {success, data, meta}
    │   │       │   └── PageResponse.java             # 페이지네이션 래퍼 {data[], pagination}
    │   │       └── util/
    │   │           ├── HashUtils.java                # SHA-256 해시 (파일 지문, 토큰 해시용)
    │   │           └── SecurityUtils.java            # SecurityContext에서 현재 인증 사용자 추출 유틸
    │   │
    │   └── resources/
    │       ├── application.yml                       # ⭐ 전체 서비스 설정 중앙 관리 (DB, Redis, JWT, AI Agent URL 등)
    │       ├── application-local.yml                 # 로컬 개발 오버라이드 (DEBUG 로그, AI Agent localhost URL)
    │       ├── application-prod.yml                  # 운영 오버라이드 (WARN 로그, SSL 강제, 실 AI Agent URL)
    │       ├── db/migration/                         # Flyway SQL 마이그레이션 (V001 ~ V022)
    │       │   ├── V001__create_plans.sql
    │       │   ├── ...
    │       │   └── V022__seed_initial_partitions.sql
    │       └── prompts/                              # (참고용 — 실제 프롬프트는 ai-agent 서비스 관리)
    │           └── README.md                         # 프롬프트는 ai-agent/prompts/ 참고 안내
    │
    └── test/
        └── java/io/secureai/
            ├── auth/AuthControllerTest.java          # 로그인·토큰 갱신 통합 테스트
            ├── analysis/AnalysisServiceTest.java     # AI Agent 호출 모킹 + 세션 생성 테스트
            ├── dast/DomainVerificationTest.java      # DNS·HTTP 소유권 확인 단위 테스트
            ├── security/PlanCheckerTest.java         # 플랜별 기능 제한 경계값 테스트
            ├── security/AesEncryptionTest.java       # AES-256-GCM 암·복호화 단위 테스트
            ├── scheduler/NvdSyncJobTest.java         # NVD API 모킹 + CVE 동기화 테스트
            └── resilience/CircuitBreakerTest.java    # AI Agent 장애 시 Circuit Breaker 동작 테스트
```

---

## 3. ai-agent/ — Python FastAPI + LangGraph

```
ai-agent/                                             # Python AI 에이전트 서비스 (별도 Docker 컨테이너)
│
├── Dockerfile                                        # python:3.12-slim, gunicorn + uvicorn workers
├── requirements.txt                                  # 의존성 고정 (langgraph, langsmith, anthropic, fastapi 등)
├── pyproject.toml                                    # 프로젝트 메타 + 개발 도구 설정 (black, ruff, mypy)
├── .env.example                                      # ANTHROPIC_API_KEY, LANGSMITH_API_KEY, REDIS_URL 등
│
├── main.py                                           # FastAPI 앱 생성, 라우터 등록, 앱 생명주기 이벤트
│
├── api/                                              # ─── HTTP API 엔드포인트 ─────────────────────────
│   ├── routes/
│   │   ├── analyze.py                               # POST /agent/analyze: SAST 분석 요청 수신 → 파이프라인 시작
│   │   ├── dast.py                                  # POST /agent/dast/run: DAST 실행 요청 수신
│   │   ├── patch.py                                 # POST /agent/patch/generate: 패치 코드 생성 요청
│   │   ├── chat.py                                  # POST /agent/chat: AI 채팅 메시지 처리 (SSE 스트리밍 응답)
│   │   └── health.py                                # GET /health: 서비스 헬스체크 (LangSmith 연결 확인 포함)
│   ├── middleware/
│   │   ├── internal_key_auth.py                     # X-Internal-Key 헤더 검증 미들웨어 (Spring Boot에서만 호출)
│   │   └── request_logger.py                        # 요청·응답 로깅 (LangSmith 트레이싱 연동)
│   └── schemas/
│       ├── analyze_schema.py                        # 분석 요청·응답 Pydantic 스키마
│       ├── dast_schema.py                           # DAST 요청·응답 스키마
│       ├── patch_schema.py                          # 패치 생성 요청·응답 스키마
│       └── common_schema.py                         # 공통 스키마 (SseEvent, AgentResult 등)
│
├── agent/                                            # ─── LangGraph 에이전트 파이프라인 ──────────────
│   │
│   ├── pipeline/
│   │   ├── security_audit_graph.py                  # ⭐ LangGraph 전체 그래프 정의 (노드·엣지·조건 분기)
│   │   ├── agent_state.py                           # ⭐ TypedDict 기반 AgentState (취약점 목록, 재시도 횟수 등)
│   │   └── graph_builder.py                         # 그래프 컴파일·캐싱 (앱 시작 시 1회 컴파일)
│   │
│   ├── nodes/                                        # LangGraph 노드 (각 단계 실행 함수)
│   │   ├── sast_node.py                             # ⭐ SAST 노드: MCP Tool로 파일 읽기 → Claude 분석 → 취약점 추출
│   │   ├── cache_check_node.py                      # 파일 SHA-256 → Redis 캐시 HIT 여부 판단 노드
│   │   ├── dast_node.py                             # ⭐ DAST 노드: 페이로드 생성 → Docker 샌드박스 실행 → 결과 판정
│   │   ├── patch_node.py                            # ⭐ 패치 노드: 취약점별 수정 코드 생성 → diff 생성
│   │   ├── report_node.py                           # 리포트 노드: 최종 결과 집계 → Backend API로 전달
│   │   └── notify_node.py                           # 알림 노드: Redis Pub/Sub으로 SSE 이벤트 발행
│   │
│   ├── edges/                                        # LangGraph 조건부 엣지 (라우팅 함수)
│   │   ├── after_sast.py                            # SAST 완료 후: 취약점 있으면 DAST, 없으면 END
│   │   ├── after_dast.py                            # DAST 완료 후: 성공/실패/재시도 판단 (최대 3회)
│   │   └── after_cache.py                           # 캐시 히트 시: SAST 건너뜀, 미스 시: SAST 실행
│   │
│   └── tools/                                        # LangGraph Tool 정의 (MCP 연동)
│       ├── mcp_filesystem_tools.py                  # ⭐ MCP Filesystem Tool 래퍼 (read_file, list_dir, search)
│       ├── mcp_github_tools.py                      # MCP GitHub Tool 래퍼 (get_contents, list_commits, get_diff)
│       ├── docker_tool.py                           # Docker SDK Tool: DAST 샌드박스 컨테이너 실행
│       └── tool_registry.py                         # 사용 가능한 Tool 목록 관리, 동적 등록
│
├── mcp/                                              # ─── MCP 클라이언트 연동 ────────────────────────
│   ├── mcp_client.py                                # ⭐ MCP Client: stdio 또는 HTTP 모드 전환 관리
│   ├── filesystem_client.py                         # MCP Filesystem Server 연결 (read_file, list_directory)
│   └── github_client.py                             # MCP GitHub Server 연결 (Phase 2)
│
├── llm/                                              # ─── LLM 호출 레이어 ─────────────────────────────
│   ├── claude_client.py                             # ⭐ Anthropic SDK 래퍼: Claude API 호출, SSE 스트리밍, 토큰 추적
│   ├── prompt_templates.py                          # SAST·DAST·패치·채팅 프롬프트 템플릿 (Jinja2)
│   └── response_parser.py                           # Claude JSON 응답 파싱, 불완전 JSON 복구 로직
│
├── prompts/                                          # ─── 프롬프트 파일 (외부 관리) ──────────────────
│   ├── sast_system.txt                              # SAST 분석 시스템 프롬프트 (역할, 출력 JSON 스키마)
│   ├── sast_user.jinja2                             # SAST 사용자 프롬프트 템플릿 ({{code}}, {{language}} 치환)
│   ├── dast_payload.jinja2                          # DAST 페이로드 생성 프롬프트 ({{vuln_type}}, {{endpoint}} 치환)
│   ├── patch_generation.jinja2                      # 패치 코드 생성 프롬프트 ({{vuln_description}}, {{original_code}})
│   └── chat_system.txt                              # AI 채팅 시스템 프롬프트 (보안 전문가 페르소나, 한/영 자동)
│
├── infrastructure/                                   # ─── 인프라 연동 ─────────────────────────────────
│   ├── redis_publisher.py                           # Redis Pub/Sub 발행 (SSE 이벤트 → secureai:sse:{sessionId})
│   ├── redis_client.py                              # Redis 연결 관리, SAST 캐시 읽기·쓰기
│   ├── backend_api_client.py                        # Backend REST API 클라이언트 (취약점·패치 저장 요청)
│   └── langsmith_tracer.py                          # LangSmith 트레이싱 설정 (에이전트 실행 전체 추적)
│
├── config/
│   └── settings.py                                  # Pydantic Settings: 환경변수 로드·검증 (ANTHROPIC_API_KEY 등)
│
└── tests/
    ├── test_sast_node.py                            # SAST 노드 단위 테스트 (Claude 응답 모킹)
    ├── test_dast_node.py                            # DAST 노드 단위 테스트 (Docker 모킹)
    ├── test_pipeline.py                             # 전체 파이프라인 통합 테스트 (LangGraph 실행)
    ├── test_mcp_client.py                           # MCP 클라이언트 단위 테스트 (stdio 모킹)
    └── fixtures/
        ├── sample_vuln_response.json               # Claude SAST 응답 픽스처
        └── sample_code/                            # 테스트용 취약한 코드 샘플
```

---

## 4. mcp-server/ — MCP Server (Node.js)

```
mcp-server/                                           # MCP Server (공식 Node.js SDK 기반)
│
├── Dockerfile                                        # node:20-alpine, npx 또는 빌드 후 node 실행
├── package.json                                      # @modelcontextprotocol/sdk 의존성
├── tsconfig.json                                     # TypeScript 설정
│
├── src/
│   ├── index.ts                                     # ⭐ MCP Server 진입점: Tool 등록, 전송 방식(stdio/HTTP) 설정
│   │
│   ├── tools/                                        # MCP Tool 구현체
│   │   ├── filesystem/
│   │   │   ├── read_file.ts                         # 파일 내용 읽기 (rootPath 화이트리스트 검증)
│   │   │   ├── list_directory.ts                    # 디렉토리 트리 탐색 (숨김파일 제외 옵션)
│   │   │   ├── search_files.ts                      # 패턴 매칭 파일 검색 (시크릿 탐지용)
│   │   │   └── get_file_info.ts                     # 파일 메타정보 (크기, 수정일, 언어 감지)
│   │   └── github/                                   # Phase 2 — GitHub MCP Tool
│   │       ├── get_repo_contents.ts                 # GitHub 파일 내용 조회
│   │       ├── list_commits.ts                      # 커밋 히스토리 목록
│   │       ├── get_commit_diff.ts                   # 커밋별 변경 diff
│   │       └── create_pr_comment.ts                 # PR에 보안 리뷰 코멘트 자동 작성
│   │
│   └── security/
│       ├── path_validator.ts                        # ⭐ 경로 탈출 방지 (../, 심볼릭 링크, rootPath 외부 차단)
│       └── file_filter.ts                           # 바이너리·과대 파일 필터, .env 마스킹 규칙
│
└── tests/
    ├── read_file.test.ts
    └── path_validator.test.ts
```

---

## 5. frontend/ — Next.js 15 (웹)

```
frontend/
│
├── Dockerfile                                        # node:20-alpine → Next.js standalone 빌드
├── package.json                                      # next, react, @monaco-editor/react, zustand, recharts 등
├── tsconfig.json                                     # TypeScript strict 모드, @ 경로 alias
├── next.config.js                                    # standalone 빌드, API 프록시(/api/* → backend:8080)
├── tailwind.config.js                                # 다크 테마 색상 토큰 (--bg0 ~ --orange 등)
├── .eslintrc.json                                    # ESLint + eslint-plugin-security
│
└── src/
    │
    ├── app/                                          # Next.js App Router 페이지
    │   ├── layout.tsx                               # 루트 레이아웃: 폰트, Provider 트리, 다크 html 속성
    │   ├── page.tsx                                 # "/" 진입: 인증 여부로 랜딩 or 대시보드 분기
    │   ├── globals.css                              # VSCode 다크 테마 CSS 변수, Monaco 데코레이션 클래스
    │   │
    │   ├── (auth)/                                  # 인증 페이지 그룹 (헤더 없는 레이아웃)
    │   │   ├── layout.tsx
    │   │   ├── login/page.tsx                       # 이메일+비밀번호 로그인, GitHub OAuth 버튼
    │   │   ├── register/page.tsx                    # 회원가입 폼
    │   │   ├── callback/page.tsx                    # GitHub OAuth 콜백: URL에서 accessToken 추출
    │   │   └── forgot-password/page.tsx             # 비밀번호 재설정 요청
    │   │
    │   ├── (app)/                                   # 인증 필요 페이지 그룹
    │   │   ├── layout.tsx                           # 인증 미완료 시 /login 리다이렉트
    │   │   ├── dashboard/page.tsx                   # 전체 프로젝트 목록 + 보안 현황 대시보드
    │   │   └── projects/
    │   │       ├── new/page.tsx                     # 새 프로젝트 생성 (소스 타입 선택)
    │   │       └── [projectId]/
    │   │           ├── page.tsx                     # 프로젝트 홈: 분석 이력, 점수 트렌드
    │   │           ├── editor/page.tsx              # ⭐ 메인 에디터 (파일트리+Monaco+DAST터미널+패널)
    │   │           ├── analysis/[sessionId]/page.tsx # 완료된 세션 결과 재조회
    │   │           ├── reports/page.tsx             # 리포트 목록 + 생성
    │   │           └── settings/page.tsx            # GitHub 연동, 팀 멤버, 알림 설정
    │   │
    │   └── shared/reports/[token]/page.tsx          # 공개 공유 리포트 (인증 불필요)
    │
    ├── components/
    │   ├── editor/
    │   │   ├── EditorLayout.tsx                     # ⭐ 3패널 레이아웃 조합 (사이드바+에디터+우측패널)
    │   │   ├── FileTree.tsx                         # ⭐ MCP 파일 트리: 취약점 도트, 폴더 드릴다운
    │   │   ├── CodeEditor.tsx                       # ⭐ Monaco Editor 래퍼: 취약점 데코레이션, Diff 뷰어
    │   │   ├── EditorTabs.tsx                       # 열린 파일 탭 (취약점 파일 빨간 도트 표시)
    │   │   └── EditorHeader.tsx                     # 헤더: 심각도 필터 버튼, 분석 시작, Export
    │   ├── analysis/
    │   │   ├── VulnDetailPanel.tsx                  # ⭐ 취약점 토글: 설명+콜체인+Diff+AutoFix
    │   │   ├── CallChainView.tsx                    # API 호출 체인 트리 (취약 노드 빨간 글로우)
    │   │   ├── DiffViewer.tsx                       # Before/After 코드 비교 (Monaco DiffEditor)
    │   │   ├── DastTerminal.tsx                     # DAST 실시간 로그 (SSE 구독, ANSI 컬러)
    │   │   ├── ChatPanel.tsx                        # AI 채팅 (스트리밍 응답, 취약점 컨텍스트)
    │   │   └── AnalysisLoadingOverlay.tsx           # 분석 시작 전체화면 오버레이 (단계별 메시지)
    │   ├── dashboard/
    │   │   ├── SecurityScoreRing.tsx                # 보안 점수 원형 게이지 차트
    │   │   ├── KpiCard.tsx                          # 수치 카드 컴포넌트
    │   │   ├── SeverityBarChart.tsx                 # OWASP 카테고리별 바 차트 (recharts)
    │   │   ├── TrendLineChart.tsx                   # 7일 트렌드 라인 차트 (recharts)
    │   │   ├── FileHeatmap.tsx                      # 파일별 취약점 히트맵
    │   │   ├── OwaspCoverageMatrix.tsx              # OWASP Top 10 A01~A10 커버리지 표
    │   │   └── PrReviewHistory.tsx                  # GitHub PR 보안 리뷰 이력 테이블
    │   ├── ui/
    │   │   ├── FilterBar.tsx                        # API 그룹 필터 칩 (글로우 active 효과)
    │   │   ├── SeverityBadge.tsx                    # Critical/High/Medium/Low 배지
    │   │   ├── ResizeHandle.tsx                     # 드래그 리사이즈 핸들
    │   │   ├── ResizablePanel.tsx                   # 리사이즈 가능 패널 래퍼
    │   │   ├── SseIndicator.tsx                     # SSE 연결 상태 점멸 아이콘
    │   │   ├── PlanBadge.tsx                        # Free/Pro/Team/Enterprise 배지
    │   │   ├── Modal.tsx                            # 공통 모달 (Portal 렌더링)
    │   │   ├── Toast.tsx                            # 취약점 발견 실시간 Toast 알림
    │   │   └── Button.tsx                           # 공통 버튼 (primary/ghost/danger variant)
    │   └── layout/
    │       ├── AppHeader.tsx                        # 앱 헤더 (로고, 네비, 사용자 메뉴)
    │       ├── AppSidebar.tsx                       # 프로젝트 목록 사이드바
    │       └── MobileBottomNav.tsx                  # 모바일 하단 탭 네비게이션
    │
    ├── store/
    │   ├── useSecureStore.ts                        # ⭐ 통합 Zustand 스토어 (뷰모드·필터·패널크기·취약점 목록)
    │   ├── useAuthStore.ts                          # 인증 상태 (accessToken 메모리 저장, 사용자 정보)
    │   ├── useEditorStore.ts                        # 에디터 상태 (선택 파일, 열린 탭, 커서 위치)
    │   └── useSessionStore.ts                       # 분석 세션 상태 (진행 중 세션 ID, SSE 연결 상태)
    │
    ├── hooks/
    │   ├── useAuth.ts                               # 인증 훅 (로그인·로그아웃, accessToken 자동 갱신)
    │   ├── useSse.ts                                # ⭐ SSE 구독 훅 (이벤트 타입별 콜백, 자동 재연결)
    │   ├── useVulnFilter.ts                         # AND 필터 계산 훅 (severity + apiGroup)
    │   ├── useResizablePanel.ts                     # 드래그 리사이즈 훅 (mousedown/move 이벤트)
    │   ├── useMonaco.ts                             # Monaco 초기화 + 취약점 데코레이션 적용
    │   └── useToast.ts                              # 토스트 알림 훅 (전역 큐 관리)
    │
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts                            # ⭐ Axios 인스턴스 (baseURL, 인터셉터, 401 자동 갱신)
    │   │   ├── auth.ts / projects.ts / analysis.ts  # 도메인별 API 함수 모음
    │   │   ├── vulnerabilities.ts / dast.ts          # 취약점·DAST API 함수
    │   │   └── patches.ts / reports.ts / github.ts  # 패치·리포트·GitHub API 함수
    │   ├── monaco/
    │   │   ├── decorations.ts                       # ⭐ Monaco 취약점 하이라이팅·글로우·툴팁 정의
    │   │   └── themes.ts                            # SecureAI Dark 테마 정의
    │   ├── utils/
    │   │   ├── severity.ts                          # 심각도 → 색상·아이콘 매핑
    │   │   ├── fileHash.ts                          # Web Crypto API SHA-256 해시 계산
    │   │   └── formatters.ts                        # 날짜·용량·점수 포맷
    │   └── constants/
    │       ├── owasp.ts                             # OWASP Top 10 A01~A10 상수
    │       └── cwe.ts                               # 주요 CWE 번호 → 이름 매핑
    │
    └── types/                                        # TypeScript 타입 정의 (도메인별 분리)
        ├── auth.ts / project.ts / analysis.ts
        ├── vulnerability.ts / dast.ts
        ├── patch.ts / report.ts
        └── sse.ts                                   # SseEvent union 타입 (progress | vuln_found | completed | error)
```

---

## 6. android/ — Kotlin + Jetpack Compose

```
android/                                              # Android 앱 (Kotlin + Jetpack Compose)
│
├── build.gradle.kts                                  # 앱 수준 Gradle (minSdk 26, targetSdk 35, 서명 설정)
├── settings.gradle.kts                               # 모듈 구성
├── google-services.json.example                      # FCM 설정 템플릿 (실제 파일은 .gitignore)
│
└── app/
    ├── build.gradle.kts                              # 의존성 (Compose, Retrofit, Room, Hilt, Coil, OkHttp)
    └── src/main/
        ├── AndroidManifest.xml                       # 퍼미션 (INTERNET, POST_NOTIFICATIONS), FCM Service 등록
        │
        ├── java/io/secureai/android/
        │   │
        │   ├── SecureAiApp.kt                       # Application 클래스: Hilt 초기화, 앱 시작 설정
        │   │
        │   ├── ui/                                   # ─── Jetpack Compose UI ─────────────────────────
        │   │   ├── MainActivity.kt                  # 단일 Activity: NavHost, FCM 토큰 갱신, 딥링크 처리
        │   │   ├── navigation/
        │   │   │   └── NavGraph.kt                  # Compose Navigation 그래프 (모든 화면 경로 정의)
        │   │   │
        │   │   ├── screen/
        │   │   │   ├── auth/
        │   │   │   │   ├── LoginScreen.kt           # 이메일·비밀번호 로그인, GitHub OAuth 진입
        │   │   │   │   └── RegisterScreen.kt        # 회원가입 폼
        │   │   │   ├── dashboard/
        │   │   │   │   └── DashboardScreen.kt       # 프로젝트 목록 + 보안 점수 카드
        │   │   │   ├── project/
        │   │   │   │   ├── ProjectDetailScreen.kt   # 프로젝트 홈: 분석 이력, 점수 트렌드
        │   │   │   │   └── NewProjectScreen.kt      # 새 프로젝트 생성
        │   │   │   ├── analysis/
        │   │   │   │   ├── AnalysisScreen.kt        # 분석 시작·진행 상황 (FCM/SSE 실시간 업데이트)
        │   │   │   │   └── VulnListScreen.kt        # 취약점 목록 (필터 칩, 스와이프 상세 진입)
        │   │   │   ├── vulnerability/
        │   │   │   │   └── VulnDetailScreen.kt      # 취약점 상세: 콜체인, DAST 결과, AutoFix 버튼
        │   │   │   ├── chat/
        │   │   │   │   └── ChatScreen.kt            # AI 채팅 화면 (스트리밍 응답, 코드 스니펫 표시)
        │   │   │   └── settings/
        │   │   │       └── SettingsScreen.kt        # 계정·알림·플랜 설정
        │   │   │
        │   │   └── component/                        # 재사용 Compose 컴포넌트
        │   │       ├── SecurityScoreGauge.kt        # 보안 점수 원형 게이지 (Canvas API)
        │   │       ├── SeverityChip.kt              # Critical/High/Medium/Low 칩
        │   │       ├── VulnCard.kt                  # 취약점 카드 (목록용)
        │   │       ├── CodeBlock.kt                 # 코드 스니펫 표시 (monospace, 구문 강조)
        │   │       ├── SseStatusBadge.kt            # SSE 연결 상태 배지 (foreground 전용)
        │   │       └── PlanBadge.kt                 # 플랜 배지
        │   │
        │   ├── viewmodel/                            # ─── MVVM ViewModel ─────────────────────────────
        │   │   ├── AuthViewModel.kt                 # 로그인·로그아웃, 토큰 갱신, 사용자 상태
        │   │   ├── DashboardViewModel.kt            # 프로젝트 목록, 전체 보안 현황
        │   │   ├── AnalysisViewModel.kt             # ⭐ 분석 시작, SSE 구독 (foreground), FCM 수신 처리
        │   │   ├── VulnListViewModel.kt             # 취약점 목록 + 필터 상태, 페이지 로딩
        │   │   ├── VulnDetailViewModel.kt           # 취약점 상세, 패치 조회, AutoFix 요청
        │   │   └── ChatViewModel.kt                 # 채팅 메시지 StateFlow, 스트리밍 응답 누적
        │   │
        │   ├── repository/                           # ─── Repository (MVVM 데이터 계층) ─────────────
        │   │   ├── AuthRepository.kt                # 로그인·토큰 갱신·로그아웃 (Remote + EncryptedPrefs)
        │   │   ├── ProjectRepository.kt             # 프로젝트 목록·상세 (Remote + Room 캐시)
        │   │   ├── AnalysisRepository.kt            # 세션 생성·조회, SSE 스트림 Flow 변환
        │   │   ├── VulnerabilityRepository.kt       # 취약점 목록·상세 (Remote + Room 캐시)
        │   │   └── ChatRepository.kt                # 채팅 메시지 전송, 스트리밍 Flow 반환
        │   │
        │   ├── data/                                 # ─── 데이터 소스 ──────────────────────────────
        │   │   ├── remote/
        │   │   │   ├── api/
        │   │   │   │   ├── AuthApi.kt               # Retrofit 인터페이스: 인증 관련 엔드포인트
        │   │   │   │   ├── ProjectApi.kt            # 프로젝트 엔드포인트
        │   │   │   │   ├── AnalysisApi.kt           # 분석 세션 엔드포인트
        │   │   │   │   ├── VulnerabilityApi.kt      # 취약점 엔드포인트
        │   │   │   │   └── ChatApi.kt               # 채팅 엔드포인트
        │   │   │   └── sse/
        │   │   │       └── SseClient.kt             # ⭐ OkHttp SSE 클라이언트: Flow<SseEvent> 반환, 재연결 처리
        │   │   ├── local/
        │   │   │   ├── AppDatabase.kt               # Room 데이터베이스 정의
        │   │   │   ├── dao/
        │   │   │   │   ├── ProjectDao.kt            # 프로젝트 로컬 캐시 DAO
        │   │   │   │   └── VulnerabilityDao.kt      # 취약점 로컬 캐시 DAO (오프라인 조회)
        │   │   │   └── entity/
        │   │   │       ├── ProjectEntity.kt         # Room 프로젝트 엔티티
        │   │   │       └── VulnerabilityEntity.kt   # Room 취약점 엔티티
        │   │   └── model/                            # 데이터 모델 (서버 응답 ↔ UI 모델 변환)
        │   │       ├── request/                     # API 요청 데이터 클래스
        │   │       └── response/                    # API 응답 데이터 클래스
        │   │
        │   ├── di/                                   # ─── Hilt 의존성 주입 모듈 ───────────────────
        │   │   ├── NetworkModule.kt                 # ⭐ OkHttp(인증서 피닝) + Retrofit + Moshi 빈 제공
        │   │   ├── DatabaseModule.kt                # Room DB 빈 제공
        │   │   ├── RepositoryModule.kt              # Repository 구현체 바인딩
        │   │   └── FirebaseModule.kt                # FCM 관련 빈 제공
        │   │
        │   ├── fcm/
        │   │   └── SecureAiFcmService.kt            # ⭐ FirebaseMessagingService: Push 수신 → 알림 표시 → 딥링크
        │   │
        │   └── security/
        │       ├── CertificatePinner.kt             # ⭐ OkHttp 인증서 피닝 설정 (API Gateway SHA-256 핀)
        │       ├── RootDetector.kt                  # 루트 탐지 (앱 실행 시 경고, 민감 기능 차단)
        │       └── TokenStorage.kt                  # EncryptedSharedPreferences 기반 토큰 저장·조회
        │
        └── res/
            ├── values/
            │   ├── strings.xml                      # 앱 문자열 (한국어)
            │   └── colors.xml                       # 다크 테마 색상 (웹과 동일 색상 토큰 사용)
            ├── xml/
            │   ├── network_security_config.xml      # cleartext 트래픽 차단, 도메인 핀 설정
            │   └── file_paths.xml                   # FileProvider 경로 (PDF 공유용)
            └── drawable/
                └── ic_notification.xml             # FCM 알림 아이콘
```

---

## 7. dast-sandbox/ — Python DAST 격리 컨테이너

```
dast-sandbox/                                         # Docker 동적 생성 DAST 샌드박스
│
├── Dockerfile                                        # python:3.12-slim, 최소 패키지 (requests, httpx만)
├── requirements.txt                                  # 의존성 버전 고정
│
├── dast_runner.py                                    # ⭐ 진입점: 환경변수에서 페이로드·타겟 수신 → 실행 → 결과 JSON 출력
├── executors/
│   ├── sqli_executor.py                             # SQL Injection (에러 기반·시간 기반·블라인드)
│   ├── xss_executor.py                              # XSS (Reflected·Stored 기초 탐지)
│   ├── idor_executor.py                             # IDOR (ID 순회, 권한 없는 리소스 접근)
│   ├── ssrf_executor.py                             # SSRF (내부망 주소 리다이렉트 탐지)
│   └── auth_bypass_executor.py                      # 인증 우회 (JWT none 알고리즘, 빈 토큰 등)
│
└── utils/
    ├── result_formatter.py                          # 실행 결과 JSON 직렬화 (AI Agent가 파싱)
    └── logger.py                                    # stdout 로그 출력 (Docker logs API로 수집)
```

---

## 8. infra/ — Docker / 인프라

```
infra/
│
├── docker/
│   ├── postgres/
│   │   └── init.sql                                 # pg_crypto 확장, DB locale 설정
│   ├── redis/
│   │   └── redis.conf                               # maxmemory, eviction policy, requirepass 설정
│   └── nginx/
│       ├── nginx.conf                               # ⭐ API Gateway: 라우팅·Rate Limit·SSL·보안 헤더
│       └── ssl/                                     # SSL 인증서 (Let's Encrypt, .gitignore)
│           ├── .gitkeep
│           └── README.md                            # certbot 갱신 명령어 안내
│
├── scripts/
│   ├── create_partitions.sql                        # 월별 DB 파티션 수동 생성 스크립트
│   ├── seed_dev_data.sql                            # 개발용 샘플 데이터 (유저·프로젝트·취약점)
│   └── backup.sh                                    # pg_dump + S3 업로드 (Phase 3 운영 백업)
│
└── monitoring/                                       # Phase 3 운영 관측성
    ├── prometheus.yml                               # Spring Actuator /metrics 스크레이핑 설정
    └── grafana/dashboards/
        └── secureai-overview.json                   # Grafana 대시보드 (처리량·에러율·DAST 실행시간)
```

---

## 9. docs/ — 설계 문서

```
docs/
├── 00_ARCHITECTURE_DECISIONS.md                      # 아키텍처 의사결정 기록 (ADR v1)
├── 01_ERD.md                                         # DB ERD 설계서
├── 02_API_DESIGN.md                                  # REST API 설계서
├── 03_DOCKER_INFRA.md                                # Docker 인프라 설계서
├── 04_REPOSITORY_STRUCTURE.md                        # 레포지토리 구조 v1 (구버전 참고)
├── 05_ARCHITECTURE_PHILOSOPHY.md                     # ⭐ 아키텍처 철학 & 설계 패턴 설명서
├── 06_REPOSITORY_STRUCTURE_V2.md                     # ⭐ 이 파일 (레포지토리 구조 v2)
└── wireframes/
    ├── secureai-wireframe.html
    ├── secureai-webapp.html
    └── secureai-mobile.html
```

---

## 10. 핵심 파일 상세 설명

### 10.1 `ai-agent/agent/pipeline/security_audit_graph.py` ⭐

Python LangGraph로 전체 보안 감사 파이프라인을 그래프로 정의하는 파일입니다.

```python
# 역할: SAST → DAST → Patch → Report 흐름의 노드·엣지 정의
# 장점: 각 단계가 실패해도 다음 단계로 넘어가는 조건 제어,
#       재시도 루프, 부분 성공 처리 모두 그래프 수준에서 선언적 정의

from langgraph.graph import StateGraph, END
from .agent_state import AgentState

def build_security_audit_graph():
    graph = StateGraph(AgentState)

    # 노드 등록
    graph.add_node("cache_check", cache_check_node)   # 파일 해시 캐시 확인
    graph.add_node("sast",        sast_node)           # Claude AI SAST 분석
    graph.add_node("dast",        dast_node)           # Docker DAST 실행
    graph.add_node("patch",       patch_node)          # 패치 코드 생성
    graph.add_node("report",      report_node)         # 결과 집계·전송
    graph.add_node("notify",      notify_node)         # SSE Redis Pub/Sub 이벤트 발행

    # 엣지 정의
    graph.set_entry_point("cache_check")

    # 캐시 히트 → SAST 건너뜀
    graph.add_conditional_edges("cache_check", after_cache_edge,
        {"hit": "report", "miss": "sast"})

    # SAST 완료 → 취약점 있으면 DAST, 없으면 바로 report
    graph.add_conditional_edges("sast", after_sast_edge,
        {"has_vulns": "dast", "clean": "report", "notify": "notify"})

    graph.add_edge("notify", "sast")  # notify 후 다음 파일로

    # DAST → 성공/재시도(최대3회)/실패 분기
    graph.add_conditional_edges("dast", after_dast_edge,
        {"success": "patch", "retry": "dast", "give_up": "patch"})

    graph.add_edge("patch", "report")
    graph.add_edge("report", END)

    return graph.compile()

# LangSmith 자동 트레이싱: 각 노드 실행 시간, 입력·출력 자동 기록
```

---

### 10.2 `ai-agent/agent/tools/mcp_filesystem_tools.py` ⭐

MCP Filesystem Server와 Python LangGraph Tool을 연결하는 핵심 파일입니다.

```python
# 역할: LangGraph Agent가 @tool 데코레이터로 MCP Tool 직접 호출
# MCP Client는 stdio 또는 HTTP 모드 자동 선택

from langchain_core.tools import tool
from ..mcp.mcp_client import get_mcp_client

@tool
async def read_file(file_path: str) -> str:
    """파일 내용을 읽어 반환합니다. (MCP Filesystem Tool 래퍼)"""
    client = await get_mcp_client()
    result = await client.call_tool("read_file", {"path": file_path})
    return result.content

@tool
async def list_directory(dir_path: str, recursive: bool = True) -> list[dict]:
    """디렉토리 파일 트리를 반환합니다."""
    client = await get_mcp_client()
    result = await client.call_tool("list_directory", {
        "path": dir_path, "recursive": recursive
    })
    return result.content

@tool
async def search_files(pattern: str, root_path: str) -> list[str]:
    """패턴과 일치하는 파일 경로 목록을 반환합니다. (시크릿 탐지용)"""
    client = await get_mcp_client()
    result = await client.call_tool("search_files", {
        "pattern": pattern, "path": root_path
    })
    return result.content
```

---

### 10.3 `backend/src/main/java/io/secureai/analysis/service/AiAgentClient.java` ⭐

Spring Boot에서 Python AI Agent를 호출하는 HTTP 클라이언트입니다.

```java
// 역할: Python AI Agent로 분석 요청 위임, Circuit Breaker로 장애 격리
// Resilience4j: 50% 실패율 → Circuit Open → 30초 후 Half-Open 시도

@Service
public class AiAgentClient {

    @CircuitBreaker(name = "aiAgent", fallbackMethod = "fallback")
    @Retry(name = "aiAgent")
    @Async("aiCallExecutor")
    public CompletableFuture<Void> requestAnalysis(AgentAnalyzeRequest request) {
        return webClient.post()
            .uri(aiAgentUrl + "/agent/analyze")
            .header("X-Internal-Key", internalApiKey)  // 내부 서비스 인증
            .bodyValue(request)
            .retrieve()
            .bodyToMono(Void.class)
            .toFuture();
    }

    // Circuit Open 시 fallback: 세션 status=failed 업데이트
    public CompletableFuture<Void> fallback(AgentAnalyzeRequest req, Exception ex) {
        sessionService.markFailed(req.getSessionId(), "AI 서비스 일시 불가");
        return CompletableFuture.completedFuture(null);
    }
}
```

---

### 10.4 `android/app/src/main/java/io/secureai/android/di/NetworkModule.kt` ⭐

Android OkHttp 인증서 피닝 설정이 포함된 Hilt DI 모듈입니다.

```kotlin
// 역할: Retrofit + OkHttp 빈 제공, 인증서 피닝으로 MITM 방어

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    fun provideOkHttpClient(tokenStorage: TokenStorage): OkHttpClient {
        return OkHttpClient.Builder()
            .certificatePinner(
                CertificatePinner.Builder()
                    // API Gateway 인증서 SHA-256 핀 (갱신 시 앱 업데이트 필요)
                    .add("api.secureai.io", "sha256/AAAA...==")  // 현재 인증서
                    .add("api.secureai.io", "sha256/BBBB...==")  // 백업 핀
                    .build()
            )
            .addInterceptor { chain ->
                val token = tokenStorage.getAccessToken()
                val req = if (token != null)
                    chain.request().newBuilder()
                        .addHeader("Authorization", "Bearer $token")
                        .build()
                else chain.request()
                chain.proceed(req)
            }
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }
}
```

---

### 10.5 `android/app/src/main/java/io/secureai/android/data/remote/sse/SseClient.kt` ⭐

Android에서 OkHttp로 SSE를 구독하고 Kotlin Flow로 변환하는 클라이언트입니다.

```kotlin
// 역할: foreground SSE 구독 → Flow<SseEvent> 반환
// background 전환 시 자동 해제, FCM Push가 대신 처리

class SseClient(private val okHttpClient: OkHttpClient) {

    fun subscribe(sessionId: String, token: String): Flow<SseEvent> = callbackFlow {
        val request = Request.Builder()
            .url("$BASE_URL/api/v1/analysis/sessions/$sessionId/stream?token=$token")
            .build()

        val listener = object : EventSourceListener() {
            override fun onEvent(source: EventSource, id: String?,
                                  type: String?, data: String) {
                val event = parseEvent(type, data)
                trySend(event)
            }
            override fun onFailure(source: EventSource, t: Throwable?, r: Response?) {
                // 재연결: exponential backoff (최대 5회)
                close(t)
            }
        }

        val eventSource = EventSources.createFactory(okHttpClient)
            .newEventSource(request, listener)

        awaitClose { eventSource.cancel() }
    }
}
```

---

### 10.6 `docker-compose.yml` ⭐

개발 환경에서 6개 서비스를 단일 명령으로 실행합니다.

```yaml
# 서비스 구성:
#   postgres:   PostgreSQL 15 (데이터 영속)
#   redis:      Redis 7 (캐시·Pub/Sub)
#   mcp-server: MCP Server Node.js (파일시스템 Tool)
#   ai-agent:   Python FastAPI + LangGraph
#   backend:    Spring Boot (메인 API)
#   frontend:   Next.js (웹 클라이언트)
#
# 네트워크:
#   secureai-app-net: backend ↔ ai-agent ↔ mcp-server 통신
#   secureai-data-net: backend·ai-agent ↔ postgres·redis (데이터 전용)
#   dast-isolated-net: DAST 컨테이너 전용 (동적 생성)
```

---

*이전 문서: [05_ARCHITECTURE_PHILOSOPHY.md] — 아키텍처 철학 & 설계 패턴*
