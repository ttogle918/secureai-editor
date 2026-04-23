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
**Spring @Scheduled** (배포 앱 모니터링, CVE 동기화, 토큰 정리)를 사용한다.

### 스케줄 목록

| Job 이름 | Cron | 목적 | 비고 |
|---------|------|------|------|
| `NvdSyncJob` | `0 0 3 * * *` (매일 03:00) | NVD API에서 최신 CVE 동기화 | Redis 캐시 갱신 포함 |
| `MonitoringJob` | `0 0 * * * *` (매시) | 구독 중인 배포 앱 Passive 스캔 | 24/7 모니터링 (Phase 3) |
| `ExpiredSessionCleanup` | `0 30 4 * * *` (매일 04:30) | 30일 초과 분석 세션/로그 삭제 | GDPR 30일 삭제 정책 |
| `SslCertChecker` | `0 0 9 * * MON` (매주 월 09:00) | SSL 인증서 만료 사전 알림 | Phase 3 |
| `TokenRefreshJob` | `0 */30 * * * *` (30분) | 만료 임박 GitHub 토큰 갱신 알림 | - |
| `RateLimitResetJob` | `0 0 * * * *` (매시) | Redis Rate Limit 카운터 확인 로그 | 모니터링용 |

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
  backend:     # Spring Boot 3 JAR, port 8080
  frontend:    # Next.js 15, port 3000
  nginx:       # Reverse Proxy (개발 시 선택적)
  
# DAST 샌드박스 컨테이너는 Docker SDK로 동적 생성 (Compose에 미포함)
```

---

*이 문서는 ERD(01_ERD.md) 및 API 설계서(02_API_DESIGN.md) 작성의 전제 조건입니다.*
