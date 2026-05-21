# [2026-05-17] 테스트 완전 활성화 세션

**브랜치**: `refactor/http-client-hardening`  
**작업 범위**: 단위·통합 테스트 0 skipped 달성 + 신규 테스트 21개 추가

---

## 1. 완료 작업

| 항목 | 커밋 | 내용 |
|------|------|------|
| `BackendApplicationTests` @Disabled 해제 | `cc950d2` | `application-test.yaml` + `@ActiveProfiles("test")` |
| `AnalysisServiceTest` 신규 | `cc950d2` | 9개 단위 테스트 |
| `VulnerabilityQueryServiceTest` 신규 | `cc950d2` | 8개 단위 테스트 |
| `UserServiceTest` 신규 | `cc950d2` | 4개 단위 테스트 |

---

## 2. BackendApplicationTests 활성화

### 문제
`@SpringBootTest`가 전체 Spring 컨텍스트를 로드하려면 실제 DB·Redis 연결이 필요하다.  
기존에는 `@Disabled("DB 연결 필요 — docker compose up 환경에서만 실행")`으로 처리.

### 해결
`src/test/resources/application-test.yaml` 생성:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5434/secureai_db   # 기본값 secureai → secureai_db 수정
  flyway:
    enabled: false          # 이미 마이그레이션된 dev DB, 재실행 불필요
  data:
    redis:
      password: ${REDIS_PASSWORD:}   # 비밀번호는 env에서 주입 (커밋에 하드코딩 금지)
```

`BackendApplicationTests`에 `@ActiveProfiles("test")` 추가, `@Disabled` 제거.

**실행 방법**: `REDIS_PASSWORD=... ./gradlew test`

---

## 3. 신규 테스트 상세

### AnalysisServiceTest (9개)

가장 핵심적인 서비스임에도 테스트가 전혀 없던 상태.

| 테스트 | 검증 내용 |
|--------|---------|
| `startAnalysis_notMember_throwsAccessDenied` | 프로젝트 멤버 아님 → PROJECT_ACCESS_DENIED, aiAgentClient 미호출 |
| `startAnalysis_alreadyRunning_noForce_throwsSessionAlreadyRunning` | RUNNING 세션 존재 + force=false → SESSION_ALREADY_RUNNING |
| `startAnalysis_force_interruptsExistingAndStartsNew` | force=true → markInterrupted 후 새 세션 시작 |
| `startAnalysis_localSourceType_usesDefaultWorkspaceRoot` | workspaceRoot null → `/workspace/{projectId}` 기본 경로 |
| `startAnalysis_githubSourceType_resolvesAndCallsAgent` | github 타입 → resolveAndValidate 후 owner/repo/token 포함 에이전트 호출 |
| `resumeSession_notFound_throwsSessionNotFound` | 세션 없음 → SESSION_NOT_FOUND |
| `resumeSession_statusNotInterrupted_throwsNotResumable` | 상태 RUNNING → SESSION_NOT_RESUMABLE |
| `resumeSession_success_callsAgentAndSaves` | 성공 → 상태 RUNNING, save + resumeAnalysis 호출 |
| `cancelSession_success_callsAgentAndSaves` | 성공 → 상태 CANCELLED, save + cancelAnalysis 호출 |

### VulnerabilityQueryServiceTest (8개)

CQRS read 서비스 - 접근 제어 + 쿼리 분기 검증.

| 테스트 | 검증 내용 |
|--------|---------|
| `listBySession_sessionNotFound_throwsSessionNotFound` | 세션 없음 → SESSION_NOT_FOUND |
| `listBySession_notMember_throwsAccessDenied` | 멤버 아님 → PROJECT_ACCESS_DENIED |
| `listBySession_withSeverity_callsFilteredRepo` | severity 파라미터 → findBySessionIdAndSeverity 호출 |
| `listBySession_noSeverity_callsUnfilteredRepo` | severity null → findBySessionId 호출 |
| `getById_notFound_throwsVulnNotFound` | 취약점 없음 → VULN_NOT_FOUND |
| `getById_accessDenied_returnsVulnNotFound` | 접근 권한 없음 → 존재 여부 미노출, VULN_NOT_FOUND |
| `countBySeverity_sessionNotFound_throws` | 세션 없음 → SESSION_NOT_FOUND |
| `countByFilePath_sessionNotFound_throws` | 세션 없음 → SESSION_NOT_FOUND |

### UserServiceTest (4개)

R-02-A에서 추가된 크로스 도메인 facade 메서드 검증.

| 테스트 | 검증 내용 |
|--------|---------|
| `findOrThrow_found_returnsUser` | 사용자 존재 → User 반환 |
| `findOrThrow_notFound_throwsUserNotFound` | 사용자 없음 → USER_NOT_FOUND |
| `findAllByIds_returnsUserList` | ID 목록 → User 목록 반환 |
| `getDecryptedGithubToken_notFound_throwsUserNotFound` | 사용자 없음 → USER_NOT_FOUND |

---

## 4. 트러블슈팅 — UnnecessaryStubbingException

`@BeforeEach`에서 `when(project.getId())`, `when(user.getId())`, `when(session.getProject())` stub을 설정했으나
일부 테스트에서 사용되지 않아 Mockito strict mode가 예외를 던짐.

**수정**: 전체 테스트에서 공통으로 사용되지 않는 `@BeforeEach` stub에 `lenient()` 적용.

```java
lenient().when(project.getId()).thenReturn(projectId);
```

---

## 5. 최종 테스트 집계

| 구분 | 이번 세션 시작 | 최종 |
|------|-------------|------|
| 총 테스트 | 198 | **219** |
| 통과 | 198 | **219** |
| 실패 | 0 | **0** |
| 스킵 | 1 | **0** |

---

## 6. 리팩토링 로드맵 현황

`docs/refactoring/20260516_stage4.md` 기준으로 전체 진행 상태:

| Tier | ID | 항목 | 상태 |
|------|----|------|------|
| 0 | R-00-A | OrganizationService 이메일 발송 연동 | ✅ InvitationService.inviteByEmail이 EmailService.sendOrgInvitation 호출 |
| 0 | R-00-B | X-Forwarded-For 신뢰 프록시 검증 | ✅ |
| 1 | R-01-A | DastController AI 호출 → Service 분리 | ✅ DastController에 @PostConstruct 없음, DastResultQueryService 주입됨 |
| 1 | R-01-B | ChatService → AiChatClient 분리 | ✅ |
| 1 | R-01-C | CommitSecretService → AiAgentClient 위임 | ✅ CommitSecretService에 RestClient 없음 |
| 1 | R-01-D | DastExecutionService CQRS 분리 | ✅ DastResultQueryService 이미 분리 완료 |
| 2 | R-02-A | 크로스 도메인 Repository → Service Facade | ✅ |
| 2 | R-02-B | AnalysisService 책임 분리 | ✅ |
| 2 | R-02-C | OrganizationService → InvitationService 분리 | ✅ |
| 2 | R-02-D | Circuit Breaker 강화 | ✅ AtomicInteger + DefaultAiChatClient 적용 |
| 2 | R-02-E | SessionStatus enum | ✅ |
| **3** | **R-03-A** | **GitHubOAuthService RestTemplate → RestClient** | **⬜ 미착수** (S — 반나절) |
| **3** | **R-03-B** | **VulnerabilityService @deprecated 메서드 제거** | **⬜ 미착수** (XS — 1시간) |
| 3 | R-03-C | GDPR 하드 삭제 스케줄러 | ⬜ Sprint 9+ 계획 (L — 2일) |

**Tier 0·1·2 모두 완료. 잔여: Tier 3 중 R-03-A + R-03-B (소규모)**
