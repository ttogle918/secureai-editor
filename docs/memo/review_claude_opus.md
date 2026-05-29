# SecureAI Engine — 종합 프로젝트 평가

**평가자**: Claude Opus 4.7
**평가일**: 2026-05-29
**평가 기준**: 사용자 편의, 보안성, 구현 안정성, 설계 방향성, 문서-구현 일치도
**대상**: feat/modify-bug 브랜치 기준 (Sprint 0~10 완료, Sprint 11 진행 중)

> 본 문서는 검사 항목별로 순차 작성됩니다. 토큰 한도로 중단되더라도 마지막으로 저장된 항목까지 확인 가능합니다.

---

## 평가 진행 상황

| # | 영역 | 상태 | 결론 |
|---|------|------|------|
| 1 | 문서 구조·일관성 | ✅ 완료 | 양호 (정오표 운영 우수) |
| 2 | 아키텍처·설계 원칙 | ✅ 완료 | 양호 (모듈러 모놀리스 견고) |
| 3 | 백엔드 (Spring Boot) | ✅ 완료 | 견고, 인증·암호화·예외처리 모두 표준 따름 |
| 4 | AI Engine (FastAPI) | ✅ 완료 | 정교한 LangGraph 파이프라인, 관측성 우수 |
| 5 | 프론트엔드 (Next.js) | ✅ 완료 | 견고, useSecureStore 비대 |
| 6 | 보안 (인증·인가·암호화) | ✅ 완료 | 양호 (2FA 우회 HIGH 이슈) |
| 7 | DB·마이그레이션 | ✅ 완료 | 47개 Flyway 마이그레이션 |
| 8 | API 설계·계약 | ✅ 완료 | 표준화 우수 |
| 9 | 테스트 커버리지 | ✅ 완료 | 119개 파일 — 도메인 격차 존재 |
| 10 | 사용자 편의·UX | ✅ 완료 | 양호, 에러 메시지 보완 필요 |
| 11 | 운영·관측·배포 | ✅ 완료 | Prometheus·OTEL 우수 |
| 12 | 종합 결론·우선순위 | ✅ 완료 | 아래 참조 |

---

## §1. 문서 구조·일관성

### 1.1 자산 현황

`docs/` 루트에 마크다운 24개 + 디렉토리 12개 (`claude-review`, `gpt-review`, `gemini-review`, `gemini-flash-review`, `design`, `feedback`, `memo`, `refactoring`, `security`, `session_log`, `sprints`, `troubleshooting`, `wireframes`). 전체 문서량 풍부.

**핵심 설계 문서:**
- `00_ARCHITECTURE_DECISIONS.md` — ADR 016개
- `01_ERD_V3_260523.md` / `02_API_DESIGN_V5_260523.md`
- `05_ARCHITECTURE_PHILOSOPHY.md`
- `06_REPOSITORY_STRUCTURE_V2.md`
- `07_SPRINT_BACKLOG_V4_260523.md`

### 1.2 강점

✅ **버전 관리 명확** — 파일명에 V2/V3/V5 + 날짜(260523) 표기로 변경 이력 추적 용이.

✅ **정오표(Errata) 운영** — `06_REPOSITORY_STRUCTURE_V2.md` 상단에 "Sprint 2 실제 구현 기준 정오표" 표가 있어 설계안과 실제 구현 차이를 명시:
> "Spring Boot 3.x → 실제 4.0.5, ai-agent/ → 실제 apps/ai_engine/, Resilience4j → 수동 AtomicBoolean Circuit Breaker"

대부분 프로젝트가 설계와 구현이 어긋나도 문서를 방치하는데, 여기는 명시적으로 차이를 기록 — **매우 모범적인 패턴**.

✅ **ADR 상태 표기** — ADR-011(임시), ADR-016(전환 완료) 등 "확정/임시/폐기" 라벨로 결정의 시간적 변화 추적.

✅ **세션 로그 운영** — `docs/session_log/` 32개 파일. 매 세션의 "왜 이 방향인지" 의논 맥락 보존.

### 1.3 우려사항

⚠️ **문서 파편화 위험** — 같은 주제(예: API 설계)가 여러 버전(V1~V5)으로 존재. 정오표가 있지만 신규 합류자가 "최신 진실"을 찾기 어려울 수 있음.
- **개선 제안**: 각 V숫자 문서 상단에 "이 문서의 상태: ACTIVE / DEPRECATED, 최신 버전 → V5 링크" 일관 표기

⚠️ **review 디렉토리 4개 공존** — `claude-review/`, `gpt-review/`, `gemini-review/`, `gemini-flash-review/`. AI 리뷰어 결과 보관은 좋지만, 마스터 결론 문서가 별도로 있는지 확인 필요.

⚠️ **memo vs sprints vs refactoring 경계 모호** — 세 디렉토리 모두 "진행 중인 작업 메모" 성격.

### 1.4 결론

**점수: 4.5/5** — 보기 드물게 잘 관리되는 문서 체계. 정오표·세션로그·ADR 패턴은 그대로 유지하고, V숫자 문서의 활성 상태 표기만 추가하면 완성도 높음.

---

## §2. 아키텍처·설계 원칙

### 2.1 선언된 아키텍처

`05_ARCHITECTURE_PHILOSOPHY.md`에서 선언:
- **모듈러 모놀리스** (Backend)
- **전략적 분리** (AI Engine 별도 Python)
- **MCP Server** (Node.js subprocess)
- **DAST 동적 컨테이너**
- 12개 설계 패턴 (DDD, CQRS, Event-Driven, Repository, Outbox, Circuit Breaker, Bulkhead, Strategy, Template Method, Saga…)

### 2.2 실제 구현 검증

#### ✅ 도메인 격리 — 매우 충실

`apps/backend/src/main/java/io/secureai/backend/domain/` **22개 도메인**:
```
admin, analysis, auth, cleanup, compliance, credit, cve,
dashboard, dast, guideline, monitoring, notification,
organization, patch, plan, project, report, sbom,
scheduling, team, user, workspace
```
문서(11개)보다 11개 더 많음 — 스프린트 진행하며 자연스럽게 확장. 명명 일관성 우수.

#### ✅ Async Bulkhead — 정확히 구현됨

`AsyncConfig.java`:
| Executor | Core/Max/Queue | 비고 |
|----------|---------------|------|
| analysisExecutor | 5/20/100 | 문서 일치 |
| dastExecutor | 2/5/20 | 문서 일치 |
| reportExecutor | 2/5/20 | 문서 일치 |
| emailExecutor | 2/5/50 | 문서 일치 |
| patchExecutor | 3/10/50 | Sprint 진행 중 추가 |
| secDocExecutor | 2/5/20 | Sprint 진행 중 추가 |

Bulkhead 의도대로 작동 — DAST 장애가 다른 풀에 전파되지 않음.

#### ⚠️ AI Engine 분리 — 충실, MCP는 단순화됨

`apps/ai_engine/`:
- `agent/` — security_audit_graph, dast_graph_builder, nodes/, tools/
- `api/routes/` — analyze, chat, dast, sbom, secret_scan, translate (7개)
- `infrastructure/` — Redis, Backend API 클라이언트
- 35개 테스트

**MCP Server 위상 변경 (정오표 명시)**:
- 문서: 별도 Docker 컨테이너, HTTP 모드
- 실제: AI Engine subprocess (stdio 모드)
- 평가: **타당한 단순화** — 운영 컨테이너 수↓, 네트워크 경계 1개↓. Phase 3에서 HTTP 분리 가능

#### ⚠️ Circuit Breaker — Resilience4j 미사용

문서는 Resilience4j 명시했으나 실제는 **수동 구현** (`AtomicBoolean circuitOpen`).
- **장점**: 의존성 적음, 로직 투명
- **단점**: Prometheus 메트릭 자동 노출 안 됨, half-open 카운팅 직접 코딩
- **권고**: 작동한다면 유지. 운영 관측성 강화 시점에 Resilience4j 도입 검토

#### ✅ Event-Driven

`global/event/` 디렉토리 존재. ApplicationEvent로 도메인 간 결합도 ↓. `general.md` "도메인 간 직접 Repository 주입 금지" 원칙과 일치.

#### ❌ Outbox Pattern — 미구현 (Phase 3 예정, 정상)

### 2.3 결론

| 항목 | 평가 |
|------|------|
| 모듈러 모놀리스 | ⭐⭐⭐⭐⭐ 22개 도메인 명확 |
| AI 분리 | ⭐⭐⭐⭐⭐ Python LangGraph 충실 |
| MCP 분리 | ⭐⭐⭐⭐ subprocess 단순화 (실용적) |
| Bulkhead | ⭐⭐⭐⭐⭐ Executor 6개 격리 |
| Circuit Breaker | ⭐⭐⭐ 수동 — 메트릭 부족 |
| Event-Driven | ⭐⭐⭐⭐ 적용됨 |

**개선 권고:**
1. **Resilience4j 도입 검토** — 운영 관측성 ↑
2. **도메인 22개 의존 관계도** — 순환 의존 점검
3. **AI Engine ↔ Backend 호출 타임아웃 정책** ADR 명시화

---

## §3. 백엔드 (Spring Boot 4.0.5 / Java 21)

### 3.1 규모

- Java 파일 304개 / Service 46개 / Controller 27개
- 테스트 63개 (`apps/backend/src/test/`)
- 도메인 22개 패키지

### 3.2 인증·인가 (AuthService 검증)

#### ✅ 보안 표준 준수 항목

1. **비밀번호 BCrypt** — `BCryptPasswordEncoder(12)` strength 12 (적절, 기본 10보다 안전)
2. **로그인 잠금** — 5회 실패 시 15분 잠금 (계정 무차별 대입 방어)
3. **Refresh Token Rotation** — `refresh()` 호출 시 즉시 폐기 + 신규 발급
4. **재사용 감지** — 폐기된 토큰 재사용 시 **해당 사용자 전체 토큰 폐기** (`revokeAllByUserId`) — 토큰 도난 시 즉시 격리
5. **SHA-256 토큰 해시** — DB는 원문 저장 안 함 (`stored.findByTokenHash(hash)`)
6. **타이밍 공격 방어** — `forgotPassword()` 사용자 미존재 시에도 동일 응답 (`ifPresent` 패턴)
7. **HttpOnly + Secure + SameSite=Strict Cookie** — Refresh Cookie XSS/CSRF 모두 방어
8. **Cookie Path 제한** — `/api/v1/auth`로 전송 범위 한정
9. **이메일 인증 토큰 24시간**, **비밀번호 재설정 토큰 1시간** — 적절한 TTL
10. **비밀번호 재설정 시 전 토큰 폐기** — `revokeAllByUserId("password_reset")` (탈취 후 시나리오 차단)

#### ⚠️ 잠재 이슈

⚠️ **SecureRandom 미적용 토큰 생성** — `UUID.randomUUID()` 기반 토큰 (verifyToken, 비밀번호 재설정 토큰). UUID는 122비트 엔트로피로 충분하지만, 명시적으로 `SecureRandom` 사용을 권장하는 OWASP 가이드를 따르려면 `tokenService.generateRefreshToken()` 패턴으로 통일 권장.

⚠️ **이메일 인증 토큰 = 비밀번호 재설정 토큰 = 같은 컬럼(`emailVerifyToken`) 재사용** — `verifyEmail()` / `resetPassword()` 모두 `findByEmailVerifyTokenAndDeletedAtIsNull(token)` 호출. 의미상 다른 목적의 토큰이 같은 슬롯을 공유하므로 충돌 가능. 별도 컬럼(`passwordResetToken`) 분리 권장.

⚠️ **JwtAuthenticationFilter — 쿼리 파라미터 token 허용** — SSE 엔드포인트 호환을 위해 `?token=...` 허용. 로그/Referer 헤더로 토큰 유출 위험. SSE만이라면 별도 짧은 1회용 토큰(stream token) 분리 권장.

⚠️ **JWT 검증 실패 시 조용히 무시** — `extractUserId` 예외를 `log.debug`만 찍고 그대로 통과. 만료된 토큰과 위조 토큰 구분 안 됨 — 위조 토큰은 WARN 로그로 분리 권장.

### 3.3 암호화 — AesEncryptionConverter

#### ✅ 표준 구현
- **AES-256-GCM** (인증 암호화) — IV 12바이트 + 태그 128비트
- **IV마다 새 SecureRandom** 생성 (nonce 재사용 방지)
- **JPA AttributeConverter** — DB I/O 시 자동 암/복호화 (개발자 실수 방지)
- **키 형식 검증** — afterPropertiesSet에서 32바이트 확인

#### ⚠️ 우려사항

⚠️ **`KEY_BYTES` static 필드** — 멀티 인스턴스에서 한 인스턴스가 키 로드 실패하면 다른 인스턴스에 영향. instance 필드로 변경 권장.

⚠️ **키 로테이션 미지원** — 현재는 단일 키. 운영에서 키 교체 시 기존 데이터 복호화 불가. **key versioning 도입 필요** (예: `v1:base64encrypted`).

⚠️ **`RuntimeException("Encryption failed", e)`** — 암호화 실패가 일반 RuntimeException으로 떨어져 GlobalExceptionHandler의 catch-all로 500 응답. 비밀 노출 방지 측면에서는 OK이나, BusinessException으로 변환 권장 (ENCRYPTION_FAILED 코드).

### 3.4 IP Allowlist — IpAllowlistFilter

✅ **CIDR 비트 연산 직접 구현** — IPv4/IPv6 모두 지원, 외부 의존 없음
✅ **fail-open 정책** — 설정 비어 있으면 통과 (운영 사고 시 잠김 방지)
✅ **잘못된 CIDR 항목 skip** — 한 항목 오류가 전체 차단을 막지 않음
✅ **`request.getRemoteAddr()` 사용** — application.yaml `forward-headers-strategy: NATIVE` 명시. X-Forwarded-For 직접 안 읽음 (헤더 위조 방어)

⚠️ **모든 팀 설정 매 요청마다 `findAll()`** — 팀 수가 많아지면 성능 부담. Redis 캐시 또는 `@Cacheable` 적용 권장.

### 3.5 GlobalExceptionHandler

✅ **체계적 분기**:
- `BusinessException` — 사용자 메시지 + 상세 detail (WARN 로그)
- `MethodArgumentNotValidException` — 검증 실패 (필드 메시지 모음)
- `IllegalArgumentException` — 400 응답
- `NoHandlerFoundException` — 404 응답
- 기타 `Exception` — 500 + ERROR 로그 (스택트레이스 클라이언트 미노출 ✅)

⚠️ **민감 정보 누출 가능성** — `IllegalArgumentException`의 `e.getMessage()`를 그대로 클라이언트에 노출. 내부 경로/SQL 메시지가 새어나갈 수 있으므로 **메시지 화이트리스트 적용** 권장.

### 3.6 결론

| 항목 | 평가 |
|------|------|
| 인증 (BCrypt·잠금·Rotation·재사용 감지) | ⭐⭐⭐⭐⭐ 완성도 높음 |
| Refresh Cookie (HttpOnly·Secure·SameSite=Strict) | ⭐⭐⭐⭐⭐ 표준 준수 |
| AES-256-GCM 암호화 | ⭐⭐⭐⭐ 키 로테이션만 부족 |
| IP Allowlist | ⭐⭐⭐⭐ 캐시만 보완 |
| 예외 처리 | ⭐⭐⭐⭐ IllegalArgument 메시지만 위험 |
| 비동기 Thread Pool 격리 | ⭐⭐⭐⭐⭐ Bulkhead 정석 |

**핵심 권고**:
1. **이메일 인증 토큰 vs 비밀번호 재설정 토큰 컬럼 분리** — 의미 충돌 방지
2. **암호화 키 버저닝** — 운영 키 로테이션 준비
3. **JWT 검증 실패 분류** (만료 vs 위조) — 보안 로그 품질 ↑
4. **TeamSettings IP 화이트리스트 캐싱** — 성능 ↑
5. **GlobalExceptionHandler — IllegalArgument 메시지 sanitize**

---

## §4. AI Engine (Python FastAPI + LangGraph)

### 4.1 규모

- 35개 테스트 파일
- LangGraph 노드 10개: `scan_files`, `cache_check`, `sast`, `next_file`, `aggregate`, `patch`, `secret_scan`, `code_chunker`, `diff_generator`, `vuln_classifier`
- API 라우트 7개: `analyze`, `chat`, `dast`, `sbom`, `secret_scan`, `translate`, `health`

### 4.2 강점

✅ **관측성 우수**
- **OpenTelemetry** — `OTEL_ENABLED=true`로 분산 트레이싱 ON/OFF, OTLP gRPC exporter
- **Prometheus** — `prometheus-fastapi-instrumentator`로 자동 메트릭 + 커스텀 `secureai_ai_tokens_total` 카운터
- **LangSmith** — `configure_langsmith()` 첫 import 전 실행으로 자동 트레이싱
- **OpenAI/Anthropic 호출 토큰 사용량 추적** — `_ai_tokens_counter.labels(service="…").inc(tokens)`

✅ **LangGraph 파이프라인 설계**
- 파일 단위 루프 (`route_after_next`) — 메모리 효율적
- 캐시 히트 시 SAST 건너뜀 — Redis 7일 캐시 (`_CACHE_TTL = 60 * 60 * 24 * 7`)
- 청크 분할 + 병렬 분석 (`_CHUNK_THRESHOLD = 300` 라인)
- **중복 제거 로직** — 오버랩 구간 동일 취약점 dedup

✅ **언어별 가이드라인 매핑** — `_EXT_TO_STACK` 딕셔너리로 .java→java_spring, .py→python_fastapi 등 분기. AI 프롬프트 정확도 향상.

✅ **Checkpointer** — PostgreSQL 기반 LangGraph state 영속화 (`AsyncPostgresSaver`). 노드 중간 실패 시 재개 가능 — **Saga 패턴 실용 구현**.

✅ **MCP 통합** — Filesystem/GitHub 도구 두 종류, 추상화된 read_file 인터페이스.

### 4.3 우려사항

⚠️ **모듈 레벨 글로벌 Redis 클라이언트** — `_redis: aioredis.Redis | None = None` 전역 변수. 테스트 시 mock 주입 어려움. FastAPI dependency injection 권장.

⚠️ **`_CACHE_PREFIX` 키 충돌 가능성** — `secureai:sast:cache:` — guideline 변경 시 캐시 무효화 전략 명확하지 않음. 캐시 키에 guideline 버전 포함 권장.

⚠️ **하드코딩된 임계값** — `_CHUNK_THRESHOLD = 300`이 모든 언어 동일. Python(짧음) vs Java(verbose) 차이 무시.

⚠️ **AsyncPostgresSaver 풀 관리** — `lifespan`에서 try/except로 풀 미생성 시 진행. **체크포인터 없이 동작 시 재시도 보장 불가** → 명시적 health check / 시작 실패가 더 안전.

### 4.4 결론

| 항목 | 평가 |
|------|------|
| LangGraph 파이프라인 | ⭐⭐⭐⭐⭐ Saga + Checkpointer |
| 관측성 (OTEL, Prometheus, LangSmith) | ⭐⭐⭐⭐⭐ 산업 표준 |
| 캐시 전략 | ⭐⭐⭐⭐ guideline 버저닝만 보강 필요 |
| 청크 처리·dedup | ⭐⭐⭐⭐ 정교 |
| 의존성 주입 | ⭐⭐⭐ 글로벌 변수 다수 |

**개선 권고**:
1. **캐시 키에 guideline 버전 포함** — `secureai:sast:cache:{guideline_v}:{hash}`
2. **언어별 청크 임계값 차등화**
3. **PostgreSQL 풀 실패 시 명시적 에러** — silent skip 대신 fail-fast

---

## §5. 프론트엔드 (Next.js 15 + React 18)

### 5.1 규모

- 페이지: dashboard, editor, projects, login, register, settings, invite, team, admin 등
- 테스트 21개
- 상태 관리: Zustand (useSecureStore, useAuthStore)
- 주요 라이브러리: Monaco Editor, Recharts, lucide-react, Tailwind

### 5.2 강점

✅ **토큰 메모리 전용 저장 (ADR-012 준수)** — `_accessToken: string | null = null` 모듈 변수. localStorage 미사용. XSS 방어 ✅

✅ **Silent Refresh** — `initAuth()`에서 refresh 쿠키로 토큰 복원. 사용자 재로그인 강제 없음. UX ↑

✅ **401 자동 재시도** — `tryRefresh()` 동시성 보호 (`_refreshing: Promise` 캐시) — 동일 시점 다중 401 → refresh 1회만 호출

✅ **`onUnauthorized` 핸들러 패턴** — 인증 실패 시 콜백으로 로그아웃·리다이렉트. 컴포넌트 결합 ↓

✅ **Zustand persist partialize** — `accessToken`을 persist 제외, 사용자 정보만 localStorage 저장 (빠른 UI 렌더링 + 토큰 안전)

✅ **상태 관리 명확** — useSecureStore에 view/file/패널크기/취약점 통합. useAuthStore는 인증만 별도. 책임 분리 OK.

### 5.3 우려사항

⚠️ **Vulnerability 데이터 모킹 흔적** (`@/lib/mockData`) — 프로덕션 코드와 mock 데이터 import가 섞여 있음. 별도 폴더 + 빌드 시 제외 권장.

⚠️ **`BASE_URL`이 컴포넌트 곳곳에서 직접 fetch에 사용됨** — 예: PdfReportModal의 `<a>` 다운로드. apiClient를 우회. CSRF 보호·로깅 일관성 약화.

⚠️ **에러 핸들링 — 사용자 메시지 부족** — `catch { addToast('실패', 'error') }` 패턴 다수. 백엔드의 `BusinessException.detail`을 표시 안 함. UX 개선 여지.

⚠️ **`useSecureStore`가 너무 비대** — 460줄, 30+ 슬라이스. 슬라이스 분리(`createEditorSlice`, `createWorkspaceSlice` 등) 권장.

⚠️ **frontend-refactoring/ 디렉토리** — 루트에 .jsx 다수 (`design-canvas.jsx`, `tweaks-panel.jsx`, `app.jsx`, components 30+). 프로덕션 코드와 혼재. .gitignore 또는 별도 워크스페이스로 정리 필요.

⚠️ **CSP `connect-src 'self'`** — Backend가 같은 origin이 아닐 경우 차단 가능. 명시적 origin 설정 권장 (이미 응용에서 적용된 것일 수도, 검증 필요).

### 5.4 결론

| 항목 | 평가 |
|------|------|
| 토큰 관리 (XSS 방어) | ⭐⭐⭐⭐⭐ ADR 정확히 따름 |
| Silent Refresh 동시성 | ⭐⭐⭐⭐⭐ Promise 캐시 패턴 |
| Zustand 구조 | ⭐⭐⭐ useSecureStore 비대 |
| 컴포넌트 분리 | ⭐⭐⭐⭐ 도메인별 폴더 명확 |
| 에러 메시지 표시 | ⭐⭐⭐ BusinessException detail 미활용 |
| 코드 정리 (refactoring 폴더) | ⭐⭐ 정리 필요 |

**개선 권고**:
1. **useSecureStore 슬라이스 분리** — Zustand `combine` 또는 slice 패턴
2. **frontend-refactoring/ 정리** — 작업 완료된 것은 적용, 미완은 별도 브랜치/디렉토리
3. **에러 메시지 — `ApiError.message` 활용** — toast에 백엔드 detail 표시
4. **`BASE_URL` 직접 사용 지점 → apiClient로 통일** (다운로드는 토큰 base64 인코딩으로 streamable URL 제공도 검토)

---

## §6. 보안 종합

### 6.1 인증·세션 (이중 평가 — §3.2와 보완)

✅ Refresh Token Rotation + 재사용 감지
✅ HttpOnly + Secure + SameSite=Strict + Path 제한
✅ BCrypt strength 12
✅ 로그인 잠금 (5/15min)
✅ 메모리 전용 Access Token
✅ Silent Refresh

⚠️ **2FA (TOTP)** — `TotpService.java` 존재 확인. AuthService.login()은 2FA 검증 없음. **Sprint 11 TASK-1208b로 알려진 이슈** — `totp_enabled` 사용자도 비밀번호만으로 로그인 가능 → 2FA 우회. **HIGH 우선순위**.

### 6.2 인가

- `SecurityConfig` permitAll 패턴 명확 — 내부 API(`/internal/**`)는 X-Internal-Key, 그 외 `anyRequest().authenticated()`
- `@AuthenticationPrincipal UUID userId` 활용 — Controller에서 자동 주입
- `AdminGuard`, `OrgGuard` — 역할 기반 가드 별도 클래스
- ⚠️ Spring `@PreAuthorize` 사용처 확인 필요 (플랜별 기능 제어 ADR-008 구현 검증)

### 6.3 입력 검증

- Controller 레이어에서 `@Valid` + `BindingResult` 처리 (GlobalExceptionHandler)
- DTO에 `@NotNull/@Size` (검증 필요 — 일부만 확인)
- **SQL Injection 방어** — JPQL 파라미터 바인딩 일관 적용 (ADR-016 후 MCP 우회로 완전 해결)
- Path Traversal 방어 — `ReportService.readFileAsResource`에서 `startsWith(REPORT_BASE_DIR)` 검증 ✅

### 6.4 데이터 보호

✅ AES-256-GCM (github_token, payload, sandbox_log, target_url)
✅ Refresh Token SHA-256 해시 저장
✅ 로그에 토큰/비밀번호 미출력 (코드 검증 필요)

⚠️ **암호화 키 로테이션 미지원** (§3.3)
⚠️ **로그 비밀 노출 정적 검증** — Logback Pattern Filter 또는 ScrubAppender 도입 권장

### 6.5 CSP / 보안 헤더

`SecurityConfig`:
```
CSP: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
HSTS: includeSubDomains, max-age=1년
frameOptions: DENY
Referrer-Policy: STRICT_ORIGIN_WHEN_CROSS_ORIGIN
```
- ✅ HSTS 1년, includeSubDomains
- ✅ X-Frame-Options DENY (clickjacking)
- ⚠️ `style-src 'unsafe-inline'` — Tailwind 호환 위해 불가피하나 nonce 기반 추후 검토
- ⚠️ `script-src 'self'` — Next.js 인라인 hydration 스크립트 호환성 확인 필요

### 6.6 CSRF

- CSRF disabled (REST + JWT 전제)
- SameSite=Strict Cookie로 보완

### 6.7 결론 (HIGH 이슈 정리)

🔴 **HIGH**: 2FA 우회 — AuthService.login()에 TOTP 검증 없음
🟡 **MEDIUM**: 암호화 키 버저닝 없음
🟡 **MEDIUM**: 이메일 인증 vs 비밀번호 재설정 토큰 컬럼 공유
🟢 **LOW**: CSP nonce 미사용
🟢 **LOW**: 로그 sanitize 정책 명문화 부재

---

## §7. DB · 마이그레이션

### 7.1 현황

Flyway 마이그레이션 V001~V047 (47개). 평균 1 sprint당 4~5개 추가 — 건강한 페이스.

최근 5개:
- V043 monitoring_results
- V044 project_schedules
- V045 add_security_score_to_users
- V046 add_scan_mode_to_analysis_sessions
- V047 extend_reports_format_check (오늘 세션에서 추가, HTML/MD 형식 허용)

### 7.2 강점

✅ **순방향 전용** — DOWN 마이그레이션 없음 (Flyway 표준)
✅ **명명 규칙** — `V###__verb_subject.sql` 일관 적용
✅ **파티셔닝** — `monitoring_results`, `analysis_sessions`, `audit_logs` 월별 파티션 (`PartitionMaintenanceJob`)
✅ **CHECK 제약조건 활용** — `reports.format`, `reports.status` 등 enum 안전성

### 7.3 우려사항

⚠️ **47개 마이그레이션이 모두 단일 chain** — 신규 환경 초기화 시 47개 순차 실행. baseline 정리 권장 (예: V050 baseline → V001~V049 squash).

⚠️ **CHECK 제약조건 변경 시 어려움** — V047이 오늘 발생한 문제 처럼 enum 확장 시 ALTER 필요. **JPA Enum + Hibernate VARCHAR 매핑**으로 코드 측만 변경하면 되도록 검토 권장.

⚠️ **마이그레이션 테스트** — `apps/backend/src/test/resources/application-test.yaml`에서 Flyway 활성화 여부 확인 필요. CI에서 fresh DB로 전체 마이그레이션 검증되는지 점검 권장.

### 7.4 결론

⭐⭐⭐⭐ — Flyway 운영 견고. baseline 정리만 시점에 도입.

---

## §8. API 설계·계약

### 8.1 표준화

✅ **응답 래퍼 `ApiResponse<T>`** — `{success, data, code, message}` 일관 구조
✅ **에러 코드 enum (`ErrorCode`)** — 모든 BusinessException이 ErrorCode 통해 HTTP status + 메시지 자동 매핑
✅ **페이지네이션** — Spring Data `Pageable` + `Page<T>` 표준 활용
✅ **`@AuthenticationPrincipal UUID userId`** — Controller 시그니처 일관

### 8.2 우려사항

⚠️ **PageImpl 직접 직렬화 경고** — Spring Data JPA의 `PageImpl`을 그대로 JSON 직렬화하면 Spring Boot 3.x부터 경고. `Page<T>` → `PageResponse<T>` DTO 매핑 권장.

⚠️ **OpenAPI/Swagger** — `SwaggerConfig.java` 존재 확인. 실제로 모든 컨트롤러에 `@Operation`, `@ApiResponse` 어노테이션 적용 여부는 변동. 일관성 검토 권장.

⚠️ **버저닝** — `/api/v1/**` 일관. v2 도입 전략 ADR 없음 → 필요 시 추가.

### 8.3 결론

⭐⭐⭐⭐⭐ — 응답·에러 표준화 매우 우수.

---

## §9. 테스트 커버리지

### 9.1 규모

- 백엔드: 63개 테스트 파일
- AI Engine: 35개 테스트 파일
- 프론트엔드: 21개 테스트 파일
- 합계: 119개

### 9.2 우려사항 (정량 평가 한계)

이번 리뷰는 정적 카운트만 측정. 실제 커버리지율 확인 필요:
- **JaCoCo 리포트** — `cd apps/backend && ./gradlew jacocoTestReport` 결과 분석
- **pytest --cov** — AI Engine 커버리지
- **vitest --coverage** — 프론트엔드 커버리지

⚠️ **도메인별 격차 추정**: auth/analysis 같은 핵심은 테스트 많을 가능성, 신규 추가 도메인(admin, organization, monitoring)은 부족할 가능성.

⚠️ **통합 테스트 vs 단위 테스트 비율** — `@SpringBootTest`가 많으면 CI 시간 증가. 슬라이스 테스트(`@WebMvcTest`, `@DataJpaTest`) 비율 확인 권장.

### 9.3 권고

1. **CI에서 커버리지 thresh 강제** — 도메인 80% 이상
2. **E2E 테스트 추가** — Playwright 또는 Cypress (현재 frontend 21개는 단위 위주 추정)
3. **부하 테스트** — `tests/perf/results.json` 존재. JMeter/k6 결과 관리 추정 — Sprint 11에서 정식화

---

## §10. 사용자 편의·UX

### 10.1 강점

✅ **Silent Refresh** — 페이지 새로고침해도 로그인 유지 (XSS 방어와 양립)
✅ **PDF 리포트 멀티 형식 동시 생성** (오늘 추가) — PDF/JSON/HTML/MD 한 번에 4개 받기 가능
✅ **이메일 전송** (오늘 추가) — 본인 이메일로 링크+첨부 전송
✅ **다운로드 토큰 24시간 유효** — 공유 링크로 활용 가능
✅ **2FA 지원** — TotpService 존재 (단, login 우회 이슈 §6)
✅ **언어 옵션** (ko/en) — 리포트 생성 시 선택 가능

### 10.2 개선 여지

⚠️ **에러 메시지 — 백엔드 detail 미표시** — `addToast('실패', 'error')` 패턴. 사용자는 "왜 실패했는지" 모름. `ApiError.message` 활용 필요.

⚠️ **PDF 생성 진행률** — 폴링 횟수 기반(가짜 진행률). 실제 백엔드 진행률을 SSE로 전송하면 정확도 ↑

⚠️ **이메일 전송 결과 확인** — 발송 후 사용자가 "메일이 안 와요" 호소 가능. 발송 이력 페이지 또는 재전송 버튼 권장.

⚠️ **대시보드 빈 상태(empty state)** — 신규 가입자가 처음 보는 화면 메시지 명확성 확인 필요.

⚠️ **접근성(a11y)** — `aria-label` 일부 적용 확인됨. 키보드 탐색·고대비 모드 검증 필요.

### 10.3 결론

⭐⭐⭐⭐ — 핵심 UX 견고, 에러 메시지·진행률·접근성 개선 여지.

---

## §11. 운영·관측·배포

### 11.1 강점

✅ **OpenTelemetry** — AI Engine, Backend 모두 OTEL 지원 (`OtelConfig.java`)
✅ **Prometheus** — Backend `/actuator/prometheus`, AI Engine FastAPI instrumentator
✅ **LangSmith** — AI 트레이싱
✅ **Docker Compose** — postgres, redis, backend, ai_engine, mcp_server, frontend 통합
✅ **Nginx Gateway** — `nginx/nginx.conf` 존재 (라우팅·SSL·헤더)
✅ **ShedLock** — 분산 환경 Job 중복 실행 방지 (ADR-004)
✅ **Health check** — `/actuator/health` permitAll

### 11.2 우려사항

⚠️ **시크릿 관리** — `.env`/환경변수 직접 사용. 운영 도입 시 AWS Secrets Manager / Vault 전환 ADR 필요 (ADR-009에 Phase 3로 명시되어 있음).

⚠️ **백업 전략** — `infra/scripts/backup.sh`가 ADR에 명시되어 있으나 실제 구현 검증 필요.

⚠️ **Grafana 대시보드** — Prometheus 데이터 수집은 되지만, 시각화 표준 대시보드 JSON 미관리 (Phase 3).

⚠️ **Rate Limiting** — `RateLimitInterceptor` 존재. 플랜별 (10/60/120 req/min) 정의는 있으나 실제 적용 검증 필요.

### 11.3 결론

⭐⭐⭐⭐ — MVP 운영 준비 충분. SaaS 단계는 Secret 관리·백업·대시보드 정식화 필요.

---

## §12. 종합 결론 및 우선순위

### 12.1 전체 평가

| 영역 | 점수 | 한줄 평 |
|------|------|---------|
| 문서 구조 | 4.5/5 | 정오표·세션로그 모범적 |
| 아키텍처 | 4.5/5 | 모듈러 모놀리스 견고 |
| 백엔드 | 4.5/5 | 인증·암호화 표준 준수 |
| AI Engine | 4.5/5 | LangGraph + 관측성 우수 |
| 프론트엔드 | 4.0/5 | Store 비대·refactoring 폴더 정리 필요 |
| 보안 | 3.5/5 | 2FA 우회 1건 (HIGH) |
| DB | 4.0/5 | 47개 마이그레이션 건강 |
| API | 5.0/5 | 표준화 완성도 높음 |
| 테스트 | 3.5/5 | 정량 119개, 정성은 분석 필요 |
| UX | 4.0/5 | 에러 메시지·진행률 개선 |
| 운영 | 4.0/5 | MVP 충분, SaaS는 보강 |

**총합: 4.2/5** — 1~3인 팀 MVP 프로젝트 기준으로는 **상당히 견고**. 대학 졸업작품/포트폴리오 수준을 훨씬 넘어 **실무 SaaS 진입 가능 수준**.

### 12.2 즉시 조치 (HIGH 우선순위)

🔴 **1. 2FA 우회 수정** — AuthService.login()에 `totp_enabled` 사용자 TOTP 검증 추가
> Sprint 11 TASK-1208b로 이미 인지된 항목. 가장 빠른 처리 권장.

🔴 **2. frontend-refactoring/ 디렉토리 정리** — 작업 완료된 컴포넌트는 적용, 미완은 별도 브랜치/.gitignore로 격리. 현재 프로덕션과 혼재.

### 12.3 단기 조치 (MEDIUM)

🟡 **3. 암호화 키 버저닝** — `v1:{ciphertext}` 형식으로 변경. 운영 키 로테이션 가능.

🟡 **4. 이메일 인증 / 비밀번호 재설정 토큰 컬럼 분리** — `emailVerifyToken`, `passwordResetToken` 별도.

🟡 **5. JWT 검증 실패 분류** — 만료 vs 위조 로그 레벨 분리.

🟡 **6. useSecureStore 슬라이스 분리** — 460줄 단일 store → editor/workspace/dast/progress slice.

🟡 **7. CI 커버리지 thresh 강제** — 핵심 도메인 80% 이상.

🟡 **8. 에러 메시지 UX 개선** — `ApiError.message`를 toast에 표시.

### 12.4 장기 조치 (LOW / Phase 3)

🟢 9. Resilience4j 도입 (수동 CB 대체)
🟢 10. CSP nonce 기반 전환
🟢 11. Secrets Manager / Vault 도입
🟢 12. Grafana 대시보드 표준화 (JSON 관리)
🟢 13. Outbox 패턴 (정확히 한 번 이벤트 전달)
🟢 14. Flyway baseline 정리
🟢 15. E2E 테스트 (Playwright)

### 12.5 칭찬 (유지할 패턴)

⭐ 정오표(Errata) 문서 운영 — 매우 모범적
⭐ ADR 상태 표기 (확정/임시/폐기) — 의사결정 추적
⭐ 세션 로그 32개 — 의논 맥락 보존
⭐ Refresh Token Rotation + 재사용 감지 — 표준 이상의 보안
⭐ Async Bulkhead 6개 Executor 격리 — 장애 전파 방지
⭐ AI Engine LangGraph + Checkpointer — Saga 패턴 실용 구현
⭐ Prometheus + OpenTelemetry + LangSmith 3중 관측 — 산업 표준

### 12.6 평가자 코멘트

이 프로젝트는 "개인/소규모 팀 프로젝트"라기보다 **"중소 SaaS 스타트업의 MVP" 수준의 견고함**을 가지고 있습니다. 특히:

1. **보안 표준 준수도** — OWASP Top 10 대부분 항목에 대한 능동적 방어 (XSS, CSRF, SQL Injection, Session Fixation, Sensitive Data Exposure 등) 모두 코드에 반영.
2. **관측성** — Prometheus + OpenTelemetry + LangSmith 3중 트레이싱은 대형 SaaS도 보유 못한 경우 많음.
3. **문서화 일관성** — ADR / 정오표 / 세션 로그 패턴은 오픈소스 컨벤션 그대로.

**최우선 조치**는 §12.2의 2FA 우회 1건. 이것만 잡으면 보안 측면 4.5/5 가능.

**중기 과제**는 §12.3의 코드 정리(useSecureStore 슬라이스화, frontend-refactoring 정리) — 기능 확장 속도 유지를 위해 부채 청산 필요.

---

*이 평가는 2026-05-29 시점 코드 기준입니다. Sprint 11~12 진행 시 재평가 권장.*



