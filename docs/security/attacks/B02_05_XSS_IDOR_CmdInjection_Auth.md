# 🗡️ B-02: Cross-Site Scripting (XSS)
## AI 코드 분석 지침

| OWASP | CWE | CVSS |
|-------|-----|------|
| A03:2021 Injection | CWE-79 | 5.4~8.8 MEDIUM~HIGH |

---

## 1️⃣ 공격 원리

```
Reflected XSS: 사용자 입력 → 즉시 응답에 반영 → 피해자 브라우저에서 JS 실행
Stored XSS:   사용자 입력 → DB 저장 → 다른 사용자가 페이지 로드 시 JS 실행 (더 위험)
DOM XSS:      서버 응답 없이 클라이언트 JS가 DOM을 직접 조작할 때 발생

공격 결과: 세션 쿠키 탈취, 피싱 페이지 삽입, 키로거 설치, CSRF 공격 연계
```

---

## 2️⃣ 취약 패턴 탐지

### React / Next.js

```jsx
// ❌ CRITICAL: dangerouslySetInnerHTML + 외부 입력
<div dangerouslySetInnerHTML={{ __html: userInput }} />
<div dangerouslySetInnerHTML={{ __html: post.content }} />
<div dangerouslySetInnerHTML={{ __html: props.description }} />

// ❌ HIGH: href에 사용자 입력 직접 삽입 (javascript: 스킴)
<a href={userUrl}>링크</a>         // javascript:alert(1) 가능
<a href={`/profile/${username}`}>  // username에 JS 삽입 가능

// ❌ HIGH: DOM 직접 조작 (React 외부)
document.getElementById('output').innerHTML = userInput;
element.insertAdjacentHTML('beforeend', data);

// ❌ MEDIUM: URL 파라미터를 검증 없이 렌더링
const name = new URLSearchParams(window.location.search).get('name');
document.write(name);  // DOM XSS
```

### Python 백엔드 (Jinja2/FastAPI)

```python
# ❌ CRITICAL: Jinja2 autoescape 비활성화 + 사용자 입력
from jinja2 import Environment
env = Environment(autoescape=False)  # autoescape 꺼짐
template = env.from_string("<div>{{ user_input }}</div>")

# ❌ HIGH: Markup() 클래스로 이스케이프 우회
from markupsafe import Markup
return Markup(user_input)  # 사용자 입력에 적용 금지

# ❌ HIGH: FastAPI HTMLResponse에 사용자 입력 직접 포함
from fastapi.responses import HTMLResponse
return HTMLResponse(f"<html><body>{user_comment}</body></html>")
```

### Node.js / Express

```javascript
// ❌ CRITICAL: res.send에 사용자 입력 직접 포함
res.send(`<html><body>${req.query.search}</body></html>`);

// ❌ HIGH: EJS 템플릿에서 unescaped 출력
<%- userContent %>   // ❌ unescaped (XSS 취약)
<%= userContent %>   // ✅ escaped (안전)
```

---

## 3️⃣ 올바른 수정 패턴

```jsx
// ✅ React 기본 렌더링 사용 (자동 이스케이프)
<div>{userInput}</div>

// ✅ URL 검증 (javascript: 차단)
function SafeLink({ url }) {
  const isAllowed = /^https?:\/\//i.test(url);
  return <a href={isAllowed ? url : '#'}>{children}</a>;
}

// ✅ DOMPurify로 HTML 새니타이징 (dangerouslySetInnerHTML 필요 시)
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(userHtml, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong'],
    ALLOWED_ATTR: []
  })
}} />
```

```python
# ✅ FastAPI: CSP 헤더 + 응답에 사용자 입력 미포함
@app.middleware("http")
async def csp_header(request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = \
        "default-src 'self'; script-src 'self'; object-src 'none'"
    return response
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: Stored XSS + 관리자 페이지 노출 → 전체 관리자 세션 탈취
HIGH:     Stored XSS + 일반 사용자 페이지 / Reflected XSS + 자동 링크 배포 가능
MEDIUM:   Reflected XSS + 사용자가 링크 클릭 필요 / DOM XSS + 제한적 조건
LOW:      Self-XSS (본인 브라우저에서만 실행)
```

---
---

# 🗡️ B-03: Broken Access Control / IDOR
## AI 코드 분석 지침

| OWASP | CWE | CVSS |
|-------|-----|------|
| A01:2021 (1위) | CWE-284, CWE-639 | 6.5~9.8 HIGH~CRITICAL |

---

## 1️⃣ 공격 원리

```
IDOR (Insecure Direct Object Reference):
  /api/orders/1234 → /api/orders/1235 로 변경 → 남의 주문 조회

Horizontal Privilege Escalation: 같은 권한, 다른 사용자 데이터
Vertical Privilege Escalation:   낮은 권한으로 높은 권한 기능 접근
Mass Assignment:                 API 요청에 is_admin=true 삽입
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ CRITICAL: 소유권 검증 없는 데이터 조회
@app.get("/api/orders/{order_id}")
async def get_order(order_id: int, db=Depends(get_db)):
    return db.query(Order).filter(Order.id == order_id).first()
    # current_user와 소유권 비교 없음!

# ❌ CRITICAL: 소유권 검증 없는 데이터 수정
@app.put("/api/profiles/{user_id}")
async def update_profile(user_id: int, data: dict, db=Depends(get_db)):
    db.query(User).filter(User.id == user_id).update(data)
    # 누구든 어떤 user_id든 수정 가능

# ❌ HIGH: Mass Assignment — Pydantic 없이 dict 그대로 업데이트
@app.put("/api/users/{id}")
async def update_user(id: int, data: dict, db=Depends(get_db)):
    db.query(User).filter(User.id == id).update(data)
    # data에 {'is_admin': True, 'role': 'superadmin'} 삽입 가능

# ❌ HIGH: 관리자 기능에 역할 검증 누락
@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, current_user=Depends(get_current_user)):
    # current_user.role == 'admin' 검증 없음!
    db.query(User).filter(User.id == user_id).delete()
```

```javascript
// ❌ Node.js: 소유권 검증 없는 라우트
app.get('/api/documents/:id', auth, async (req, res) => {
  const doc = await Document.findById(req.params.id);  // 소유권 미확인
  res.json(doc);
});

// ❌ Next.js API Route: 인증 미들웨어 누락
// pages/api/admin/users.js
export default async function handler(req, res) {
  // 인증 확인 없음!
  const users = await User.findAll();
  res.json(users);
}
```

```java
// ❌ Spring Boot: @PreAuthorize 누락
@RestController
@RequestMapping("/api/admin")
public class AdminController {
  // ❌ 클래스 레벨 보안 없음

  @DeleteMapping("/users/{id}")
  public void deleteUser(@PathVariable Long id) {  // 인증/인가 없음
    userService.delete(id);
  }
}
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ 소유권 검증 필수 패턴
@app.get("/api/orders/{order_id}")
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(
        Order.id == order_id,
        Order.user_id == current_user.id  # 소유권 검증
    ).first()
    if not order:
        raise HTTPException(status_code=404)  # 403 대신 404 (정보 노출 방지)
    return order

# ✅ Mass Assignment 방지 — Pydantic으로 허용 필드 명시
class UserUpdateRequest(BaseModel):
    username: str
    bio: str
    # is_admin, role, balance 등 민감 필드 제외

# ✅ 역할 기반 접근 제어
def require_role(role: str):
    async def checker(current_user=Depends(get_current_user)):
        if current_user.role != role:
            raise HTTPException(status_code=403)
        return current_user
    return checker

@app.delete("/api/admin/users/{user_id}")
async def delete_user(user_id: int, _=Depends(require_role("admin"))):
    ...
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: 소유권 검증 없음 + 수정/삭제 + 민감 데이터
HIGH:     소유권 검증 없음 + 읽기 / 역할 검증 없는 관리자 기능
MEDIUM:   Mass Assignment (is_admin 미노출이지만 구조적 문제)
LOW:      내부 API에서 소유권 검증 부재이나 외부 노출 없음
```

---
---

# 🗡️ B-04: Command Injection / SSTI
## AI 코드 분석 지침

| OWASP | CWE | CVSS |
|-------|-----|------|
| A03:2021 Injection | CWE-78(Cmd), CWE-94(SSTI) | 9.0~10.0 CRITICAL |

---

## 1️⃣ 공격 원리

```
Command Injection:
  host = "; rm -rf /"
  os.system(f"ping {host}")  → 서버에서 임의 OS 명령 실행

SSTI (Server-Side Template Injection):
  Jinja2에서 {{ 7*7 }} → "49" 반환 시 SSTI 확인
  {{ config.items() }} → Flask 설정 노출
  {{ ''.__class__.__mro__[1].__subclasses__() }} → RCE 가능
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ CRITICAL: os.system/popen에 사용자 입력
import os
os.system(f"ping -c 1 {host}")
os.popen(f"convert {filename} output.png")
subprocess.call(f"echo {message}", shell=True)  # shell=True + 입력 = 위험

# ❌ CRITICAL: subprocess shell=True + 사용자 입력
subprocess.run(user_cmd, shell=True)
subprocess.Popen(f"git clone {repo_url}", shell=True)

# ❌ CRITICAL: eval/exec에 사용자 입력
eval(user_expression)
exec(user_code)

# ❌ CRITICAL: SSTI — Template에 사용자 입력 직접 렌더링
from jinja2 import Template
template = Template(user_input)  # 사용자가 템플릿 자체를 제어
result = template.render()

# ❌ HIGH: SSTI — render_template_string에 사용자 입력
from flask import render_template_string
return render_template_string(f"Hello {username}!")
# username = "{{config}}" → Flask 설정 전체 노출
```

```javascript
// ❌ CRITICAL: child_process에 사용자 입력
const { exec } = require('child_process');
exec(`convert ${filename} output.png`);  // filename에 "x; cat /etc/passwd"
exec(`git clone ${repoUrl}`);

// ❌ CRITICAL: eval() 사용
eval(req.body.expression);
```

```java
// ❌ CRITICAL: Runtime.exec에 사용자 입력
Runtime.getRuntime().exec("ping " + host);
ProcessBuilder pb = new ProcessBuilder("sh", "-c", userInput);
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ subprocess 리스트 방식 (쉘 해석 없음)
import subprocess, re

def safe_ping(host: str) -> str:
    if not re.match(r'^[a-zA-Z0-9.\-]+$', host):
        raise ValueError("Invalid hostname")
    result = subprocess.run(
        ["ping", "-c", "1", host],  # 리스트 = 쉘 인젝션 불가
        capture_output=True, text=True, timeout=5
    )
    return result.stdout

# ✅ SSTI 방지 — 사용자 입력은 변수로만
from jinja2 import Environment, select_autoescape
env = Environment(autoescape=select_autoescape())
template = env.from_string("Hello, {{ name }}!")  # 템플릿은 고정
result = template.render(name=user_input)           # 입력은 변수
```

---

## 4️⃣ 심각도 판단

```
CRITICAL (전부): Command Injection, SSTI = 즉시 서버 장악 가능
  → 발견 즉시 해당 엔드포인트 비활성화 후 수정
```

---
---

# 🗡️ B-05: Authentication Failures (인증 실패)
## AI 코드 분석 지침

| OWASP | CWE | CVSS |
|-------|-----|------|
| A07:2021 | CWE-287, CWE-384, CWE-798 | 6.5~9.8 |

---

## 1️⃣ 공격 원리

```
JWT alg:none 공격: 알고리즘을 none으로 변조 → 서명 검증 스킵
약한 시크릿 키:   hashcat으로 HS256 키 브루트포스
Brute Force:     Rate Limit 없는 로그인 → 비밀번호 대입
Session Fixation: 로그인 전 세션 ID를 로그인 후에도 재사용
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ CRITICAL: JWT 알고리즘 검증 없음
import jwt
payload = jwt.decode(token, options={"verify_signature": False})

# ❌ CRITICAL: 토큰에서 알고리즘을 읽음 (alg:none 공격)
header = jwt.get_unverified_header(token)
payload = jwt.decode(token, SECRET, algorithms=[header["alg"]])

# ❌ CRITICAL: 약한/기본 시크릿 키
SECRET_KEY = "secret"
SECRET_KEY = "password123"
SECRET_KEY = "your-256-bit-secret"  # 라이브러리 기본값

# ❌ HIGH: 만료 시간 없는 JWT
payload = {"sub": user_id, "role": "admin"}
# exp 클레임 없음 → 영원히 유효

# ❌ HIGH: Rate Limiting 없는 로그인
@app.post("/login")
async def login(credentials: LoginSchema):  # @limiter.limit 없음
    ...

# ❌ HIGH: 비밀번호를 MD5/SHA1로 해시
import hashlib
password_hash = hashlib.md5(password.encode()).hexdigest()
password_hash = hashlib.sha1(password.encode()).hexdigest()

# ❌ MEDIUM: JWT를 localStorage에 저장 (프론트엔드)
localStorage.setItem('token', jwtToken);  // XSS로 탈취 가능
```

```java
// ❌ Spring Security: 기본 설정 그대로 사용
@Configuration
public class SecurityConfig {
  // 커스텀 설정 없음 → 기본 in-memory 사용자
}

// ❌ 비밀번호 평문 저장
user.setPassword(rawPassword);  // 해싱 없음
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ JWT 안전 검증
from jose import JWTError, jwt
SECRET_KEY = os.environ["JWT_SECRET_KEY"]  # 환경 변수, 64바이트 이상
ALGORITHM = "HS256"  # 서버가 고정

def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401)

# ✅ 만료 시간 설정
from datetime import datetime, timedelta
payload = {
    "sub": user_id,
    "exp": datetime.utcnow() + timedelta(minutes=15),
    "iat": datetime.utcnow(),
}

# ✅ Argon2 비밀번호 해싱
from passlib.context import CryptContext
pwd = CryptContext(schemes=["argon2"], deprecated="auto")
hashed = pwd.hash(raw_password)
valid = pwd.verify(raw_password, hashed)

# ✅ Rate Limiting
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/login")
@limiter.limit("5/minute")
async def login(request: Request, ...): ...
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: alg:none / 약한 시크릿 / 비밀번호 평문 저장
HIGH:     Rate Limit 없는 로그인 / JWT 만료 없음 / MD5 해시
MEDIUM:   localStorage JWT 저장 / 세션 타임아웃 미설정
LOW:      로그인 실패 메시지가 username/password 구분 노출
```

---

*참조: OWASP Authentication Cheat Sheet, OWASP JWT Security Cheat Sheet*
