# 🗡️ B-12: Path Traversal (경로 탐색 공격)
## AI 코드 분석 지침 — Python FastAPI/Flask + React/Next.js 특화

| OWASP | CWE | CVSS |
|-------|-----|------|
| A01:2021 | CWE-22 (Path Traversal) | 6.5~9.8 HIGH~CRITICAL |

---

## 1️⃣ 공격 원리

```
파일 서비스 API에서 사용자가 지정한 경로로 파일을 읽을 때:

filename = "../../etc/passwd"
path = "/app/uploads/" + filename
→ 실제 경로: /app/uploads/../../etc/passwd → /etc/passwd

또는 URL 인코딩으로 필터 우회:
filename = "%2e%2e%2f%2e%2e%2fetc%2fpasswd"
filename = "..%2F..%2Fetc%2Fpasswd"
filename = "....//....//etc/passwd"  (이중 슬래시 우회)
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ CRITICAL: 경로 검증 없는 파일 읽기
from fastapi import FastAPI
from fastapi.responses import FileResponse
import os

@app.get("/files/{filename}")
async def get_file(filename: str):
    path = f"/app/uploads/{filename}"  # 경로 조작 가능
    return FileResponse(path)

# ❌ CRITICAL: open()에 사용자 입력 직접 사용
@app.get("/download")
async def download(filename: str):
    with open(f"./static/{filename}", "rb") as f:  # 탈출 가능
        return f.read()

# ❌ CRITICAL: os.path.join의 절대경로 우회
import os
base = "/app/uploads"
path = os.path.join(base, filename)
# filename = "/etc/passwd" → os.path.join 결과 = "/etc/passwd" (base 무시!)
# os.path.join은 절대경로가 오면 이전 경로를 버림

# ❌ HIGH: 블랙리스트 방식 검증 (우회 가능)
if ".." in filename:  # 단순 블랙리스트
    raise ValueError("Invalid")
# 우회: filename = "....//....//etc/passwd"
# URL 인코딩: %2e%2e%2f 등

# ❌ HIGH: Next.js API Route에서 파일 경로 노출
// pages/api/files/[filename].ts
const filePath = path.join(process.cwd(), 'public', req.query.filename as string);
fs.readFileSync(filePath);  // 경로 검증 없음

# ❌ MEDIUM: 파일 확장자만 검증 (경로는 미검증)
if not filename.endswith('.pdf'):
    raise ValueError("Only PDF")
# "../../etc/passwd%00.pdf" 같은 Null Byte 공격 가능 (구버전 Python)
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ 핵심 방어: Path.resolve()로 실제 절대경로 확인 후 base 경로 내부인지 검증
from pathlib import Path
from fastapi import HTTPException
import re

BASE_UPLOAD_DIR = Path("/app/uploads").resolve()

def safe_file_path(filename: str) -> Path:
    """경로 탈출 시도를 완전 차단하는 안전한 경로 생성"""

    # 1단계: 파일명 화이트리스트 검증 (영숫자, 하이픈, 점만 허용)
    if not re.match(r'^[a-zA-Z0-9_\-\.]+$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename")

    # 2단계: 확장자 화이트리스트
    ALLOWED_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.txt'}
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="File type not allowed")

    # 3단계: 실제 경로 해석 후 base 디렉토리 내부인지 확인
    target = (BASE_UPLOAD_DIR / filename).resolve()
    if not str(target).startswith(str(BASE_UPLOAD_DIR)):
        # 경로 탈출 시도 감지 → 보안 로그 기록
        security_logger.warning(f"Path traversal attempt: {filename}")
        raise HTTPException(status_code=400, detail="Invalid path")

    return target

@app.get("/files/{filename}")
async def get_file(filename: str, current_user=Depends(get_current_user)):
    file_path = safe_file_path(filename)
    if not file_path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(file_path)
```

```typescript
// ✅ Next.js: 파일 서빙 안전 패턴
import path from 'path';
import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from 'next';

const BASE_DIR = path.resolve(process.cwd(), 'uploads');
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg']);

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    const filename = req.query.filename as string;

    // 화이트리스트 검증
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(filename)) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return res.status(400).json({ error: 'File type not allowed' });
    }

    // 경로 탈출 방지: resolve 후 base 내부 확인
    const fullPath = path.resolve(BASE_DIR, filename);
    if (!fullPath.startsWith(BASE_DIR + path.sep)) {
        return res.status(400).json({ error: 'Invalid path' });
    }

    if (!fs.existsSync(fullPath)) return res.status(404).end();
    res.sendFile(fullPath);
}
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: 경로 검증 없음 + 파일 읽기 → /etc/passwd, 소스코드, .env 노출
HIGH:     블랙리스트만으로 검증 (우회 가능) / 파일 쓰기 포함
MEDIUM:   확장자만 검증 (경로 탈출은 막되 일부 위험)
LOW:      파일명만 사용 (경로 구분자 없음)
```

---
---

# 🗡️ B-13: Mass Assignment / Parameter Pollution
## AI 코드 분석 지침 — FastAPI + React/Next.js 특화

| OWASP | CWE | CVSS |
|-------|-----|------|
| A03:2021 (API3) | CWE-915 (Improperly Controlled Modification) | 6.5~9.1 HIGH |

---

## 1️⃣ 공격 원리

```
Mass Assignment:
  API가 클라이언트 데이터를 모델에 그대로 바인딩할 때,
  공격자가 수정 불가 필드(is_admin, role, balance)를 요청에 포함

  정상 요청: {"username": "alice", "email": "alice@ex.com"}
  공격 요청: {"username": "alice", "email": "alice@ex.com",
              "is_admin": true, "role": "superadmin", "balance": 9999999}

HTTP Parameter Pollution:
  ?id=1&id=2 → 파서마다 다르게 해석 → 검증 우회
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ CRITICAL: dict/**kwargs로 모델 직접 업데이트
@app.put("/api/users/{user_id}")
async def update_user(user_id: int, data: dict,
                      current_user=Depends(get_current_user)):
    # data에 is_admin, role, balance 등 무엇이든 올 수 있음
    db.query(User).filter(User.id == user_id).update(data)

# ❌ CRITICAL: request.json()을 그대로 ORM에 전달
@app.put("/api/profile")
async def update_profile(request: Request):
    data = await request.json()
    user = db.query(User).first()
    for key, value in data.items():   # 모든 키를 그대로 적용
        setattr(user, key, value)

# ❌ HIGH: Pydantic 모델이 있지만 민감 필드 포함
class UserUpdate(BaseModel):
    username: str
    email: str
    is_admin: bool    # ❌ 클라이언트가 직접 제어 가능
    role: str         # ❌ 클라이언트가 직접 제어 가능
    balance: float    # ❌ 클라이언트가 직접 제어 가능

# ❌ HIGH: SQLAlchemy model_update 오용
@app.put("/api/items/{item_id}")
async def update_item(item_id: int, data: dict):
    item = db.query(Item).get(item_id)
    item.__dict__.update(data)   # 모든 속성 덮어쓰기

# ❌ MEDIUM: exclude 방식 (화이트리스트가 아닌 블랙리스트)
class UserUpdateBad(BaseModel):
    model_config = ConfigDict(extra='allow')  # 추가 필드 허용
    username: str
    # is_admin 제외를 잊으면 취약
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ 핵심: Pydantic으로 허용 필드만 명시적으로 정의 (화이트리스트)
from pydantic import BaseModel, ConfigDict

class UserUpdateRequest(BaseModel):
    """일반 사용자가 수정 가능한 필드만 포함"""
    model_config = ConfigDict(extra='forbid')  # 추가 필드 거부

    username: str = Field(min_length=2, max_length=50)
    email: EmailStr
    bio: str = Field(default="", max_length=500)
    # is_admin, role, balance, created_at 등 민감 필드 없음

class AdminUserUpdateRequest(BaseModel):
    """관리자만 수정 가능한 필드"""
    role: Literal["user", "moderator", "admin"]
    is_active: bool

@app.put("/api/users/me")
async def update_my_profile(
    data: UserUpdateRequest,         # Pydantic이 허용 필드만 파싱
    current_user=Depends(get_current_user),
    db=Depends(get_db)
):
    # 명시적으로 허용된 필드만 업데이트
    current_user.username = data.username
    current_user.email = data.email
    current_user.bio = data.bio
    # is_admin, role은 절대 여기서 변경 안 함
    db.commit()
    return current_user

# ✅ 관리자 전용 필드 업데이트는 별도 엔드포인트 + 별도 스키마
@app.put("/api/admin/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    data: AdminUserUpdateRequest,
    admin=Depends(require_role("admin")),
    db=Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    user.role = data.role
    user.is_active = data.is_active
    db.commit()

# ✅ model_dump(include=...)로 안전하게 업데이트
@app.put("/api/items/{item_id}")
async def update_item(item_id: int, data: ItemUpdateRequest,
                      current_user=Depends(get_current_user)):
    item = db.query(Item).filter(
        Item.id == item_id,
        Item.owner_id == current_user.id
    ).first()
    # 허용된 필드만 추출하여 업데이트
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)
    db.commit()
```

```typescript
// ✅ React/Next.js: 전송 전 허용 필드만 포함
interface UserUpdatePayload {
    username: string;
    email: string;
    bio?: string;
    // is_admin, role 등 민감 필드 타입에 없음
}

async function updateProfile(formData: FormData) {
    // FormData에서 허용 필드만 추출 (추가 필드 무시)
    const payload: UserUpdatePayload = {
        username: formData.get('username') as string,
        email: formData.get('email') as string,
        bio: formData.get('bio') as string,
    };
    // payload에는 is_admin 등이 포함될 수 없음
    await api.put('/api/users/me', payload);
}
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: dict 그대로 ORM 업데이트 + is_admin/role 필드 존재
HIGH:     Pydantic에 민감 필드 포함 / extra='allow' 설정
MEDIUM:   exclude 방식 사용 (블랙리스트 — 필드 추가 시 누락 위험)
LOW:      민감 필드 없는 모델에서 extra 허용
```

---
---

# 🗡️ B-14: Open Redirect
## AI 코드 분석 지침 — FastAPI + React/Next.js 특화

| OWASP | CWE | CVSS |
|-------|-----|------|
| A01:2021 | CWE-601 (URL Redirection to Untrusted Site) | 4.7~6.1 MEDIUM |

---

## 1️⃣ 공격 원리

```
피싱 공격 연계:
  정상 URL: https://myapp.com/login?next=/dashboard
  악성 URL: https://myapp.com/login?next=https://evil.com/phishing

→ 사용자가 myapp.com 도메인을 신뢰하고 링크 클릭
→ 로그인 후 evil.com으로 리다이렉트
→ evil.com에서 자격증명 재입력 유도 (피싱)

OAuth2 토큰 탈취:
  https://myapp.com/oauth/callback?redirect_uri=https://attacker.com
  → OAuth 인가 코드가 attacker.com으로 전달
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ HIGH: 사용자 입력 URL로 직접 리다이렉트
from fastapi.responses import RedirectResponse

@app.get("/login")
async def login_redirect(next: str = "/"):
    # 인증 후 next URL로 리다이렉트 — 외부 URL 검증 없음
    return RedirectResponse(url=next)

@app.get("/logout")
async def logout(return_url: str = "/"):
    clear_session()
    return RedirectResponse(url=return_url)  # 외부 URL 가능

# ❌ HIGH: Location 헤더에 사용자 입력 직접 사용
@app.post("/api/callback")
async def oauth_callback(code: str, redirect_uri: str):
    token = exchange_code(code)
    return Response(
        status_code=302,
        headers={"Location": redirect_uri}  # redirect_uri 검증 없음
    )

# ❌ MEDIUM: 프로토콜 상대 URL 미처리
# next = "//evil.com" → 브라우저가 현재 프로토콜로 리다이렉트
if next.startswith("/"):  # //evil.com 통과됨
    return RedirectResponse(url=next)
```

```typescript
// ❌ Next.js: router.push에 외부 URL 직접 사용
const { next } = router.query;
router.push(next as string);  // 외부 URL 가능

// ❌ window.location 직접 조작
const returnUrl = new URLSearchParams(window.location.search).get('return');
window.location.href = returnUrl;  // 피싱 리다이렉트

// ❌ Next.js getServerSideProps redirect
export const getServerSideProps = async (ctx) => {
    const next = ctx.query.next;
    return { redirect: { destination: next, permanent: false } };  // 외부 가능
}
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ 화이트리스트 방식 URL 검증
from urllib.parse import urlparse
import re

ALLOWED_REDIRECT_PATHS = re.compile(r'^/[a-zA-Z0-9/_\-]*$')
ALLOWED_DOMAINS = {"myapp.com", "www.myapp.com"}

def validate_redirect_url(url: str, allow_external: bool = False) -> str:
    """안전한 리다이렉트 URL 반환 (위험 시 기본값 반환)"""
    if not url:
        return "/"

    # 상대 경로 허용 (프로토콜 상대 URL // 제외)
    if url.startswith("/") and not url.startswith("//"):
        if ALLOWED_REDIRECT_PATHS.match(url):
            return url
        return "/"  # 패턴 불일치 → 기본값

    # 절대 URL은 도메인 화이트리스트로만 허용
    if allow_external:
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https") and \
           parsed.netloc in ALLOWED_DOMAINS:
            return url

    return "/"  # 허용되지 않으면 기본값으로

@app.get("/login")
async def login(next: str = "/"):
    safe_next = validate_redirect_url(next)
    # ... 인증 처리 ...
    return RedirectResponse(url=safe_next)
```

```typescript
// ✅ Next.js: 리다이렉트 URL 검증
function getSafeRedirectUrl(url: string | string[] | undefined): string {
    const redirectUrl = Array.isArray(url) ? url[0] : url ?? '/';

    // 상대 경로만 허용 (절대 URL 차단)
    if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
        // 허용된 경로 패턴 검증
        if (/^\/[a-zA-Z0-9/_\-]*$/.test(redirectUrl)) {
            return redirectUrl;
        }
    }
    return '/';  // 안전하지 않으면 홈으로
}

// 사용
const { next } = router.query;
const safeUrl = getSafeRedirectUrl(next);
router.push(safeUrl);
```

---

## 4️⃣ 심각도 판단

```
HIGH:   OAuth 콜백 redirect_uri 미검증 → 인가 코드/토큰 탈취
MEDIUM: 로그인 후 next 파라미터 미검증 → 피싱 연계
LOW:    내부 경로만 이동하나 프로토콜 상대 URL 미처리
```

---

*참조: OWASP Unvalidated Redirects and Forwards Cheat Sheet*
