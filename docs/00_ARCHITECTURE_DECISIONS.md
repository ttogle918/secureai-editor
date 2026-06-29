# SecureAI — 아키텍처 의사결정 기록 (ADR)
> 데이터 아키텍처 전문가 ↔ 시니어 백엔드 개발자 의논 결과  
> 작성일: 2026-04-19 | 상태: 확정

---

## 개요

이 문서는 ERD 및 API 설계서 작성에 앞서 두 담당자가 합의한 핵심 설계 결정 사항을 기록합니다.  
각 결정은 번복 비용이 크기 때문에 개발 착수 전 반드시 확인이 필요합니다.

---

## ADR-001 — DB 전략: SQLite → PostgreSQL 마이그레이션 경로

### 결정
MVP는 **PostgreSQL 15**로 직접 시작한다. SQLite는 사용하지 않는다.

### 근거
- Docker Compose 환경에서 PostgreSQL 컨테이너 구동 비용은 SQLite와 동일
- SQLite는 `FOR UPDATE` 락, 배열 타입(`jsonb`), 파티셔닝, `pg_trgm` 전문 검색을 지원하지 않음
- 분석 세션/취약점 데이터는 동시 쓰기가 빈번 → SQLite WAL 모드로는 한계
- 마이그레이션 시점에 Flyway 스크립트 재작성 리스크 제거

### 영향
- Docker Compose에 `postgres:15-alpine` 서비스 추가
- `application.properties` datasource는 처음부터 PostgreSQL 설정

---

## ADR-002 — 캐시 레이어: Redis 도입

### 결정
**Redis 7**을 캐시 + 메시지 브로커 + 분산 락으로 활용한다.

### 활용 목적별 분류

| 목적 | 상세 | TTL |
|------|------|-----|
| 분석 결과 캐시 | 동일 파일 해시에 대한 SAST 결과 재사용 | 24h |
| 세션 상태 캐시 | 진행 중인 AnalysisSession 상태 | 2h |
| CVE 데이터 캐시 | NVD API 응답 (변경 느림) | 6h |
| Rate Limit 카운터 | 도메인별 DAST 횟수 제한 | 1h |
| SSE 채널 | `SUBSCRIBE secureai:sse:{sessionId}` | 세션 종료 시 삭제 |
| 분산 락 | DAST Docker 컨테이너 동시 실행 제한 | 30min |
| Pub/Sub | LangGraph4j 에이전트 → SSE 브릿지 | - |

### 영향
- Docker Compose에 `redis:7-alpine` 서비스 추가
- `spring-boot-starter-data-redis` 의존성 추가
- `@Cacheable`, `@CacheEvict` 어노테이션 적극 활용

---

## ADR-003 — 비동기 처리: Spring @Async + Virtual Thread

### 결정
분석 작업은 **Spring @Async + Java 21 Virtual Thread**로 처리한다.  
외부 메시지 큐(Kafka/RabbitMQ)는 Phase 3 이후 도입 검토.

### 이유
- LangGraph4j 에이전트 파이프라인이 단일 JVM 내에서 완결됨
- DAST Docker 실행은 평균 30~120초 → Virtual Thread로 블로킹 없이 처리
- SSE 스트리밍은 Spring SseEmitter + Redis Pub/Sub으로 충분
- Phase 1~2 범위에서 메시지 큐 운영 오버헤드 불필요

### 비동기 처리 영역

```
분석 시작 요청 (HTTP 201 즉시 반환)
    │
    ├─ @Async("analysisExecutor")
    │       └─ SAST 에이전트 실행 (Virtual Thread)
    │               └─ Claude API 호출 (비동기)
    │
    ├─ @Async("dastExecutor")  
    │       └─ DAST Docker 실행 (Virtual Thread)
    │               └─ Redis Pub/Sub으로 진행 상황 발행
    │
    └─ SSE SseEmitter
            └─ Redis SUBSCRIBE → 클라이언트로 스트리밍
```

---

## ADR-004 — 스케줄링: Spring @Scheduled

### 결정
**Spring @Scheduled + ShedLock** (분산 환경 중복 실행 방지)을 사용한다.  
Sprint 8(TASK-801)에서 ShedLock Redis Provider를 도입하여 모든 Job에 `@SchedulerLock`을 적용했다.

### 스케줄 목록 (Sprint 9 완료 기준 — 2026-05-23 현행화)

> **ShedLock**: 모든 Job에 적용됨 (`lockAtMostFor` 각 Job 참고)  
> **⚠️ 설계 변경**: `SslCertChecker`는 독립 Job이 아닌 `MonitoringJob` 내부 서비스로 통합됨 (Sprint 9, TASK-901)

| Job 클래스 | Cron | 목적 | ShedLock | 도입 |
|-----------|------|------|---------|------|
| `NvdSyncJob` | `0 0 3 * * *` (매일 03:00) | NVD API 최신 CVE 동기화, `NvdSyncCompletedEvent` 발행 | `PT1H` | Sprint 3 |
| `ExpiredDataCleanupJob` | `0 30 4 * * *` (매일 04:30) | exploit_results 30일·reports 90일 만료 데이터 삭제 | `PT1H` | Sprint 8 |
| `PartitionMaintenanceJob` | `0 0 1 * *` (매월 1일) | analysis_sessions·audit_logs 다음 달 파티션 미리 생성 | `PT30M` | Sprint 8 |
| `SastUsageResetJob` | `0 0 1 * *` (매월 1일) | 전 사용자 `sast_usage_this_month` 0으로 리셋 | `PT30M` | Sprint 8 |
| `SessionInterruptionScheduler` | (주기적 점검) | 비정상 종료 세션 감지·정리, AI Agent Circuit Breaker 상태 체크 | `PT30M` | Sprint 8 |
| `RefreshTokenCleanupJob` | `0 0 2 * * *` (매일 02:00) | 만료된 refresh_tokens 행 삭제 | `PT30M` | Sprint 8 |
| `GdprHardDeleteJob` | `0 0 4 * * *` (매일 04:00) | `deleted_at` 30일 초과 계정·연관 데이터 배치 완전 삭제, 감사 로그 선행 기록 | `PT30M` | Sprint 9 |
| `MonitoringJob` | `0 0 * * * *` (매시) | Team/Enterprise 플랜 대상: HTTPS 헬스체크 + `SslCertChecker`(X.509 파싱·30일 만료 알림) + CVE 재매칭(`NvdSyncCompletedEvent` 구독) | `PT50M` | Sprint 9 |
| `MonitoringPartitionJob` | `0 0 1 * *` (매월 1일) | monitoring_results 다음 달 파티션 생성, DDL 정규식 화이트리스트 검증 | `PT30M` | Sprint 9 |

### 폐기된 설계 항목

| 항목 | 원래 설계 | 변경 이유 |
|------|---------|---------|
| `SslCertChecker` (독립 Job, 매주 월 09:00) | ADR 초안에서 별도 `@Scheduled` Job으로 계획 | Sprint 9(TASK-901) 구현 시 `MonitoringJob` 내 `SslCertChecker.java` 서비스 클래스로 통합 — 매시 헬스체크와 SSL 파싱을 분리 운영할 실익 없음, 운영 복잡도 감소 |
| `TokenRefreshJob` (30분 주기) | ADR 초안에서 GitHub 토큰 갱신 알림 목적 | 구현 우선순위 하락. Sprint 10 이후 재검토 예정 |
| `RateLimitResetJob` (매시) | Redis Rate Limit 카운터 로그 목적 | Redis TTL 기반 자동 만료로 별도 Job 불필요. 모니터링은 Prometheus 메트릭으로 대체 |

---

## ADR-005 — DAST 격리: Docker-in-Docker vs Docker Socket

### 결정
**Docker Socket 마운트** 방식을 사용한다. DinD는 사용하지 않는다.

### 이유
- DinD는 privileged 권한 필요 → 보안 위험 더 큼
- Spring Boot 컨테이너에서 `/var/run/docker.sock` 마운트로 Docker SDK 호출
- DAST 실행 컨테이너는 네트워크 격리 (`--network none` 또는 전용 bridge) 적용
- 컨테이너 실행 타임아웃 강제: 300초 후 자동 kill

### DAST 컨테이너 생명주기

```
1. 도메인 소유권 확인 (DB 조회)
2. Redis 분산 락 획득 (동일 도메인 중복 실행 방지)
3. Docker 컨테이너 생성 (격리 네트워크, 메모리 512MB 제한)
4. 페이로드 실행 + SSE 스트리밍
5. 컨테이너 종료 (타임아웃 또는 완료)
6. 로그 암호화 저장 (AES-256)
7. Redis 락 해제
```

> ⚠️ **정정 (2026-06-29) — 제품 DAST는 이 설계와 다르게 동작 중.**
> 위 socket-mount + 단명 격리 컨테이너 + `dast-isolated-net` 설계는 **Sprint 6 원본 DAST·ZAP 회귀스캔(profile:zap) 한정**으로만 유효하다.
> **데모/제품 DAST executor**(SQLi/XSS/IDOR/SSRF)는 **ai_engine 프로세스 內 httpx async**로 **app-net**에서 타깃을 직접 공격한다(별도 컨테이너·격리망 없음). ai_engine이 app-net+data-net 멀티홈이라 **SSRF 측면이동(postgres/redis 도달) 표면이 존재**한다.
> → 격리 복원은 백로그 **TASK-1227(제품 DAST 격리화)**: dast-runner 별도 컨테이너를 dast-isolated-net 전용 연결(data-net 제거) + executor 사설IP/메타데이터 차단. CLAUDE.md "DAST 샌드박스는 반드시 dast-isolated-net 격리" 규칙은 현재 ZAP에만 충족됨.

---

## ADR-006 — API 인증: JWT + Refresh Token Rotation

### 결정
**Access Token (15분) + Refresh Token (30일, Rotation)** 전략을 사용한다.

### 토큰 저장 전략

| 토큰 | 저장 위치 | 이유 |
|------|----------|------|
| Access Token | 메모리 (JS 변수) | XSS 노출 최소화 |
| Refresh Token | HttpOnly Secure Cookie | CSRF 방어 (SameSite=Strict) |
| Refresh Token 해시 | Redis (TTL 30일) | 서버사이드 무효화 가능 |

### Refresh Token Rotation
- Refresh Token 사용 시 즉시 새 Refresh Token 발급 + 구 토큰 Redis에서 삭제
- 구 토큰 재사용 감지 시 해당 유저 전체 세션 강제 만료

---

## ADR-007 — 파일 해시 기반 SAST 캐시 전략

### 결정
동일 코드 재분석 방지를 위해 **파일 내용 SHA-256 해시** 기반 캐시를 적용한다.

### 흐름

```
파일 목록 수신
    → 파일별 SHA-256 해시 계산
    → Redis에서 hash 조회
        ├── HIT: 캐시된 취약점 결과 즉시 반환
        └── MISS: Claude API 분석 → 결과 Redis 저장 (TTL 24h) + DB 저장
```

### 캐시 키 형식
```
secureai:sast:{sha256_hash}:{language}
```

> ⚠️ **정정 (2026-06-29) — 실제 구현과 상이.** 실제 SAST 캐시 키는 `sast:cache:{sha256}`(language 미포함), **TTL은 24h가 아니라 7일**이다(`17_ARCHITECTURE_CURRENT` §2.1·코드 기준). 패치 캐시는 `patch:cache:{vuln_type}:{ext}` TTL 24h로 별도.

---

## ADR-008 — 멀티테넌시: 플랜별 기능 제어

### 결정
`PLAN` 컬럼 + Spring Security `@PreAuthorize` + AOP로 플랜별 기능 제어를 한다.

### 플랜별 제한 매트릭스

| 기능 | Free | Pro | Team | Enterprise |
|------|------|-----|------|-----------|
| SAST 월 횟수 | 50 | 무제한 | 무제한 | 무제한 |
| Private Repo | ✗ | ✓ | ✓ | ✓ |
| DAST | ✗ | ✓ | ✓ | ✓ |
| 모니터링 | ✗ | ✗ | ✓ | ✓ |
| 팀 멤버 | 1 | 1 | 5 | 협의 |
| API Rate Limit | 10 req/min | 60 req/min | 120 req/min | 무제한 |
| PDF 리포트 | ✗ | ✓ | ✓ | ✓ |
| SBOM 생성 | ✗ | ✓ | ✓ | ✓ |
| SSO | ✗ | ✗ | ✗ | ✓ |

---

## ADR-009 — 민감 데이터 암호화 전략

### 결정
분석 로그, 익스플로잇 결과, GitHub 토큰은 **AES-256-GCM**으로 암호화 저장한다.

### 암호화 대상 컬럼

| 테이블 | 컬럼 | 방식 |
|--------|------|------|
| `users` | `github_token` | AES-256-GCM + JPA AttributeConverter |
| `exploit_results` | `payload`, `sandbox_log` | AES-256-GCM |
| `scan_targets` | `target_url` | AES-256-GCM |
| `cvss_details` | - | 암호화 불필요 (공개 데이터) |

### 키 관리
- 암호화 키: 환경변수 `SECUREAI_ENCRYPTION_KEY` (32바이트 랜덤)
- Docker Secret 또는 AWS Secrets Manager (Phase 3)

---

## ADR-010 — 배치 처리: SBOM 생성 및 CVE 매칭

### 결정
SBOM 생성 및 CVE 매칭은 **Spring Batch** 없이 `@Async` + 청크 처리로 구현한다.  
(Spring Batch는 별도 메타 테이블이 많아 MVP 오버스펙)

### 처리 흐름

```
의존성 파일 파싱 (pom.xml / package.json / requirements.txt)
    → 컴포넌트 목록 추출 (ChunkProcessor, 50개씩)
    → Redis 캐시에서 CVE 조회
        ├── HIT: 캐시 결과 사용
        └── MISS: NVD API 호출 → Redis 캐시 저장 (6h)
    → vulnerability_components 테이블 저장
    → 분석 세션에 결과 집계
```

---

## 미결 사항 (개발 중 결정 필요)

다음 항목은 설계 시 방향만 잡고, 구현 단계에서 최종 결정한다.

| 번호 | 사항 | 현재 방향 |
|------|------|----------|
| 1 | GitHub OAuth 앱 등록 scope | `repo:read` + `security_events` |
| 2 | DAST 페이로드 DB 저장 상세 수준 | 요약만 저장, 전문은 암호화 파일 |
| 3 | PDF 리포트 생성 라이브러리 | iText 7 또는 OpenPDF 검토 |
| 4 | 알림 채널 (Slack/Email) | Phase 3에서 결정 |
| 5 | 온프레미스 배포 형태 | Docker Compose → Helm Chart |

---

## Docker Compose 서비스 구성 확정

```yaml
services:
  postgres:    # PostgreSQL 15-alpine, port 5432
  redis:       # Redis 7-alpine, port 6379
  backend:     # Spring Boot 4 JAR, port 8080
  frontend:    # Next.js 15, port 3000
  nginx:       # Reverse Proxy (개발 시 선택적)
  
# DAST 샌드박스 컨테이너는 Docker SDK로 동적 생성 (Compose에 미포함)
```

---

*이 문서는 ERD(01_ERD.md) 및 API 설계서(02_API_DESIGN.md) 작성의 전제 조건입니다.*

---

## Sprint 1 ADR (2026-04-19 ~ 2026-04-25)

---

## ADR-011 — DB 마이그레이션: Flyway → ddl-auto:update (임시)

### 결정
Sprint 1 기간 중 **`spring.jpa.hibernate.ddl-auto=update`** 를 사용하고 Flyway는 비활성화한다.

### 근거
- Sprint 1은 엔티티 스키마가 빠르게 변경되는 설계 초기 단계
- Flyway 스크립트를 매 변경마다 작성하면 개발 속도 저하
- 데이터 유실이 허용되는 로컬 개발 환경(Docker Compose)에서만 운영

### 제약
- **프로덕션 배포 전 반드시 Flyway로 전환** 필요
- 컬럼 이름 변경·삭제는 ddl-auto가 처리하지 않으므로 수동 ALTER 필요
- Sprint 2 착수 전 `V1__init.sql` 작성 후 ddl-auto를 `validate`로 변경 예정

---

## ADR-012 — Access Token 저장: 메모리 전용

### 결정
Access Token은 **JS 메모리(클로저 변수)에만** 저장한다. `localStorage`, `sessionStorage`, Zustand persist에 저장하지 않는다.

### 근거
- `localStorage`에 저장하면 XSS 공격으로 토큰 탈취 가능 (OWASP A03)
- Zustand `persist` 미들웨어의 `partialize`로 `accessToken` 키를 명시적으로 제외
- 대신 **HttpOnly Secure Cookie**에 Refresh Token 저장 → 페이지 새로고침 시 `POST /auth/refresh`로 조용히 재발급(Silent Refresh)

### 구현 세부사항
- `apps/frontend/src/lib/api/client.ts`: `let _accessToken: string | null = null` (모듈 수준 변수)
- `apps/frontend/src/hooks/useAuth.ts`: `initAuth()` — 앱 마운트 시 Refresh 쿠키로 토큰 복원
- `apps/frontend/src/components/AuthProvider.tsx`: root layout에서 `initAuth()` 1회 호출 (useRef 가드)
- `isInitialized` 플래그: refresh 완료 전 보호된 페이지가 `/login`으로 조기 리다이렉트하는 것 방지

---

## ADR-013 — GitHub OAuth CSRF 방어: State + Redis

### 결정
OAuth 2.0 state 파라미터를 **UUID 생성 → Redis TTL 10분 저장 → 콜백에서 검증 후 즉시 삭제** 방식으로 구현한다.

### 흐름
```
1. GET /api/v1/auth/github
   → UUID state 생성
   → Redis SET "secureai:oauth:state:{state}" "1" EX 600
   → GitHub Authorization URL로 리다이렉트 (state 포함)

2. GET /api/v1/auth/github/callback?code=...&state=...
   → Redis에 key 존재 확인
   → 없으면 AUTH_OAUTH_STATE_INVALID (400) 반환
   → 있으면 즉시 DEL (재사용 방지)
   → GitHub code → 사용자 처리 → LoginResponse
   → 프론트엔드 /auth/callback?accessToken=... 으로 리다이렉트
```

### 보안 고려사항
- state 검증 실패 시 즉시 예외 (`BusinessException(ErrorCode.AUTH_OAUTH_STATE_INVALID)`)
- Redis TTL로 오래된 state 자동 만료
- 콜백 처리 즉시 key 삭제 → 동일 state 재사용 불가 (replay attack 방지)

---

## ADR-014 — Jackson 3.x / Spring Boot 4 호환

### 결정
Spring Boot 4.0에서 Jackson은 기본적으로 **Jackson 3.x** (FasterXML)로 올라간다.  
`ObjectMapper` 직접 주입 대신 Spring이 제공하는 Bean을 사용하고, 직렬화 설정은 `application.properties`로 관리한다.

### 영향
- `com.fasterxml.jackson` 패키지 임포트는 그대로 유지 (Jackson 3.x는 패키지명 변경 없음)
- `spring.jackson.serialization.write-dates-as-timestamps=false` → ISO-8601 문자열 직렬화
- `OffsetDateTime` 파라미터를 포함하는 DTO는 `@JsonFormat` 불필요 (기본 ISO-8601 처리)

---

## ADR-015 — Refresh Token DB 저장 전략

### 결정
Refresh Token은 **SHA-256 해시값만 DB(`refresh_tokens` 테이블)에 저장**한다. 원문은 저장하지 않는다.

### 근거
- DB 유출 시 토큰 원문 노출 방지
- 검증: 요청의 원문 토큰 → SHA-256 → DB 조회
- Rotation: 사용 시 즉시 새 토큰 발급 + 구 해시 무효화
- 재사용 감지: 이미 무효화된 해시 재요청 → 해당 유저 전체 세션 강제 만료 (`revokeAllByUserId`)

### 토큰 발급 흐름
```
1. 랜덤 UUID → Raw Token (클라이언트 전달용)
2. SHA-256(Raw Token) → DB 저장
3. HttpOnly Cookie로 Raw Token 설정 (Secure, SameSite=Strict, Max-Age=2592000)
```

---

## ADR-016 — MCP PostgreSQL 컨텍스트 조회: Backend 내부 API 경유

> 작성일: 2026-05-23 | 상태: **확정** (2026-05-23 전환 완료)

### 배경

`@modelcontextprotocol/server-postgres`의 `query` 툴은 **파라미터 바인딩을 지원하지 않는다.**  
툴 인터페이스가 `{ "query": "<raw SQL string>" }` 단일 인수만 허용하며, prepared statement 또는 `$1/$2` 플레이스홀더를 전달할 방법이 없다.

이 서버는 `mcp_client.py`에서 `npx -y @modelcontextprotocol/server-postgres <connstring>` 형태로  
AI Engine 내부에서 stdio subprocess로 실행된다 (별도 Docker 컨테이너 아님).

이로 인해 MCP PostgreSQL을 통한 조회(`sast_node.py`, `patch_node.py`)에서  
프로젝트 전체 코딩 규칙(`general.md`) **"SQL 쿼리는 파라미터 바인딩 필수"** 원칙을 그대로 적용할 수 없었다.

### 검토된 대안

| 대안 | 구현 방법 | 파라미터 바인딩 | 평가 |
|------|----------|----------------|------|
| **A. Backend API 경유 ✅ 채택** | AI Engine → `GET /api/v1/internal/…` | ✅ JPQL 파라미터 바인딩 | 원칙 완전 준수. 기존 `backend_api_client.py` 패턴 재사용 |
| B. asyncpg 직접 사용 | AI Engine의 `AsyncConnectionPool` 재사용 | ✅ `$1` 플레이스홀더 | "AI는 MCP를 통해서만 DB 접근" 일관성 저해 |
| C. f-string + 입력 검증 (구현됐다 폐기) | UUID 검증 / 내부 열거값만 삽입 | ❌ 원칙 위반 | 2026-05-23 이전 임시 적용, 이후 삭제 |

### 확정 결정 (A 방안)

AI Engine이 MCP PostgreSQL을 통해 컨텍스트를 조회하는 두 지점을  
**Backend 내부 HTTP API 경유**로 전환한다.  
AI Engine은 이미 `BACKEND_INTERNAL_URL` + `X-Internal-Key` 패턴으로 Backend를 호출 중이므로  
추가 인프라 변경 없이 구현 가능하다.

### 구현 위치

| 계층 | 파일 | 변경 내용 |
|------|------|----------|
| Backend | `VulnerabilityRepository` | `findVulnTypeSummaryByProjectId()` JPQL 추가 |
| Backend | `VulnerabilityQueryService` | `getVulnTypeSummary()` 서비스 메서드 추가 |
| Backend | `VulnerabilityController` | `GET /api/v1/internal/projects/{projectId}/vuln-context` 엔드포인트 추가 |
| Backend | `PatchSuggestionRepository` | `findRecentByVulnTypeAndLangSuffix()` JPQL 추가 |
| Backend | `PatchService` | `getPatchExamples()` 서비스 메서드 추가 |
| Backend | `PatchController` | `GET /api/v1/internal/patch-examples` 엔드포인트 추가 |
| Backend | `VulnContextItem` (DTO) | 신규 record DTO |
| Backend | `PatchExampleItem` (DTO) | 신규 record DTO |
| AI Engine | `backend_api_client.py` | `get_vuln_context()`, `get_patch_examples()` 추가 |
| AI Engine | `sast_node.py` | `_fetch_prev_vuln_context()` — MCP 호출 → Backend API 호출로 교체 |
| AI Engine | `patch_node.py` | `_fetch_prev_patch_example()` — MCP 호출 → Backend API 호출로 교체 |

### 핵심 코드 패턴

```python
# sast_node.py — Backend 내부 API 경유 (JPQL 파라미터 바인딩)
async def _fetch_prev_vuln_context(project_id) -> str:
    items = await get_vuln_context(str(project_id))
    lines = [f"{i['vulnType']} | count: {i['count']} | max_severity: {i['maxSeverity']}" for i in items if i.get("vulnType")]
    return "\n".join(lines)
```

```python
# patch_node.py — Backend 내부 API 경유 (JPQL LIKE 파라미터 바인딩)
async def _fetch_prev_patch_example(vuln_type: str, language: str) -> str:
    items = await get_patch_examples(vuln_type, language)
    ...
```

```java
// VulnerabilityRepository.java — JPQL 파라미터 바인딩
@Query("SELECT v.vulnType, COUNT(v), MAX(v.severity) FROM Vulnerability v WHERE v.project.id = :projectId AND v.createdAt > :since GROUP BY v.vulnType ORDER BY COUNT(v) DESC")
List<Object[]> findVulnTypeSummaryByProjectId(@Param("projectId") UUID projectId, @Param("since") OffsetDateTime since, Pageable pageable);
```

### 보안 인증

두 내부 엔드포인트는 `InternalKeyAuthFilter`로 보호된다 (`X-Internal-Key` 헤더 검증).  
`SecurityConfig`의 `/api/v1/internal/**` 패턴에 포함되어 JWT 없이 내부키만으로 접근된다.

---

## ADR-017 — SAST 분석 산출 강화 + 프로덕션 SAST→DAST 핸드오프

> 의논 맥락: 2026-06-24 세션. "SAST는 '왜 위험한가'까지 결론을 내는데, 그 추론 중 생성되는 정보 대부분이 출력 스키마에 없어서 버려진다. DAST에 넘길 것/사용자 참고자료로 줄 것이 더 있지 않나?"에 대한 코드 실측 후 합의.

### 배경 — 현재 SAST가 실제로 산출하는 것

`agent/claude_client.py`의 SAST 시스템 프롬프트가 강제하는 JSON 스키마는 취약점당 **8개 필드뿐**이다:

```
type · severity · category · cwe · owasp · line · description · code_snippet
```

`response_parser.parse_sast_response`는 이 필드를 그대로 통과시키고(`file_path`만 부착), 백엔드 `Vulnerability` 엔티티도 동일 집합만 영속화한다(+ status·source·dedup_hash). **수정안("이렇게 바꿔라")은 SAST 노드가 아니라 별도 `patch_node`(aggregate→patch→patch_verify)에서만**, 그것도 patch 단계까지 도달한 finding에 한해 생성된다.

### 문제

1. **추론은 풍부하나 스키마가 최소** — 모델은 공격 시나리오·taint 흐름(source→sink)·주입 파라미터·참고자료까지 내부적으로 추론하지만, 출력 스키마에 없어 **폐기**된다.
2. **SAST→DAST 핸드오프가 실데이터가 아님** — `api_discovery_node`가 `api_groups`(url+method 힌트)를 만들지만 **취약점에 연결·영속화되지 않는다**. 백엔드 `Vulnerability`에 endpoint/method/params 컬럼이 없어, 프론트(`vulnUtils.deriveEndpoint`/`deriveApiGroup`, DVWA 하드코딩 포함)가 **휴리스틱 재추론**하고 DAST 워크스페이스 Request Builder는 사실상 **수동 입력**이다. (VAL-4의 프로덕션 proven 라벨링이 S14+로 이월된 것과 동일 선상의 미결 갭.)

### 결정

SAST 출력 스키마를 **선별 확장**하고, 그 결과를 취약점에 **영속화**하여 DAST 입력과 사용자 참고자료의 단일 출처로 삼는다. "전부 캡처"가 아니라 **DAST/사용자 가치가 분명한 필드만** 추가한다.

**(1) SAST 출력 스키마 확장** (`claude_client.py` 프롬프트 + 파서 + 엔티티/마이그레이션):

| 추가 필드 | 용도 | 비고 |
|---|---|---|
| `tainted_parameter` | DAST가 *어느 파라미터를 퍼징할지* 결정 | code_snippet에 묻혀 있던 것을 구조화 |
| `attack_scenario` | 사용자 참고자료 + DAST 증거 프레이밍 | "공격자가 이 입력으로 …" 1~2문장 |
| `data_flow`(source→sink, 선택) | 재현성·이해도 + AST 가드(VAL-3) 교차검증 | 비용 큰 필드 — 후순위/옵션 |
| `references`(파생) | 사용자 참고자료 | **신규 토큰 비용 없음** — 기존 `cwe`/`owasp` ID로 링크 렌더만 |

**(2) 프로덕션 SAST→DAST 핸드오프**: `api_discovery`의 `api_groups`를 `vuln.filePath+line`과 매칭해 취약점에 `api_endpoint`/`http_method`를 부여·영속화한다. 프론트 휴리스틱(`vulnUtils`)을 제거하고, DAST 시작 폼을 prefill한다(실행은 **여전히 user-triggered + 동의 게이트 유지** — 자동 연결 아님).

**(3) 자동 그래프 연결은 하지 않는다** — SAST 종료 즉시 DAST 자동 실행은 `consentGiven`·도메인 소유권 게이트를 우회하므로 금지. 핸드오프는 "데이터 전달 + prefill"까지이고 트리거는 사용자가 누른다.

### 트레이드오프 (정직하게)

- **출력 토큰↑** → 단위 원가 상승(EPIC-ECON과 충돌). ⇒ 필드를 최소 선별, `references`처럼 무비용 항목 우선.
- **환각 위험↑** → 없는 파라미터/흐름을 지어낼 수 있음. ⇒ `tainted_parameter`·`data_flow`는 **AST 가드(VAL-3)로 실재 검증** 후 채택, 불일치 시 해당 필드만 폐기.
- **검증 부담↑** → 스키마 확장은 파서·엔티티·마이그레이션·테스트 동반.

### 영향

- `apps/ai_engine/agent/claude_client.py`(프롬프트 스키마), `response_parser.py`(파서), `agent/nodes/sast_node.py`·`api_discovery_node.py`(엔드포인트 바인딩).
- 백엔드 `Vulnerability` 엔티티 + Flyway 마이그레이션(신규 컬럼: `tainted_parameter`·`attack_scenario`·`api_endpoint`·`http_method`), `VulnerabilityResponse` DTO.
- 프론트 `vulnUtils.ts` 휴리스틱 제거 → 실데이터 사용, 취약점 카드에 SAST 의심 + DAST proven + 참고링크 통합 뷰.
- **백로그**: `VAL-18`로 태스크화(07_SPRINT_BACKLOG_V4). VAL-3(AST 가드)·VAL-4(proven 라벨)와 의존. 실제 편성은 `/sprint`(PM)에서.
