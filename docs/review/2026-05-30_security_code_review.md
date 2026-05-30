# SecureAI — 전체 코드 보안·정확성 리뷰 (2026-05-30)

> 리뷰어: Claude (claude-opus-4-8) · 요청자: ttogle918
> 대상: 전체 모노레포 (backend 304 / ai_engine 62 / frontend 94 / mcp_server 13 파일)
> 방법: 신뢰 경계(인증·암호화·내부 API·경로검증·웹훅·접근통제) 우선 직접 정독.
> 브랜치: `claude/project-structure-overview-a75HC`

---

## 1. 요약

| 구분 | 건수 |
|------|------|
| 🔴 High (수정 완료) | 2 |
| 🟠 Medium (미수정, 권고) | 5 |
| 🟡 Low / 참고 | 4 |
| ✅ 양호 확인 | 8 |

이번 작업에서 **High 2건(#1 IDOR, #2 Webhook fail-open)을 코드 수정 + 테스트 갱신**했고,
나머지는 권고 사항으로 정리했다.

> ⚠️ **컴파일 검증 한계**: 이 실행 환경에는 Spring Boot 4.0.5 Gradle 플러그인/의존성이
> 캐시되어 있지 않아(네트워크 차단) `./gradlew`로 컴파일 검증을 하지 못했다.
> 변경분은 임포트·메서드 시그니처·`ErrorCode` 상수·엔티티 getter를 수동 대조해 정합성을 확인했다.
> 머지 전 CI(또는 의존성 있는 환경)에서 `./gradlew compileTestJava test` 1회 실행 권장.

---

## 2. 수정 완료 (High)

### #1 IDOR — 세션이 프로젝트에 속하는지 미검증

- **위치**: `compliance/service/ComplianceMappingService.java`, `analysis/service/VulnerabilityQueryService.java`
- **문제**: `getComplianceReport()`가 `projectId`에 대한 멤버십만 확인하고, 취약점은
  `sessionId` 기준으로 조회했다. 세션이 그 프로젝트 소속인지 검증이 없어,
  A 프로젝트 멤버가 `/api/v1/projects/{A}/sessions/{타프로젝트 세션}/compliance` 로
  **다른 테넌트 세션의 OWASP 취약점 분포를 열람**할 수 있었다.
  코드베이스 전체에 `session.project == projectId` 검증이 한 곳도 없었다.
- **수정**:
  - `VulnerabilityQueryService`에 `findOwaspCodesBySession(userId, projectId, sessionId)` 신설.
    세션 로드 → **세션-프로젝트 바인딩 검증(불일치 시 `SESSION_NOT_FOUND`로 존재 비노출)** →
    멤버십 검증(`PROJECT_ACCESS_DENIED`) → OWASP 코드 반환.
  - 안전하지 않던 `findOwaspCodesBySessionId(sessionId)`는 제거.
  - `ComplianceMappingService`는 신규 메서드로 위임(자체 멤버십 검사·미사용 `ProjectService` 의존 제거).
- **테스트**:
  - `VulnerabilityQueryServiceTest`에 바인딩 차단/비멤버/정상 케이스 4건 추가.
  - `ComplianceMappingServiceTest`를 위임 구조에 맞게 갱신(접근거부 예외 전파 검증 포함).

### #2 GitHub Webhook 서명 검증 fail-open

- **위치**: `config/GitHubConfig.java` (`webhookMac` 빈)
- **문제**: `GITHUB_WEBHOOK_SECRET` 미설정 시 `webhookMac`이 `null`이 되고,
  `GitHubWebhookService.validateSignature()`가 검증을 건너뛰고 통과시켰다.
  `.env.example`에서 이 값은 기본 공란 → **운영에서 누락하면 누구나 위조 웹훅으로
  PR 분석 트리거/`pr_review_history` 오염** 가능. (HMAC 비교 자체는 `MessageDigest.isEqual` 상수시간으로 정상)
- **수정**: `validateSignature()`(수정 금지 주석)를 건드리지 않고, **빈 생성 시점에서 처리**.
  `prod` 프로파일 + 시크릿 공란이면 **부팅 실패(fail-fast)** 시켜 무인증 웹훅을 원천 차단.
  dev/local/test는 기존처럼 경고 후 스킵 허용(로컬 개발 편의 유지).

---

## 3. 미수정 — 권고 (Medium)

### #3 `/api/workspace/**` 전체 무인증 + 사용자 바인딩 없음
`SecurityConfig`에서 `permitAll`. 업로드한 소스코드를 `workspaceId`만 알면 누구나
tree/file/export로 읽을 수 있다(소유자 바인딩 없음). 무인증 업로드라 저장소 고갈 DoS 표면도 있음.
- 권고: 인증 요구 또는 세션 사용자와 workspace 바인딩, 업로드 rate limit.
- 참고: 문서가 약속한 `WORKSPACE_PATH_TRAVERSAL` 검증은 코드에 없으나, 저장이 Redis Hash
  필드 조회라 파일시스템 traversal로는 악용되지 않는다(잘못된 경로는 단순 null).

### #4 `/api/v1/sbom/components` POST 무인증
`SecurityConfig`에서 `permitAll`. 인증 없이 의존성 파싱 로직을 호출 가능(DoS/공격 표면).
- 권고: 인증 필요 여부 재검토.

### #5 MCP 시크릿 차단이 `.env`만
`mcp_server/src/path_validator.ts`, `file_filter.ts`. 차단 대상이 사실상 `.env` 하나.
`.ssh/id_rsa`, `*.pem`, `*.key`, `.git/config`, `.npmrc`, `credentials` 등은 AI가 그대로 읽는다.
`file_filter.ts`는 점 없는 파일명(`Dockerfile`, `id_rsa`)에서 `lastIndexOf('.') = -1 → substring(-1)`로
확장자를 오인해 차단을 회피한다.
- 권고: 시크릿 파일명/확장자 거부목록 확장 + 확장자 추출 로직 수정.

### #6 AI Engine 무인증 OPEN 경로
`ai_engine/api/middleware/internal_key_auth.py`. `/docs`,`/openapi.json`,`/redoc` 무인증
(내부 API 스키마 노출), `/agent/dast/logs/*` SSE 무인증. compose에선 `expose:8000`(내부 전용)이라
"브라우저 직접 구독" 주석과 모순 → 의도/망 구성 정합 필요. (키 비교는 `compare_digest` 정상)
- 권고: 운영에서 `/docs` 비활성화, DAST 로그 스트림 인증 또는 게이트웨이 경유.

### #7 Backend 내부키 비교가 비상수시간
`global/security/InternalKeyAuthFilter.java` — `provided.equals(expectedKey)` (timing attack).
Python 쪽은 `compare_digest`인데 불일치.
- 권고: `MessageDigest.isEqual(...)`로 통일.

---

## 4. Low / 참고

- **#8 컴플라이언스 A04/A08 매핑 누락**: Insecure Design·Software/Data Integrity 취약점은
  리포트에서 조용히 제외 → 그 카테고리만 있으면 "완전 준수"로 오인. (`ComplianceMappingService` 매핑 테이블)
- **#9 `VulnerabilityQueryService.countBySeverity/countByFilePath(sessionId)`**: `existsById`만 확인하고
  멤버십 미검증 — 단, **현재 호출하는 컨트롤러가 없는 미사용 메서드**라 악용 불가. 향후 엔드포인트
  연결 시 멤버십 검증 추가 필요(잠재 위험).
- **#10 GitHub Webhook 기능 대부분 스텁**: `resolveProjectId()`=`UUID(0,0)` 고정,
  `extractInstallationToken()`=`""` 고정, AI 분석 연결 미구현. 기능 미완성(보안 아님).
- **#11 DAST executor `follow_redirects=True`**: `sqli_executor.py` 등에서 리다이렉트 추종.
  SSRF 증폭 여지가 있으나 백엔드 `DomainVerificationService` 도메인 소유권 검증으로 게이트됨. 노트 수준.

---

## 5. 양호 확인 (잘 된 부분)

1. **프론트 토큰 처리**(`lib/api/client.ts`): accessToken 메모리 전용, refresh는 httpOnly 쿠키,
   `_refreshing` 프라미스 디듀프 + `_retry`로 401 무한루프/리프레시 폭주 방지. localStorage엔 `user`만.
2. **AnalysisController**: 전 엔드포인트 `@AuthenticationPrincipal userId` + `getSession(userId, sessionId)`
   게이팅, SSE 구독 전에도 인증 확인.
3. **컴플라이언스 OWASP 포맷 정규화**(`extractOwaspCode`)로 `"A03:2021"`↔`"A03"` 불일치 방지.
4. **도메인 격리**: 타 도메인 Repository 직접 주입 대신 `VulnerabilityQueryService` 경유.
5. **Webhook HMAC 비교**: `MessageDigest.isEqual` 상수시간(시크릿 설정 시).
6. **ShedLock**: 스케줄 Job 10개 전부 `@SchedulerLock` 적용 → 중복 실행 방지.
7. **다운로드 토큰**: Report/SecurityDoc 토큰은 122비트 SecureRandom(UUID) + 만료 + 경로검증
   (`filePath.startsWith(BASE_DIR)` Path Traversal 방어).
8. **AI 출력 파싱**(`response_parser.py`): `json.loads`만 사용(`eval`/`literal_eval` 없음).
   프론트엔드에 `dangerouslySetInnerHTML`/`innerHTML`/`eval` 싱크 없음.

---

## 6. 커버리지 / 한계

- 라인 단위로 정독: 인증·내부키·웹훅·컴플라이언스·워크스페이스·MCP 경로검증·DAST 실행·토큰·스케줄러.
- 표본 점검(grep+발췌): 나머지 도메인 컨트롤러/서비스.
- **미정독 영역**(후속 권장): organization/team 초대 권한 경계, dashboard 집계 쿼리 IDOR,
  admin 엔드포인트 ROLE 검증 전수, ai_engine LangGraph 노드별 예외/리소스 누수,
  android 클라이언트, frontend 라우트 가드 전수.

---

*이 리뷰는 2026-05-30 시점 코드 기준이며, #1·#2 수정은 동일 커밋에 포함된다.*

---

## 부록 A — 2차 작업: Medium 수정 + 추가 감사 (2026-05-30, 동일 일자)

### A.1 Medium 권고 추가 수정 (#4·#5·#6·#7)

| # | 항목 | 처리 |
|---|------|------|
| #4 | SBOM 저장 엔드포인트 무인증 | **수정 완료** |
| #5 | MCP 시크릿 차단 미흡 + 확장자 추출 버그 | **수정 완료** |
| #6 | AI Engine OpenAPI/문서 무인증 노출 | **수정 완료** |
| #7 | Backend 내부키 비상수시간 비교 | **수정 완료** |
| #3 | 워크스페이스 무인증 | **보류** (사유 아래) |

- **#4**: `POST /api/v1/sbom/components`는 주석상 "X-Internal-Key 인증"이라 했으나 실제로는
  `/api/v1/internal/` 경로가 아니어서 `InternalKeyAuthFilter` 보호를 받지 못하고 `permitAll`인
  **완전 무인증** 상태였다(누구나 임의 세션/프로젝트에 SBOM 컴포넌트 주입 가능).
  엔드포인트를 `POST /api/v1/internal/sbom/components`로 이전(`SbomController`),
  `SecurityConfig`의 구 `permitAll` 매처 제거, AI Engine `_SBOM_SAVE_PATH`도 동일 경로로 변경.
  이제 `InternalKeyAuthFilter`가 `X-Internal-Key`를 검증한다. (AI Engine은 이미 헤더 전송 중)
- **#5**: `path_validator.ts`에 시크릿 차단 확장 — `.npmrc/.netrc/.pgpass/id_rsa` 등 파일명,
  `.pem/.key/.p12/.pfx/.keystore/.jks` 등 확장자, `.ssh/.aws/.gnupg/.kube/.docker` 디렉터리,
  `.git` 내부를 거부. `file_filter.ts`의 확장자 추출 버그(점 없는 파일명에서 `substring(-1)`)를
  디렉터리 구분자 인식 + dotfile 처리하는 `extractExtension()`으로 교체.
- **#6**: `main.py`의 FastAPI 생성 시 `openapi_url`을 debug일 때만 노출하도록 변경(`redoc_url`/`docs_url`은
  이미 비-debug에서 비활성). 운영에서 `/openapi.json`·`/docs`·`/redoc` 모두 비활성화되어 내부 API 명세 노출 차단.
- **#7**: `InternalKeyAuthFilter`의 `provided.equals(expectedKey)`를 `MessageDigest.isEqual` 기반
  상수시간 비교로 교체(AI Engine 측 `secrets.compare_digest`와 동작 일치).

#### #3 보류 사유
`/api/workspace/**` 무인증은 `02_API_DESIGN_V5`에 **명시된 계약**("인증을 요구하지 않는다")이며,
프론트엔드 업로드 흐름과 직접 얽혀 있다. 인증 강제로 전환하면 문서화된 API 계약과 클라이언트
동작을 동시에 바꿔야 하므로(파괴적 변경), **제품 의사결정이 필요**하다고 보아 이번 코드 변경에서 제외했다.
권고: (a) 세션 사용자와 `workspaceId` 바인딩 + 인증 요구, 또는 (b) 업로드 rate limit + workspaceId 엔트로피 강화.

### A.2 추가 감사 결과 (미정독 영역 일부)

| 영역 | 결과 |
|------|------|
| Admin 엔드포인트 | ✅ `AdminController` 전 메서드 `@PreAuthorize("@adminGuard.check(authentication)")` |
| 대시보드(프로젝트) | ✅ `DashboardQueryService`가 `projectService.isMember` 검증(`PROJECT_ACCESS_DENIED`) |
| 대시보드(팀) | ✅ `TeamDashboardService.verifyTeamMember` 검증(`ORG_ACCESS_DENIED`) |
| 조직 변경 작업 | ✅ `OrganizationController` 변경 계열에 `@PreAuthorize("@orgGuard.isAdminOrAbove(...)")` |
| 초대 GET `permitAll` | 토큰 기반 수락 링크(표준 패턴). 단 `GET /api/v1/invitations/{token}`이 인증 없이 `orgId/projectId/email/role/expiresAt`를 반환 → 토큰 노출 시 초대 이메일 등 메타 노출(경미). 토큰 추측불가 전제하에 허용 가능, 필요 시 email 마스킹 권장 |

> organization/team/admin 권한 경계는 정독 결과 모두 가드(@adminGuard/@orgGuard/멤버십 검증)로 보호됨을 확인했다.
> 후속 권장: ai_engine LangGraph 노드별 예외/리소스 누수, android 클라이언트, frontend 라우트 가드 전수.

*2차 작업의 코드 변경은 별도 커밋으로 추가된다.*

