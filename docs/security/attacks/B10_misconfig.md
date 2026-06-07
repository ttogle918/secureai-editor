# B10: Security Misconfiguration
OWASP: A05:2021 (2위 급상승) | CWE-16, CWE-732 | CVSS: 5.0~9.8

## 취약 패턴
```python
# CRITICAL — Werkzeug debugger = 원격 코드 실행
app.run(debug=True)
app = FastAPI(debug=True)
app.config['DEBUG'] = True       # Flask

# HIGH
app.add_middleware(CORSMiddleware,
    allow_origins=["*"], allow_credentials=True)  # * + credentials

# FastAPI — Swagger 프로덕션 노출
app = FastAPI(docs_url="/docs", redoc_url="/redoc")  # 환경 분기 없음

# 에러 핸들러 — 스택 트레이스 노출
return JSONResponse({"error": str(exc), "traceback": traceback.format_exc()})

# MEDIUM — 보안 헤더 없음 (응답에 아무 보안 헤더 없음)
```
```javascript
const app = express()           // helmet() 없음 → HIGH
app.use(cors({ origin: '*', credentials: true }))  // CRITICAL
```
```yaml
# application.properties
management.endpoints.web.exposure.include=*  # Spring Actuator 전체 노출 HIGH
spring.h2.console.enabled=true               # H2 콘솔 노출 MEDIUM
```

## 수정 패턴
```python
# ✅ 환경별 분리
ENV = os.getenv("ENVIRONMENT", "production")
app = FastAPI(
    debug=ENV == "development",
    docs_url="/docs" if ENV == "development" else None,
)

# ✅ CORS 명시적 허용
app.add_middleware(CORSMiddleware,
    allow_origins=os.environ["ALLOWED_ORIGINS"].split(","),
    allow_credentials=True,
    allow_methods=["GET","POST","PUT","DELETE","PATCH"])

# ✅ 보안 헤더 미들웨어
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.update({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'",
        "Server": "MyApp"})
    return response

# ✅ 에러 핸들러 — 내부만
@app.exception_handler(Exception)
async def handler(req, exc):
    logger.error(f"Unhandled: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
```

## 심각도
- CRITICAL: debug=True (Werkzeug debugger = RCE)
- HIGH: CORS * + credentials / 스택 트레이스 클라이언트 노출 / Actuator 전체
- MEDIUM: 보안 헤더 누락 / Swagger 프로덕션 / H2 콘솔 노출
- LOW: 서버 버전 헤더 노출
