# [2026-05-17] 통합 테스트 활성화 세션

**브랜치**: `refactor/http-client-hardening`  
**작업 범위**: Docker 검증 + Redis 통합 테스트 @Disabled 해제

---

## 1. 완료 작업

| 항목 | 커밋 | 결과 |
|------|------|------|
| Docker 백엔드 기동 확인 및 스모크 테스트 | — | 전 엔드포인트 통과 |
| `DomainVerificationRedisIT` TestContainers → 로컬 Redis 직접 연결 | `7b2c1b4` | 4개 통합 테스트 통과 |

---

## 2. Docker 스모크 테스트

백엔드 컨테이너 `Started BackendApplication in 16.68 seconds` 확인 후 아래 엔드포인트 전수 검증.

| 엔드포인트 | 기대 | 실제 |
|-----------|------|------|
| `GET /actuator/health` | 200 UP | ✅ |
| `GET /api/v1/organizations` (미인증) | 401 | ✅ |
| `POST /api/v1/auth/register` | 200 | ✅ |
| `POST /api/v1/auth/login` (이메일 미인증) | 403 AUTH_EMAIL_NOT_VERIFIED | ✅ |
| `POST /api/v1/organizations` (인증) | 200, planName=free | ✅ |
| `POST /api/v1/projects` | 200 | ✅ |
| `POST /api/v1/analysis/sessions` | 200 status=running | ✅ |

`POST /api/v1/analysis/sessions` 결과에서 백엔드 로그에 아래 두 줄이 순서대로 출력됨 — R-02 리팩토링 체인이 실제 운영 컨테이너에서 정상 동작함을 확인:

```
DefaultAiAgentClient : [agent-client] startAnalysis sessionId=266f2d4f sourceType=local
AnalysisService      : [analysis] started sessionId=266f2d4f projectId=3d3fcd3e sourceType=local
```

---

## 3. DomainVerificationRedisIT 활성화

### 원인

TestContainers 1.20.4가 Docker API 버전 프로브 시 `RemoteApiVersion.VERSION_1_24`를 하드코딩하여 Docker Desktop Windows의 `MinAPIVersion=1.40` 정책과 충돌 → Status 400. 환경변수(`DOCKER_API_VERSION`)로 해결 불가능한 라이브러리 내부 제약이었다.

### 해결 전략

TestContainers 컨테이너 기동을 포기하고, `docker compose`로 이미 실행 중인 `secureai-redis(localhost:6379)`에 직접 연결.

비밀번호는 `REDIS_PASSWORD` 환경변수 → `.env` 기본값 순으로 읽도록 구성.

**변경 내용 (`DomainVerificationRedisIT.java`):**
- `@Disabled` 제거
- `static GenericContainer<?> REDIS` 필드 + `@BeforeAll startRedisContainer()` / `@AfterAll stopRedisContainer()` 전부 제거
- TestContainers import 제거 (`GenericContainer`, `DockerImageName`)
- `@BeforeEach setUp()`: `REDIS.getHost() / REDIS.getMappedPort(6379)` → `"localhost" / 6379`
- `RedisStandaloneConfiguration`에 `RedisPassword.of(REDIS_PASSWORD)` 추가
- `@AfterEach tearDown()`: null 가드 추가

### 테스트 결과

| 테스트 | 검증 내용 | 결과 |
|--------|---------|------|
| Rate Limit — 3회 허용 후 4번째 429 | Redis 카운터 실제 증가 | ✅ |
| 분산 락 — 동시 2번째 409 | Redis SET NX 경쟁 조건 | ✅ |
| 락 해제 후 재요청 허용 | `lockService.release()` 후 재취득 | ✅ |
| 면책 동의 미체크 — Rate Limit 카운터 미증가 | Redis 키 부재 검증 | ✅ |

---

## 4. 최종 테스트 집계

| 구분 | 이전 세션 | 이번 세션 |
|------|---------|---------|
| 통과 | 198 | 198 |
| 실패 | 0 | 0 |
| 스킵 | **5** | **1** |

스킵 5 → 1 감소: `DomainVerificationRedisIT` 4개 모두 통과.

---

## 5. 남은 스킵 1개 — BackendApplicationTests

```java
@SpringBootTest
@Disabled("DB 연결 필요 — docker compose up 환경에서만 실행")
class BackendApplicationTests {
    @Test void contextLoads() { }
}
```

`@SpringBootTest`는 전체 Spring 컨텍스트를 띄우므로 실제 DB 연결이 필요하다.  
연결 대상은 **secureai-postgres (본 프로젝트 소유 DB)** 이며, 외부 사용자 DB가 아니다.  
`docker compose`로 기동 시 내부 네트워크 주소(`postgres:5432`)를 사용하고, 로컬 테스트 실행 시에는 `localhost:5434`로 연결해야 한다.

현재 테스트용 datasource 설정(`application-test.yml`)이 없어 `@Disabled` 상태 유지 중.  
활성화하려면 `src/test/resources/application-test.yml`에 `localhost:5434` datasource 설정을 추가하고 `@ActiveProfiles("test")`를 붙이면 된다.
