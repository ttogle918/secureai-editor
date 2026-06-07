# B17: Improper Rate Limiting & Resource Exhaustion
OWASP: A04:2021 (API4) | CWE-770 | CVSS: 5.3~8.6

## 취약 패턴
```python
# CRITICAL — OTP/MFA 무제한 (6자리 브루트포스 가능)
@app.post("/api/auth/verify-otp")
async def verify_otp(code: str): ...          # @limiter.limit 없음

# HIGH — 로그인 무제한
@app.post("/api/auth/login")
async def login(credentials: LoginSchema): ... # Rate Limit 없음

# HIGH — 비밀번호 재설정 무제한 → 이메일 스팸
@app.post("/api/auth/forgot-password")
async def forgot_password(email: str): ...

# HIGH — LLM API 프록시 무제한 → 비용 폭탄
@app.post("/api/ai/chat")
async def ai_chat(message: str): ...          # 수백만 토큰 소비 가능

# MEDIUM — 페이지 크기 제한 없음
@app.get("/api/users")
async def list_users(limit: int = 100): ...   # limit=999999 가능
```

## 수정 패턴
```python
# ✅ slowapi Rate Limiting
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

@app.post("/api/auth/login")
@limiter.limit("5/minute;20/hour")
async def login(request: Request, ...): ...

@app.post("/api/auth/verify-otp")
@limiter.limit("5/15minutes")             # OTP: 15분 5회
async def verify_otp(request: Request, ...): ...

@app.post("/api/auth/forgot-password")
@limiter.limit("3/hour")
async def forgot_password(request: Request, ...): ...

@app.post("/api/ai/chat")
@limiter.limit("10/minute;100/day")       # LLM: 비용 제한
async def ai_chat(request: Request, ...): ...

# ✅ 페이지 크기 강제 제한
from fastapi import Query
@app.get("/api/users")
async def list_users(limit: int = Query(default=20, le=100)):  # 최대 100
    ...

# ✅ 사용자 ID 기반 (IP 우회 방지)
def get_user_key(request: Request) -> str:
    try:
        token = request.headers.get("Authorization","").replace("Bearer ","")
        payload = verify_token(token)
        return f"user:{payload['sub']}"
    except:
        return get_remote_address(request)
user_limiter = Limiter(key_func=get_user_key)
```
```typescript
// ✅ Next.js @upstash/ratelimit
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"
const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "1 m"),
})
const { success } = await ratelimit.limit(ip)
if (!success) return res.status(429).json({ error: "Too Many Requests" })
```

## 심각도
- CRITICAL: OTP/MFA 무제한 → 수초 내 6자리 브루트포스
- HIGH: 로그인 무제한 / LLM 프록시 무제한 / 비밀번호 재설정 무제한
- MEDIUM: IP 기반만 (VPN 우회) / 임계값 너무 높음
