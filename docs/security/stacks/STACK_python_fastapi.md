# ⚡ STACK_python_fastapi — FastAPI 특화 보안 패턴
## Python 공통 파일과 함께 로드 | RAG 추가 대상

> **로드 조건:** `from fastapi` 또는 `import fastapi` 감지 시.
> `STACK_common_python.md` 와 **반드시 함께** 로드하세요.

---

## 1️⃣ FastAPI 즉시 CRITICAL

```python
# ── CORS 와일드카드 + Credentials ───────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,    # * + credentials = CSRF 완전 무방비
)

# ── Debug 모드 ────────────────────────────────────────
app = FastAPI(debug=True)      # 스택 트레이스 외부 노출

# ── 인증 없는 엔드포인트 + 민감 데이터 ───────────────
@app.get("/api/users/{user_id}")
async def get_user(user_id: int, db=Depends(get_db)):
    # Depends(get_current_user) 없음 + DB 직접 조회
    return db.query(User).filter(User.id == user_id).first()

# ── 소유권 검증 없는 데이터 조회/수정 (IDOR) ─────────
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, db=Depends(get_db),
                    current_user=Depends(get_current_user)):
    # current_user.id 와 order.user_id 비교 없음
    return db.query(Order).filter(Order.id == order_id).first()

# ── Mass Assignment ───────────────────────────────────
@app.put("/api/users/{id}")
async def update_user(id: int, data: dict,  # Pydantic 모델 아닌 dict
                      db=Depends(get_db)):
    db.query(User).filter(User.id == id).update(data)
    # is_admin, role 등 모든 필드 덮어쓰기 가능
```

---

## 2️⃣ FastAPI 즉시 HIGH

```python
# ── JWT 설정 오류 ─────────────────────────────────────
SECRET_KEY = "secret"                             # 약한 시크릿
SECRET_KEY = os.getenv("SECRET_KEY", "default")  # 기본값 설정 → 위험

@app.post("/login")
async def login(request: Request, ...):           # @limiter.limit 없음
    ...                                           # Rate Limiting 부재

# ── Pydantic 모델에 민감 필드 포함 ───────────────────
class UserUpdate(BaseModel):
    username: str
    is_admin: bool     # 클라이언트 직접 제어 가능
    role: str          # 클라이언트 직접 제어 가능

# ── 프로덕션에 Swagger 노출 ───────────────────────────
app = FastAPI(
    docs_url="/docs",    # 환경 분기 없이 항상 노출
    redoc_url="/redoc",
)

# ── 보안 헤더 미설정 ─────────────────────────────────
# X-Content-Type-Options, X-Frame-Options, HSTS 헤더 없음

# ── 에러 핸들러 미정의 또는 스택 트레이스 노출 ────────
@app.exception_handler(Exception)
async def handler(req, exc):
    return JSONResponse({"error": str(exc), "trace": traceback.format_exc()})
    # traceback 클라이언트 노출

# ── SameSite 없는 쿠키 ───────────────────────────────
response.set_cookie(key="session", value=token,
                    httponly=True, secure=True)
                    # samesite 누락 → CSRF 취약

# ── SSRF ─────────────────────────────────────────────
@app.post("/proxy")
async def proxy(url: str):
    async with httpx.AsyncClient() as c:
        return await c.get(url)   # url 검증 없음
```

---

## 3️⃣ FastAPI 확인 필요 패턴

```python
# Depends() 의존성 체인 확인
@app.get("/api/data")
async def endpoint(current_user=Depends(get_current_user)):
    # ✅ get_current_user 구현 확인:
    #    - JWT 만료 검증?
    #    - algorithms 명시적 고정?
    #    - DB에서 사용자 존재 재확인?

# response_model 지정 확인
@app.get("/api/users/{id}")
async def get_user(id: int) -> User:  # User 모델 전체 반환?
    # ✅ response_model=UserPublicResponse 로 민감 필드 제외 권장
    # password_hash, internal 필드 포함이면 HIGH

# Background Task 내 에러 처리
@app.post("/api/send")
async def send(background_tasks: BackgroundTasks):
    background_tasks.add_task(process_data, ...)
    # ✅ process_data 내부에 예외 처리 없으면 MEDIUM

# Middleware 순서
app.add_middleware(AuthMiddleware)
app.add_middleware(CORSMiddleware)
# ✅ CORS는 항상 마지막(가장 먼저 실행)이어야 함
#    순서 잘못되면 인증 전에 CORS 우회 가능
```

---

## 4️⃣ FastAPI 올바른 패턴 (참조)

```python
# ✅ CORS — 명시적 허용 목록
ALLOWED_ORIGINS = os.environ["ALLOWED_ORIGINS"].split(",")
app.add_middleware(CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET","POST","PUT","DELETE","PATCH"],
    allow_headers=["Content-Type","Authorization","X-CSRF-Token"])

# ✅ 환경별 FastAPI 설정
ENV = os.getenv("ENVIRONMENT", "production")
app = FastAPI(
    debug=ENV == "development",
    docs_url="/docs" if ENV == "development" else None,
    redoc_url=None)

# ✅ 소유권 검증 표준 패턴
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int,
                    current_user=Depends(get_current_user),
                    db=Depends(get_db)):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id   # 소유권 검증
    ).first()
    if not order:
        raise HTTPException(status_code=404)  # 403 아닌 404 (정보 은닉)
    return order

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

# ✅ Rate Limiting
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/login")
@limiter.limit("5/minute;20/hour")
async def login(request: Request, ...): ...

# ✅ Pydantic — 허용 필드만, 추가 필드 거부
class UserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    username: str = Field(min_length=2, max_length=50)
    email: EmailStr

# ✅ SameSite 쿠키
response.set_cookie(key="session", value=token,
    httponly=True, secure=True, samesite="strict", max_age=3600)
```

---

## 5️⃣ FastAPI 의존성 특이사항

```
fastapi < 0.95.0   → 알려진 보안 이슈 (업그레이드 권고)
uvicorn (workers)  → --workers > 1 시 메모리 공유 세션 주의
python-jose        → HS256 기본, RS256 사용 시 키 타입 확인
python-multipart   → 파일 업로드 시 파일 크기/타입 검증 필수
```
