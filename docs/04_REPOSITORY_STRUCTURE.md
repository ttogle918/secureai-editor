# SecureAI — 레포지토리 구조 설계서
> 작성자: 시니어 백엔드 개발자 / 데이터 아키텍처 전문가  
> 작성일: 2026-04-19 | 버전: v1.0  
> 기준 스택: Spring Boot 3 (Java 21) + Next.js 15 + PostgreSQL 15 + Redis 7

---

## 목차

1. [모노레포 전체 구조](#1-모노레포-전체-구조)
2. [백엔드 상세 구조 (Spring Boot)](#2-백엔드-상세-구조-spring-boot)
3. [프론트엔드 상세 구조 (Next.js)](#3-프론트엔드-상세-구조-nextjs)
4. [DAST 샌드박스 구조](#4-dast-샌드박스-구조)
5. [인프라 / Docker 구조](#5-인프라--docker-구조)
6. [핵심 파일 상세 설명](#6-핵심-파일-상세-설명)

---

## 1. 모노레포 전체 구조

```
secureai/                                           # 프로젝트 루트 (Git 루트)
│
├── .github/                                        # GitHub 관련 설정
│   ├── workflows/
│   │   ├── ci-backend.yml                          # 백엔드 CI: 빌드 + 테스트 + Docker 이미지 빌드
│   │   ├── ci-frontend.yml                         # 프론트엔드 CI: lint + 타입체크 + 빌드
│   │   └── security-scan.yml                       # SecureAI 자기 자신에게 SAST 실행 (먹이사슬)
│   ├── PULL_REQUEST_TEMPLATE.md                    # PR 템플릿: 보안 체크리스트 포함
│   └── ISSUE_TEMPLATE/
│       ├── bug_report.md
│       └── feature_request.md
│
├── backend/                                        # Spring Boot 3 백엔드
│   └── (상세 구조: 섹션 2 참고)
│
├── frontend/                                       # Next.js 15 프론트엔드
│   └── (상세 구조: 섹션 3 참고)
│
├── dast-sandbox/                                   # DAST Docker 샌드박스
│   └── (상세 구조: 섹션 4 참고)
│
├── infra/                                          # 인프라 설정
│   └── (상세 구조: 섹션 5 참고)
│
├── docs/                                           # 설계 문서 모음
│   ├── 00_ARCHITECTURE_DECISIONS.md                # 아키텍처 의사결정 기록 (ADR)
│   ├── 01_ERD.md                                   # DB ERD 설계서
│   ├── 02_API_DESIGN.md                            # REST API 설계서
│   ├── 03_DOCKER_INFRA.md                          # Docker 인프라 설계서
│   ├── 04_REPOSITORY_STRUCTURE.md                  # 이 파일 (레포지토리 구조)
│   └── wireframes/                                 # UI 와이어프레임 HTML 파일들
│       ├── secureai-wireframe.html
│       ├── secureai-webapp.html
│       └── secureai-mobile.html
│
├── .env.example                                    # 환경변수 템플릿 (민감값 제외, Git 포함)
├── .gitignore                                      # .env, *.db, build/, node_modules/ 등 제외
├── docker-compose.yml                              # 개발 환경 전체 컨테이너 정의
├── docker-compose.prod.yml                         # 운영 환경 오버라이드
├── Makefile                                        # 자주 쓰는 명령어 단축키 (make dev, make test 등)
└── README.md                                       # 프로젝트 소개 + 빠른 시작 가이드
```

---

## 2. 백엔드 상세 구조 (Spring Boot)

```
backend/
│
├── Dockerfile                                      # Spring Boot 멀티스테이지 빌드 (JDK21 → JRE21)
├── build.gradle.kts                                # Gradle 빌드 스크립트 (의존성 + 플러그인)
├── settings.gradle.kts                             # Gradle 프로젝트명 설정
├── gradlew / gradlew.bat                           # Gradle Wrapper (버전 고정)
│
└── src/
    ├── main/
    │   ├── java/io/secureai/
    │   │   │
    │   │   ├── SecureAiApplication.java            # Spring Boot 진입점 (@SpringBootApplication)
    │   │   │
    │   │   ├── config/                             # 전역 설정 클래스
    │   │   │   ├── AsyncConfig.java                # @Async Thread Pool 4종 설정 (analysis/dast/report/email)
    │   │   │   ├── CacheConfig.java                # Redis CacheManager 설정, TTL 정책 정의
    │   │   │   ├── SecurityConfig.java             # Spring Security 6 필터체인, CORS, CSRF 설정
    │   │   │   ├── JwtConfig.java                  # JWT 서명 키, 만료시간 프로퍼티 바인딩
    │   │   │   ├── RedisConfig.java                # RedisTemplate, Pub/Sub 리스너 설정
    │   │   │   ├── DockerConfig.java               # Docker Java SDK 클라이언트 빈 등록
    │   │   │   ├── WebConfig.java                  # MVC 설정 (인터셉터, 메시지 컨버터)
    │   │   │   └── OpenApiConfig.java              # Swagger/OpenAPI 3 문서 설정
    │   │   │
    │   │   ├── domain/                             # 핵심 비즈니스 도메인 (패키지별 분리)
    │   │   │   │
    │   │   │   ├── auth/                           # 인증/인가 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── AuthController.java     # POST /auth/login, /register, /refresh, /logout
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── AuthService.java        # 로그인/회원가입/토큰 발급 핵심 로직
    │   │   │   │   │   └── TokenService.java       # JWT 생성/검증, Refresh Token Rotation 처리
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── LoginRequest.java       # 로그인 요청 DTO
    │   │   │   │   │   ├── LoginResponse.java      # accessToken, user 정보 응답 DTO
    │   │   │   │   │   ├── RegisterRequest.java    # 회원가입 요청 DTO (이메일, 비밀번호, 닉네임)
    │   │   │   │   │   └── TokenRefreshResponse.java # 새 accessToken 응답 DTO
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── RefreshToken.java       # refresh_tokens 테이블 JPA 엔티티
    │   │   │   │   ├── repository/
    │   │   │   │   │   └── RefreshTokenRepository.java # Refresh Token CRUD, 만료 토큰 삭제
    │   │   │   │   ├── oauth/
    │   │   │   │   │   ├── GitHubOAuthService.java # GitHub OAuth 코드→토큰→사용자정보 교환
    │   │   │   │   │   └── GitHubUserInfo.java     # GitHub API 응답 사용자 정보 DTO
    │   │   │   │   └── filter/
    │   │   │   │       └── JwtAuthenticationFilter.java # 매 요청 JWT 검증 → SecurityContext 주입
    │   │   │   │
    │   │   │   ├── user/                           # 사용자 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── UserController.java     # GET /users/me, PATCH, DELETE /users/me
    │   │   │   │   ├── service/
    │   │   │   │   │   └── UserService.java        # 사용자 조회/수정, SAST 사용량 추적, 플랜 확인
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── UserResponse.java       # 사용자 + 플랜 + 사용량 통합 응답 DTO
    │   │   │   │   │   └── UserUpdateRequest.java  # 닉네임, 타임존 등 수정 요청 DTO
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── User.java               # users 테이블 JPA 엔티티 (Soft Delete 포함)
    │   │   │   │   │   └── Plan.java               # plans 테이블 JPA 엔티티 (기능 제한 플래그)
    │   │   │   │   └── repository/
    │   │   │   │       ├── UserRepository.java     # 이메일/GitHub ID로 사용자 조회
    │   │   │   │       └── PlanRepository.java     # 플랜 목록 조회 (거의 변경 없음, 캐시)
    │   │   │   │
    │   │   │   ├── project/                        # 프로젝트 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── ProjectController.java  # CRUD /projects, 팀 멤버 관리 엔드포인트
    │   │   │   │   ├── service/
    │   │   │   │   │   └── ProjectService.java     # 프로젝트 생성/수정/삭제, 멤버 초대, 보안점수 갱신
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── ProjectCreateRequest.java  # 프로젝트 생성 요청 DTO
    │   │   │   │   │   ├── ProjectResponse.java       # 프로젝트 + 최근 세션 요약 응답 DTO
    │   │   │   │   │   └── ProjectListResponse.java   # 목록 조회 경량 DTO
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── Project.java            # projects 테이블 JPA 엔티티
    │   │   │   │   │   └── TeamMember.java         # team_members 테이블 JPA 엔티티 (role 포함)
    │   │   │   │   └── repository/
    │   │   │   │       ├── ProjectRepository.java  # 소유자별 프로젝트 목록, @EntityGraph(최근세션 JOIN)
    │   │   │   │       └── TeamMemberRepository.java # 팀 멤버 조회/추가/삭제
    │   │   │   │
    │   │   │   ├── analysis/                       # 분석 세션 도메인 (핵심)
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── AnalysisController.java # POST /analysis/sessions, GET /stream (SSE), GET /{id}
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── AnalysisService.java    # 세션 생성/조회, SAST 사용량 체크 및 증가, 파일해시 캐시 조회
    │   │   │   │   │   ├── AnalysisPipelineService.java # @Async: LangGraph4j 에이전트 파이프라인 진입점
    │   │   │   │   │   └── SseEmitterService.java  # Redis Pub/Sub → SseEmitter 브릿지, 채널 관리
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── AnalysisStartRequest.java  # 분석 시작 요청 (projectId, layerType, options)
    │   │   │   │   │   ├── AnalysisStartResponse.java # sessionId + sseUrl 즉시 반환 DTO
    │   │   │   │   │   ├── AnalysisSessionResponse.java # 세션 전체 상태 + 집계 결과 DTO
    │   │   │   │   │   └── SseEvent.java           # SSE 이벤트 종류별 페이로드 DTO (progress/vuln_found/completed)
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── AnalysisSession.java    # analysis_sessions 테이블 JPA 엔티티 (집계 컬럼 포함)
    │   │   │   │   └── repository/
    │   │   │   │       └── AnalysisSessionRepository.java # 프로젝트별 세션 목록, 상태별 조회
    │   │   │   │
    │   │   │   ├── vulnerability/                  # 취약점 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── VulnerabilityController.java # GET /vulns (필터), PATCH /status, GET /api-groups
    │   │   │   │   ├── service/
    │   │   │   │   │   └── VulnerabilityService.java    # 취약점 조회(필터링/페이징), 상태변경, 지문 중복체크
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── VulnerabilityResponse.java   # 취약점 상세 응답 (callChain JSON 포함)
    │   │   │   │   │   ├── VulnListRequest.java         # 필터 조건 DTO (severity, apiGroup, status)
    │   │   │   │   │   └── VulnStatusUpdateRequest.java # 상태 변경 요청 DTO (status + reason)
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── Vulnerability.java           # vulnerabilities 테이블 JPA 엔티티 (JSONB callChain)
    │   │   │   │   └── repository/
    │   │   │   │       └── VulnerabilityRepository.java # 세션+심각도+apiGroup 복합 필터 쿼리
    │   │   │   │
    │   │   │   ├── dast/                           # DAST 동적 분석 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── DastController.java     # POST /dast/targets, /verify, /run, GET /stream, /result
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── DastService.java        # 대상 등록, 도메인 소유권 확인, Rate Limit 체크
    │   │   │   │   │   ├── DastExecutorService.java # @Async: Docker 컨테이너 생성/실행/종료, Redis 락 관리
    │   │   │   │   │   └── DomainVerificationService.java # DNS TXT 조회 또는 파일 HTTP GET으로 소유권 확인
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── DastTargetRequest.java  # 스캔 대상 URL + 면책 동의 여부 요청 DTO
    │   │   │   │   │   ├── DastRunRequest.java     # DAST 실행 옵션 (scanProfile, testXss 등)
    │   │   │   │   │   └── DastResultResponse.java # 익스플로잇 결과 목록 응답 DTO
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── ScanTarget.java         # scan_targets 테이블 JPA 엔티티 (URL 암호화 컨버터)
    │   │   │   │   │   └── ExploitResult.java      # exploit_results 테이블 JPA 엔티티 (payload 암호화)
    │   │   │   │   └── repository/
    │   │   │   │       ├── ScanTargetRepository.java   # 호스트별 중복 조회, 모니터링 대상 스케줄 조회
    │   │   │   │       └── ExploitResultRepository.java # 취약점별 결과 조회, 만료 결과 삭제
    │   │   │   │
    │   │   │   ├── patch/                          # 패치 제안 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── PatchController.java    # GET /patches, POST /generate, PATCH /apply
    │   │   │   │   ├── service/
    │   │   │   │   │   └── PatchService.java       # 패치 조회/적용, @Async: Claude API로 패치 생성, 템플릿 캐시
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── PatchResponse.java      # 패치 코드 + diff + 설명 응답 DTO
    │   │   │   │   │   └── PatchApplyRequest.java  # 패치 적용 처리 요청 DTO
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── PatchSuggestion.java    # patch_suggestions 테이블 JPA 엔티티
    │   │   │   │   └── repository/
    │   │   │   │       └── PatchSuggestionRepository.java # 취약점별 패치 조회, 적용 템플릿 캐시 조회
    │   │   │   │
    │   │   │   ├── report/                         # 리포트 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── ReportController.java   # POST /reports, GET /status, GET /download, POST /share
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── ReportService.java      # 리포트 생성 요청/조회/공유링크 생성
    │   │   │   │   │   └── PdfGeneratorService.java # @Async: iText7로 PDF 생성, 파일 저장, 다운로드 토큰 발급
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── ReportCreateRequest.java   # 리포트 생성 요청 DTO (format, 옵션)
    │   │   │   │   │   └── ReportResponse.java        # 리포트 상태 + 다운로드 URL 응답 DTO
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── Report.java             # reports 테이블 JPA 엔티티 (summaryJson JSONB)
    │   │   │   │   └── repository/
    │   │   │   │       └── ReportRepository.java   # 프로젝트별 리포트 목록, 다운로드 토큰으로 조회
    │   │   │   │
    │   │   │   ├── github/                         # GitHub 연동 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── GitHubController.java   # GET /github/repos, POST /github-config, POST /scan/history
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── GitHubApiService.java   # GitHub REST API 호출 래퍼 (저장소/PR/커밋/Webhook)
    │   │   │   │   │   ├── GitHubWebhookService.java # PR 이벤트 처리, HMAC 서명 검증, 분석 세션 자동 생성
    │   │   │   │   │   └── CommitHistoryScanner.java # @Async: 커밋 히스토리 diff 페이징 조회 + 시크릿 탐지
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── GitHubRepoResponse.java    # GitHub 저장소 목록 응답 DTO
    │   │   │   │   │   └── GitHubConfigRequest.java   # Webhook 설정 + 자동 리뷰 옵션 요청 DTO
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── GitHubConfig.java          # github_configs 테이블 JPA 엔티티
    │   │   │   │   │   └── PrReviewHistory.java       # pr_review_history 테이블 JPA 엔티티
    │   │   │   │   └── repository/
    │   │   │   │       ├── GitHubConfigRepository.java    # 프로젝트별 GitHub 설정 조회
    │   │   │   │       └── PrReviewHistoryRepository.java # PR 번호+SHA로 중복 방지 조회
    │   │   │   │
    │   │   │   ├── cve/                            # CVE / SBOM 도메인
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── CveController.java      # GET /cve/{id}, POST /sbom, GET /sbom
    │   │   │   │   ├── service/
    │   │   │   │   │   ├── CveService.java         # CVE 조회 (Redis 캐시 우선), NVD API 폴백
    │   │   │   │   │   └── SbomService.java        # @Async: 의존성 파싱→CVE 매칭→CycloneDX JSON 생성
    │   │   │   │   ├── dto/
    │   │   │   │   │   ├── CveResponse.java           # CVE 상세 응답 DTO
    │   │   │   │   │   └── SbomResponse.java          # SBOM 컴포넌트 목록 + 취약 패키지 집계 DTO
    │   │   │   │   ├── entity/
    │   │   │   │   │   ├── CveData.java               # cve_data 테이블 JPA 엔티티 (JSONB affectedPackages)
    │   │   │   │   │   └── DependencyComponent.java   # dependency_components 테이블 JPA 엔티티
    │   │   │   │   └── repository/
    │   │   │   │       ├── CveDataRepository.java     # CVE ID 조회, 패키지명+버전 영향 여부 검색
    │   │   │   │       └── DependencyComponentRepository.java # 세션별 컴포넌트 목록, 취약 컴포넌트 필터
    │   │   │   │
    │   │   │   ├── monitoring/                     # 지속 모니터링 도메인 (Phase 3)
    │   │   │   │   ├── controller/
    │   │   │   │   │   └── MonitoringController.java  # POST /enable, GET /results, PUT /notifications
    │   │   │   │   ├── service/
    │   │   │   │   │   └── MonitoringService.java     # 모니터링 활성화/비활성화, 결과 조회, 알림 발송
    │   │   │   │   ├── entity/
    │   │   │   │   │   └── MonitoringResult.java      # monitoring_results 테이블 JPA 엔티티 (파티션 테이블)
    │   │   │   │   └── repository/
    │   │   │   │       └── MonitoringResultRepository.java # 대상별 최근 결과, 알림 미발송 건 조회
    │   │   │   │
    │   │   │   └── chat/                           # AI 채팅 도메인
    │   │   │       ├── controller/
    │   │   │       │   └── ChatController.java     # POST /chat/sessions/{id}/message (SSE 스트리밍)
    │   │   │       ├── service/
    │   │   │       │   └── ChatService.java        # Claude API SSE 스트림 중계, 대화이력 Redis 관리
    │   │   │       └── dto/
    │   │   │           ├── ChatMessageRequest.java  # 사용자 메시지 + 취약점 컨텍스트 DTO
    │   │   │           └── ChatHistoryResponse.java # 최근 10턴 대화 이력 응답 DTO
    │   │   │
    │   │   ├── agent/                              # LangGraph4j AI 에이전트 파이프라인
    │   │   │   │
    │   │   │   ├── pipeline/
    │   │   │   │   ├── SecurityAuditPipeline.java  # ⭐ LangGraph4j 전체 그래프 정의 (SAST→DAST→Patch 흐름)
    │   │   │   │   └── AgentState.java             # 에이전트 간 공유 상태 객체 (취약점 목록, 결과 누적)
    │   │   │   │
    │   │   │   ├── sast/
    │   │   │   │   ├── SastAgent.java              # ⭐ SAST 에이전트: 파일별 Claude AI 분석 요청, 결과 파싱
    │   │   │   │   ├── FileHashCacheAgent.java     # 파일 SHA-256 계산 → Redis 캐시 HIT/MISS 판단
    │   │   │   │   ├── CodeChunker.java            # 큰 파일을 Claude 컨텍스트 윈도우에 맞게 분할
    │   │   │   │   └── VulnClassifier.java         # AI 응답 JSON 파싱 → Vulnerability 엔티티 변환 + CWE 매핑
    │   │   │   │
    │   │   │   ├── dast/
    │   │   │   │   ├── DastAgent.java              # ⭐ DAST 에이전트: 취약점별 페이로드 생성 + Docker 실행 지시
    │   │   │   │   ├── PayloadGeneratorAgent.java  # Claude AI에게 OWASP 공격 페이로드 생성 요청
    │   │   │   │   └── ExploitJudgeAgent.java      # Docker 실행 결과 분석 → 익스플로잇 성공 여부 판정
    │   │   │   │
    │   │   │   └── patch/
    │   │   │       ├── PatchAgent.java             # ⭐ 패치 에이전트: 취약점별 수정 코드 생성 요청
    │   │   │       └── DiffGenerator.java          # 원본↔패치 unified diff 생성 유틸리티
    │   │   │
    │   │   ├── infrastructure/                     # 외부 시스템 연동 (인프라 레이어)
    │   │   │   │
    │   │   │   ├── ai/
    │   │   │   │   ├── ClaudeApiClient.java        # ⭐ Spring AI 래퍼: Claude API 호출, SSE 스트리밍, 토큰 추적
    │   │   │   │   ├── ClaudePromptTemplates.java  # SAST/DAST/Patch/Chat 시스템 프롬프트 상수 모음
    │   │   │   │   └── AiResponseParser.java       # Claude JSON 응답 파싱, 오류 복구 로직
    │   │   │   │
    │   │   │   ├── docker/
    │   │   │   │   ├── DockerSandboxManager.java   # ⭐ Docker SDK: DAST 컨테이너 생성/실행/로그수집/종료
    │   │   │   │   └── ContainerConfig.java        # 샌드박스 컨테이너 생성 파라미터 (메모리/네트워크/타임아웃)
    │   │   │   │
    │   │   │   ├── redis/
    │   │   │   │   ├── RedisPublisher.java         # Redis Pub/Sub 발행 (SSE 이벤트 → 채널 발행)
    │   │   │   │   ├── RedisSubscriber.java        # Redis Pub/Sub 구독 → SseEmitter로 전달
    │   │   │   │   └── DistributedLockService.java # Redis SETNX 기반 분산 락 획득/해제 (DAST 중복방지)
    │   │   │   │
    │   │   │   ├── github/
    │   │   │   │   └── GitHubRestClient.java       # GitHub REST API HTTP 클라이언트 (WebClient 기반)
    │   │   │   │
    │   │   │   ├── nvd/
    │   │   │   │   └── NvdApiClient.java           # NVD REST API 클라이언트 (CVE 조회, 동기화)
    │   │   │   │
    │   │   │   ├── mcp/
    │   │   │   │   └── McpFilesystemClient.java    # MCP Filesystem Server 통신: 로컬 파일 트리/내용 읽기
    │   │   │   │
    │   │   │   └── email/
    │   │   │       └── EmailService.java           # @Async: 이메일 인증/비밀번호 재설정 메일 발송 (JavaMailSender)
    │   │   │
    │   │   ├── scheduler/                          # 스케줄 작업
    │   │   │   ├── NvdSyncJob.java                 # @Scheduled 매일 03:00: NVD CVE 데이터 동기화 + Redis 갱신
    │   │   │   ├── ExpiredDataCleanupJob.java      # @Scheduled 매일 04:30: 30일 익스플로잇 로그 삭제, 90일 리포트 삭제
    │   │   │   ├── MonitoringJob.java              # @Scheduled 매시: 모니터링 대상 Passive 스캔 실행 (Phase 3)
    │   │   │   ├── SastUsageResetJob.java          # @Scheduled 매월 1일: 사용자 SAST 월별 사용량 초기화
    │   │   │   ├── PartitionMaintenanceJob.java    # @Scheduled 매월 25일: 다음 달 DB 파티션 자동 생성
    │   │   │   └── SslCertCheckJob.java            # @Scheduled 매주 월요일: SSL 인증서 만료 30일 전 알림 (Phase 3)
    │   │   │
    │   │   ├── security/                           # 보안 공통 컴포넌트
    │   │   │   ├── PlanChecker.java                # ⭐ @PreAuthorize용 플랜별 기능 허용 여부 검사 빈
    │   │   │   ├── AesEncryptionConverter.java     # ⭐ JPA AttributeConverter: AES-256-GCM 자동 암/복호화
    │   │   │   ├── RateLimitInterceptor.java       # API Rate Limit: Redis 카운터 기반 요청 제한 인터셉터
    │   │   │   └── AuditLogAspect.java             # @AuditLog 어노테이션: AOP로 민감 작업 audit_logs 자동 기록
    │   │   │
    │   │   ├── webhook/
    │   │   │   └── GitHubWebhookController.java    # POST /webhooks/github: HMAC 검증 → PR 이벤트 비동기 처리
    │   │   │
    │   │   ├── admin/
    │   │   │   └── AdminController.java            # ROLE_ADMIN 전용: 통계, Job 강제 실행, 사용자 플랜 변경
    │   │   │
    │   │   └── common/                             # 공통 유틸 / 예외처리
    │   │       ├── exception/
    │   │       │   ├── GlobalExceptionHandler.java # @RestControllerAdvice: 전역 예외 → 표준 에러 응답 변환
    │   │       │   ├── BusinessException.java      # 비즈니스 예외 기반 클래스 (errorCode 포함)
    │   │       │   └── ErrorCode.java              # 에러 코드 enum (PLAN_LIMIT_EXCEEDED, DAST_LOCK_FAILED 등)
    │   │       ├── response/
    │   │       │   ├── ApiResponse.java            # 표준 성공 응답 래퍼 {success, data, meta}
    │   │       │   └── PageResponse.java           # 페이지네이션 응답 래퍼 {data[], pagination}
    │   │       └── util/
    │   │           ├── HashUtils.java              # SHA-256 해시 생성 유틸 (파일 지문, 토큰 해시)
    │   │           └── SecurityUtils.java          # SecurityContext에서 현재 사용자 꺼내기 유틸
    │   │
    │   └── resources/
    │       ├── application.yml                     # ⭐ 기본 설정 (DB, Redis, JWT, 비동기, 캐시 TTL 정의)
    │       ├── application-local.yml               # 로컬 개발 오버라이드 (로그 레벨 DEBUG)
    │       ├── application-prod.yml                # 운영 오버라이드 (로그 레벨 WARN, SSL 강제)
    │       ├── db/migration/                       # Flyway SQL 마이그레이션 파일
    │       │   ├── V001__create_plans.sql
    │       │   ├── V002__create_users.sql
    │       │   ├── V003__create_refresh_tokens.sql
    │       │   ├── V004__create_projects.sql
    │       │   ├── V005__create_team_members.sql
    │       │   ├── V006__create_analysis_sessions_partitioned.sql
    │       │   ├── V007__create_vulnerabilities.sql
    │       │   ├── V008__create_exploit_results.sql
    │       │   ├── V009__create_patch_suggestions.sql
    │       │   ├── V010__create_reports.sql
    │       │   ├── V011__create_scan_targets.sql
    │       │   ├── V012__create_github_configs.sql
    │       │   ├── V013__create_pr_review_history.sql
    │       │   ├── V014__create_cve_data.sql
    │       │   ├── V015__create_vulnerability_cve_mapping.sql
    │       │   ├── V016__create_dependency_components.sql
    │       │   ├── V017__create_monitoring_results_partitioned.sql
    │       │   ├── V018__create_audit_logs_partitioned.sql
    │       │   ├── V019__create_indexes.sql
    │       │   ├── V020__create_triggers.sql
    │       │   └── V021__seed_plans.sql            # 4개 플랜 초기 데이터
    │       └── prompts/                            # Claude AI 프롬프트 템플릿 (외부 파일 관리)
    │           ├── sast_system.txt                 # SAST 분석 시스템 프롬프트
    │           ├── sast_user.txt                   # SAST 분석 사용자 프롬프트 템플릿 ({{code}} 치환)
    │           ├── dast_payload.txt                # DAST 페이로드 생성 프롬프트
    │           ├── patch_generation.txt            # 패치 코드 생성 프롬프트
    │           └── chat_system.txt                 # AI 채팅 시스템 프롬프트 (한/영 자동 언어 감지)
    │
    └── test/
        ├── java/io/secureai/
        │   ├── auth/
        │   │   └── AuthControllerTest.java         # 로그인/회원가입/토큰 갱신 통합 테스트
        │   ├── analysis/
        │   │   └── AnalysisPipelineTest.java       # LangGraph4j 파이프라인 단위 테스트 (Claude 모킹)
        │   ├── dast/
        │   │   └── DastExecutorTest.java           # Docker 컨테이너 생성/실행 단위 테스트 (TestContainers)
        │   ├── security/
        │   │   ├── PlanCheckerTest.java            # 플랜별 기능 제한 단위 테스트
        │   │   └── AesEncryptionTest.java          # AES-256-GCM 암/복호화 단위 테스트
        │   └── scheduler/
        │       └── NvdSyncJobTest.java             # NVD 동기화 스케줄러 단위 테스트 (NVD API 모킹)
        └── resources/
            └── application-test.yml               # 테스트 전용 설정 (H2 또는 TestContainers PostgreSQL)
```

---

## 3. 프론트엔드 상세 구조 (Next.js)

```
frontend/
│
├── Dockerfile                                      # Next.js standalone 빌드 (node:20-alpine)
├── package.json                                    # 의존성 정의 (next, react, monaco-editor, zustand, recharts 등)
├── package-lock.json
├── tsconfig.json                                   # TypeScript 설정 (strict: true, path alias @/)
├── next.config.js                                  # Next.js 설정 (API 프록시, 이미지 도메인, standalone 빌드)
├── tailwind.config.js                              # Tailwind CSS 설정 (다크 테마 색상 토큰 확장)
├── .eslintrc.json                                  # ESLint 규칙 (security 플러그인 포함)
├── .env.local.example                              # 프론트 환경변수 템플릿 (NEXT_PUBLIC_API_URL 등)
│
└── src/
    │
    ├── app/                                        # Next.js 15 App Router
    │   ├── layout.tsx                              # 루트 레이아웃: 폰트 로드, 전역 Provider, 다크 테마 html 속성
    │   ├── page.tsx                                # "/" 진입점: 인증 여부에 따라 랜딩 or 대시보드로 리다이렉트
    │   ├── globals.css                             # 전역 CSS: VSCode 다크 테마 변수, Monaco 취약점 하이라이팅 CSS
    │   │
    │   ├── (auth)/                                 # 인증 관련 페이지 그룹 (레이아웃 별도)
    │   │   ├── layout.tsx                          # 인증 페이지 전용 레이아웃 (헤더 없는 심플 구조)
    │   │   ├── login/
    │   │   │   └── page.tsx                        # 로그인 페이지: 이메일/비밀번호 + GitHub OAuth 버튼
    │   │   ├── register/
    │   │   │   └── page.tsx                        # 회원가입 페이지: 이메일, 비밀번호, 닉네임 입력 폼
    │   │   ├── callback/
    │   │   │   └── page.tsx                        # GitHub OAuth 콜백: URL에서 accessToken 추출 → 메모리 저장
    │   │   └── forgot-password/
    │   │       └── page.tsx                        # 비밀번호 재설정 요청 페이지
    │   │
    │   ├── (app)/                                  # 인증 필요 페이지 그룹
    │   │   ├── layout.tsx                          # 앱 레이아웃: 인증 미완료 시 /login 리다이렉트
    │   │   │
    │   │   ├── dashboard/
    │   │   │   └── page.tsx                        # 프로젝트 목록 + 전체 현황 대시보드 페이지
    │   │   │
    │   │   ├── projects/
    │   │   │   ├── new/
    │   │   │   │   └── page.tsx                    # 새 프로젝트 생성 폼 (소스 타입 선택: local/github/url)
    │   │   │   └── [projectId]/
    │   │   │       ├── page.tsx                    # 프로젝트 홈: 분석 이력 + 보안 점수 트렌드
    │   │   │       │
    │   │   │       ├── editor/
    │   │   │       │   └── page.tsx                # ⭐ 메인 에디터 페이지: 파일트리+Monaco+DAST터미널+패널 레이아웃
    │   │   │       │
    │   │   │       ├── analysis/
    │   │   │       │   └── [sessionId]/
    │   │   │       │       └── page.tsx            # 특정 세션 분석 결과 뷰 (완료된 세션 재조회)
    │   │   │       │
    │   │   │       ├── reports/
    │   │   │       │   └── page.tsx                # 리포트 목록 + 생성 버튼
    │   │   │       │
    │   │   │       └── settings/
    │   │   │           └── page.tsx                # 프로젝트 설정: GitHub 연동, 알림, 팀 멤버 관리
    │   │   │
    │   │   └── account/
    │   │       └── page.tsx                        # 계정 설정: 프로필 수정, 플랜 확인, 계정 탈퇴
    │   │
    │   └── shared/
    │       └── reports/
    │           └── [token]/
    │               └── page.tsx                    # 공개 공유 리포트 뷰 (인증 불필요, 읽기 전용)
    │
    ├── components/                                 # UI 컴포넌트
    │   │
    │   ├── editor/                                 # 에디터 관련 컴포넌트
    │   │   ├── EditorLayout.tsx                    # ⭐ VSCode 스타일 3패널 레이아웃 (사이드바+에디터+패널) 조합
    │   │   ├── FileTree.tsx                        # ⭐ MCP 파일 트리: 취약점 도트, 드릴다운, 파일 선택
    │   │   ├── CodeEditor.tsx                      # ⭐ Monaco Editor 래퍼: 취약점 인라인 데코레이션, Diff 뷰어
    │   │   ├── EditorTabs.tsx                      # 열린 파일 탭 목록 (취약점 있는 파일은 빨간 도트)
    │   │   └── EditorHeader.tsx                    # 상단 헤더: 심각도 필터 버튼, 분석 시작, Export 버튼
    │   │
    │   ├── analysis/                               # 분석 결과 관련 컴포넌트
    │   │   ├── VulnDetailPanel.tsx                 # ⭐ 취약점 토글 목록: 설명+콜체인+Diff+AutoFix 패널
    │   │   ├── CallChainView.tsx                   # API 호출 체인 트리: 취약 노드 글로우 효과, 클릭 시 에디터 점프
    │   │   ├── DiffViewer.tsx                      # Before/After 코드 비교 (Monaco DiffEditor 활용)
    │   │   ├── DastTerminal.tsx                    # DAST 실시간 로그 터미널 (SSE 구독, ANSI 컬러)
    │   │   ├── ChatPanel.tsx                       # AI 보안 채팅 패널: 메시지 입력, 스트리밍 응답 표시
    │   │   └── AnalysisLoadingOverlay.tsx          # 분석 시작 시 전체화면 오버레이 (스텝별 진행 메시지)
    │   │
    │   ├── dashboard/                              # 대시보드 관련 컴포넌트
    │   │   ├── DashboardLayout.tsx                 # 대시보드 전체 레이아웃 (KPI + 차트 그리드)
    │   │   ├── SecurityScoreRing.tsx               # 보안 점수 원형 차트 (0~100 게이지)
    │   │   ├── KpiCard.tsx                         # 수치 카드 (점수/Critical/High/Medium/패치율)
    │   │   ├── SeverityBarChart.tsx                # OWASP 카테고리별 취약점 수 수평 바 차트 (recharts)
    │   │   ├── TrendLineChart.tsx                  # 7일 보안 점수 트렌드 라인 차트 (recharts)
    │   │   ├── FileHeatmap.tsx                     # 파일별 취약점 히트맵 (severity 색상 코딩)
    │   │   ├── OwaspCoverageMatrix.tsx             # OWASP Top 10 A01~A10 커버리지 표
    │   │   └── PrReviewHistory.tsx                 # GitHub PR 보안 리뷰 이력 테이블
    │   │
    │   ├── ui/                                     # 재사용 기본 UI 컴포넌트
    │   │   ├── FilterBar.tsx                       # API 그룹 필터 칩 바 (active 상태 글로우 효과)
    │   │   ├── SeverityBadge.tsx                   # 심각도 배지 (CRITICAL/HIGH/MEDIUM/LOW 색상 맵)
    │   │   ├── ResizeHandle.tsx                    # 드래그 리사이즈 핸들 (가로/세로 모두 지원)
    │   │   ├── ResizablePanel.tsx                  # ResizeHandle을 포함한 리사이즈 가능 패널 래퍼
    │   │   ├── SseIndicator.tsx                    # SSE 연결 상태 표시 (연결중/수신중/완료 점멸 아이콘)
    │   │   ├── PlanBadge.tsx                       # 구독 플랜 배지 (Free/Pro/Team/Enterprise)
    │   │   ├── Modal.tsx                           # 공통 모달 (포털 렌더링)
    │   │   ├── Toast.tsx                           # 알림 토스트 (취약점 발견 시 실시간 알림)
    │   │   └── Button.tsx                          # 공통 버튼 (variant: primary/ghost/danger)
    │   │
    │   └── layout/                                 # 전역 레이아웃 컴포넌트
    │       ├── AppHeader.tsx                       # 앱 상단 헤더 (로고, 네비게이션, 사용자 메뉴)
    │       ├── AppSidebar.tsx                      # 프로젝트 목록 사이드바 (모바일에서 드로어)
    │       └── MobileBottomNav.tsx                 # 모바일 하단 탭 네비게이션 (대시보드/취약점/분석/채팅)
    │
    ├── store/                                      # Zustand 전역 상태
    │   ├── useSecureStore.ts                       # ⭐ 단일 통합 스토어: 뷰모드, 필터, 패널크기, 취약점 목록
    │   ├── useAuthStore.ts                         # 인증 상태: accessToken(메모리), 사용자 정보, 로그아웃
    │   ├── useEditorStore.ts                       # 에디터 상태: 선택 파일, 커서 위치, 열린 탭 목록
    │   └── useSessionStore.ts                      # 분석 세션 상태: 진행 중 세션 ID, SSE 구독 상태
    │
    ├── hooks/                                      # 커스텀 React 훅
    │   ├── useAuth.ts                              # 인증 훅: 로그인/로그아웃, accessToken 자동 갱신
    │   ├── useSse.ts                               # ⭐ SSE 구독 훅: EventSource 관리, 이벤트 타입별 콜백
    │   ├── useVulnFilter.ts                        # 취약점 필터 훅: AND 조건(severity + apiGroup) 파생 계산
    │   ├── useResizablePanel.ts                    # 드래그 리사이즈 훅: mousedown/mousemove 이벤트 처리
    │   ├── usePanelResize.ts                       # 패널 그룹 리사이즈 훅 (min/max 범위 강제)
    │   ├── useMonaco.ts                            # Monaco 에디터 초기화 + 취약점 데코레이션 적용 훅
    │   └── useToast.ts                             # 토스트 알림 훅 (전역 토스트 큐 관리)
    │
    ├── lib/                                        # 유틸리티 / API 클라이언트
    │   ├── api/
    │   │   ├── client.ts                           # ⭐ Axios 인스턴스: baseURL, 인터셉터(토큰 자동 갱신/401 처리)
    │   │   ├── auth.ts                             # 인증 API 함수 모음 (login, register, refresh, logout)
    │   │   ├── projects.ts                         # 프로젝트 API 함수 모음
    │   │   ├── analysis.ts                         # 분석 세션 API 함수 모음
    │   │   ├── vulnerabilities.ts                  # 취약점 API 함수 모음
    │   │   ├── dast.ts                             # DAST API 함수 모음
    │   │   ├── patches.ts                          # 패치 API 함수 모음
    │   │   ├── reports.ts                          # 리포트 API 함수 모음
    │   │   └── github.ts                           # GitHub 연동 API 함수 모음
    │   ├── monaco/
    │   │   ├── decorations.ts                      # ⭐ Monaco 취약점 데코레이션 정의 (하이라이팅, 글로우, 호버 툴팁)
    │   │   └── themes.ts                           # Monaco 에디터 다크 테마 정의 (SecureAI Dark)
    │   ├── utils/
    │   │   ├── severity.ts                         # 심각도 → 색상/아이콘 매핑 유틸
    │   │   ├── fileHash.ts                         # 브라우저 File SHA-256 계산 (Web Crypto API)
    │   │   └── formatters.ts                       # 날짜/용량/점수 포맷 유틸
    │   └── constants/
    │       ├── owasp.ts                            # OWASP Top 10 카테고리 상수 (A01~A10 이름/설명)
    │       └── cwe.ts                              # 주요 CWE 번호 → 이름 매핑 상수
    │
    └── types/                                      # TypeScript 타입 정의
        ├── auth.ts                                 # User, Plan, LoginRequest, TokenResponse 타입
        ├── project.ts                              # Project, TeamMember 타입
        ├── analysis.ts                             # AnalysisSession, SseEvent, AnalysisOptions 타입
        ├── vulnerability.ts                        # Vulnerability, CallChainNode, VulnFilter 타입
        ├── dast.ts                                 # ScanTarget, ExploitResult, DastRunOptions 타입
        ├── patch.ts                                # PatchSuggestion 타입
        └── report.ts                               # Report 타입
```

---

## 4. DAST 샌드박스 구조

```
dast-sandbox/
│
├── Dockerfile                                      # Python 3.12-slim 기반, 최소 의존성 (requests, httpx만)
├── requirements.txt                                # Python 의존성 고정 (requests==2.32.x, httpx==0.27.x)
│
├── dast_runner.py                                  # ⭐ 샌드박스 진입점: 환경변수에서 페이로드 수신 → 실행 → 결과 출력
├── executors/
│   ├── sqli_executor.py                            # SQL Injection 페이로드 실행 + 응답 분석 (에러 기반/시간 기반)
│   ├── xss_executor.py                             # XSS 페이로드 실행 + 응답 본문에서 스크립트 반영 여부 확인
│   ├── idor_executor.py                            # IDOR: 인증 토큰 없이 /resource/{id} 순회 접근 시도
│   ├── ssrf_executor.py                            # SSRF: 내부 주소(127.0.0.1, 169.254.x.x) 리다이렉트 여부 확인
│   └── auth_bypass_executor.py                     # 인증 우회: JWT none 알고리즘, 빈 토큰, 만료 토큰 시도
│
└── utils/
    ├── result_formatter.py                         # 실행 결과를 JSON 형식으로 직렬화 (Spring Boot가 파싱)
    └── logger.py                                   # 실행 로그 stdout 출력 (Spring Boot가 Docker logs API로 수집)
```

---

## 5. 인프라 / Docker 구조

```
infra/
│
├── docker/
│   ├── postgres/
│   │   └── init.sql                                # PostgreSQL 초기화: pg_crypto 확장, locale 설정
│   └── nginx/
│       └── nginx.conf                              # Nginx 리버스 프록시 설정 (운영 환경: SSL 터미네이션)
│
├── scripts/
│   ├── create_partitions.sql                       # 수동 DB 파티션 생성 스크립트 (월별 일괄 생성)
│   ├── seed_dev_data.sql                           # 개발용 더미 데이터 (유저, 프로젝트, 취약점 샘플)
│   └── backup.sh                                   # PostgreSQL pg_dump + S3 업로드 스크립트 (Phase 3)
│
└── monitoring/                                     # Phase 3 운영 모니터링
    ├── prometheus.yml                              # Prometheus 스크레이핑 설정 (Spring Actuator /metrics)
    └── grafana/
        └── dashboards/
            └── secureai-overview.json              # Grafana 대시보드 (분석 처리량, 에러율, DAST 실행 시간)
```

---

## 6. 핵심 파일 상세 설명

### 6.1 `backend/src/main/java/io/secureai/agent/pipeline/SecurityAuditPipeline.java`

LangGraph4j로 전체 AI 에이전트 흐름을 그래프로 정의하는 핵심 파일입니다.

```
역할:
  - SAST → DAST → Patch 순서의 분기/루프 그래프 정의
  - 각 노드(에이전트)의 실행 조건 및 엣지(전이) 조건 설정
  - 에이전트 상태(AgentState) 공유 및 전파

주요 로직:
  ┌─────────────────────────────────────────────────────────┐
  │  graph.addNode("sast", sastAgent::run)                  │
  │  graph.addNode("dast", dastAgent::run)                  │
  │  graph.addNode("patch", patchAgent::run)                │
  │  graph.addNode("report", reportAgent::run)              │
  │                                                         │
  │  graph.addEdge(START, "sast")                           │
  │  graph.addConditionalEdge("sast",                       │
  │      state -> state.hasVulnerabilities()                │
  │          ? "dast" : END)                                │
  │  graph.addConditionalEdge("dast",                       │
  │      state -> state.exploitSucceeded()                  │
  │          || state.getRetryCount() >= 3                  │
  │          ? "patch" : "dast")   ← 최대 3회 재시도        │
  │  graph.addEdge("patch", "report")                       │
  │  graph.addEdge("report", END)                           │
  └─────────────────────────────────────────────────────────┘

SSE 연동:
  - 각 노드 실행 전후 redisPublisher.publish(sessionId, SseEvent)
  - 진행률(progressPct) 단계별 계산 및 발행
```

---

### 6.2 `backend/src/main/java/io/secureai/security/AesEncryptionConverter.java`

JPA `AttributeConverter`로, DB 저장 시 자동으로 AES-256-GCM 암/복호화를 처리합니다.

```
역할:
  - @Convert(converter=AesEncryptionConverter.class) 어노테이션 하나로 암호화 적용
  - 평문 String → AES-256-GCM(IV 포함) → BYTEA 저장
  - BYTEA 읽기 → AES-256-GCM 복호화 → 평문 String 반환

적용 필드:
  - User.githubToken (GitHub OAuth 토큰)
  - ScanTarget.targetUrlEncrypted (배포 앱 URL)
  - ExploitResult.payloadEncrypted (DAST 페이로드)
  - ExploitResult.sandboxLogEncrypted (샌드박스 실행 로그)

키 관리:
  - 환경변수 SECUREAI_ENCRYPTION_KEY (32바이트 HEX)
  - IV(초기화 벡터)는 암호화마다 랜덤 생성 → 암호문 앞에 붙여 저장
```

---

### 6.3 `backend/src/main/java/io/secureai/security/PlanChecker.java`

`@PreAuthorize("@planChecker.allowsDast(#userId)")` 형태로 사용되는 플랜 제한 검사 빈입니다.

```
역할:
  - API 핸들러에 AOP 방식으로 플랜 제한 자동 적용
  - Redis 캐시에서 사용자 플랜 정보 우선 조회 (DB 부하 최소화)

주요 메서드:
  boolean canStartAnalysis(UUID userId, String layerType)
    → Free 플랜: layerType=dast 차단
    → Free 플랜: sast_usage_this_month >= 50 시 차단

  boolean allowsDast(UUID userId)
    → plan.allowDast = false 이면 403 반환

  boolean allowsMonitoring(UUID userId)
    → plan.allowMonitoring = false 이면 403 반환

  boolean canAddMember(UUID projectId)
    → 현재 팀 멤버 수 >= plan.maxMembers 이면 403 반환
```

---

### 6.4 `backend/src/main/resources/application.yml`

모든 설정값의 중앙 집중 관리 파일입니다.

```yaml
# 핵심 설정 영역 요약:

spring:
  datasource:
    hikari:
      maximum-pool-size: 20       # CPU * 2 + 2 (DAST 실행 포함)
  data.redis:
    host: redis
    port: 6379
  cache:
    redis:
      time-to-live: 300000        # 기본 TTL 5분 (도메인별 오버라이드)
  threads:
    virtual:
      enabled: true               # Java 21 Virtual Thread 전역 활성화

secureai:
  jwt:
    secret: ${JWT_SECRET}
    access-expiry: 900            # 15분
    refresh-expiry: 2592000       # 30일
  encryption:
    key: ${SECUREAI_ENCRYPTION_KEY}
  claude:
    api-key: ${CLAUDE_API_KEY}
    model: claude-sonnet-4-20250514
    max-tokens: 8096
  dast:
    sandbox-image: secureai-dast-sandbox:latest
    max-concurrent: 3
    timeout-seconds: 300
    memory-limit: 536870912       # 512MB
  cache:
    sast-result-ttl: 86400        # 24h
    cve-data-ttl: 21600           # 6h
    patch-template-ttl: 604800    # 7d
    user-plan-ttl: 300            # 5min
```

---

### 6.5 `frontend/src/store/useSecureStore.ts`

Zustand 단일 통합 스토어로, 전체 앱의 핵심 상태를 관리합니다.

```typescript
interface SecureStore {
  // 뷰 모드
  viewMode: 'editor' | 'dashboard';
  setViewMode: (mode: 'editor' | 'dashboard') => void;

  // 현재 세션
  currentSessionId: string | null;
  sessionStatus: 'idle' | 'running' | 'completed' | 'failed';

  // 파일 / 에디터
  selectedFilePath: string | null;
  openedTabs: string[];

  // 패널 크기 (드래그 리사이즈 상태 유지)
  sidebarWidth: number;       // 160~400px
  rightPanelWidth: number;    // 280~640px
  terminalHeight: number;     // 80~420px

  // 취약점 목록 (SSE로 실시간 추가)
  vulns: Vulnerability[];
  addVuln: (vuln: Vulnerability) => void;

  // 필터 (AND 조건)
  severityFilter: 'all' | 'critical' | 'high' | 'medium' | 'low';
  apiGroupFilter: string | null;

  // 파생 셀렉터 (useMemo 역할)
  filteredVulns: () => Vulnerability[];
  apiGroups: () => string[];
}

// 중요: SSE vuln_found 이벤트 수신 시 addVuln()으로 실시간 추가
// → Monaco 에디터 decorations 즉시 업데이트
// → 우측 패널 취약점 목록 실시간 갱신
```

---

### 6.6 `frontend/src/hooks/useSse.ts`

SSE 구독을 관리하는 핵심 훅입니다.

```typescript
역할:
  - EventSource 생성/정리 (useEffect cleanup)
  - 이벤트 타입별 콜백 분기 처리:
      'progress' → sessionStore.setProgress(pct)
      'vuln_found' → secureStore.addVuln(vuln) + Monaco 데코레이션 추가
      'dast_log' → terminal 버퍼에 로그 추가
      'completed' → sessionStore.setCompleted() + Toast 알림
      'error' → sessionStore.setFailed() + Toast 에러

주의사항:
  - accessToken을 쿼리파라미터로 전달 (EventSource는 헤더 미지원)
    → ?token=xxx 형태, 백엔드에서 파싱 후 검증
  - 연결 끊김 시 exponential backoff로 자동 재연결 (최대 5회)
```

---

### 6.7 `frontend/src/lib/monaco/decorations.ts`

Monaco Editor의 취약점 인라인 하이라이팅을 정의합니다.

```typescript
역할:
  - 취약점 심각도별 라인 하이라이팅 CSS 클래스 매핑
  - 글리프 마진 아이콘 (빨간 원, 주황 원) 설정
  - 호버 툴팁 마크다운 (취약점 유형, CWE, 클릭 시 패널 스크롤)
  - 취약 라인 빨간 글로우 효과 (box-shadow CSS)

주요 함수:
  applyVulnDecorations(editor, vulns, selectedFilePath)
    → 현재 파일에 해당하는 취약점만 필터
    → editor.deltaDecorations()로 기존 제거 + 신규 적용

  clearDecorations(editor)
    → 파일 전환 시 이전 파일 데코레이션 초기화
```

---

### 6.8 `docker-compose.yml`

개발 환경의 모든 서비스를 단일 명령(`docker compose up -d`)으로 실행합니다.

```yaml
핵심 포인트:
  - postgres, redis: healthcheck로 준비 상태 확인 후 backend 시작
  - backend: /var/run/docker.sock 마운트 (DAST 컨테이너 동적 생성)
  - backend: ./reports 볼륨 마운트 (PDF 파일 영속 저장)
  - 모든 서비스가 secureai-net 브릿지 네트워크로 연결
  - DAST 샌드박스 컨테이너는 별도 dast-isolated-bridge 네트워크 사용
    (타겟 도메인 외부 통신 격리)
```

---

### 6.9 `Makefile`

개발자 편의를 위한 단축 명령어 모음입니다.

```makefile
make dev          # docker compose up -d (전체 환경 시작)
make stop         # docker compose stop
make logs         # docker compose logs -f backend
make db           # postgres 컨테이너 psql 접속
make redis        # redis-cli 접속
make test         # 백엔드 단위 테스트 실행
make migrate      # Flyway 마이그레이션 수동 실행
make build-sandbox # DAST 샌드박스 Docker 이미지 빌드
make clean        # 볼륨 포함 전체 정리 (주의: DB 데이터 삭제)
```

---

*이전 문서: [02_API_DESIGN.md] — REST API 설계서*  
*이전 문서: [01_ERD.md] — ERD 설계서*
