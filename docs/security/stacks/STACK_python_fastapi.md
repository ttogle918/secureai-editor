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
    # is_admin, role, balance 등 모든 필드 덮어쓰기 가능
```
... (rest of the file)
