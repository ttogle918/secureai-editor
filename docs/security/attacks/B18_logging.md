# B18: Logging & Monitoring Failures
OWASP: A09:2021 | CWE-117, CWE-778 | CVSS: 4.0~7.5 MEDIUM

## 취약 패턴
```python
# HIGH — 민감 정보 로그 출력
logger.info(f"Login: {credentials.username} / {credentials.password}")
logger.debug(f"Token: {access_token}")
logger.info(f"User: {user.__dict__}")           # PII 전체 포함
print(f"API key: {os.environ['OPENAI_API_KEY']}")
logger.error(f"Card: {card_number}")

# HIGH — 보안 이벤트 로깅 없음
@app.post("/api/auth/login")
async def login(credentials: LoginSchema):
    user = authenticate(credentials)
    if not user:
        raise HTTPException(status_code=401)     # 실패 이벤트 기록 없음

# MEDIUM — 로그 인젝션
logger.info(f"Search: {query}")
# query = "normal\nINFO: Fake admin login" → 로그 조작

# MEDIUM — 예외 무시
try: result = process()
except Exception: pass                          # 조용한 실패

# MEDIUM — 관리자 행동 감사 로그 없음
@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, admin=Depends(require_admin)):
    db.query(User).filter(User.id == user_id).delete()  # 감사 로그 없음
```

## 수정 패턴
```python
# ✅ 구조화 로깅 + 민감 정보 마스킹
import structlog
logger = structlog.get_logger()
security_logger = structlog.get_logger("security")

SENSITIVE = {"password","token","secret","api_key","card_number","cvv","ssn"}
def mask(data: dict) -> dict:
    return {k: "***" if k.lower() in SENSITIVE else v for k, v in data.items()}

def sanitize_log(v: str) -> str:
    return v.replace('\n','\\n').replace('\r','\\r')

# ✅ 보안 이벤트 로깅
@app.post("/api/auth/login")
async def login(request: Request, credentials: LoginSchema):
    user = authenticate(credentials)
    if not user:
        security_logger.warning("login_failed",
            username=sanitize_log(credentials.username),
            ip=request.client.host, result="failure")
        raise HTTPException(status_code=401)
    security_logger.info("login_success", user_id=str(user.id),
        ip=request.client.host)
    return create_token(user)

# ✅ 관리자 감사 로그
security_logger.critical("admin_user_deleted",
    admin_id=str(admin.id), target_user_id=user_id,
    ip=request.client.host)

# ✅ 예외 항상 로깅
@app.exception_handler(Exception)
async def handler(req, exc):
    logger.error("unhandled", error=str(exc), exc_info=True)
    return JSONResponse(status_code=500, content={"detail":"Internal server error"})
```

## 심각도
- HIGH: 비밀번호·토큰·카드번호 평문 로그 / 보안 이벤트 로깅 완전 없음
- MEDIUM: 관리자 감사 로그 없음 / 로그 인젝션 / 예외 무시
- LOW: 비구조화 로그 / 알림 미설정
