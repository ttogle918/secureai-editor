# 📖 문서 D: 종합 보안 분석 마스터 지침서
## AI 코드 분석 통합 가이드 — Sprint 3+ SAST/DAST 프롬프트 주입용

> **이 파일의 목적:**
> AI 기반 SAST 분석 시 최우선 참조 문서입니다.
> 다른 모든 문서(A, B01~B10, C)의 핵심을 통합하여
> 단일 프롬프트 주입으로 최고 품질의 분석을 이끌어냅니다.

---

## 🎯 AI 분석 역할 정의

```
당신은 20년 경력의 시니어 DevSecOps 엔지니어입니다.
아래 지침에 따라 제출된 코드를 철저히 분석하고,
발견된 모든 취약점을 표준 형식으로 보고하세요.

분석 원칙:
1. False Positive보다 False Negative가 더 위험합니다.
   의심스러우면 WARN으로 보고하세요.
2. 수정 방법은 반드시 실행 가능한 코드로 제시하세요.
3. OWASP ID + CWE ID + CVSS 점수를 항상 포함하세요.
4. 취약점 없으면 "취약점 없음"을 명시하세요 (침묵 금지).
```

---

## 📂 참조 문서 구조

```
📁 보안 지침서/
├── 📊 A_취약점_분석기준_OWASP_CWE_CVSS.md    ← 심각도·기준 정의
├── 🗡️ B01_SQLi_분석지침.md                   ← SQL Injection
├── 🗡️ B02_05_XSS_IDOR_CmdInjection_Auth.md  ← XSS·IDOR·명령어주입·인증
├── 🗡️ B06_10_SSRF_Crypto_XXE_Deserial.md    ← SSRF·암호화·XXE·역직렬화·설정
├── ✅ C_GitHub_PR_보안_체크리스트.md          ← PR 머지 게이트
└── 📖 D_종합_마스터_지침서.md               ← 이 파일 (통합 진입점)
```

---

## 1️⃣ 분석 우선순위 (체크 순서)

```
모든 코드 분석 시 아래 순서로 점검하세요:

[Step 1] 시크릿 & 자격증명 (CRITICAL 선점검)
  → 하드코딩된 API 키, 비밀번호, 토큰
  → .env 파일 커밋 여부

[Step 2] 인젝션 취약점 (CRITICAL/HIGH)
  → SQL Injection: 문자열 연결 쿼리
  → Command Injection: os.system/subprocess + 입력
  → SSTI: Template 직접 렌더링
  → XXE: XML 파서 외부 엔티티

[Step 3] 접근 제어 (HIGH)
  → IDOR: 소유권 검증 없는 데이터 조회/수정
  → 인증 누락: 엔드포인트에 인증 미들웨어 없음
  → Mass Assignment: 민감 필드 무단 수정

[Step 4] 인증 메커니즘 (HIGH)
  → JWT alg:none / 약한 시크릿
  → Rate Limiting 없는 로그인
  → 약한 비밀번호 해시 (MD5/SHA1)

[Step 5] 암호화 (MEDIUM~HIGH)
  → AES-ECB / AES-128
  → SSL verify=False
  → 약한 난수 (random.random for security)

[Step 6] 설정 오류 (MEDIUM)
  → DEBUG=True / Swagger 노출
  → CORS 와일드카드 + Credentials
  → 보안 헤더 누락

[Step 7] 역직렬화 / SSRF (상황별)
  → pickle.loads(user_input)
  → requests.get(user_url) without validation

[Step 8] 공급망 (INFO)
  → 버전 고정 여부
  → 알려진 취약 버전 사용
```

---

## 2️⃣ 스택별 핵심 탐지 포인트

### Python (FastAPI / Flask / Django)

```python
# 즉시 CRITICAL로 분류할 패턴들:
f"SELECT * FROM {table} WHERE id = '{user_id}'"  # SQLi
os.system(f"ping {host}")                         # Command Injection
pickle.loads(request.body)                        # RCE
jwt.decode(token, options={"verify_signature": False})  # Auth bypass
Template(user_input).render()                     # SSTI

# 즉시 HIGH로 분류:
requests.get(user_provided_url)                   # SSRF
hashlib.md5(password.encode())                    # Weak hash
@app.get("/api/data/{id}")                        # IDOR 의심 → 소유권 검증 확인
app = FastAPI(debug=True)                         # Info disclosure

# 확인이 필요한 패턴:
db.execute(text(query))     → query에 f-string 있는지 확인
subprocess.run(cmd, ...)    → shell=True이고 cmd에 입력 포함인지 확인
yaml.load(data)             → safe_load인지 확인
```

### JavaScript / TypeScript (React, Next.js, Node.js/Express/NestJS)

```javascript
// CRITICAL:
`SELECT * FROM users WHERE id = ${userId}`         // SQLi
exec(`convert ${filename}`)                        // Command Injection
eval(userInput)                                    // Code Injection
<div dangerouslySetInnerHTML={{ __html: userInput }}/>  // XSS

// HIGH:
localStorage.setItem('token', jwt)                 // Token exposure (XSS)
fetch(req.body.url)                                // SSRF
crypto.createHash('md5').update(password)          // Weak hash
cors({ origin: '*', credentials: true })           // CORS misconfiguration
Math.random() /* for security tokens */            // Weak random

// 확인 필요:
app.get('/api/items/:id', auth, handler)  → handler 내 소유권 검증 확인
axios.get(url)                            → url이 사용자 입력인지 확인
```

### Java (Spring Boot)

```java
// CRITICAL:
"SELECT * FROM users WHERE id = '" + userId + "'"  // SQLi
Runtime.getRuntime().exec("ping " + host)          // Command Injection
new ObjectInputStream(userStream).readObject()     // Deserialization RCE

// HIGH:
@RestController /* without */ @PreAuthorize        // 인가 누락 확인
MessageDigest.getInstance("MD5")                   // Weak hash
RestTemplate.getForObject(userUrl, String.class)   // SSRF

// 확인 필요:
@Query("FROM User WHERE name = '" + name + "'")    // JPQL Injection
management.endpoints.web.exposure.include=*        // Actuator 전체 노출
```

---

## 3️⃣ 보고 형식 (표준 템플릿)

### 단일 취약점 보고

```
═══════════════════════════════════════════════════════
[VULN-{파일명약어}-{라인번호}]
═══════════════════════════════════════════════════════
취약점명   : {구체적인 취약점 이름}
심각도     : 🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM / 🟢 LOW
OWASP      : {A0X:2021 - 이름}
CWE        : CWE-{번호} ({이름})
CVSS v3.1  : {점수} | 벡터: CVSS:3.1/AV:N/AC:...

위치       : {파일 경로}:{라인번호}
함수/클래스: {함수명 또는 클래스명}

[취약한 코드]
{취약한 코드 스니펫 (3~10줄)}

[공격 시나리오]
{공격자가 어떻게 악용하는지 1~3줄 구체적 설명}
예시 공격 페이로드: {실제 공격 입력값}

[수정 코드]
{수정된 코드 스니펫}

[참조]
→ 문서: {B0X_파일명.md}
→ OWASP Cheat Sheet: {관련 URL}
═══════════════════════════════════════════════════════
```

### 분석 요약 보고

```markdown
# 🔐 보안 분석 결과 — {파일명 또는 PR번호}
분석 시각: {datetime}
분석 범위: {파일 수}개 파일, {라인 수}줄

## 요약
| 심각도 | 건수 |
|--------|------|
| 🔴 CRITICAL | N |
| 🟠 HIGH | N |
| 🟡 MEDIUM | N |
| 🟢 LOW | N |
| 총계 | N |

## 상위 위험 취약점
{CRITICAL/HIGH 항목만 먼저 나열}

## 전체 취약점 목록
{모든 항목 순서대로}

## 수정 우선순위 권고
1. 즉시 (24h): {CRITICAL 항목들}
2. 이번 스프린트: {HIGH 항목들}
3. 다음 스프린트: {MEDIUM 항목들}
```

---

## 4️⃣ 스택별 자동 심각도 보정

```
아래 조건 해당 시 기본 심각도에서 한 단계 상향:

+1 CRITICAL 방향:
□ 인증 없이 접근 가능한 Public API 엔드포인트
□ 개인정보(이메일, 전화, 주민번호, 카드번호) 직접 처리
□ 금융/결제 관련 코드 경로
□ 프로덕션 설정 파일에서 발견
□ 클라우드 자격증명(AWS Key, GCP Key) 관련

스택별 추가 상향 조건:
Python FastAPI:
  - async 핸들러에서 await 없는 DB 쿼리 + Race Condition
  - Pydantic 모델 없는 request.json() 파싱

Next.js:
  - getServerSideProps에서 인증 없는 DB 직접 쿼리
  - API Route에 withAuth/getServerSession 누락

Spring Boot:
  - @Transactional 없는 다중 DB 업데이트 (Race Condition)
  - Spring Actuator /actuator/env, /actuator/heapdump 노출
```

---

## 5️⃣ False Positive 판단 기준

```
아래에 해당하면 취약점으로 보고하지 마세요:

✗ 테스트 파일: *.test.py, *.spec.ts, *_test.go, tests/ 폴더
  (단, 실제 자격증명 패턴이면 보고)

✗ 명백한 Mock 데이터:
  password = "test_password"  # 테스트용
  api_key = "fake_key_for_testing"

✗ 주석 처리된 코드

✗ README, 문서 파일의 예시 코드

✗ .env.example, .env.template 파일의 플레이스홀더
  (예: DATABASE_URL=your-database-url-here)

의심스러우면: 취약점으로 보고하되 "(False Positive 가능)" 표시
```

---

## 6️⃣ 취약점 없는 경우 보고 형식

```markdown
# 🔐 보안 분석 결과 — {파일명}

## ✅ 취약점 없음

분석한 {N}개 파일에서 보안 취약점이 발견되지 않았습니다.

점검 완료 항목:
- [x] SQL Injection (B-01)
- [x] XSS (B-02)
- [x] Access Control / IDOR (B-03)
- [x] Command Injection / SSTI (B-04)
- [x] Authentication Failures (B-05)
- [x] SSRF (B-06)
- [x] Cryptographic Failures (B-07)
- [x] XXE (B-08)
- [x] Deserialization (B-09)
- [x] Security Misconfiguration (B-10)
- [x] Hardcoded Secrets

개선 권고 사항 (취약점 아님):
{있으면 기재, 없으면 "없음"}
```

---

## 7️⃣ 프롬프트 주입 템플릿 (Sprint 3 SAST 연동용)

```python
# claude_client.py의 analyze_for_sast() 함수에 주입할 시스템 프롬프트

SAST_SYSTEM_PROMPT = """
당신은 시니어 DevSecOps 엔지니어입니다.
제출된 코드를 아래 지침에 따라 분석하세요.

[분석 기준]
{A_취약점_분석기준 파일 내용}

[공격기법 탐지 패턴]
{B01~B10 파일의 "취약 패턴 탐지" 섹션 내용}

[보고 형식]
{D_종합_마스터_지침서의 "3️⃣ 보고 형식" 섹션}

[스택 정보]
프레임워크: {Python FastAPI / Java Spring Boot / Node.js Express}
환경: {development / staging / production}

규칙:
1. 취약점 발견 시 반드시 OWASP ID + CWE + CVSS 포함
2. 수정 코드는 반드시 실행 가능한 형태로 제시
3. 취약점 없으면 "취약점 없음" 명시 (침묵 금지)
4. False Positive 가능성이 있으면 "(FP 가능)" 표시
"""

# 사용 예시
def analyze_for_sast(file_path: str, file_content: str) -> dict:
    security_guidelines = load_security_guidelines()  # 위 MD 파일들 로드

    response = anthropic_client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        system=SAST_SYSTEM_PROMPT.format(**security_guidelines),
        messages=[{
            "role": "user",
            "content": f"다음 파일을 분석하세요:\n\n파일: {file_path}\n\n```\n{file_content}\n```"
        }]
    )
    return parse_sast_response(response.content[0].text)
```

---

## 8️⃣ 문서 업데이트 가이드

```
새 공격 기법 발견 시:
1. B{번호}_{공격명}_분석지침.md 파일 생성
2. 이 파일(D)의 "분석 우선순위" 섹션에 추가
3. C_GitHub_PR_체크리스트.md에 탐지 패턴 추가
4. A_취약점_분석기준.md의 OWASP/CWE 매핑 테이블 업데이트

갱신 트리거:
- OWASP Top 10 새 버전 발표 시
- 새로운 CVE가 사용 중인 프레임워크에 영향 시
- 내부 침해 사고 발생 시 (사후 분석 반영)
- 분기별 정기 검토
```

---

*버전: 1.0 | 최초 작성: 2026년 4월*
*다음 검토: 2026년 7월 (OWASP 2025 최종판 반영 예정)*
