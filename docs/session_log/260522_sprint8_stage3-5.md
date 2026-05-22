# [2026-05-22] 작업 세션 요약

**브랜치**: `feat/sprint8`
**작업 범위**: Sprint 8 Stage 3~5 실행 완료 (GdprServiceTest 수정 포함)

---

## 1. 완료 작업

| 항목 | 주요 파일 |
|------|---------|
| GdprServiceTest 수정 (이월) | `GdprServiceTest.java` |
| Stage 3 — 2FA (TOTP) | `TotpService.java`, `TotpController.java`, `V038__add_totp_fields.sql`, `SecurityConfig.java` |
| Stage 3 — IP Allowlist | `IpAllowlistFilter.java`, `V039__create_team_settings.sql`, `application.yaml` |
| Stage 4 — 성능 최적화 | `@EntityGraph`(3개 Repository), `@BatchSize(30)`, `RedisCacheConfig`, `tests/perf/load-test.js` |
| Stage 4 — 보안 헤더 | `SecurityConfig.java` `.headers()` (CSP/HSTS/XFO/XCTO/Referrer), `DastController @Valid` 누락 수정, `HttpMethod.POST` /sbom/components 명시 |
| Stage 4 — SBOM 화면 | `SbomController` GET 엔드포인트, `SbomService.getComponents()`, `SbomPage.tsx`, `sbom/page.tsx` |
| Stage 5 — 보안 문서 자동 생성 | `SecurityDocService.java`, `SecurityDocAsyncProcessor.java`, `SecurityDocController.java`, Thymeleaf 템플릿 3종, `SecurityDocPage.tsx`, `V040__create_security_doc_requests.sql` |
| Stage 5 — Nginx API Gateway | `nginx/nginx.conf`, `docker-compose.yml` nginx 서비스, `Makefile` ssl-cert 타겟 |
| 문서 체크리스트 | `docs/07_SPRINT_BACKLOG_V3.md`, `docs/sprints/sprint-8.md` |

---

## 2. 의논 내용 & 결정 맥락

### GdprServiceTest — `ApplicationEvent` 타입 추론 문제
- `reportRepository` 제거 후 `ApplicationEventPublisher.publishEvent()` 모킹으로 전환할 때 `argThat` 람다 타입 추론 실패
- 원인: `publishEvent(ApplicationEvent)` 오버로드가 선택되면 람다가 `ArgumentMatcher<ApplicationEvent>`로 추론 → `instanceof GdprAccountDeletedEvent` 패턴 매칭이 JLS 상 다른 타입 계층이라 컴파일 오류
- 해결: 람다 매개변수를 `(Object e) ->` 로 명시 → `publishEvent(Object)` 오버로드 선택 강제

### Stage 3 순차 실행 — SecurityConfig.java 공유
- TASK-806(2FA)과 TASK-807(IP Allowlist) 모두 `SecurityConfig.java` 수정
- 806이 먼저 `/api/v1/auth/2fa/**` 경로 + 필터 체인 구조를 확정한 뒤, 807이 `addFilterBefore(ipAllowlistFilter, JwtAuthenticationFilter.class)` 삽입
- 병렬 실행 시 merge conflict + 2FA 우회 가능성 → 순차 강제

### TOTP 복구 코드 — SecureRandom
- 초기 Dev 구현에서 `Math.random()` 사용 → Reviewer BLOCK
- 복구 코드는 계정 접근 수단이므로 암호학적 PRNG 필수
- `private static final SecureRandom SECURE_RANDOM = new SecureRandom()` 상수화하여 매 호출마다 초기화 비용 제거

### SBOM GET 엔드포인트 경로 결정
- 초안: `/api/v1/sbom/components` (기존 POST와 같은 경로, `permitAll()` 적용 중)
- 문제: HTTP 메서드만 다를 뿐 동일 경로에 `permitAll()`이면 GET도 인증 없이 접근 가능
- 해결 ①: GET 경로를 `/api/v1/projects/{projectId}/sbom/components`로 분리 (인증 필수)
- 해결 ②: SecurityConfig POST 한정 명시 → `requestMatchers(HttpMethod.POST, "/api/v1/sbom/components").permitAll()`

### Stage 4 BackendApplicationTests 컨텍스트 로드 실패
- `totp-spring-boot-starter:1.7.1`이 Spring Boot 3+ 환경에서 `QrGenerator` 빈 자동 등록 안 함
- Tester가 발견 → `AppConfig.java`에 `@Bean QrGenerator qrGenerator()` 수동 등록으로 해결

### TASK-MISC-002 — OpenHTMLtoPDF 버전
- 백로그 명세: `openhtmltopdf-pdfbox:1.0.20` → Maven Central 미배포
- 실제 사용: `1.1.37` (최신 안정 버전, PDFBox 기반 HTML5 안정 지원)
- Flying Saucer는 HTML5 비호환·유지보수 침체로 사용 금지 (sprint-8.md Stage 0 결정 사항)

### TASK-MISC-002 Reviewer FAIL — 도메인 간 Repository 직접 주입
- `SecurityDocService`가 `ProjectRepository`, `TeamMemberRepository`, `UserRepository` 3개를 직접 주입
- 규칙: `general.md` "도메인 간 직접 Repository 주입 금지 — ApplicationEvent 사용"
- 해결: `ProjectService.findOrThrow()`, `ProjectService.isMember()`, `UserService.findOrThrow()` 경유로 교체

### Nginx 설계 결정
- `frontend` 서비스가 docker-compose에서 주석 처리 상태이므로 nginx `depends_on`에서 frontend 제외
- 개발 환경: `make ssl-cert`로 자체 서명 인증서 생성, Let's Encrypt는 프로덕션 전용
- Certbot 서비스는 개발 docker-compose에 불필요 → `docker-compose.prod.yml`로 분리 예정

---

## 3. 버그 수정 / 특이사항

| 버그 | 원인 | 해결 |
|------|------|------|
| `GdprServiceTest` 컴파일 오류 | `publishEvent(ApplicationEvent)` 오버로드 타입 추론 | `(Object e) ->` 명시 |
| `BackendApplicationTests` 컨텍스트 로드 실패 | `QrGenerator` 빈 자동 등록 안 됨 | `AppConfig.java`에 수동 `@Bean` 등록 |
| `IpAllowlistFilter.isIpAllowed()` 빈 목록 버그 | 빈 목록 반환 `false`, `doFilterInternal`에서 `isEmpty()` early return 불일치 | `isIpAllowed()` 최상단에 `allowedRanges.isEmpty()` → `true` 추가 |
| SBOM GET 인증 우회 가능성 | POST `permitAll()` 경로가 GET에도 적용 | `HttpMethod.POST` 명시 + GET 경로 분리 |
| `SecurityDocService` 도메인 간 Repository 직접 주입 | Reviewer FAIL | `ProjectService`·`UserService` 경유 교체 |
| `SecurityDocAsyncProcessor` 경로 조합 문자열 연결 | `+` 연결로 Path Traversal 방어 신뢰성 저하 | `Paths.get()` 다중 인자 방식으로 통일 |

---

## 4. Sprint 8 완료 기준 최종 현황

| 항목 | 상태 |
|------|------|
| 스케줄러 안정 (ShedLock 6개 Job) | ✅ |
| Circuit Breaker (AI Agent/NVD/DNS) | ✅ |
| 2FA (TOTP + 복구 코드) | ✅ |
| IP Allowlist (CIDR + Spoofing 방어) | ✅ |
| OpenTelemetry (Backend → AI Engine) | ✅ |
| GDPR Export/Delete API | ✅ |
| SBOM Page (백엔드 GET + 프론트) | ✅ |
| 보안 문서 자동 생성 Level 1 (3종 PDF) | ✅ |
| Nginx + SSL (HTTP→HTTPS, Rate Limit) | ✅ |
| 성능 목표 p95 < 500ms | ⬜ `make perf-test` 실행 필요 (수동) |
| 보안 기본선 OWASP ZAP 0건 | ⬜ ZAP 스캔 실행 필요 (수동) |

---

## 5. 다음 세션에서 할 것

- [ ] 수동 테스트: Stage 5 보안 문서 PDF E2E 확인 (CISO / 행안부 / ISMS-P)
- [ ] 수동 테스트: `make ssl-cert` → `make dev` → Nginx HTTP→HTTPS 리다이렉트 확인
- [ ] 수동 테스트: Stage 3 Google Authenticator QR 스캔 + 허용 IP 외부 요청 403
- [ ] 수동 테스트: `make perf-test` k6 부하 테스트 실행 (p95 < 500ms 게이트)
- [ ] Sprint 8 전체 테스트 마일스톤 통과 확인 후 `feat/sprint8` → `main` PR 생성
- [ ] Sprint 9 계획 (`/sprint 9`)
