# 2026-05-17 리팩토링 세션 로그 (R-02-A + R-02-B + R-02-D)

## 세션 개요
**브랜치:** `refactor/http-client-hardening`  
**목표:** R-02 잔여 항목 완료 — 크로스 도메인 Repository 제거(A), AnalysisService 구조화(B), 서킷브레이커 강화(D) + Docker 검증  
**최종 테스트:** 198 passed / 0 failed / 5 skipped  
**Docker 스모크:** 핵심 엔드포인트 전수 통과

---

## 작업 내역

### R-02-A: 크로스 도메인 Repository 직접 주입 → Service Facade 경유

**문제:** `analysis`, `organization` 도메인 서비스 8개 파일이 타 도메인의 Repository(`ProjectRepository`, `TeamMemberRepository`, `UserRepository`, `PlanRepository`)를 직접 주입 → Bounded Context 위반.

**해결 전략:** 각 도메인의 Service에 파사드 메서드를 추가하고, 타 도메인에서는 그 Service만 호출.

**Service Facade 추가 내역:**

| Service | 추가된 파사드 메서드 |
|---------|---------------------|
| `ProjectService` | `isMember(UUID, UUID)`, `findOrThrow(UUID)` |
| `UserService` | `findOrThrow(UUID)`, `findAllByIds(List<UUID>)`, `getDecryptedGithubToken(UUID)` |
| `PlanService` (신규) | `findByName(String)` — 조직 도메인용 Plan 조회 전담 |

**제거된 크로스 도메인 Repository 주입 (8개 파일):**

| 파일 | 제거된 Repository | 대체 |
|------|-------------------|------|
| `AnalysisService` | `ProjectRepository`, `TeamMemberRepository` | `ProjectService` |
| `ChatService` | `TeamMemberRepository` | `ProjectService` |
| `CommitSecretService` | `TeamMemberRepository` | `ProjectService` |
| `ProgressLogService` | `TeamMemberRepository` | `ProjectService` |
| `VulnerabilityQueryService` | `TeamMemberRepository` | `ProjectService` |
| `VulnerabilityService` | `ProjectRepository` | `ProjectService` |
| `GitHubApiService` | `UserRepository` | `UserService` |
| `OrganizationService` | `UserRepository`, `PlanRepository` | `UserService`, `PlanService` |

**테스트 업데이트 (6개 파일):**
- `ChatServiceTest`, `CommitSecretServiceTest`, `ProgressLogServiceTest` — `@Mock TeamMemberRepository` → `@Mock ProjectService`
- `VulnerabilityServiceTest` — `@Mock ProjectRepository` → `@Mock ProjectService`
- `GitHubApiServiceTest` — `@Mock UserRepository` → `@Mock UserService`; USER_NOT_FOUND 테스트 `.thenThrow(BusinessException)` 패턴으로 변경
- `OrganizationServiceTest` — `@Mock UserRepository`, `@Mock PlanRepository` → `@Mock UserService`, `@Mock PlanService`

**트러블슈팅:**
- `OrganizationServiceTest.addMember_alreadyMember` 에서 `userRepository.findById(memberId)` stub 미교체로 컴파일 오류 → `userService.findOrThrow(memberId)` 패턴으로 수정

**커밋:** `557227a` (17개 파일 변경)

---

### R-02-B: AnalysisService 구조화 (God Class 분해)

**문제:** `startAnalysis()` 메서드가 세션 중복 처리, GitHub 정보 해석, 에이전트 디스패치를 모두 담당 — 메서드 길이 40줄 초과.

**결정:** `SessionAccessPolicy` / `AnalysisSourceResolver` 클래스로 분리는 과도한 추상화(137줄 서비스). 대신 private 헬퍼 메서드 추출로 `startAnalysis()`를 18줄로 축소.

**추출된 메서드:**
- `handleRunningSession(UUID projectId, boolean force)` — RUNNING 세션 중단 처리
- `dispatchToAgent(session, project, userId, request, settings)` — source_type별 에이전트 호출 분기

**커밋:** `dbf1872`

---

### R-02-D: 서킷브레이커 강화

#### DefaultAiAgentClient — AtomicInteger 스레드 안전 수정
**문제:** `private int failureCount = 0`에 `synchronized recordFailure()`를 걸었으나, `resetFailures()`에는 `synchronized` 없어 경쟁 조건 존재.

**수정:** `int failureCount` → `AtomicInteger failureCount`. `synchronized` 키워드 전부 제거. `failureCount++` → `failureCount.incrementAndGet()`.

**AiAgentClientTest 수정:** `ReflectionTestUtils.setField(client, "failureCount", 0)` → `new AtomicInteger(0)` (타입 불일치로 5개 테스트 실패했던 문제 해결).

#### DefaultAiChatClient — 서킷브레이커 신규 적용
**문제:** `DefaultAiChatClient`에 서킷브레이커 없어 AI Chat 호출 무한 재시도 가능.

**추가:** `DefaultAiAgentClient`와 동일한 패턴 — `AtomicBoolean circuitOpen`, `AtomicLong circuitOpenTime`, `AtomicInteger failureCount`. `FAILURE_THRESHOLD=3`, `RESET_TIMEOUT_MS=30_000`.

**Resilience4j 미사용 이유:** Spring Boot 4.0.5와 호환되는 Resilience4j 버전이 없음. 수동 구현 패턴을 두 클라이언트에 일관 적용.

**커밋:** `dbf1872`

---

## Docker 검증

### 빌드 및 기동
```
docker compose build backend   → 성공
docker compose stop backend && docker compose up -d backend
  → Tomcat started on port 8080
  → Flyway: 34 migrations validated, up to date
  → Started BackendApplication in 16.68 seconds
```

### 스모크 테스트 결과

| 엔드포인트 | 기대 | 실제 |
|-----------|------|------|
| `GET /actuator/health` | 200 UP | ✅ 200 `{"status":"UP"}` |
| `GET /api/v1/organizations` (미인증) | 401 | ✅ 401 |
| `GET /api/v1/projects` (미인증) | 401 | ✅ 401 |
| `POST /api/v1/auth/register` | 200 | ✅ 200, 이메일 발송 |
| `POST /api/v1/auth/login` (미인증) | 403 AUTH_EMAIL_NOT_VERIFIED | ✅ 403 |
| `POST /api/v1/organizations` (인증) | 200 | ✅ 200, Org 생성, planName=free |
| `GET /api/v1/organizations` (인증) | 200 목록 | ✅ 200 |
| `POST /api/v1/projects` | 200 | ✅ 200, Project 생성 |
| `POST /api/v1/analysis/sessions` | 200 running | ✅ 200, AI Agent 호출 로그 확인 |

**AI Agent 호출 로그 (서비스 간 연동 확인):**
```
DefaultAiAgentClient: [agent-client] startAnalysis sessionId=266f2d4f sourceType=local
AnalysisService: [analysis] started sessionId=266f2d4f projectId=3d3fcd3e sourceType=local
```
AI 에이전트 미실행 → `ProgressLogService`가 `scan_files failed` 처리 — 예상 동작.

---

## 최종 결과

| 항목 | R-02-A 이전 | 완료 후 |
|------|------------|---------|
| 크로스 도메인 Repository 주입 | 10개 | 0개 |
| `AnalysisService.startAnalysis()` 줄 수 | ~40줄 | 18줄 |
| `DefaultAiChatClient` 서킷브레이커 | 없음 | AtomicBoolean 기반 |
| `DefaultAiAgentClient` thread-safety | `synchronized` 불완전 | `AtomicInteger` 완전 |
| 단위 테스트 | 198 / 0 / 5 | 198 / 0 / 5 (변동 없음) |

---

## 남은 항목 (다음 세션 후보)

| 항목 | 우선순위 | 설명 |
|------|---------|------|
| `DomainVerificationRedisIT` @Disabled 해제 | Tier 2 | Linux CI 또는 TestContainers 업그레이드 후 |
| Frontend localStorage → getAccessToken | Tier 3 | `useChat.ts` API 토큰 중앙화 |
| PageImpl serialization 경고 제거 | Tier 4 | `@EnableSpringDataWebSupport(pageSerializationMode = VIA_DTO)` 추가 |
