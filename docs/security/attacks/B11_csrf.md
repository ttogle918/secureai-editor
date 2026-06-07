# B11: CSRF (Cross-Site Request Forgery)
OWASP: A01:2021 | CWE-352 | CVSS: 6.5~8.8

## 취약 패턴
```python
# CRITICAL
app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_credentials=True)   # * + credentials

# HIGH — SameSite 없는 세션 쿠키
response.set_cookie(key="session", value=token,
    httponly=True, secure=True)                    # samesite 누락

# HIGH — CSRF 토큰 검증 없는 state-changing 엔드포인트
@app.post("/api/transfer")
async def transfer(amount: int, current_user=Depends(get_current_user)):
    process_transfer(...)                          # X-CSRF-Token 검증 없음

app.config['WTF_CSRF_ENABLED'] = False            # CRITICAL (Flask)
```

## 수정 패턴
```python
# ✅ SameSite=Strict (가장 간단)
response.set_cookie(key="session", value=token,
    httponly=True, secure=True, samesite="strict", max_age=3600)

# ✅ Double Submit Cookie (SPA용)
import secrets
def verify_csrf(
    csrf_cookie: str = Cookie(None, alias="csrf_token"),
    csrf_header: str = Header(None, alias="X-CSRF-Token")
):
    if not csrf_cookie or not csrf_header:
        raise HTTPException(status_code=403)
    if not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(status_code=403, detail="CSRF token mismatch")

@app.post("/api/transfer")
async def transfer(data: TransferSchema,
    current_user=Depends(get_current_user), _=Depends(verify_csrf)):
    process_transfer(...)
```
```typescript
// ✅ axios 인터셉터로 CSRF 토큰 자동 첨부
api.interceptors.request.use((config) => {
    if (['post','put','patch','delete'].includes(config.method ?? '')) {
        config.headers['X-CSRF-Token'] = getCsrfFromCookie()
    }
    return config
})
```

## 심각도
- CRITICAL: CORS * + credentials / WTF_CSRF_ENABLED=False
- HIGH: SameSite 없음 + CSRF 토큰 없음 + state-changing API
- MEDIUM: SameSite=Lax (일부 시나리오 취약)
