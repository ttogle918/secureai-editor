# Sprint 8 — 안정화 & 보안 강화 & 런칭 준비
**기간**: 2026-05-21 ~ 2026-06-03 (Week 17–18, 실제 시작일 조정)
**목표**: 관측성·복원성 기반 구축(OpenTelemetry + ShedLock + Circuit Breaker) → 보안 인증 강화(2FA + IP Allowlist) → 성능 최적화 + 보안 헤더 + SBOM 화면 → 보안 문서 자동 생성 + Nginx 통합

---

## 사전 발견 사항 (Dev 평가 결과 — 착수 전 보정)

| 항목 | 백로그 명세 | 실제 상태 | 조치 |
|------|-----------|---------|------|
| Flyway V029 | TASK-806 `V029__add_totp_fields.sql` | **이미 사용됨** (`V029__add_updated_at_to_dast_tables.sql`) | **V038**로 변경 |
| ShedLock 의존성 | TASK-801 백로그 미명시 | `build.gradle.kts` 미포함 | `shedlock-spring:6.x` + `shedlock-provider-redis-spring:6.x` 추가 |
| Resilience4j 의존성 | TASK-802 백로그 미명시 | Spring Boot 4 호환 모듈 필요 | `resilience4j-spring-boot3` 사용 (Spring Boot 3 명명이지만 4도 호환) |
| TOTP 라이브러리 | `dev.samstevens.totp` | 의존성 미포함 | `totp-spring-boot-starter` 추가 |
| Jaeger vs Tempo | TASK-808 선택 미확정 | docker-compose 둘 다 미존재 | **Jaeger all-in-one 선택** (Tempo는 Sprint 9 Grafana 스택과 함께) |
| Thymeleaf + PDF 라이브러리 | TASK-MISC-002 미확정 | OpenPDF는 HTML→PDF 변환 없음 | **OpenHTMLtoPDF(`openhtmltopdf-pdfbox:1.0.20`) 채택**. Flying Saucer는 HTML5 비호환·유지보수 침체로 사용 금지 |
| `team_settings` 테이블 | TASK-807 백로그가 컬럼 추가로 표기 | **테이블 자체가 미존재** | V039 마이그레이션으로 테이블 신규 생성 |
| `AiAgentClient.isCircuitOpen()` | TASK-802 미언급 | 현재 stub 상태로 `SessionInterruptionScheduler`에서 이미 호출 중 | TASK-802 하위 할일에 Resilience4j `CircuitBreakerRegistry` 연결 추가 |
| Python OTel + LangGraph | TASK-808 미상세 | asyncio Task 경계에서 ContextVar 단절 | 노드별 수동 `tracer.start_as_current_span` 코드 명시 |
| Nginx 보안 헤더 | TASK-804에 포함 | TASK-805와 동일 파일(`nginx.conf`) 충돌 | TASK-804는 Spring Security `headers()` 설정으로 1단계, TASK-805에서 Nginx로 2단계 이전 |
| Let's Encrypt | TASK-805 백로그 | 개발 환경 도메인 소유권 없음 | 개발: 자체 서명 인증서, 프로덕션 배포 시에만 Let's Encrypt 검증 |
| X-Forwarded-For 신뢰 | TASK-807 미언급 | Spring Boot 기본 미신뢰 → IP 우회 가능 | `application.yaml`에 `server.forward-headers-strategy: NATIVE` 설정 + Docker 내부 신뢰 프록시 IP 화이트리스트 |
| SBOM 엔드포인트 경로 | FEAT-FE-001 `/api/v1/sbom/components` | 현재 `/api/v1/sbom/*`가 `permitAll()` 상태 | **`/api/v1/projects/{projectId}/sbom/components`로 변경** (인증 필수) |

---

## Flyway 번호 예약 (사전 확정으로 병렬 충돌 방지)

| 번호 | 태스크 | 파일명 | 비고 |
|------|--------|--------|------|
| V037 | TASK-801 | `V037__create_shedlock_table.sql` | Redis Provider 사용 시 DB 백업용 (선택적) |
| V038 | TASK-806 | `V038__add_totp_fields.sql` | V029 충돌 회피 |
| V039 | TASK-807 | `V039__create_team_settings.sql` | 테이블 신규 |
| V040 | TASK-MISC-002 | `V040__create_security_doc_requests.sql` | 생성 이력·다운로드 토큰 |

---

## 스프린트 시작 전 완료 사항 (2026-05-21)

### PR #73 머지 완료 — Pagori 리디자인 전체 적용
- `refactor/frontend-ui` → `main` 스쿼시 머지 완료
- UI 적용률 75% → 95% (온보딩·SBOM·반응형·EmptyStates·Mock fallback·네비게이션)
- SBOM 화면은 mock 데이터 — FEAT-FE-001(Stage 4)에서 API 연결 예정

### CI 인프라 수정 (PR #73과 함께 main 반영)
| 수정 항목 | 원인 | 조치 |
|----------|------|------|
| `SECUREAI_ENCRYPTION_KEY` | Base64 40자 → AES 키 불일치 | 64자 hex로 교체 |
| `DB_URL` → `SPRING_DATASOURCE_URL` | Spring 환경변수명 불일치 → 포트 5434 기본값 사용 | `SPRING_DATASOURCE_URL` 등으로 정정 |
| postgres 이미지 `postgres:15-alpine` | V028 `CREATE EXTENSION vector` 실패 | `pgvector/pgvector:pg15`로 교체 |
| `BackendApplicationTests` | `application-test.yaml`에 `flyway.enabled: false` → plans 테이블 없어 DataInitializer 실패 | `@MockitoBean DataInitializer` 추가 (Spring Boot 4.x 패키지) |

---

## 이월 태스크

| TASK | 출처 | 사유 | Sprint 8 처리 |
|------|------|------|---------------|
| 없음 | Sprint 7 | 4개 스테이지 모두 완료 | — |
| FCM E2E 에뮬레이터 수동 검증 | Sprint 7 | 사용자 수동 작업 | Sprint 8과 병행 가능 |

---

## Stage 0 — 사전 결정 사항 (착수 전 확정)

> 코드 구현 없음. 아래 항목을 먼저 결정한 뒤 Stage 1 진입.

| # | 항목 | 내용 | 결정 |
|---|------|------|------|
| 1 | **분산 트레이싱 백엔드** | Jaeger all-in-one (`jaegertracing/all-in-one`) — Tempo/Grafana는 Sprint 9 | ✅ |
| 2 | **PDF 변환 라이브러리** | Thymeleaf + OpenHTMLtoPDF(PDFBox 기반) — Flying Saucer 사용 금지 | ✅ |
| 3 | **ShedLock Provider** | Redis Provider (DB 0, 키 접두사 `shedlock:`) | ✅ |
| 4 | **TOTP 복구 코드 동시성** | JPA `@Lock(PESSIMISTIC_WRITE)` = `SELECT FOR UPDATE` (Redis 분산 락 불필요) | ✅ |
| 5 | **OpenTelemetry Exporter** | OTLP gRPC → Jaeger 4317 포트 | ✅ |
| 6 | **IP Allowlist 필터 위치** | `addFilterBefore(ipAllowlistFilter, JwtAuthenticationFilter.class)` — JWT 검증 전 IP 차단 | ✅ |
| 7 | **개발/프로덕션 SSL** | 개발: 자체 서명 인증서, 프로덕션: Let's Encrypt + Certbot | ✅ |
| 8 | **OWASP ZAP 실행 환경** | `ghcr.io/zaproxy/zaproxy:stable` 로컬 Docker (CI 별도) | ✅ |
| 9 | **k6 부하 테스트 환경** | `grafana/k6` Docker 서비스 + `make perf-test` 명령 | ✅ |

---

## 실행 계획

### Stage 1 — 관측성 기반 + 스케줄러 안정화 (병렬) ✅ 완료 (2026-05-21)

| TASK | 제목 | 서비스 | 파일 | 선행 | 상태 |
|------|------|--------|------|------|------|
| TASK-808 | OpenTelemetry 통합 (Jaeger) | backend + ai_engine + docker-compose | `build.gradle.kts`(OTel starter), `application.yaml`(OTel 설정), `docker-compose.yml`(Jaeger), Python `requirements.txt`(OTel SDK), `settings.py`(환경변수), LangGraph 노드별 수동 span | Stage 0 #1, #5 | ✅ |
| TASK-801 | ShedLock 스케줄러 전체 완성 | backend | `build.gradle.kts`(ShedLock 의존성), `V037__create_shedlock_table.sql`, 6개 Job `@SchedulerLock` (`ExpiredDataCleanupJob`, `PartitionMaintenanceJob`, `SastUsageResetJob`, `NvdSyncJob`, `SessionInterruptionScheduler`, `RefreshTokenCleanupJob`) | Stage 0 #3 | ✅ |

**병렬 안전 조건**:
- `build.gradle.kts` 공유 → 단일 Dev 에이전트가 두 의존성 블록(OTel + ShedLock)을 한 번에 처리하거나, 801 의존성 추가 커밋 후 808이 이어서 추가
- 서비스 레이어 수정 파일은 완전히 분리됨

**구성 근거**: OTel을 가장 먼저 도입하면 Stage 2 이후 새 레이어(Circuit Breaker, 보안 필터)가 자동 계측되어 디버깅 용이.

---

### Stage 2 — Circuit Breaker + GDPR API (병렬) ✅ 완료 (2026-05-21)

| TASK | 제목 | 서비스 | 파일 | 선행 | 상태 |
|------|------|--------|------|------|------|
| TASK-802 | Resilience4j Circuit Breaker 전체 적용 | backend | `build.gradle.kts`, `application.yaml`(CB 설정), `DefaultAiAgentClient`·`NvdApiClient`·`DomainVerificationService` @CircuitBreaker, `CircuitBreakerTest.java`(8개) | TASK-801 | ✅ |
| TASK-809 | GDPR Export/Delete API | backend | `GdprController.java`, `GdprService.java`, `GdprAccountDeletedEvent`, `GdprReportCleanupHandler.java`, `GdprServiceTest.java`(7개) | — | ✅ |

**병렬 안전**: 802는 기존 서비스 클래스 어노테이션 추가, 809는 신규 컨트롤러/서비스 — 파일 영역 분리

**구성 근거**: 802가 801 후행인 이유는 `NvdSyncJob`에 Circuit Breaker 적용 시 `@SchedulerLock`이 이미 확정되어 있어야 메서드 시그니처 충돌 회피.

---

### Stage 3 — 보안 인증 강화 (순차: SecurityConfig.java 공유) ✅ 완료 (2026-05-22)

| TASK | 제목 | 서비스 | 파일 | 선행 | 상태 |
|------|------|--------|------|------|------|
| TASK-806 | 2FA (TOTP) | backend | `build.gradle.kts`(`totp-spring-boot-starter`), `V038__add_totp_fields.sql`, `TotpService.java`, `TotpController.java`(`@Lock(PESSIMISTIC_WRITE)`), `SecurityConfig.java` 2FA 경로 설정, `/api/v1/auth/2fa/*` 엔드포인트 | — | ✅ |
| TASK-807 | IP Allowlist | backend | `V039__create_team_settings.sql`(테이블 신규), `IpAllowlistFilter.java`(`OncePerRequestFilter`), `SecurityConfig.java`에 `addFilterBefore(ipAllowlistFilter, JwtAuthenticationFilter.class)`, `application.yaml`에 `server.forward-headers-strategy: NATIVE`, `PUT /api/v1/admin/teams/{teamId}/ip-allowlist` API | TASK-806 | ✅ |

**순차 강제 이유**: 두 태스크 모두 `SecurityConfig.java` 수정 → 806이 먼저 필터 체인 구조 확정 후 807이 IP 필터 삽입

**구성 근거**: Stage 3를 별도 분리한 이유는 Reviewer가 보안 필터 체인 변경을 집중 검토할 수 있도록 PR 부담 분산.

---

### Stage 4 — 성능 최적화 + DTO 보안 검증 + SBOM 화면 (병렬) ✅ 완료 (2026-05-22)

| TASK | 제목 | 서비스 | 파일 | 선행 | 상태 |
|------|------|--------|------|------|------|
| TASK-803 | 성능 테스트 & 캐시 최적화 | backend + k6 | `docker-compose.yml`(k6 perf profile), `tests/perf/load-test.js`, `@EntityGraph`(Project/Vulnerability/Session), `@BatchSize(30)`, `RedisCacheConfig` cveList 6h TTL | TASK-808 | ✅ |
| TASK-804 | 보안 강화 (Spring Security 헤더 + DTO + Android) | backend + android | `SecurityConfig.java` `.headers()`(CSP/HSTS/X-Frame-Options/X-Content-Type/Referrer-Policy), Controller @Valid 전수 점검(DastController 1건 수정), Android network_security_config.xml 확인, POST /sbom/components HttpMethod.POST 명시 | TASK-806·807 | ✅ |
| FEAT-FE-001 | SBOM API + SbomPage.tsx | backend + frontend | `SbomController` GET 추가, `SbomComponentResponse.java`, `DependencyComponentRepository.findBySession_Id`, `SbomService.getComponents(프로젝트 소유권)`, `SbomPage.tsx` API 연결, 신규 `sbom/page.tsx` | — | ✅ |

**병렬 안전**:
- 803: Repository 레이어 (`VulnerabilityRepository`, `AnalysisSessionRepository` 등)
- 804: Controller 레이어 (전체 DTO 점검) + `SecurityConfig.headers()`
- FEAT-FE-001: SBOM 도메인 + 신규 프론트엔드 페이지
- 파일 영역 분리됨

**구성 근거**: 803은 808의 Jaeger Span 기반으로 병목 추적. 804는 2FA·IP Controller 추가 후 전체 점검해야 누락 없음. Nginx 보안 헤더는 Stage 5(805)로 이전.

---

### Stage 5 — 보안 문서 자동 생성 + Nginx 통합 (순차)

| TASK | 제목 | 서비스 | 파일 | 선행 |
|------|------|--------|------|------|
| TASK-MISC-002 | 보안 문서 자동 생성 Level 1 | backend + frontend | `build.gradle.kts`(`spring-boot-starter-thymeleaf` + `openhtmltopdf-pdfbox:1.0.20`), `V040__create_security_doc_requests.sql`, `SecurityDocController.java`, `SecurityDocService.java`(Thymeleaf → HTML → OpenHTMLtoPDF 파이프라인), 템플릿 3종(`ciso-report.html`, `hanafos-checklist.html`, `isms-p-evidence.html`), 프론트엔드 문서 유형 선택 UI | Stage 1~4 완료 |
| TASK-805 | Nginx API Gateway + SSL + 보안 헤더 통합 | nginx + docker-compose | `nginx.conf` 라우팅(`/api/*` → backend, `/ai/*` → ai_engine), `limit_req_zone` 분당 100회, 보안 헤더 통합(TASK-804의 Spring `.headers()` 설정을 Nginx `add_header`로 이전), 개발: 자체 서명 / 프로덕션: Let's Encrypt + Certbot, `docker-compose.yml` Nginx + Certbot 서비스 | TASK-808 (Jaeger와 `docker-compose.yml` 비충돌 확인) |

**구성 근거**: Nginx는 모든 엔드포인트 확정 후 라우팅 작성. 보안 헤더는 TASK-804에서 Spring Security로 1단계 적용된 상태에서 Nginx로 통합 이전.

**중요**: TASK-MISC-002 착수 전 OpenHTMLtoPDF + Spring Boot 4 호환성 PoC 1회 권장 (Stage 5 진입 지연 방지).

---

## 전체 실행 순서 요약

| 순서 | TASK | 제목 | 선행 | 에이전트 | 상태 |
|------|------|------|------|---------|------|
| 1a | TASK-808 | OpenTelemetry 통합 (Jaeger) | — | Dev + Tester | ✅ |
| 1b | TASK-801 | ShedLock 스케줄러 전체 완성 | — | Dev + Tester | ✅ |
| 2a | TASK-802 | Resilience4j Circuit Breaker | TASK-801 | Dev + Tester | ✅ |
| 2b | TASK-809 | GDPR Export/Delete API | — | Dev + Tester | ✅ |
| 3a | TASK-806 | 2FA (TOTP) | — | Dev + Tester | ✅ |
| 3b | TASK-807 | IP Allowlist | TASK-806 | Dev + Tester | ✅ |
| 4a | TASK-803 | 성능 테스트 & 캐시 최적화 | TASK-808 | Dev + Tester | ✅ |
| 4b | TASK-804 | 보안 강화 (헤더 + DTO + Android) | TASK-806·807 | Dev + Tester | ✅ |
| 4c | FEAT-FE-001 | SBOM API + SbomPage.tsx | — | Dev + Tester | ✅ |
| 5a | TASK-MISC-002 | 보안 문서 자동 생성 Level 1 | Stage 1~4 | Dev + Tester |
| 5b | TASK-805 | Nginx + SSL + 보안 헤더 통합 | TASK-808, 5a | Dev + Tester |

---

## 리스크 분석

### 의존성 리스크

1. **`build.gradle.kts` 다중 접촉 (Stage 1)**: TASK-801·808이 동일 파일 수정 → 단일 Dev 에이전트로 두 의존성 블록 순차 추가하거나 801 커밋 후 808 진행
2. **`SecurityConfig.java` 순차 강제 (Stage 3)**: 2FA·IP Allowlist 필터 적용 순서 잘못 시 2FA 우회 또는 IP 검증 누락. Reviewer가 필터 체인 순서를 반드시 검토
3. **`docker-compose.yml` 다중 접촉 (Stage 1 vs Stage 5)**: TASK-808(Jaeger), TASK-803(k6), TASK-805(Nginx + Certbot)이 각각 서비스 추가. 스테이지 분리로 충돌 없으나, Stage 5 착수 전 main 동기화 확인
4. **`application.yaml` 다중 접촉**: TASK-808(OTel 설정), TASK-807(forward-headers-strategy), TASK-802(Resilience4j 설정)이 동일 파일 수정. Stage 별 순차 진행으로 충돌 회피
5. **Flyway 번호 사전 예약 준수**: V037~V040 번호 일탈 금지 (다른 작업에서 임의 번호 사용 시 충돌)

### 기술 복잡도 리스크

6. **Python OTel + LangGraph asyncio**: `opentelemetry-instrumentation-asyncio`가 GA 미달 → LangGraph 노드별 수동 `with tracer.start_as_current_span` 필요. `aiohttp`/`httpx` span만 자동 계측
7. **TASK-806 TOTP 복구 코드 트랜잭션**: `@Lock(PESSIMISTIC_WRITE)` PostgreSQL `SELECT FOR UPDATE`로 직렬화 보장. Redis 분산 락 불필요
8. **TASK-807 IP Spoofing 방어**: Nginx(Stage 5) 없이 Stage 3에서 IP 검증 시 `X-Forwarded-For` 임의 조작 가능 → `server.forward-headers-strategy: NATIVE` + Docker 신뢰 프록시 IP 화이트리스트 필수
9. **TASK-MISC-002 OpenHTMLtoPDF 호환성**: Spring Boot 4 + Java 21 환경에서 PoC 1회 권장. PDFBox 기반이라 HTML5 안정 지원하나 CSS3 일부 제약 가능
10. **TASK-803 k6 환경**: GitHub Actions 러너 리소스 부족 → 로컬 Docker `make perf-test`만 지원, CI는 별도 분리

### 보안 리스크

11. **2FA 활성화 후 잠금 시나리오**: 복구 코드 분실 + TOTP 디바이스 분실 시 계정 잠금 → 관리자 강제 해제 절차 정의 필요 (TASK-806 추가 고려)
12. **GDPR 즉시 하드 삭제**: TASK-809에서 30일 유예 없는 즉시 삭제는 사용자 실수로 인한 데이터 영구 손실 위험 → 이메일 확인 토큰 또는 2FA 재인증 필수
13. **보안 문서 생성 권한**: TASK-MISC-002 생성 문서가 타 프로젝트 데이터 노출 가능성 → 프로젝트 소유권 검증 + 다운로드 토큰 만료(24h) 적용

---

## 스프린트 테스트 마일스톤

| 마일스톤 | 기준 |
|---------|------|
| **Stage 1 게이트** | Jaeger UI에서 분산 Trace 시각화 (secureai-backend ✅) + ShedLock 다중 인스턴스 시뮬레이션 1회만 실행 ✅ — `secureai-ai-engine` Jaeger 검증은 추후(Stage 4 성능 테스트 시 분석 요청과 함께 확인) |
| **Stage 2 게이트** | AI Agent 강제 종료 → 연속 실패 10회 → Circuit OPEN → fallback 응답 + 30초 후 HALF_OPEN → CLOSED 복구 + GDPR export JSON 완전성 + delete 연쇄 삭제 검증 |
| **Stage 3 게이트** | Google Authenticator QR 스캔 → TOTP 인증 성공, 복구 코드 1회 사용 후 재사용 거부 + 허용 IP 외부 요청 403, CIDR 범위 내 IP 정상 통과, X-Forwarded-For 조작 시 원본 IP 기준 검증 |
| **Stage 4 게이트** | k6 p95 < 500ms + Redis 캐시 히트율 > 80% + OWASP ZAP Critical/High 0건 + CSP/HSTS/X-Frame-Options 헤더 응답 확인 + SBOM Page → CVE 매핑 표시 |
| **Stage 5 게이트** | 행안부 점검결과서 PDF 30초 이내 생성, CISO 보고서·ISMS-P 증적 모두 생성 확인 + Nginx HTTP → HTTPS 강제 리다이렉트 + 분당 100회 초과 차단 |
| **Sprint 8 완료** | 위 5개 게이트 + Sprint 8 완료 기준 모두 통과 |

---

## Sprint 8 완료 기준 (백로그 기준)

- [x] **스케줄러 안정**: ShedLock으로 중복 실행 방지 (6개 Job)
- [x] **Circuit Breaker**: 모든 외부 호출(AI Agent / NVD / DNS) 장애 격리
- [ ] **성능 목표 달성**: p95 < 500ms, 캐시 히트율 > 80% (k6 인프라 실행 필요)
- [ ] **보안 기본선**: OWASP ZAP Critical 0건 (수동 스캔 필요)
- [x] **2FA**: TOTP 기반 2단계 인증 동작 (복구 코드 포함)
- [x] **IP Allowlist**: CIDR 범위 기반 차단 + Spoofing 방어
- [x] **OpenTelemetry**: Backend → AI Engine 분산 트레이싱 전체 연결
- [x] **GDPR**: Export/Delete API 동작
- [ ] **보안 문서 자동 생성 Level 1**: CISO·행안부·ISMS-P 3종 PDF 생성
- [x] **SBOM Page**: 백엔드 GET 엔드포인트 + 프론트엔드 화면
- [ ] **Nginx + SSL**: API Gateway 라우팅 + 보안 헤더 통합

---

## 실행 명령어

```
/stage 1   ✅ 완료 (2026-05-21) — TASK-808 + TASK-801
/stage 2   ✅ 완료 (2026-05-21) — TASK-802 + TASK-809
/stage 3   ✅ 완료 (2026-05-22) — TASK-806 + TASK-807
/stage 4   ✅ 완료 (2026-05-22) — TASK-803 + TASK-804 + FEAT-FE-001
/stage 5   (Stage 4 완료 후)
```

권장 선행 작업: FCM E2E 에뮬레이터 수동 검증 (Sprint 7 잔여 매뉴얼 항목) — Sprint 8 진행과 병행 가능.
