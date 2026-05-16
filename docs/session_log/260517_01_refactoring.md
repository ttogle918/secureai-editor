# 2026-05-17 리팩토링 세션 로그

## 세션 개요
**브랜치:** `refactor/http-client-hardening`  
**목표:** HTTP 클라이언트 강화 + 코드 품질 개선 (R-00-B, R-01-B, R-02-C, R-02-E)  
**최종 테스트:** 198 passed / 0 failed / 5 skipped

---

## 작업 내역

### 보안 리뷰 (사전 점검)
리팩토링 전 변경 파일 전체를 보안 관점에서 점검했다.

**주요 확인 사항:**
- `X-Internal-Key` 헤더: `DefaultAiChatClient`에서만 주입, 서비스 레이어에 노출 없음 ✅
- `X-Forwarded-For` 검증 (`IpResolverService`): 신뢰 프록시(loopback/RFC 1918) IP에서 온 헤더만 파싱하도록 수정 — IP 헤더 인젝션 방어 ✅
- 로그 출력: 토큰(`token`)은 로그에서 완전히 제외, `orgId`/`email`만 기록 ✅
- SQL: JPQL 파라미터 바인딩으로 변환 (`@Param` 사용) ✅

---

### R-00-B: X-Forwarded-For 신뢰 프록시 검증 강화
`IpResolverService.resolveClientIp()` — remoteAddr이 loopback 또는 RFC 1918 대역일 때만 `X-Forwarded-For` 헤더를 신뢰한다. IPv4/IPv6 형식 검증으로 헤더 인젝션 방어.

**커밋:** `c9e003c`

---

### TestContainers 이슈 — `DomainVerificationRedisIT` @Disabled 처리

**문제:** TestContainers 1.20.4가 Docker Desktop Windows(MinAPIVersion=1.40)와 충돌.  
`RemoteApiVersion.VERSION_1_24`를 라이브러리 내부에 하드코딩 → Docker Desktop이 Status 400으로 거절.

**시도한 해결책:**
1. `testcontainers.properties`에 `ryuk.disabled=true` → 효과 없음 (Ryuk 문제가 아님)
2. `jvmArgs("-DDOCKER_API_VERSION=1.41")` → 효과 없음 (라이브러리 내부 버전 프로브 미적용)

**결론:** 라이브러리 레벨 제약. 외부에서 해결 불가.  
**대응:** `@Disabled` 처리. 비즈니스 로직은 `DomainVerificationServiceTest` (단위 테스트, 188 → 193 passed)가 커버.  
CI/CD (Linux Docker) 또는 TestContainers 업그레이드 후 `@Disabled` 제거 가능.

**스킵 현황 (총 5개):**
| 테스트 | 이유 |
|--------|------|
| `DomainVerificationRedisIT` (4개) | TC 1.20.4 + Docker Desktop Windows MinAPIVersion 비호환 |
| `BackendApplicationTests` (1개) | DB 연결 필요 — docker compose 환경 전용 (세션 이전부터 존재) |

---

### R-01-B: ChatService AI 호출 AiChatClient로 분리

**변경 파일:**
- `AiChatClient.java` (신규 인터페이스)
- `DefaultAiChatClient.java` (신규 구현체)
- `ChatService.java` (RestClient 의존성 제거, AiChatClient 주입)
- `ChatServiceTest.java` (Mock 구조 업데이트)

**설계 결정:**
- `Consumer<BufferedReader>` 콜백 패턴으로 스트리밍 위임 — `ChatService`는 `reader -> relayLines(...)` 람다만 전달
- `DefaultAiChatClient`가 `X-Internal-Key` 헤더·RestClient·SSE 연결 전담 → SRP 준수
- `@Value` 의존성이 `ChatService`에서 사라짐 → 테스트 격리성 향상

**커밋:** `82aa521`

---

### R-02-E: SessionStatus enum 도입 — 매직 문자열 제거

**배경:** `AnalysisSession.status` 필드가 `"running"`, `"pending"` 등 문자열 리터럴로 관리되어 오타·오용 위험 존재.

**변경 파일:**
- `SessionStatus.java` (신규 enum)
- `SessionStatusConverter.java` (JPA `AttributeConverter` — DB는 lowercase 유지)
- `AnalysisSession.java` (`@Convert(converter = SessionStatusConverter.class)`)
- `AnalysisSessionRepository.java` (JPQL `@Param` 타입 변경)
- `AnalysisService.java`, `SessionInterruptionScheduler.java` (enum 상수로 교체)
- `AnalysisSessionResponse.java` (`toDbValue()` 호출로 JSON 응답 lowercase 유지)

**핵심 결정 — DB 마이그레이션 불필요:**  
`AttributeConverter`가 `RUNNING` ↔ `"running"` 변환을 담당. 기존 데이터 그대로 호환.

**커밋:** `17ad1df`

---

### R-02-C: OrganizationService 초대 로직 InvitationService로 분리

**배경:** `OrganizationService`가 조직 CRUD + 멤버 관리 + 초대 이메일 발송을 모두 처리 → SRP 위반.

**변경 파일:**
- `InvitationService.java` (신규) — `inviteByEmail`, `acceptInvitation`, `getInvitationInfo`
- `OrganizationService.java` — `EmailService`, `TeamInvitationRepository`, `secureRandom`, 초대 메서드 3개 제거
- `InvitationController.java` — `OrganizationService` 대신 `InvitationService` 주입
- `OrganizationController.java` — `InvitationService` 필드 추가, `inviteByEmail` 위임 변경
- `OrganizationServiceTest.java` — 초대 관련 Mock·테스트 제거
- `InvitationServiceTest.java` (신규) — 7개 단위 테스트

**설계 결정:**
- `InvitationService`에 `requireAdminOrAbove()` private 헬퍼를 별도 구현 (OrgGuard와 소량 중복)  
  → OrgGuard는 SpEL boolean 반환용, InvitationService 내부는 `BusinessException` 던지기 위해 분리
- `generateToken()` — `SecureRandom` + Base64 URL-safe 64자, 로그 출력 없음

**커밋:** `4144571`

---

## 최종 결과

| 항목 | 이전 | 이후 |
|------|------|------|
| 테스트 수 | 193 | 198 |
| 실패 | 0 | 0 |
| 스킵 | 5 | 5 |
| `OrganizationService` 의존성 수 | 6 | 4 |
| `ChatService` `@Value` 필드 | 2 | 0 |
| 매직 문자열 (status) | ~12곳 | 0 |

---

## 다음 세션 후보

| 항목 | 우선순위 | 설명 |
|------|---------|------|
| R-02-A | Tier 2 | Cross-domain Repository → Service Facade (4단계) |
| R-02-B | Tier 2 | AnalysisService God Class 분해 (R-02-A 1-3단계 완료 후) |
| R-02-D | Tier 2 | Resilience4j Circuit Breaker 전체 적용 (R-01 완료 후) |
| Frontend | Tier 3 | useChat.ts localStorage → getAccessToken, API Base URL 중앙화 |
