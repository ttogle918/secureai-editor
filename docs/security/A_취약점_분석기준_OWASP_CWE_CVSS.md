# 📊 문서 A: 취약점 분석 기준 지침서
## OWASP Top 10 매핑 · CWE 참조 · CVSS v3.1 · 심각도 정의

> **AI 사용 지침:** 이 파일은 코드 보안 분석 시 판단 기준으로 사용합니다.
> 취약점 발견 시 반드시 이 기준에 따라 심각도를 분류하고,
> OWASP ID + CWE ID + CVSS 점수를 함께 보고하세요.

---

## 1️⃣ 심각도 4단계 정의

| 등급 | CVSS v3.1 | 의미 | 조치 기한 |
|------|-----------|------|-----------|
| 🔴 CRITICAL | 9.0 ~ 10.0 | 원격 코드 실행, 전체 시스템 장악 가능 | 즉시 (24시간 이내) |
| 🟠 HIGH | 7.0 ~ 8.9 | 인증 우회, 대규모 데이터 탈취 가능 | 48시간 이내 |
| 🟡 MEDIUM | 4.0 ~ 6.9 | 부분적 정보 노출, 조건부 악용 가능 | 1주일 이내 |
| 🟢 LOW | 0.1 ~ 3.9 | 악용 조건 복잡, 영향 범위 제한적 | 다음 릴리즈 |
| ⚪ INFO | 0.0 | 취약점 아님, 개선 권고 사항 | 백로그 |

---

## 2️⃣ OWASP Top 10 (2021) + CWE 매핑 전체 표

| OWASP ID | 취약점명 | 핵심 CWE | CVSS 범위 | 코드 레벨 여부 |
|----------|----------|----------|-----------|----------------|
| A01 | Broken Access Control | CWE-284, CWE-285, CWE-639 | 6.5~9.8 | ✅ 코드 |
| A02 | Cryptographic Failures | CWE-311, CWE-327, CWE-328 | 5.9~9.1 | ✅ 코드 |
| A03 | Injection | CWE-89, CWE-79, CWE-78 | 7.5~10.0 | ✅ 코드 |
| A04 | Insecure Design | CWE-209, CWE-256, CWE-501 | 4.0~8.0 | ✅ 설계 |
| A05 | Security Misconfiguration | CWE-16, CWE-611, CWE-732 | 5.0~9.8 | ✅ 설정 |
| A06 | Vulnerable Components | CWE-1104 | 5.0~10.0 | 🔧 인프라 |
| A07 | Auth Failures | CWE-287, CWE-384 | 6.5~9.8 | ✅ 코드 |
| A08 | Software & Data Integrity | CWE-494, CWE-829 | 7.0~10.0 | 🔧 파이프라인 |
| A09 | Logging Failures | CWE-117, CWE-778 | 4.0~7.5 | ✅ 코드 |
| A10 | SSRF | CWE-918 | 7.5~10.0 | ✅ 코드 |

---

## 3️⃣ CVSS v3.1 빠른 계산 기준

```
CVSS 점수 = Base Score + Temporal Score + Environmental Score

Base Score 핵심 요소:
┌───────────────┬────────────────────────────────────────┐
│ Attack Vector │ Network(N) > Adjacent(A) > Local(L)    │
│               │ → N이면 +0.85 가중치 (원격 공격 가능) │
├───────────────┼────────────────────────────────────────┤
│ Complexity    │ Low(L) > High(H)                        │
│               │ → Low면 공격자 특별 조건 불필요         │
├───────────────┼────────────────────────────────────────┤
│ Privileges    │ None(N) > Low(L) > High(H)              │
│               │ → None이면 인증 없이 공격 가능          │
├───────────────┼────────────────────────────────────────┤
│ User Inter.   │ None(N) > Required(R)                   │
├───────────────┼────────────────────────────────────────┤
│ Scope         │ Changed(C) > Unchanged(U)               │
│               │ → Changed면 다른 시스템까지 영향        │
├───────────────┼────────────────────────────────────────┤
│ Impact        │ CIA 각각 High/Low/None                  │
│               │ (Confidentiality/Integrity/Availability)│
└───────────────┴────────────────────────────────────────┘
```

### 자주 쓰는 취약점별 CVSS 벡터 예시

```
SQL Injection (인증 없이 원격):
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H → 9.8 CRITICAL

Stored XSS:
CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N → 5.4 MEDIUM

IDOR (인증된 사용자):
CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N → 8.1 HIGH

SSRF (내부망 접근):
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N → 8.6 HIGH

Hardcoded Secret:
CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H → 9.8 CRITICAL

Path Traversal:
CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N → 6.5 MEDIUM
```

---

## 4️⃣ OWASP Risk Rating 보조 기준

```
위험도 = 가능성(Likelihood) × 영향도(Impact)

가능성 요소:
- 공격 난이도: 쉬움(3) / 보통(2) / 어려움(1)
- 공격자 수준: Script Kiddie(3) / 해커(2) / 국가급(1)
- 익스플로잇 공개 여부: 있음(3) / 없음(1)

영향도 요소:
- 데이터 노출 범위: 전체(3) / 일부(2) / 최소(1)
- 금전적 피해: 대규모(3) / 중간(2) / 소규모(1)
- 서비스 영향: 전체 중단(3) / 부분(2) / 없음(1)

결과 매핑:
HIGH likelihood × HIGH impact = CRITICAL
HIGH × LOW  또는  LOW × HIGH = HIGH
MEDIUM × MEDIUM = MEDIUM
LOW × LOW = LOW
```

---

## 5️⃣ AI 분석 보고 형식 (표준 템플릿)

```
AI가 취약점 발견 시 반드시 아래 형식으로 보고할 것:

---
[취약점 ID]: VULN-{파일명}-{라인번호}
[취약점명]: (예: SQL Injection via f-string concatenation)
[OWASP]: A03:2021 - Injection
[CWE]: CWE-89 (Improper Neutralization of SQL Commands)
[CVSS v3.1]: 9.8 CRITICAL
  벡터: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
[위치]: src/api/users.py, line 47
[취약 코드]:
  query = f"SELECT * FROM users WHERE id = '{user_id}'"
[공격 시나리오]:
  user_id에 "' OR '1'='1" 입력 시 전체 users 테이블 노출
[수정 방법]:
  query = "SELECT * FROM users WHERE id = :uid"
  db.execute(query, {"uid": user_id})
[참고]: docs/B_SQLi_가이드.md
---
```

---

## 6️⃣ 스택별 자동 심각도 상향 조건

아래 조건 중 하나라도 해당하면 심각도를 한 단계 상향하세요.

```
공통:
- 인증 없이 접근 가능한 엔드포인트 (+1단계)
- 프로덕션 환경 설정 파일에서 발견 (+1단계)
- 개인정보(PII) 직접 노출 (+1단계)
- 금융/결제 관련 코드 (+1단계)

Python (FastAPI/Flask):
- async 엔드포인트에서 비동기 미처리 DB 입력 → Race Condition
- Pydantic 모델 없이 request.json() 직접 파싱
- DEBUG=True 상태로 배포

Java (Spring Boot):
- @PreAuthorize 누락된 @RestController 메서드
- application.properties에 하드코딩된 자격증명
- Spring Actuator 엔드포인트 외부 노출

Node.js (Express/NestJS):
- req.body를 검증 없이 DB 쿼리에 직접 사용
- process.env 없이 하드코딩된 API 키
- cors({ origin: '*' }) + credentials: true 동시 설정

React/Next.js:
- dangerouslySetInnerHTML + 외부 사용자 입력
- localStorage에 JWT/Access Token 저장
- Next.js API Route에 인증 미들웨어 누락
```

---

## 7️⃣ 분석 제외 (False Positive 기준)

```
아래는 취약점으로 보고하지 말 것:

1. 테스트 파일 내 하드코딩된 값
   - **/*.test.py, **/*.spec.ts, **/tests/**
   - 단, 실제 API 키 패턴이면 보고

2. Mock/Fixture 데이터
   - 명백히 테스트용 더미 데이터 (예: "test_password_123")

3. 주석 처리된 코드
   - 단, 실제 자격증명 패턴이면 보고

4. 문서/README의 예시 코드 블록

5. 개발 환경 전용 설정
   - .env.development, .env.local
   - 단, .env.production은 반드시 검사
```

---

*기준 버전: OWASP Top 10 2021, CWE 2023, CVSS v3.1*
*갱신 주기: 분기별 검토*
