# [2026-05-17] Tier 3 리팩토링 완료 세션

**브랜치**: `refactor/http-client-hardening`  
**커밋**: `441bcd8`  
**작업 범위**: R-03-A (GitHubOAuthService RestTemplate → RestClient) + R-03-B (VulnerabilityService deprecated 메서드 제거)

---

## 1. 완료 작업

| 항목 | 내용 |
|------|------|
| R-03-A | `GitHubOAuthService` — `RestTemplate` 완전 제거, `RestClient`로 전환 |
| R-03-A | `AppConfig` — `restTemplate()` @Bean 제거 |
| R-03-B | `VulnerabilityController` — `VulnerabilityQueryService` 직접 주입 |
| R-03-B | `VulnerabilityService` — `listBySession` / `getById` 위임 메서드 제거 |

---

## 2. R-03-A — GitHubOAuthService RestTemplate → RestClient

### 변경 이유
- Spring 6.0+에서 `RestTemplate`은 유지 관리 모드 — 신규 HTTP 통합은 `RestClient` 권장
- 기존 `RestTemplate`은 `AppConfig`에서 Bean으로 관리되었으나, timeout 설정이 전역 Bean과 결합되어 있었음

### 핵심 설계 결정: @PostConstruct 사용

`@RequiredArgsConstructor`(Lombok)는 생성자에서 `@Value` 필드를 주입받지만, Spring이 필드 주입을 완료하기 전에 `RestClient`를 빌드할 수 없다. `RestClient.Builder`가 `@Value` 필드에 의존하지 않더라도, 일관성을 위해 `@PostConstruct`로 초기화.

```java
private RestClient gitHubClient;

@PostConstruct
void init() {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(10_000);
    factory.setReadTimeout(30_000);
    this.gitHubClient = RestClient.builder()
            .requestFactory(factory)
            .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
            .defaultHeader("User-Agent", "secureai-backend/1.0")
            .build();
}
```

### catch 범위 축소

기존 `resolveEmail()`에서 `Exception`을 잡던 것을 `RestClientException`으로 좁혔다.
GitHub 이메일 API 실패는 HTTP 오류이므로 `RestClientException`이 정확한 타입.

### AppConfig 정리

`restTemplate()` @Bean 제거. 이제 `AppConfig`는 `ObjectMapper` Bean + `@EnableCaching`만 담당.

---

## 3. R-03-B — VulnerabilityService deprecated 메서드 제거

### 변경 이유
이전 세션(R-02)에서 CQRS 분리 완료: 쓰기는 `VulnerabilityService`, 읽기는 `VulnerabilityQueryService`.
그러나 `VulnerabilityController`는 여전히 `VulnerabilityService`를 통해 읽기 메서드를 위임 호출하고 있었음.

### 변경 내용

**VulnerabilityController**: `VulnerabilityQueryService` 직접 주입
```java
private final VulnerabilityService vulnerabilityService;
private final VulnerabilityQueryService vulnerabilityQueryService;
// GET 엔드포인트 → vulnerabilityQueryService.listBySession() / getById()
// POST 엔드포인트 → vulnerabilityService.saveFromAgent()
```

**VulnerabilityService**: `listBySession`, `getById` 위임 메서드 제거
- `VulnerabilityQueryService` 필드 제거
- `Page`, `Pageable`, `VulnerabilityResponse`, `UUID` 불필요 import 제거

---

## 4. 테스트 최종 상태

R-03 변경은 기존 219개 테스트에 영향 없음 (Service 내부 구현 변경, 인터페이스 동일).

| 구분 | 결과 |
|------|------|
| 총 테스트 | **219** |
| 통과 | **219** |
| 실패 | **0** |
| 스킵 | **0** |

---

## 5. 리팩토링 로드맵 최종 현황

`docs/refactoring/20260516_stage4.md` 기준 전체 완료:

| Tier | ID | 항목 | 상태 |
|------|----|------|------|
| 0 | R-00-A | OrganizationService 이메일 발송 연동 | ✅ |
| 0 | R-00-B | X-Forwarded-For 신뢰 프록시 검증 | ✅ |
| 1 | R-01-A | DastController AI 호출 → Service 분리 | ✅ |
| 1 | R-01-B | ChatService → AiChatClient 분리 | ✅ |
| 1 | R-01-C | CommitSecretService → AiAgentClient 위임 | ✅ |
| 1 | R-01-D | DastExecutionService CQRS 분리 | ✅ |
| 2 | R-02-A | 크로스 도메인 Repository → Service Facade | ✅ |
| 2 | R-02-B | AnalysisService 책임 분리 | ✅ |
| 2 | R-02-C | OrganizationService → InvitationService 분리 | ✅ |
| 2 | R-02-D | Circuit Breaker 강화 | ✅ |
| 2 | R-02-E | SessionStatus enum | ✅ |
| 3 | **R-03-A** | **GitHubOAuthService RestTemplate → RestClient** | **✅ 이번 세션** |
| 3 | **R-03-B** | **VulnerabilityService deprecated 메서드 제거** | **✅ 이번 세션** |
| 3 | R-03-C | GDPR 하드 삭제 스케줄러 | ⬜ Sprint 9+ |

**Tier 0 · 1 · 2 · 3 (R-03-C 제외) 전부 완료.**
