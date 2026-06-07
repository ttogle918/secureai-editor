# B14: Open Redirect
OWASP: A01:2021 | CWE-601 | CVSS: 4.7~6.1 MEDIUM

## 취약 패턴
```python
# HIGH — 검증 없는 리다이렉트
from fastapi.responses import RedirectResponse
@app.get("/login")
async def login(next: str = "/"):
    return RedirectResponse(url=next)   # next = "https://phishing.com"

@app.get("/logout")
async def logout(return_url: str = "/"):
    return RedirectResponse(url=return_url)

# HIGH — Location 헤더 직접
return Response(status_code=302, headers={"Location": redirect_uri})

# MEDIUM — // 프로토콜 상대 미처리
if next.startswith("/"): return RedirectResponse(url=next)
# next = "//evil.com" → 통과
```
```typescript
// HIGH
router.push(next as string)               // next = "https://phishing.com"
window.location.href = returnUrl          // 검증 없음
// Next.js
return { redirect: { destination: ctx.query.next, permanent: false } }
```

## 공격 시나리오
```
피싱: https://myapp.com/login?next=https://evil.com/fake-login
OAuth: ?redirect_uri=https://attacker.com → 인가 코드 탈취
```

## 수정 패턴
```python
# ✅ 상대 경로만 허용
import re
def validate_redirect(url: str) -> str:
    if url and url.startswith("/") and not url.startswith("//"):
        if re.match(r'^/[a-zA-Z0-9/_\-]*$', url):
            return url
    return "/"  # 안전하지 않으면 홈으로
```
```typescript
// ✅
function getSafeRedirect(url: string | undefined): string {
    if (url?.startsWith('/') && !url.startsWith('//') && /^\/[a-zA-Z0-9/_\-]*$/.test(url))
        return url
    return '/'
}
```

## 심각도
- HIGH: OAuth redirect_uri 미검증 → 인가 코드 탈취
- MEDIUM: 로그인 next 파라미터 미검증 → 피싱
- LOW: 내부 경로만이나 // 미처리
