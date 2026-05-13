# 🗡️ B-11: Cross-Site Request Forgery (CSRF)
## AI 코드 분석 지침 — Python FastAPI/Flask + React/Next.js 특화

---

## 📋 기본 정보

| 항목 | 내용 |
|------|------|
| OWASP | A01:2021 - Broken Access Control (포함) |
| CWE | CWE-352 (Cross-Site Request Forgery) |
| CVSS 기본 | 6.5~8.8 MEDIUM~HIGH |
| 스택 관련성 | SameSite 쿠키 설정 + FastAPI CORS 조합이 핵심 |

---

## 1️⃣ 공격 원리

```
[정상 흐름]
사용자(로그인 상태) → mybank.com/transfer → 세션 쿠키 자동 첨부 → 송금 처리

[CSRF 공격 흐름]
사용자(로그인 상태) → evil.com 방문
evil.com 페이지 내부에 숨겨진 코드:
  <img src="https://mybank.com/api/transfer?to=attacker&amount=1000000">
  또는
  <form action="https://mybank.com/api/transfer" method="POST">
    <input name="to" value="attacker">
    <input name="amount" value="1000000">
  </form>
  <script>document.forms[0].submit()</script>

→ 사용자의 브라우저가 mybank.com에 세션 쿠키를 자동으로 첨부해 요청 전송
→ 서버는 정상 요청으로 인식 → 공격자 계좌로 이체
```

---

## 2️⃣ 취약 패턴 탐지

### FastAPI / Flask — 백엔드

```python
# ❌ HIGH: SameSite 설정 없는 쿠키 (기본값 = None 또는 브라우저 의존)
from fastapi import Response

response.set_cookie(
    key="session",
    value=token,
    httponly=True,
    secure=True
    # samesite 없음 → 기본값 브라우저 의존 → CSRF 취약
)

# ❌ CRITICAL: CORS wildcard + credentials 동시 설정 (CSRF 완전 무방비)
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 와일드카드
    allow_credentials=True,       # credentials 허용 → 세션 쿠키 포함 요청 가능
    allow_methods=["*"],
    allow_headers=["*"],
)

# ❌ HIGH: State-changing 요청에 CSRF 토큰 검증 없음
@app.post("/api/transfer")
async def transfer(amount: int, to_account: str,
                   current_user=Depends(get_current_user)):
    # X-CSRF-Token 헤더 검증 없음
    process_transfer(current_user, to_account, amount)

# ❌ HIGH: Flask-WTF CSRF 보호 전역 비활성화
app.config['WTF_CSRF_ENABLED'] = False

# ❌ MEDIUM: CSRF 예외 처리 남용 (특정 엔드포인트 전체 제외)
@csrf.exempt  # Flask-WTF
@app.route('/api/payment', methods=['POST'])
def payment():  # State-changing 엔드포인트를 exempt 처리
    ...
```

### React / Next.js — 프론트엔드

```jsx
// ❌ HIGH: credentials 없이 쿠키 기반 인증 사용
// (쿠키는 자동 전송되므로 withCredentials 설정과 무관하게 CSRF 위험)
fetch('/api/transfer', {
    method: 'POST',
    body: JSON.stringify({ amount: 1000 }),
    // credentials: 'include' 없어도 same-origin은 쿠키 자동 전송
})

// ❌ MEDIUM: CSRF 토큰을 localStorage에만 저장
// (XSS로 토큰 탈취 시 CSRF 방어 무력화)
const csrfToken = localStorage.getItem('csrf_token');

// ❌ HIGH: Next.js API Route에서 Origin 헤더 검증 없음
// pages/api/transfer.js
export default async function handler(req, res) {
    if (req.method === 'POST') {
        // Origin/Referer 검증 없음
        await processTransfer(req.body);
    }
}
```

---

## 3️⃣ 올바른 수정 패턴

### FastAPI 방어 — SameSite 쿠키 (가장 간단하고 효과적)

```python
# ✅ 방법 1: SameSite=Strict 쿠키 (state-changing 요청 완전 차단)
@app.post("/api/auth/login")
async def login(response: Response, creds: LoginSchema):
    token = create_session_token(creds)
    response.set_cookie(
        key="session",
        value=token,
        httponly=True,        # JS 접근 불가 (XSS 방어)
        secure=True,          # HTTPS에서만 전송
        samesite="strict",    # 외부 사이트 요청 시 쿠키 미전송 ✅
        max_age=3600,
        path="/"
    )
    return {"message": "Login successful"}

# ✅ SameSite=Lax (OAuth 리다이렉트 필요 시 — Strict보다 약하지만 대부분 충분)
response.set_cookie(
    key="session",
    value=token,
    samesite="lax",  # GET 요청만 크로스사이트 허용, POST는 차단
    httponly=True,
    secure=True,
)
```

```python
# ✅ 방법 2: Double Submit Cookie (SPA + 쿠키 인증 조합)
import secrets
from fastapi import Cookie, Header

@app.get("/api/csrf-token")
async def get_csrf_token(response: Response):
    """CSRF 토큰 발급 엔드포인트 (로그인 후 호출)"""
    token = secrets.token_urlsafe(32)
    # 쿠키로도 저장 (httponly=False — JS가 읽어야 함)
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=False,       # JS에서 읽어야 헤더로 보낼 수 있음
        secure=True,
        samesite="strict",
        max_age=3600
    )
    return {"csrf_token": token}

def verify_csrf(
    csrf_cookie: str = Cookie(None, alias="csrf_token"),
    csrf_header: str = Header(None, alias="X-CSRF-Token")
):
    """CSRF 토큰 검증 의존성"""
    if not csrf_cookie or not csrf_header:
        raise HTTPException(status_code=403, detail="CSRF token missing")
    if not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(status_code=403, detail="CSRF token mismatch")

# State-changing 엔드포인트에 CSRF 검증 의존성 추가
@app.post("/api/transfer")
async def transfer(
    data: TransferSchema,
    current_user=Depends(get_current_user),
    _=Depends(verify_csrf)  # CSRF 검증 추가
):
    process_transfer(current_user, data)
```

```python
# ✅ 방법 3: Referer/Origin 헤더 검증 (추가 방어층)
from urllib.parse import urlparse
from fastapi import Request

ALLOWED_ORIGINS = {"https://myapp.com", "https://www.myapp.com"}

async def verify_origin(request: Request):
    origin = request.headers.get("origin") or request.headers.get("referer")
    if not origin:
        raise HTTPException(status_code=403, detail="Missing Origin header")
    parsed = urlparse(origin)
    base = f"{parsed.scheme}://{parsed.netloc}"
    if base not in ALLOWED_ORIGINS:
        raise HTTPException(status_code=403, detail="Origin not allowed")

# ✅ CORS 올바른 설정
import os
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://myapp.com").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,      # 명시적 화이트리스트
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
)
```

### React / Next.js 방어 — 프론트엔드

```typescript
// ✅ axios 인터셉터로 CSRF 토큰 자동 첨부
import axios from 'axios';

// 쿠키에서 CSRF 토큰 읽기 (httponly=false 쿠키)
function getCsrfToken(): string {
    return document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf_token='))
        ?.split('=')[1] ?? '';
}

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,  // 세션 쿠키 전송
});

// 모든 state-changing 요청에 CSRF 토큰 자동 첨부
api.interceptors.request.use((config) => {
    if (['post', 'put', 'patch', 'delete'].includes(config.method ?? '')) {
        config.headers['X-CSRF-Token'] = getCsrfToken();
    }
    return config;
});

export default api;
```

```typescript
// ✅ Next.js API Route — Origin 검증
// pages/api/transfer.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const ALLOWED_ORIGINS = new Set([
    'https://myapp.com',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : ''
]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Origin 검증
    const origin = req.headers.origin || req.headers.referer || '';
    const originBase = new URL(origin).origin;
    if (!ALLOWED_ORIGINS.has(originBase)) {
        return res.status(403).json({ error: 'CSRF protection: origin not allowed' });
    }

    if (req.method === 'POST') return res.status(405).end();

    // CSRF 토큰 검증 (Double Submit Cookie)
    const cookieToken = req.cookies['csrf_token'];
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || cookieToken !== headerToken) {
        return res.status(403).json({ error: 'CSRF token mismatch' });
    }

    // 실제 로직
    await processTransfer(req.body);
    res.json({ success: true });
}
```

---

## 4️⃣ 심각도 판단 기준

```
CRITICAL:
- CORS allow_origins=["*"] + allow_credentials=True 동시 설정
  → 어떤 외부 사이트에서든 인증된 요청 가능
- SameSite 설정 없음 + CSRF 토큰도 없음 + State-changing API

HIGH:
- SameSite=None 명시 + CSRF 토큰 없음
- State-changing 엔드포인트에 CSRF 검증 없음 (단, SameSite=Strict이면 경감)
- @csrf.exempt을 결제/계정변경 엔드포인트에 적용

MEDIUM:
- SameSite=Lax (대부분 충분하지만 일부 시나리오 취약)
- CSRF 토큰이 localStorage에만 저장 (XSS 연계 시 무력화)

LOW:
- Origin 헤더 검증 없음 (SameSite로 이미 방어된 경우)
- Referer 헤더만으로 검증 (스푸핑 가능하나 어려움)
```

---

## 5️⃣ 보고 템플릿

```
[VULN-cors_config-001]
취약점명   : CSRF via Wildcard CORS + Credentials
심각도     : 🔴 CRITICAL
OWASP      : A01:2021 - Broken Access Control
CWE        : CWE-352 (CSRF)
CVSS v3.1  : 8.8 HIGH
  벡터     : CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H

위치       : main.py:15-22 (CORSMiddleware 설정)

[취약한 코드]
app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True)

[공격 시나리오]
공격자 사이트(evil.com)에서 피해자가 로그인된 myapp.com API에
세션 쿠키가 포함된 POST 요청 전송 → 피해자 권한으로 임의 작업 수행

[수정]
allow_origins=["https://myapp.com"]  # 명시적 허용 목록
+ response.set_cookie(..., samesite="strict")
```

---

*참조: OWASP CSRF Prevention Cheat Sheet*
*탐지 도구: Semgrep p/python, Bandit B104, ZAP CSRF 스캐너*
