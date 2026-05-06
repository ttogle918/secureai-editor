# ✅ 문서 C: GitHub PR 보안 체크리스트
## PR 머지 전 필수 보안 게이트 — Sprint 5 GitHub 기반 점검용

> **AI 사용 지침:** PR 코드 리뷰 시 이 체크리스트를 기준으로
> 각 항목을 자동 점검하고, 미통과 항목은 PR 코멘트로 리포트하세요.
> BLOCK 항목이 하나라도 있으면 머지를 차단하세요.

---

## 🚦 게이트 3단계

```
🔴 BLOCK  — 머지 절대 불가. 즉시 수정 필요.
🟡 WARN   — 수정 권고. 리뷰어 승인 시 예외 가능.
🟢 INFO   — 개선 권고. 머지 차단 안 함.
```

---

## 1️⃣ 시크릿 & 자격증명 (BLOCK)

```
□ [BLOCK] 코드에 API 키, 비밀번호, 토큰 하드코딩 없음
  탐지 패턴:
  - /(?:password|passwd|pwd)\s*=\s*['"][^'"]{4,}/i
  - /(?:api_key|apikey|api-key)\s*=\s*['"][^'"]{8,}/i
  - /(?:secret|token)\s*=\s*['"][^'"]{8,}/i
  - AWS: AKIA[0-9A-Z]{16}
  - GitHub: ghp_[a-zA-Z0-9]{36}
  - Slack: xox[baprs]-[0-9a-zA-Z]{10,}
  예외: *.test.py, *.spec.ts, README.md의 예시 코드

□ [BLOCK] .env 파일 미커밋
  체크: .env, .env.production, .env.local이 staged files에 없음

□ [BLOCK] 비밀키 / PEM 파일 미커밋
  체크: *.pem, *.key, *.p12, *.pfx 파일 없음

□ [BLOCK] DB 연결 문자열 하드코딩 없음
  탐지: postgresql://, mysql://, mongodb:// + 자격증명 포함
```

---

## 2️⃣ 인증 & 인가 (BLOCK / WARN)

```
□ [BLOCK] 신규 API 엔드포인트에 인증 미들웨어 적용
  Python: Depends(get_current_user) 존재
  Node.js: authMiddleware 적용
  Java: @PreAuthorize 또는 SecurityConfig에 포함
  Next.js: getServerSession() 또는 withAuth() 적용

□ [BLOCK] 데이터 조회/수정 시 소유권 검증 (IDOR 방지)
  체크: .filter(Model.user_id == current_user.id) 패턴 존재
  체크: WHERE user_id = ? 파라미터 바인딩 존재

□ [WARN] 신규 관리자 기능에 역할 검증
  Python: require_role("admin") 또는 동등한 의존성
  Java: @PreAuthorize("hasRole('ADMIN')")

□ [WARN] JWT 변경 시 알고리즘 명시적 지정
  체크: algorithms=["HS256"] 또는 고정 알고리즘 사용
  체크: alg:none 허용 코드 없음
```

---

## 3️⃣ 입력 검증 (BLOCK / WARN)

```
□ [BLOCK] SQL 쿼리 문자열 연결 없음
  탐지 (Python): f"SELECT.*{", "SELECT.*" + , "SELECT.*%s" % 
  탐지 (JS): `SELECT.*${`, "SELECT.*" + 
  탐지 (Java): "SELECT.*" + variable

□ [BLOCK] 사용자 입력의 OS 명령어 직접 실행 없음
  탐지: os.system(f"...", subprocess.run(user_input, shell=True
  탐지: exec(user_input), eval(user_expression)

□ [WARN] 신규 엔드포인트에 Pydantic/Zod/Bean Validation 적용
  Python: 파라미터가 BaseModel 타입 또는 Query/Path 타입 힌트
  TypeScript: zod.parse() 또는 class-validator 데코레이터
  Java: @Valid, @NotNull, @Size 등 Bean Validation

□ [WARN] dangerouslySetInnerHTML 신규 사용 없음
  체크: dangerouslySetInnerHTML이 있으면 → DOMPurify 적용 확인

□ [WARN] 외부 URL 요청 시 화이트리스트 검증 존재
  체크: requests.get(url) / fetch(url) / axios.get(url) 앞에
        URL 검증 함수 호출 확인
```

---

## 4️⃣ 암호화 & 데이터 보호 (BLOCK / WARN)

```
□ [BLOCK] 비밀번호를 MD5/SHA1/SHA256 단독 해시 없음
  탐지: hashlib.md5(password, hashlib.sha1(password
  탐지 (JS): createHash('md5').update(password
  올바른 사용: passlib argon2, bcrypt, scrypt

□ [WARN] AES-128 신규 사용 없음 (AES-256 권장)
  탐지: os.urandom(16) 키로 AES 사용
        AES.new(key, ...) where len(key) == 16

□ [WARN] SSL 검증 비활성화 없음
  탐지: verify=False, ssl=False, checkCertificate=false
  탐지: NODE_TLS_REJECT_UNAUTHORIZED=0

□ [WARN] 민감 데이터 로그 출력 없음
  탐지: logger.*/print/console.log + password, token, secret, ssn
  탐지: logging.info(f"...{password}...")
```

---

## 5️⃣ 의존성 & 공급망 (WARN)

```
□ [WARN] 신규 의존성 추가 시 취약점 확인
  Python: pip-audit로 신규 패키지 스캔
  Node.js: npm audit에서 HIGH 이상 없음

□ [WARN] requirements.txt / package.json 정확한 버전 고정
  Python: == 버전 고정 (>= 금지)
  Node.js: ^ 없이 정확한 버전 권장

□ [WARN] GitHub Actions workflow 변경 시 SHA 고정 확인
  탐지: uses: actions/xxx@main 또는 @master (브랜치 참조)
  올바른 형식: uses: actions/checkout@11bd71901bbe...
```

---

## 6️⃣ 설정 & 인프라 (WARN / INFO)

```
□ [WARN] DEBUG 모드 프로덕션 설정 없음
  탐지: debug=True, DEBUG=True (프로덕션 설정 파일)
  탐지: app.run(debug=True)

□ [WARN] Swagger/API Docs 프로덕션 노출 없음
  체크: docs_url="/docs" 가 환경 변수로 조건부인지 확인

□ [WARN] CORS 와일드카드 + Credentials 동시 설정 없음
  탐지: allow_origins=["*"] AND allow_credentials=True

□ [INFO] 보안 헤더 미들웨어 존재
  체크: X-Content-Type-Options, X-Frame-Options 헤더 설정

□ [INFO] 에러 핸들러 스택 트레이스 미노출
  체크: exception handler에서 traceback을 클라이언트에 반환하지 않음
```

---

## 7️⃣ 로깅 & 감사 (INFO)

```
□ [INFO] 인증 성공/실패 이벤트 로깅
□ [INFO] 민감 API 접근 로깅 (관리자 기능 등)
□ [INFO] 로그에 요청 ID 포함 (추적 가능성)
□ [INFO] 개인정보(PII)가 로그에 마스킹 처리
```

---

## 8️⃣ AI 자동 PR 코멘트 형식

```markdown
## 🔐 보안 자동 검토 결과

### 🔴 BLOCK (머지 불가) — N건
| # | 파일 | 라인 | 내용 | 수정 방법 |
|---|------|------|------|-----------|
| 1 | src/api/users.py | 47 | SQL 문자열 연결 | ORM 또는 파라미터 바인딩 사용 |

### 🟡 WARN (수정 권고) — N건
| # | 파일 | 라인 | 내용 | 권고 사항 |
|---|------|------|------|-----------|
| 1 | src/api/orders.py | 23 | AES-128 사용 | AES-256으로 업그레이드 |

### 🟢 INFO (개선 사항) — N건
- [INFO] /api/products 엔드포인트에 Rate Limiting 추가 권고

---
*검토 기준: A_취약점_분석기준.md + B01~B10 공격기법 가이드*
*자동 검토 도구: Semgrep p/owasp-top-ten, Bandit, Gitleaks*
```

---

## 9️⃣ 예외 처리 프로세스

```
BLOCK 항목 예외 신청 시:
1. PR 코멘트에 예외 사유 명시
2. 담당 보안 리뷰어 태그 (@security-reviewer)
3. 임시 예외 승인 + 이슈 티켓 생성 (7일 내 수정)
4. 예외 승인 없이 BLOCK 항목 머지 절대 불가

WARN 항목 예외:
1. PR 설명에 예외 사유 한 줄 기재
2. 리뷰어 1명 승인으로 머지 가능
```

---

*Sprint 5 GitHub 자동화 연동 시 이 파일을 Semgrep custom rule + GitHub Actions에 연결*
*갱신: 새 공격 기법 발견 시 B** 파일 추가 후 이 파일 탐지 패턴 업데이트*
