# SecureAI — 아키텍처 철학 & 설계 패턴 설명서
> 작성자: 보안 전문가 · AI 전문가 · 앱 개발자 · 시니어 백엔드 공동 작성  
> 작성일: 2026-04-19 | 버전: v2.0

---

## 목차

1. [모놀리스 vs 마이크로서비스 — 우리의 선택](#1-모놀리스-vs-마이크로서비스--우리의-선택)
2. [최종 결정: 전략적 하이브리드 아키텍처](#2-최종-결정-전략적-하이브리드-아키텍처)
3. [서비스별 경계 설정 근거](#3-서비스별-경계-설정-근거)
4. [적용 설계 패턴 목록](#4-적용-설계-패턴-목록)
5. [신뢰 경계 (Trust Boundary) 보안 설계](#5-신뢰-경계-trust-boundary-보안-설계)
6. [Android 앱 아키텍처 결정](#6-android-앱-아키텍처-결정)
7. [MCP 통합 아키텍처](#7-mcp-통합-아키텍처)
8. [서비스 간 통신 전략](#8-서비스-간-통신-전략)
9. [장애 격리 전략](#9-장애-격리-전략)
10. [단계별 발전 로드맵](#10-단계별-발전-로드맵)

---

## 1. 모놀리스 vs 마이크로서비스 — 우리의 선택

### 1.1 순수 모놀리스의 문제 (기존 v1 설계)

```
[기존 v1 — 모놀리식 Spring Boot]
┌──────────────────────────────────────────────────────┐
│              Spring Boot (단일 프로세스)               │
│                                                      │
│  Auth + User + Project + Analysis + DAST +           │
│  LangGraph4j Agent + Docker SDK + Report + ...       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**문제점:**

| 문제 | 영향 |
|------|------|
| DAST Docker 실행 중 OOM → **전체 서비스 다운** | 가용성 |
| Java LangGraph4j는 Python 생태계 대비 **6~12개월 기능 격차** | AI 품질 |
| MCP 클라이언트, LangSmith 트레이싱 미지원 | 관측성 |
| 단일 프로세스이므로 **AI 처리 지연이 API 응답에 영향** | 성능 |
| 안드로이드 앱 고려 없음, MCP 서버 위치 불명확 | 확장성 |
| AI 모델 교체 시 전체 재배포 필요 | 유연성 |

### 1.2 순수 마이크로서비스의 문제

**지금 단계에서 모든 도메인을 서비스로 분리하면:**
- 네트워크 지연 폭증 (도메인 간 동기 HTTP 호출 체인)
- 분산 트랜잭션 처리 복잡도 급증
- 운영 오버헤드 (서비스 디스커버리, 분산 추적, 다수 컨테이너 관리)
- **소규모 팀에서 초기 개발 속도 급감**

### 1.3 결론 — "전략적 분리"

> **"분리의 근거가 있는 경계만 마이크로서비스로, 나머지는 모듈러 모놀리스로"**

분리 기준 3가지:
1. **독립적 장애 격리가 필요한가?** (DAST OOM이 인증에 영향 주면 안 됨)
2. **언어/런타임이 달라야 기능이 가능한가?** (Python LangGraph 생태계)
3. **독립적 스케일링이 필요한가?** (AI 처리는 GPU/고메모리, API는 다수 인스턴스)

---

## 2. 최종 결정: 전략적 하이브리드 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        클라이언트 레이어                                  │
│                                                                         │
│   [웹 브라우저]          [Android 앱]          [VSCode Extension]        │
│   Next.js 15             Kotlin + Retrofit      (Phase 3)               │
│                               │FCM Push                                 │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         API Gateway (Nginx)                             │
│         라우팅 / SSL 터미네이션 / Rate Limiting / 인증서 피닝 헤더        │
└────────────┬─────────────────────────────────────┬───────────────────────┘
             │                                     │
   ┌─────────▼──────────┐               ┌──────────▼──────────┐
   │   Backend Service   │               │   AI Agent Service   │
   │   Spring Boot 4     │◄─────HTTP────►│   Python FastAPI     │
   │   (모듈러 모놀리스)  │               │   LangGraph          │
   │   포트: 8080        │               │   포트: 8000         │
   └────────┬────────────┘               └──────────┬──────────┘
            │                                       │
            │                            ┌──────────▼──────────┐
            │                            │   MCP Server         │
            │                            │   Node.js            │
            │                            │   포트: 3001         │
            │                            └─────────────────────┘
            │
   ┌────────▼──────────────────────────┐
   │         데이터 레이어              │
   │  PostgreSQL 15  │  Redis 7        │
   └────────────────────────────────────┘
            │
   ┌────────▼──────────┐
   │   DAST Sandbox    │
   │   Python (Docker) │
   │   동적 생성/삭제   │
   └───────────────────┘
            │
   ┌────────▼──────────┐
   │   FCM Gateway     │
   │   (Google)        │
   │   Android Push    │
   └───────────────────┘
```

---

## 3. 서비스별 경계 설정 근거

### 3.1 Backend Service (Spring Boot) — 모듈러 모놀리스 유지

**포함 도메인:**
- 인증/인가 (Auth)
- 사용자·플랜 (User)
- 프로젝트 (Project)
- 분석 세션 관리 (Analysis Session 오케스트레이션)
- 취약점 저장·조회 (Vulnerability)
- 패치 관리 (Patch)
- 리포트 생성 (Report)
- GitHub 연동 (GitHub)
- CVE/SBOM 관리 (CVE)
- 모니터링 (Monitoring)
- 스케줄러 (Scheduler)

**분리하지 않는 이유:**
- 이 도메인들은 동일한 PostgreSQL 트랜잭션 경계 안에 있어야 함
- 서비스 간 분산 트랜잭션 없이도 데이터 일관성 보장
- 팀 규모(1~3인)에서 단일 배포 단위가 운영 효율적

**모듈러 모놀리스 핵심 원칙:**
- 각 도메인은 **패키지 내부 응집, 패키지 간 인터페이스를 통해서만 통신**
- 직접 다른 패키지의 Repository를 주입받지 않음
- 도메인 이벤트(`ApplicationEvent`)로 느슨한 결합 유지
- 언제든 패키지를 독립 서비스로 분리할 수 있는 구조 유지

---

### 3.2 AI Agent Service (Python FastAPI) — 분리 필수

**분리 이유:**

| 이유 | 상세 |
|------|------|
| **Python 생태계 우위** | LangGraph, LangSmith, MCP SDK 모두 Python 최신 지원 |
| **독립 장애 격리** | AI 서비스 OOM/크래시가 인증·API에 영향 없음 |
| **독립 스케일링** | AI 처리는 고메모리 인스턴스, API는 다수 소규모 인스턴스 |
| **모델 교체 유연성** | Claude → GPT-4o 교체 시 AI 서비스만 재배포 |
| **LangSmith 트레이싱** | 에이전트 실행 흐름 완전 관측 가능 |
| **MCP 클라이언트** | Python MCP SDK로 Filesystem/GitHub/Docker 서버 연결 |

**통신 방식:**
- Spring Boot → FastAPI: HTTP POST (분석 요청, 결과 폴링)
- FastAPI → Redis: Pub/Sub (SSE 이벤트 발행)
- FastAPI → MCP Server: stdio 또는 HTTP

---

### 3.3 MCP Server (Node.js) — 별도 프로세스

**MCP(Model Context Protocol)의 아키텍처 위치:**

```
AI Agent Service (Python)
    │
    │ MCP Client (Python SDK)
    │ stdio / HTTP 전송
    ▼
MCP Server (Node.js 공식 구현)
    ├── Filesystem Tool: 로컬 프로젝트 파일 읽기
    ├── GitHub Tool: 저장소/PR/커밋 접근
    └── (Phase 3) Docker Tool: 샌드박스 제어
```

**왜 MCP Server를 분리하는가:**
- MCP 공식 서버 구현체는 Node.js/@modelcontextprotocol 패키지 기준
- Python Agent에서 `subprocess`로 stdio 방식 실행하거나, HTTP 서버 모드로 운영
- 파일시스템 접근 권한을 MCP Server 프로세스 수준에서 격리 (보안 경계)
- 향후 MCP Server를 교체하거나 새 Tool을 추가해도 AI Agent 코드 무변경

---

### 3.4 DAST Sandbox (Python Docker) — 동적 생성

기존 설계 유지. Docker SDK로 요청 시마다 생성, 완료 시 즉시 삭제.

---

### 3.5 Android App (Kotlin) — 신규 추가

**웹과 다른 모바일 요구사항:**

| 항목 | 웹 | Android |
|------|-----|---------|
| 실시간 알림 | SSE (foreground) | FCM Push (background 지원) |
| 인증 토큰 저장 | 메모리 + HttpOnly Cookie | EncryptedSharedPreferences |
| 네트워크 | 브라우저 Fetch | OkHttp + Retrofit |
| 오프라인 | 없음 | Room DB 캐시 |
| 보안 | CSP, SameSite Cookie | 인증서 피닝, Root 탐지 |
| API | 웹 최적화 응답 | 모바일 최적화 응답 (필드 축소) |

---

## 4. 적용 설계 패턴 목록

### 4.1 아키텍처 패턴

#### Modular Monolith (Backend Service)
```
각 도메인 패키지는 아래 레이어를 독립적으로 보유:
  Controller → Service → Repository → Entity

도메인 간 통신:
  - 동기: ApplicationEvent (Spring 내부 이벤트)
  - 도메인 서비스 인터페이스를 통한 간접 참조
  - 직접 Repository 주입 금지

예시:
  AnalysisService가 취약점 저장 시:
    X: VulnerabilityRepository 직접 주입
    O: VulnerabilityFacade.save() 인터페이스 호출
```

#### Strangler Fig Pattern (단계별 분리)
```
Phase 1: Spring Boot 안에 모든 기능
Phase 2: AI 에이전트 → Python 서비스로 이관
Phase 3: 모니터링 서비스 → 별도 분리 (트래픽 급증 시)
```

#### API Gateway Pattern
```
모든 클라이언트(웹/앱)는 Nginx API Gateway를 통해서만 진입
  - 라우팅: /api/* → Backend, /ai/* → AI Agent
  - Rate Limiting: Nginx limit_req_zone
  - SSL 터미네이션
  - 모바일 인증서 피닝 헤더 주입
```

#### Sidecar Pattern (Phase 3)
```
각 서비스 컨테이너 옆에 Prometheus exporter 사이드카 배치
로그 → Fluent Bit 사이드카 → Loki
```

---

### 4.2 애플리케이션 패턴

#### Domain-Driven Design (DDD) — 경량 적용
```
Bounded Context = 패키지 (auth, project, analysis, vulnerability...)
Aggregate Root = 핵심 엔티티 (User, Project, AnalysisSession, Vulnerability)
Domain Event = ApplicationEvent (VulnerabilityFoundEvent, SessionCompletedEvent)
Repository = JPA Repository (Aggregate Root 단위로만 접근)
```

#### CQRS (Command Query Responsibility Segregation) — 부분 적용
```
Command (쓰기): Service → Repository → DB
Query (읽기, 복잡한 집계): @Query 또는 별도 QueryService → DB 직접 쿼리
                           + Redis 캐시 레이어

적용 대상:
  - 대시보드 통계 조회 (복잡한 집계 → QueryService 분리)
  - 취약점 목록 필터링 (다중 조건 → 별도 VulnerabilityQueryService)
  
미적용 (오버스펙):
  - 별도 Read DB 운영 (트래픽 규모 미달)
```

#### Event-Driven (내부)
```
Spring ApplicationEvent로 도메인 간 느슨한 결합:

  VulnerabilityFoundEvent
    → SessionAggregateListener: 세션 집계(vuln_count) 업데이트
    → SsePublishListener: Redis Pub/Sub으로 SSE 이벤트 발행
    → AuditLogListener: 감사 로그 기록

  SessionCompletedEvent
    → ProjectScoreListener: 프로젝트 최신 보안점수 갱신
    → NotificationListener: FCM Push 발송 (Android)
    → ReportAutoGenListener: 자동 리포트 생성 (설정 시)
```

#### Repository Pattern + Unit of Work
```
JPA Repository로 Aggregate Root 단위 영속성 관리
@Transactional 경계 = Unit of Work
도메인 로직은 Entity 내부에 위치 (Rich Domain Model)
```

#### Outbox Pattern (Phase 3 — 신뢰성 있는 이벤트 발행)
```
문제: DB 저장 성공 + Redis Pub/Sub 발행 실패 시 데이터 불일치
해결: outbox 테이블에 이벤트 함께 저장 → 스케줄러가 Redis 발행
     (정확히 한 번 전달 보장)
```

#### Circuit Breaker (Resilience4j)
```
외부 서비스 호출 시 장애 전파 차단:
  - Spring Boot → AI Agent Service (HTTP)
  - Spring Boot → GitHub API
  - Spring Boot → NVD API
  - AI Agent → Claude API

설정:
  failureRateThreshold: 50%
  waitDurationInOpenState: 30s
  fallback: 캐시 응답 또는 기능 비활성화 안내
```

#### Bulkhead Pattern
```
Thread Pool 격리로 서비스 간 장애 전파 방지:
  - analysisExecutor: SAST 처리 (Core 5, Max 20)
  - dastExecutor: DAST Docker 실행 (Core 2, Max 5)
  - reportExecutor: PDF 생성 (Core 2, Max 5)
  - emailExecutor: 이메일 발송 (Core 2, Max 5)
  - aiCallExecutor: AI Agent HTTP 호출 (Core 5, Max 15)

DAST 장애 → dastExecutor 포화 → 다른 Executor 영향 없음
```

#### Decorator Pattern (보안)
```
AesEncryptionConverter: JPA 컬럼 자동 암/복호화 Decorator
RateLimitInterceptor: API 요청 처리 전 Rate Limit 검사
AuditLogAspect: @AuditLog 메서드 실행 전후 자동 로깅
```

#### Factory Pattern (AI Agent)
```
PayloadGeneratorFactory.create(VulnType vulnType):
  → SqliPayloadGenerator
  → XssPayloadGenerator
  → IdorPayloadGenerator
  → SsrfPayloadGenerator
  각 취약점 유형별 페이로드 생성 전략 캡슐화
```

#### Strategy Pattern
```
ScanStrategy:
  → PassiveScanStrategy (Phase 1: HTTP 헤더/응답 분석)
  → ActiveDastStrategy (Phase 2: Docker 공격 시뮬레이션)
  → ContinuousMonitorStrategy (Phase 3: 주기적 재스캔)

SbomParserStrategy:
  → MavenPomParser (pom.xml)
  → NpmPackageParser (package.json)
  → PipRequirementsParser (requirements.txt)
  → CargoTomlParser (Cargo.toml)
```

#### Template Method Pattern (리포트 생성)
```
ReportGenerator (abstract):
  ├── generateHeader() → 공통
  ├── generateSummary() → 공통
  ├── generateVulnSection() → 추상 메서드
  ├── generatePatchSection() → 추상 메서드
  └── generateFooter() → 공통

  PdfReportGenerator extends ReportGenerator
  JsonReportGenerator extends ReportGenerator
  HtmlReportGenerator extends ReportGenerator
```

#### Saga Pattern (분산 분석 흐름)
```
Python AI Agent 내부의 LangGraph가 Saga 역할:

  SAST 분석 완료
    → (성공) DAST 실행
    → (실패) 보상 트랜잭션: 세션 status=failed, 부분 결과 저장

  DAST 실행 완료
    → (성공) 패치 생성
    → (실패/타임아웃) 보상: 페이로드 재시도 (최대 3회) → failed

각 단계 실패 시 이미 완료된 단계 결과는 보존 (취소 불가)
```

---

### 4.3 모바일 특화 패턴

#### Repository Pattern (Android)
```
ViewModel → Repository → {Remote(Retrofit) | Local(Room DB)}
네트워크 없을 때 Room 캐시에서 마지막 분석 결과 표시
```

#### Observer Pattern (Android LiveData/Flow)
```
FCM 수신 → NotificationViewModel → UI 자동 갱신
SSE 스트림 → Flow<SseEvent> → collect {} → UI 업데이트
```

#### Certificate Pinning (Android 보안)
```
OkHttp CertificatePinner:
  - API Gateway의 TLS 인증서 SHA-256 핀 하드코딩
  - MITM 공격 방어
  - 인증서 갱신 시 앱 업데이트 필요 (백업 핀 관리 중요)
```

---

## 5. 신뢰 경계 (Trust Boundary) 보안 설계

### 5.1 신뢰 경계 다이어그램

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Zone 0: Public Internet (신뢰 없음)                                     │
│  웹 브라우저, Android 앱, GitHub Webhook, 공격자                         │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ HTTPS/TLS 1.3
┌───────────────────────────▼─────────────────────────────────────────────┐
│  Zone 1: DMZ / API Gateway (부분 신뢰)                                   │
│  Nginx: SSL 터미네이션, Rate Limit, WAF 기본 필터                        │
│  신뢰: 유효한 TLS 핸드셰이크 완료한 요청만 통과                           │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │ HTTP (내부 네트워크)
┌───────────────────────────▼─────────────────────────────────────────────┐
│  Zone 2: Application Zone (서비스 신뢰)                                  │
│  Backend (Spring) ←→ AI Agent (Python)  ←→ MCP Server (Node.js)         │
│  신뢰: 서비스 간 내부 API Key 또는 mTLS (Phase 3)                        │
│  격리: Docker 네트워크 브릿지 (서비스별 전용 네트워크)                     │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│  Zone 3: Data Zone (최고 신뢰)                                           │
│  PostgreSQL, Redis                                                       │
│  신뢰: Application Zone에서만 접근 가능                                   │
│  격리: secureai-data-net (별도 Docker 네트워크)                          │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────────┐
│  Zone 4: DAST Sandbox (격리 — 신뢰 없음)                                 │
│  Python DAST 컨테이너                                                    │
│  격리: dast-isolated-net (외부 인터넷만 허용, 내부망 차단)                │
│  생명주기: 요청 시 생성 → 완료 즉시 삭제                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 MCP 파일시스템 접근 보안

```
MCP Filesystem Server 보안 경계:
  - rootPath 화이트리스트: 사용자가 선택한 프로젝트 폴더만 접근 허용
  - 심볼릭 링크 탈출 방지: followSymlinks=false
  - 숨김 파일 노출 제한: .env, .ssh, .aws 패턴 차단 (읽기는 허용, AI 분석은 마스킹)
  - 최대 파일 크기: 10MB 초과 파일 분석 제외
  - 바이너리 파일 제외: .exe, .bin, .jar 등
```

### 5.3 Android 보안 요구사항

```
1. 인증서 피닝 (OkHttp CertificatePinner)
2. 루트 탐지 (RootBeer 라이브러리)
3. 스크린 캡처 방지 (FLAG_SECURE, 민감 화면에서)
4. EncryptedSharedPreferences (토큰, 사용자 정보 암호화 저장)
5. Network Security Config (cleartext 트래픽 차단)
6. ProGuard/R8 난독화
7. APK 서명 검증
```

---

## 6. Android 앱 아키텍처 결정

### 6.1 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 언어 | Kotlin | 공식 언어, Coroutine, Null Safety |
| UI | Jetpack Compose | 선언형 UI, 상태 기반 렌더링 |
| 아키텍처 | MVVM + Clean Architecture | 테스트 용이성, 관심사 분리 |
| 네트워크 | Retrofit + OkHttp | Android 표준, 인증서 피닝 지원 |
| 상태관리 | StateFlow + ViewModel | 생명주기 안전 |
| 로컬 DB | Room | 오프라인 캐시 |
| DI | Hilt | 표준 DI, Compose 통합 |
| 실시간 | SSE (OkHttp) + FCM | foreground: SSE, background: FCM |
| 이미지 | Coil | Kotlin 우선, Compose 통합 |

### 6.2 FCM + SSE 이중 전략

```
[Foreground (앱 화면 켜짐)]
  SSE EventSource(OkHttp) 직접 연결
  → 실시간 취약점 발견 알림 스트림
  → 분석 진행률 업데이트

[Background (앱 최소화/종료)]
  FCM Push Notification
  "분석 완료: 취약점 3개 발견" → 앱 실행 딥링크

[앱 재실행 시]
  REST API로 최신 상태 동기화
  Room DB 캐시 갱신
```

### 6.3 모바일 전용 API 최적화

```
웹과 동일 API 사용하되, Accept 헤더로 모바일 응답 축소:

  Accept: application/json; profile="mobile"

Backend에서 모바일 프로파일 감지 시:
  - 불필요 필드 제거 (codeSnippet 축소, references 생략)
  - 이미지/파일 URL 모바일 최적화 버전 반환
  - 페이지 사이즈 기본값 축소 (20 → 10)
```

---

## 7. MCP 통합 아키텍처

### 7.1 MCP 실행 모드

```
개발 환경 (stdio 모드):
  Python AI Agent → subprocess.run("npx @modelcontextprotocol/server-filesystem /path")
  → stdin/stdout으로 JSON-RPC 통신

운영 환경 (HTTP 서버 모드):
  MCP Server 컨테이너 (포트 3001) 상시 실행
  Python AI Agent → HTTP POST http://mcp-server:3001/mcp
```

### 7.2 MCP Tool 목록

| Tool | 서버 | 용도 | Phase |
|------|------|------|-------|
| `read_file` | Filesystem | 단일 파일 내용 읽기 | 1 |
| `list_directory` | Filesystem | 파일 트리 탐색 | 1 |
| `search_files` | Filesystem | 패턴 검색 (시크릿 탐지) | 1 |
| `get_file_info` | Filesystem | 파일 메타 (크기, 수정일) | 1 |
| `get_repo_contents` | GitHub | GitHub 파일 내용 조회 | 2 |
| `list_commits` | GitHub | 커밋 히스토리 목록 | 2 |
| `get_commit_diff` | GitHub | 커밋별 diff 조회 | 2 |
| `create_issue_comment` | GitHub | PR 코멘트 자동 작성 | 2 |
| `run_container` | Docker | DAST 샌드박스 실행 | 2 |
| `get_container_logs` | Docker | 샌드박스 실행 로그 수집 | 2 |

---

## 8. 서비스 간 통신 전략

### 8.1 동기 통신 (HTTP)

```
Spring Boot → Python AI Agent:
  POST /agent/analyze
  Body: { sessionId, projectId, filePaths, layerType }
  Response: 202 Accepted (즉시 반환)
  
  AI Agent는 처리 완료 후 Redis Pub/Sub으로 결과 발행
  → Spring Boot SSE 브릿지가 클라이언트로 전달

보안: 내부 네트워크 전용 API Key (X-Internal-Key 헤더)
재시도: Resilience4j Retry (최대 3회, exponential backoff)
타임아웃: 10초 (연결), 600초 (읽기 — DAST 포함 시 최대 10분)
```

### 8.2 비동기 통신 (Redis Pub/Sub)

```
AI Agent → Redis → Spring Boot → SSE → 클라이언트

채널: secureai:sse:{sessionId}
메시지 형식: JSON (type, data, timestamp)

Spring Boot는 Redis SUBSCRIBE 후 SseEmitter에 전달
Android는 FCM으로 동일 이벤트의 Push 수신
```

### 8.3 데이터 소유권

```
PostgreSQL 쓰기 권한:
  - Backend Service만 쓰기 가능
  - AI Agent는 분석 결과를 Backend REST API로 전달 → Backend가 DB 저장
  - AI Agent가 DB에 직접 접근하지 않음 (결합도 최소화)

Redis 접근:
  - Backend: 캐시 읽기/쓰기, SSE Subscribe
  - AI Agent: SSE Publish, 분산 락 획득
```

---

## 9. 장애 격리 전략

```
장애 시나리오별 영향 범위:

[AI Agent Service 다운]
  영향: 신규 분석 요청 불가
  비영향: 인증, 프로젝트 조회, 이전 분석 결과 조회, 리포트 다운로드 — 모두 정상
  복구: AI Agent 재시작 (Spring Boot 무중단)

[DAST 컨테이너 OOM]
  영향: 해당 세션 DAST 단계 실패
  비영향: 다른 세션, API 서비스 전체 — 영향 없음
  복구: 세션 status=failed 기록, 재실행 가능

[Redis 다운]
  영향: SSE 실시간 스트림 중단, 캐시 히트 없음
  비영향: 인증(JWT 자체 검증), DB 직접 조회 — 기능 유지 (성능 저하)
  복구: Redis 재시작, Spring Boot 자동 재연결

[PostgreSQL 다운]
  영향: 모든 데이터 쓰기/읽기 불가
  대응: 헬스체크로 빠른 감지 + 로드밸런서에서 트래픽 차단

[MCP Server 다운]
  영향: AI 에이전트의 파일 접근 불가 → 분석 실패
  비영향: 이미 완료된 세션 조회, 기타 API 정상
```

---

## 10. 단계별 발전 로드맵

```
Phase 1 (MVP): 모듈러 모놀리스 + AI Agent 분리
  ├── Backend: Spring Boot (모듈러 모놀리스)
  ├── AI Agent: Python FastAPI + LangGraph
  ├── MCP: stdio 모드 (개발 간단)
  ├── 클라이언트: 웹만
  └── 인프라: Docker Compose

Phase 2 (서비스화): Android 추가 + 운영 안정화
  ├── Android 앱 출시
  ├── FCM 연동
  ├── MCP: HTTP 서버 모드 전환
  ├── Circuit Breaker 적용
  └── 인프라: Docker Compose → (검토) 단일 서버 k8s

Phase 3 (SaaS): 고가용성 + 완전 관측성
  ├── 모니터링 서비스 분리 (트래픽 급증 시)
  ├── Outbox Pattern 적용 (신뢰성 이벤트)
  ├── mTLS (서비스 간 상호 인증)
  ├── Grafana + Prometheus + LangSmith
  └── VSCode Extension 출시
```

---

*다음 문서: [05_REPOSITORY_STRUCTURE_V2.md] — 전체 레포지토리 구조 (v2)*
