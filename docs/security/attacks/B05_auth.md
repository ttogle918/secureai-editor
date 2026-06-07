# B05: Authentication Failures (인증 실패)
OWASP: A07:2021 | CWE-287, CWE-384, CWE-798 | CVSS: 6.5~9.8

## 취약 패턴
```python
# JWT 검증 오류 - CRITICAL
jwt.decode(token, options={"verify_signature": False})   # 서명 검증 스킵
header = jwt.get_unverified_header(token)
jwt.decode(token, key, algorithms=[header["alg"]])       # alg:none 공격 가능

# 약한/기본 시크릿 - CRITICAL
SECRET_KEY = "secret"
SECRET_KEY = "password"
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")      # 기본값 = 위험
SECRET_KEY = "your-256-bit-secret"                       # 라이브러리 예제

# 약한 비밀번호 해시 - CRITICAL
hashlib.md5(password.encode()).hexdigest()
hashlib.sha1(password.encode()).hexdigest()
hashlib.sha256(password.encode()).hexdigest()             # 솔트 없으면 위험

# JWT 만료 없음 - HIGH
payload = {"sub": user_id, "role": "admin"}              # exp 없음

# Rate Limit 없는 로그인 - HIGH
@app.post("/login")
async def login(credentials: LoginSchema): ...           # @limiter.limit 없음

# 예측 가능한 토큰 - HIGH
import random
token = random.randint(100000, 999999)
session_id = str(random.random())
```
```javascript
// JWT - CRITICAL
jwt.verify(token, secret, { algorithms: undefined })     // 알고리즘 미지정
const decoded = jwt.decode(token)                        // verify 아닌 decode
// 토큰 저장 - HIGH
localStorage.setItem('access_token', token)              // XSS로 탈취
// 약한 토큰 - HIGH
const token = Math.random().toString(36).substr(2)
```
```java
// MD5 해시 - CRITICAL
MessageDigest.getInstance("MD5").digest(password.getBytes())
// Spring Security 비활성화 - CRITICAL
http.csrf().disable(); http.authorizeRequests().anyRequest().permitAll()
```

## 수정 패턴
```python
# ✅ JWT 안전 검증
from jose import jwt
SECRET_KEY = os.environ["JWT_SECRET_KEY"]                # 환경변수, 64바이트+
def verify_token(token: str):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])  # 알고리즘 고정

# ✅ 만료 설정
payload = {"sub": user_id, "exp": datetime.utcnow() + timedelta(minutes=15)}

# ✅ Argon2 해시
from passlib.context import CryptContext
pwd = CryptContext(schemes=["argon2"], deprecated="auto")

# ✅ Rate Limiting
from slowapi import Limiter
@app.post("/login")
@limiter.limit("5/minute;20/hour")
async def login(request: Request, ...): ...

# ✅ 안전한 난수
import secrets
token = secrets.token_urlsafe(32)
```
```javascript
// ✅ JWT 검증
jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
// ✅ 토큰 저장 — 메모리 변수
let _accessToken = null  // localStorage 금지
```

## 심각도
- CRITICAL: alg:none / 약한 시크릿(<32자) / MD5·SHA1 비밀번호 / 서명 검증 스킵
- HIGH: Rate Limit 없는 로그인 / JWT 만료 없음 / localStorage 저장
- MEDIUM: 세션 타임아웃 미설정 / 로그인 실패 메시지 구분 노출
