# SecureAI — API 보안 체크리스트
> 작성일: 2026-04-25 | 버전: v1.0  
> 목적: API 개발 완료 후 보안 검토 시 사용하는 체크리스트  
> 대상: 백엔드 개발자, 보안 담당자, 코드 리뷰어  
> 참고 문서: `02_API_DESIGN.md`, `00_ARCHITECTURE_DECISIONS.md`

---

## 목차

1. [인증 / 인가 (Authentication & Authorization)](#1-인증--인가)
2. [입력 검증 & 출력 인코딩](#2-입력-검증--출력-인코딩)
3. [토큰 & 세션 관리](#3-토큰--세션-관리)
4. [Rate Limiting & DoS 방어](#4-rate-limiting--dos-방어)
5. [민감 데이터 처리](#5-민감-데이터-처리)
6. [DAST / Docker 샌드박스 보안](#6-dast--docker-샌드박스-보안)
7. [GitHub OAuth & Webhook 보안](#7-github-oauth--webhook-보안)
8. [에러 처리 & 로깅](#8-에러-처리--로깅)
9. [HTTP 헤더 보안](#9-http-헤더-보안)
10. [파일 업로드 & 다운로드 보안](#10-파일-업로드--다운로드-보안)
11. [의존성 & 인프라 보안](#11-의존성--인프라-보안)
12. [OWASP API Top 10 대응 점검](#12-owasp-api-top-10-대응-점검)

---

## 1. 인증 / 인가

### 1.1 JWT Access Token
- [ ] Access Token 유효 시간이 **15분** 이하로 설정되어 있는가
- [ ] `Authorization: Bearer {token}` 헤더 방식 사용 (쿼리 파라미터 전달 금지)
  - 예외: SSE 스트림 엔드포인트(`?token=...`) — 로그에서 마스킹 처리 필요
- [ ] JWT 서명 알고리즘이 `RS256` 또는 `ES256`인가 (HS256은 키 공유 위험)
- [ ] `alg: none` 공격 방어: 알고리즘 명시적 화이트리스트 검증 적용 여부
- [ ] JWT payload에 비밀번호 해시, 카드번호 등 민감 정보 미포함 여부
- [ ] Access Token을 `localStorage`/`sessionStorage`에 저장하지 않는가 (메모리 전용 — ADR-012)

### 1.2 Refresh Token
- [ ] HttpOnly + Secure + SameSite=Strict 쿠키로만 전달
- [ ] DB에 원문이 아닌 **SHA-256 해시값**만 저장 (ADR-015)
- [ ] Redis에 TTL 30일로 저장되어 있는가
- [ ] Refresh Token Rotation 구현 여부: 사용 즉시 새 토큰 발급 + 구 토큰 즉시 무효화
- [ ] 탈취된 구 토큰 재사용(Replay Attack) 감지 시 **해당 유저 전체 세션 강제 만료** 처리 여부
- [ ] 로그아웃 시 Redis + DB에서 Refresh Token 즉시 삭제되는가

### 1.3 인가 (Authorization)
- [ ] 모든 인증 필요 엔드포인트에 `@AuthenticationPrincipal` 또는 Security Filter 적용 여부
- [ ] 플랜 제한 기능에 `@PreAuthorize("@planChecker.xxx()")` AOP 적용 여부
- [ ] 타 사용자 리소스 직접 접근(IDOR) 방어: `userId` 기반 소유권 검증 여부
  - `GET /vulnerabilities/{id}` — 해당 취약점이 요청자의 세션 소속인지 확인
  - `GET /reports/{id}` — 해당 리포트 소유자 확인
  - `DELETE /projects/{id}` — owner만 가능한지 확인
- [ ] Admin API(`/admin/**`)에 `ROLE_ADMIN` 확인이 필터/컨트롤러 양쪽에서 이중 검증되는가
- [ ] 팀 멤버 역할(owner/admin/viewer)별 권한 매트릭스가 코드에 정확히 반영되는가

---

## 2. 입력 검증 & 출력 인코딩

### 2.1 Request 입력 검증
- [ ] 모든 Request Body DTO에 `@Valid` 어노테이션 적용 여부
- [ ] 문자열 필드: `@NotBlank`, `@Size(max=...)` 설정 여부 (무제한 문자열 입력 방지)
- [ ] 이메일 필드: `@Email` 검증 적용 여부
- [ ] UUID 경로 변수: Spring이 자동 변환 실패 시 400 반환되는가 (SQL Injection 벡터 차단)
- [ ] `targetUrl` (DAST 대상): URL 형식 + 허용된 스킴(https/http)만 허용하는가
- [ ] `fileExtensions` 필터: 허용된 확장자 화이트리스트만 통과하는가
- [ ] `excludePaths`: 경로 트래버설(`../`, `..\\`) 입력 방어 여부

### 2.2 SQL Injection 방어
- [ ] 모든 DB 쿼리가 JPA `@Query`(JPQL) 또는 `PreparedStatement` 사용 여부
- [ ] Native Query 사용 시 파라미터 바인딩(`:param`) 방식 확인 (문자열 연결 금지)
- [ ] 동적 정렬 파라미터(`sort=updatedAt,desc`)에 허용 컬럼 화이트리스트 검증 여부

### 2.3 XSS 방어
- [ ] JSON 응답에서 HTML 특수문자(`<`, `>`, `&`, `"`) 이스케이프 적용 여부
- [ ] 프론트엔드: `dangerouslySetInnerHTML` 사용 시 DOMPurify 등 sanitizer 적용 여부
  - `ChecklistMarkdownService` 결과를 렌더링하는 `ProgressChecklist` 컴포넌트 확인
- [ ] `codeSnippet`, `description` 등 사용자 코드 포함 필드: 렌더링 전 이스케이프 처리 여부

### 2.4 SSRF 방어
- [ ] DAST `targetUrl`에 내부 IP 대역(10.x, 172.16.x, 192.168.x, 127.x, 169.254.x) 차단 여부
- [ ] `targetUrl`에 `file://`, `ftp://`, `gopher://` 스킴 차단 여부
- [ ] DNS Rebinding 공격 방어: DNS 조회 후 IP 재검증 여부

---

## 3. 토큰 & 세션 관리

- [ ] 이메일 인증 토큰: 단일 사용(사용 즉시 무효화) 여부
- [ ] 비밀번호 재설정 토큰: TTL 설정(권장 15분) + 단일 사용 여부
- [ ] GitHub OAuth State 파라미터: Redis TTL 10분 + 사용 즉시 삭제 (ADR-013)
- [ ] 로그인 실패 5회 시 `locked_until = NOW() + 15min` 계정 잠금 구현 여부
- [ ] 계정 잠금 상태 확인이 타이밍 공격에 안전한가 (조건 분기보다 일정 시간 응답 권장)
- [ ] `POST /auth/forgot-password`: 이메일 존재 여부와 무관하게 동일 응답 반환 여부 (계정 열거 방지)
- [ ] SSE 토큰(`?token=...`)이 Access Token과 동일한 유효성 검증을 거치는가
- [ ] 리포트 다운로드 토큰: UUID + TTL 24h, 단일 사용 또는 만료 후 자동 삭제 여부

---

## 4. Rate Limiting & DoS 방어

- [ ] 전역 API Rate Limit: 플랜별 적용 여부 (Free 10/min, Pro 60/min, Team 120/min)
- [ ] Rate Limit 초과 시 `429 Too Many Requests` + `Retry-After` 헤더 반환 여부
- [ ] 응답 헤더에 `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` 포함 여부
- [ ] DAST 실행 Rate Limit: 도메인당 1시간 3회 Redis 카운터 적용 여부
- [ ] `POST /auth/login`: IP 기반 Rate Limit 별도 적용 여부 (Brute Force 방어)
- [ ] `POST /auth/forgot-password`: 이메일 발송 Rate Limit 적용 여부 (이메일 폭탄 방어)
- [ ] `POST /analysis/sessions`: 동일 프로젝트 중복 분석 방지 (`SESSION_ALREADY_RUNNING` 409) 여부
- [ ] DAST 분산 락: Redis `secureai:dast:lock:{domain}` 획득 실패 시 `DAST_LOCK_FAILED` 409 여부
- [ ] 대용량 페이로드 공격 방어: `spring.mvc.pathmatch` + `spring.servlet.multipart.max-file-size` 설정 여부
- [ ] 페이지네이션 `size` 파라미터 최대값 제한(100) 적용 여부

---

## 5. 민감 데이터 처리

### 5.1 암호화 저장 (ADR-009)
- [ ] `users.github_token`: `AesEncryptionConverter` (AES-256-GCM) 적용 여부
- [ ] `exploit_results.payload`, `sandbox_log`: AES-256-GCM 암호화 여부
- [ ] `scan_targets.target_url`: AES-256-GCM 암호화 여부
- [ ] 암호화 키(`SECUREAI_ENCRYPTION_KEY`)가 환경변수로만 주입되고 소스코드에 하드코딩되지 않는가
- [ ] IV(Initialization Vector)가 암호문마다 고유하게 생성되는가 (재사용 금지)

### 5.2 비밀번호
- [ ] Bcrypt rounds=12 이상 설정 여부
- [ ] 비밀번호를 로그에 출력하지 않는가
- [ ] 응답 DTO에 `passwordHash` 필드 노출 여부 확인 (`@JsonIgnore` 또는 별도 DTO)

### 5.3 응답 데이터 최소화
- [ ] `/users/me` 응답에 `github_token` 원문 미포함 여부
- [ ] `/admin/**` 응답에 과도한 내부 정보(스택 트레이스, DB 쿼리) 미포함 여부
- [ ] DAST 결과 응답: `payloadSummary`만 반환, 전체 payload 원문 미노출 여부

### 5.4 전송 보안
- [ ] 운영 환경 전체 HTTPS 강제 적용 (`Strict-Transport-Security` 헤더)
- [ ] 개발 환경에서도 Refresh Token Cookie의 `Secure` 플래그가 비활성화되지 않도록 주의

---

## 6. DAST / Docker 샌드박스 보안

- [ ] DAST 실행 전 `scan_targets.verification_status = 'verified'` 확인 여부 (미검증 도메인 스캔 불가)
- [ ] Docker 컨테이너 생성 시 `--network none` 또는 전용 격리 브릿지 네트워크 사용 여부
- [ ] 컨테이너 메모리 제한 512MB, CPU 0.5 설정 여부
- [ ] 컨테이너 타임아웃 300초 강제 종료 구현 여부
- [ ] `/var/run/docker.sock` 마운트: backend 컨테이너만 접근 가능한 권한 설정 여부
- [ ] DAST 컨테이너 이미지가 정기적으로 업데이트/스캔되는가
- [ ] `exploit_results`: 실행 완료 후 컨테이너 즉시 제거(`docker rm`) 여부
- [ ] DAST 결과 저장 시 AES-256-GCM 암호화 후 DB 저장 여부
- [ ] DAST 작업이 완료/실패 시 Redis 분산 락 해제 여부 (finally 블록 처리)
- [ ] 페이로드 생성 AI 프롬프트에 시스템 외부(인터넷) 접근 경로가 포함되지 않는가

---

## 7. GitHub OAuth & Webhook 보안

### 7.1 GitHub OAuth
- [ ] State 파라미터 CSRF 방어: UUID 생성 → Redis 저장 → 콜백 검증 → 즉시 삭제 (ADR-013)
- [ ] State 불일치 시 즉시 `AUTH_OAUTH_STATE_INVALID` 400 반환 여부
- [ ] GitHub Access Token이 AES-256-GCM으로 암호화 저장되는가
- [ ] OAuth scope가 최소 권한(`repo:read`, `security_events`)으로 제한되는가
- [ ] 콜백 리다이렉트 URL이 허용된 도메인으로만 제한되는가 (Open Redirect 방어)

### 7.2 GitHub Webhook
- [ ] `X-Hub-Signature-256` HMAC-SHA256 서명 검증 적용 여부
- [ ] 서명 검증 실패 시 `GITHUB_WEBHOOK_INVALID` 400 즉시 반환 여부
- [ ] `webhook_secret`이 DB에 해시값으로 저장되는가 (원문 미저장)
- [ ] Webhook 처리가 비동기(`@Async`)로 처리되어 GitHub 재시도 루프 방지 여부
- [ ] `action` 필드 화이트리스트 검증(`opened`, `synchronize`만 처리) 여부

---

## 8. 에러 처리 & 로깅

### 8.1 에러 응답
- [ ] `GlobalExceptionHandler`가 모든 미처리 예외를 잡아 표준 오류 응답으로 변환하는가
- [ ] 500 에러 응답에 스택 트레이스, SQL 쿼리, 내부 경로 등 민감 정보 미포함 여부
- [ ] 개발 환경(`spring.profiles.active=dev`)에서만 상세 에러 노출 여부
- [ ] 에러 코드 열거형(`ErrorCode.java`)에 정의되지 않은 에러 메시지가 직접 노출되지 않는가

### 8.2 감사 로그 (Audit Log)
- [ ] 인증 관련 이벤트 로깅: 로그인 성공/실패, 로그아웃, 비밀번호 변경, 계정 탈퇴
- [ ] 민감 작업 로깅: 취약점 상태 변경(`fixed_by`, `fixed_at`), 플랜 변경, 멤버 권한 변경
- [ ] DAST 실행 로깅: 실행 요청자, 대상 도메인, 실행 시각, 결과 요약
- [ ] 관리자 API 호출 전체 로깅 여부
- [ ] 감사 로그에 비밀번호, 토큰 원문이 포함되지 않는가
- [ ] 감사 로그 파티션: 13개월 이상 데이터 자동 정리 여부 (ADR 스케줄 참고)

### 8.3 민감 정보 로그 마스킹
- [ ] `github_token`, `SECUREAI_ENCRYPTION_KEY` 등이 애플리케이션 로그에 출력되지 않는가
- [ ] SSE 쿼리 파라미터 토큰(`?token=...`)이 액세스 로그에 마스킹 처리되는가
- [ ] 로그 레벨: 운영 환경 `INFO` 이상만 출력, `DEBUG` 로그에 민감 정보 없는가

---

## 9. HTTP 헤더 보안

운영 환경 응답 헤더에 다음이 포함되는지 확인:

| 헤더 | 권장 값 | 확인 |
|------|---------|------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | [ ] |
| `X-Content-Type-Options` | `nosniff` | [ ] |
| `X-Frame-Options` | `DENY` | [ ] |
| `Content-Security-Policy` | API 서버: `default-src 'none'` | [ ] |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | [ ] |
| `Permissions-Policy` | `geolocation=(), microphone=()` | [ ] |
| `Cache-Control` | 인증 응답: `no-store` | [ ] |

- [ ] CORS 설정: 허용 Origin이 `*`(와일드카드)가 아닌 명시적 도메인 목록인가
- [ ] CORS `allowCredentials=true` 시 `allowedOrigins="*"` 조합 사용 안 하는가 (Spring 오류 + 보안 위험)
- [ ] 서버 정보 노출 헤더(`Server`, `X-Powered-By`) 제거 여부

---

## 10. 파일 업로드 & 다운로드 보안

### 10.1 리포트 다운로드
- [ ] 다운로드 URL에 서명 토큰(`?token=UUID`) 필수 적용 여부
- [ ] 토큰 TTL 24시간 경과 후 자동 만료 여부
- [ ] `Content-Disposition: attachment` 헤더 설정 여부 (브라우저 직접 실행 방지)
- [ ] 리포트 파일 경로에 `../` 등 경로 트래버설 인젝션 방어 여부
- [ ] 리포트 저장 디렉토리가 웹 루트 외부에 위치하는가

### 10.2 파일 경로 보안
- [ ] `targetPath` 파라미터로 서버 파일시스템 경로 직접 지정 시 허용 경로 화이트리스트 적용 여부
- [ ] MCP Filesystem 접근 범위가 분석 대상 디렉토리로만 제한되는가

---

## 11. 의존성 & 인프라 보안

### 11.1 의존성 관리
- [ ] `build.gradle.kts`에 알려진 취약점이 있는 라이브러리 버전 사용 여부 (`./gradlew dependencyCheckAnalyze`)
- [ ] `package.json` npm audit 결과 high/critical 취약점 없는가
- [ ] Python `requirements.txt`: `safety check` 결과 이상 없는가
- [ ] DAST 샌드박스 Docker 이미지 정기 취약점 스캔 여부

### 11.2 환경변수 & 시크릿
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는가
- [ ] 소스코드에 API 키, DB 비밀번호 하드코딩 없는가 (GitHub Secret Scanning 활성화 권장)
- [ ] Docker Compose `environment` 섹션에 시크릿 원문이 포함되지 않고 `${VAR}` 참조만 사용하는가
- [ ] 운영 환경: Docker Secret 또는 AWS Secrets Manager 사용 여부 (ADR-009)

### 11.3 인프라
- [ ] PostgreSQL: 운영 환경에서 `ddl-auto=validate`로 전환되었는가 (개발: update, 운영: validate — ADR-011)
- [ ] Redis `requirepass` 설정 여부
- [ ] Docker 네트워크 격리: frontend ↔ postgres 직접 통신 차단 여부
- [ ] 불필요한 포트 외부 노출 없는가 (postgres 5432, redis 6379는 내부망 전용)

---

## 12. OWASP API Top 10 대응 점검

| # | 항목 | 대응 방법 | 확인 |
|---|------|----------|------|
| API1 | Broken Object Level Authorization | 모든 리소스 접근에 소유자 검증 | [ ] |
| API2 | Broken Authentication | JWT + Refresh Rotation + 계정 잠금 | [ ] |
| API3 | Broken Object Property Level Auth | 응답 DTO 필드 최소화, `@JsonIgnore` | [ ] |
| API4 | Unrestricted Resource Consumption | Rate Limit + 페이지네이션 size 제한 | [ ] |
| API5 | Broken Function Level Authorization | `@PreAuthorize` + ROLE 검증 이중화 | [ ] |
| API6 | Unrestricted Access to Sensitive Flows | 이메일/비밀번호 재설정 Rate Limit | [ ] |
| API7 | Server Side Request Forgery | DAST targetUrl 내부 IP/스킴 차단 | [ ] |
| API8 | Security Misconfiguration | 보안 헤더 + CORS 설정 검토 | [ ] |
| API9 | Improper Inventory Management | API 문서 최신화, 미사용 엔드포인트 제거 | [ ] |
| API10 | Unsafe Consumption of APIs | NVD API, GitHub API 응답 검증 | [ ] |

---

## 체크리스트 활용 가이드

### PR 머지 전 필수 확인 항목 (🔴 Critical)
1. **섹션 1** — 인증/인가 전체
2. **섹션 2.2** — SQL Injection 방어
3. **섹션 5.1** — 암호화 저장 여부
4. **섹션 6** — DAST 샌드박스 격리
5. **섹션 7.2** — Webhook 서명 검증

### 릴리스 전 전체 점검 (스프린트 완료 시)
- 이 문서 전체 체크박스 통과 여부 확인
- `14_SECURITY_TEAM_FEATURES.md` 보안 감사 요청

### 도구 연계
- **SAST**: SonarQube 또는 SpotBugs (`./gradlew spotbugsMain`)
- **의존성 취약점**: OWASP Dependency-Check (`./gradlew dependencyCheckAnalyze`)
- **시크릿 스캔**: GitHub Secret Scanning 또는 `trufflehog`
- **DAST (자체 도구)**: SecureAI 자체 분석 실행으로 백엔드 자가 점검 가능

---

*관련 문서: `02_API_DESIGN.md` (API 명세), `00_ARCHITECTURE_DECISIONS.md` (ADR), `14_SECURITY_TEAM_FEATURES.md` (보안팀 기능)*  
*다음 업데이트: Sprint 6 DAST 완성 후 섹션 6 보강 예정*
