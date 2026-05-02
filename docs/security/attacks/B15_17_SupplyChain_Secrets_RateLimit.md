# 🗡️ B-15: 소프트웨어 공급망 공격 (Supply Chain Attack)
## AI 코드 분석 지침 — Python FastAPI + React/Next.js 특화

| OWASP | CWE | CVSS |
|-------|-----|------|
| A06:2021 + A08:2021 | CWE-829 (Inclusion of Untrusted Code) | 7.0~10.0 CRITICAL |

---

## 1️⃣ 공격 원리

```
Typosquatting:
  pip install reqeusts  (오타)    → 악성 패키지 설치
  pip install python-jwt         → 정상은 PyJWT
  npm install lodahs             → lodash 오타

Dependency Confusion:
  내부 패키지명 "mycompany-utils"를 공개 PyPI에 더 높은 버전으로 업로드
  pip install이 내부 레지스트리보다 공개 PyPI를 우선 선택

버전 고정 미비:
  requests>=2.0  → 취약 버전이 나중에 설치될 수 있음
  "react": "^18.0.0"  → 마이너 업데이트에 악성 코드 삽입 가능

GitHub Actions 공급망:
  uses: some-action@main  → 브랜치가 변조되면 CI 전체 침해
```

---

## 2️⃣ 취약 패턴 탐지

### Python 의존성

```python
# ❌ HIGH: requirements.txt 버전 미고정
requests          # 버전 없음 → 최신 버전 (언제든 변경)
fastapi>=0.100    # >= 범위 지정 → 취약 버전 설치 가능
pydantic~=2.0    # ~= 허용 범위

# ❌ HIGH: 알려진 취약 버전 사용
Pillow==9.0.0    # CVE-2022-22817 (원격 코드 실행)
cryptography==3.4.8  # CVE-2023-49083
PyYAML==5.3      # CVE-2020-14343 (임의 코드 실행)
requests==2.20.0 # CVE-2018-18074

# ❌ MEDIUM: 해시 검증 없는 pip install
# requirements.txt에 --hash 없음

# ❌ HIGH: 의심스러운 패키지 (Typosquatting 의심)
reqeusts         # requests 오타
python-jwt       # PyJWT가 정상 (python-jwt는 의심)
colourama        # colorama 오타
```

### Node.js / npm

```json
// ❌ package.json: 버전 범위 지정
{
  "dependencies": {
    "axios": "^1.0.0",    // ^ = 마이너까지 자동 업데이트
    "lodash": "*",        // * = 모든 버전 허용
    "express": ">=4.0"    // >= 범위
  }
}
// ✅ 정확한 버전 고정 (package-lock.json도 반드시 커밋)
{
  "dependencies": {
    "axios": "1.6.5",
    "lodash": "4.17.21"
  }
}
```

### GitHub Actions

```yaml
# ❌ CRITICAL: 브랜치/태그 참조 (변조 가능)
- uses: actions/checkout@main         # 브랜치 → 언제든 변조
- uses: actions/checkout@v4           # 태그 → 재지정 가능
- uses: some-third-party/action@latest

# ✅ 커밋 SHA 고정 (불변)
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
- uses: actions/setup-python@0b93645e9fea7318ecaed2b359559ac225c90a2  # v5.3.0
```

---

## 3️⃣ 올바른 수정 패턴

```bash
# ✅ Python: 정확한 버전 + 해시 고정
# pip-compile으로 생성 (pip-tools)
pip install pip-tools
pip-compile --generate-hashes requirements.in

# 결과 (requirements.txt):
# requests==2.31.0 \
#     --hash=sha256:58cd2187423d2c4685f04... \
#     --hash=sha256:942c5a758f98d790...

# ✅ 취약 패키지 스캔
pip install pip-audit
pip-audit -r requirements.txt --strict

pip install safety
safety check -r requirements.txt
```

```bash
# ✅ Node.js: package-lock.json 커밋 강제
# .npmrc
package-lock=true
save-exact=true  # ^ 없이 정확한 버전 저장

# 취약 패키지 스캔
npm audit --audit-level=high
npx audit-ci --high

# ✅ Trivy로 통합 스캔
trivy fs . --severity HIGH,CRITICAL
```

```yaml
# ✅ GitHub Actions: 보안 강화 설정
name: Secure CI
on: [push, pull_request]

permissions:
  contents: read          # 최소 권한
  actions: read

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      # SHA 고정
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683

      # Dependabot으로 자동 업데이트 + PR 검토
      # .github/dependabot.yml
```

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10

  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: 알려진 CVE가 있는 버전 사용 + 직접 공격 경로 존재
HIGH:     버전 완전 미고정 / GitHub Actions 브랜치 참조
MEDIUM:   범위 지정 버전 (^, ~=, >=) / Dependabot 미설정
LOW:      해시 검증 없음 (버전은 고정됨)
```

---
---

# 🗡️ B-16: Hardcoded Secrets & Credential Exposure
## AI 코드 분석 지침 — Python FastAPI + React/Next.js 특화

| OWASP | CWE | CVSS |
|-------|-----|------|
| A02:2021 + A05:2021 | CWE-798 (Hardcoded Credentials) | 9.1~9.8 CRITICAL |

---

## 1️⃣ 공격 원리

```
GitHub에 업로드된 순간 자동화 봇이 즉시 스캔:
- GitGuardian 탐지: 평균 4초 내
- 삭제해도 git history에 영구 기록

탈취 후 피해:
- AWS Key → 전체 인프라 장악, 과금 폭탄
- DB 비밀번호 → 전체 데이터 탈취
- JWT Secret → 임의 토큰 위조
- Stripe Key → 결제 사기
```

---

## 2️⃣ 취약 패턴 탐지 (AI 탐지 대상)

```python
# ❌ CRITICAL: AWS 자격증명 하드코딩
AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
boto3.client('s3',
    aws_access_key_id='AKIA...',
    aws_secret_access_key='...'
)

# ❌ CRITICAL: JWT 시크릿 하드코딩
SECRET_KEY = "my-super-secret-jwt-key"
SECRET_KEY = "secret"
SECRET_KEY = "your-256-bit-secret"  # 라이브러리 예제 그대로

# ❌ CRITICAL: DB 연결 문자열에 자격증명
DATABASE_URL = "postgresql://admin:password123@localhost/mydb"
SQLALCHEMY_DATABASE_URI = "mysql://root:root@db:3306/prod"

# ❌ CRITICAL: API 키 하드코딩
OPENAI_API_KEY = "sk-proj-abc123..."
STRIPE_SECRET_KEY = "sk_live_abc123..."
SENDGRID_API_KEY = "SG.abc123..."
SLACK_TOKEN = "xoxb-abc123..."

# ❌ CRITICAL: 비밀번호 하드코딩
ADMIN_PASSWORD = "admin123"
DB_PASSWORD = "production_password_2024"

# ❌ HIGH: .env 파일을 코드에서 읽지만 .gitignore 누락
# (코드 자체는 괜찮지만 .env가 커밋된 경우 탐지)
from dotenv import load_dotenv
load_dotenv()  # .env 파일 로드 — .gitignore 확인 필요
```

```javascript
// ❌ CRITICAL: Next.js/React에서 시크릿 클라이언트 노출
// next.config.js
env: {
    API_SECRET_KEY: 'sk-secret-key',  // 클라이언트 번들에 포함됨!
}

// .env.local (클라이언트에 노출)
NEXT_PUBLIC_API_SECRET=sk-secret  // NEXT_PUBLIC_ prefix = 클라이언트 노출

// ❌ JavaScript 코드 내 하드코딩
const API_KEY = 'sk-proj-abc123';
const stripe = Stripe('sk_live_abc123...');  // Stripe 비밀키 (공개키 아님)
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ 모든 시크릿은 환경 변수에서 로드
import os

# 필수 환경 변수 — 없으면 시작 불가
SECRET_KEY = os.environ["JWT_SECRET_KEY"]           # get() 대신 []
DATABASE_URL = os.environ["DATABASE_URL"]
AWS_ACCESS_KEY_ID = os.environ["AWS_ACCESS_KEY_ID"]

# ✅ 설정 클래스로 중앙화 + 검증
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    jwt_secret_key: str
    database_url: str
    openai_api_key: str
    environment: str = "production"

    model_config = {"env_file": ".env", "case_sensitive": False}

    def validate_secrets(self):
        if len(self.jwt_secret_key) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        if self.environment == "production" and "localhost" in self.database_url:
            raise ValueError("Production cannot use localhost DB")

settings = Settings()
settings.validate_secrets()

# ✅ AWS: 하드코딩 대신 IAM Role/Instance Profile 사용
import boto3
# EC2/Lambda에서는 자격증명 없이 IAM Role로 자동 인증
s3 = boto3.client('s3')  # 환경에서 자동으로 자격증명 획득
```

```bash
# ✅ .gitignore 필수 항목
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore
echo "!.env.example" >> .gitignore  # 예시 파일은 커밋 OK
echo "*.pem" >> .gitignore
echo "*.key" >> .gitignore
echo "*.p12" >> .gitignore
echo "secrets.yaml" >> .gitignore
echo "credentials.json" >> .gitignore

# ✅ 이미 커밋된 시크릿 제거 (BFG Repo Cleaner)
bfg --delete-files .env --no-blob-protection
git push --force

# ✅ pre-commit 훅으로 예방
pip install pre-commit detect-secrets gitleaks
# .pre-commit-config.yaml에 추가
```

```typescript
// ✅ Next.js: 서버/클라이언트 시크릿 분리
// .env.local (서버에서만)
API_SECRET_KEY=sk-secret           // NEXT_PUBLIC_ 없음 = 서버 전용

// .env.local (클라이언트 노출 OK인 것만)
NEXT_PUBLIC_API_URL=https://api.myapp.com  // 공개해도 되는 것만

// pages/api/example.ts (서버 코드)
const secret = process.env.API_SECRET_KEY;  // 서버에서만 접근

// components/Client.tsx (클라이언트 코드)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;  // 공개 URL만 접근
// process.env.API_SECRET_KEY → undefined (클라이언트에서 접근 불가)
```

---

## 4️⃣ 심각도 판단

```
CRITICAL:
- AWS/GCP/Azure 자격증명 하드코딩
- JWT 시크릿 하드코딩 (임의 토큰 위조 가능)
- 프로덕션 DB 비밀번호 하드코딩
- Stripe/결제 API 시크릿 하드코딩
- NEXT_PUBLIC_ 접두사로 시크릿 노출

HIGH:
- 개발 환경 자격증명이지만 프로덕션과 동일
- 내부 서비스 API 키 하드코딩
- 약한 시크릿 (8자 이하)

MEDIUM:
- .env 파일이 .gitignore에 없음 (아직 커밋 안 됨)
- 플레이스홀더처럼 보이지만 실제 형식 일치
```

---
---

# 🗡️ B-17: Improper Rate Limiting & Resource Exhaustion
## AI 코드 분석 지침 — FastAPI + React/Next.js 특화

| OWASP | CWE | CVSS |
|-------|-----|------|
| A04:2021 (API4) | CWE-770 (Unrestricted Resource Allocation) | 5.3~8.6 MEDIUM~HIGH |

---

## 1️⃣ 공격 원리

```
Brute Force:
  로그인 엔드포인트에 Rate Limit 없음
  → 초당 1000번 비밀번호 대입 → 계정 탈취

Credential Stuffing:
  유출된 계정 DB로 자동화 로그인 시도

API 비용 폭탄:
  LLM API를 프록시하는 엔드포인트에 Rate Limit 없음
  → 공격자가 수천만 토큰 소비 → 수백만원 청구

DDoS 증폭:
  무거운 연산(PDF 생성, 이미지 처리) 엔드포인트 반복 요청
  → 서버 CPU/메모리 고갈
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ HIGH: Rate Limit 없는 로그인 엔드포인트
@app.post("/api/auth/login")
async def login(credentials: LoginSchema):  # @limiter.limit 없음
    user = authenticate(credentials)
    return create_token(user)

# ❌ HIGH: Rate Limit 없는 비밀번호 재설정
@app.post("/api/auth/forgot-password")
async def forgot_password(email: str):  # 무제한 이메일 발송 가능
    send_reset_email(email)

# ❌ HIGH: Rate Limit 없는 OTP/MFA 검증
@app.post("/api/auth/verify-otp")
async def verify_otp(code: str):  # 6자리 코드 브루트포스 가능
    return check_otp(code)

# ❌ HIGH: LLM/외부 API 프록시에 Rate Limit 없음
@app.post("/api/ai/chat")
async def ai_chat(message: str):  # 비용 폭탄 공격 가능
    return call_openai(message)

# ❌ MEDIUM: Rate Limit은 있지만 IP 기반만 (VPN으로 우회 가능)
@limiter.limit("100/minute")  # IP 기반만
async def login(request: Request, ...): ...
# → 공격자가 IP 로테이션으로 우회

# ❌ MEDIUM: 응답 크기/페이지 크기 제한 없음
@app.get("/api/users")
async def list_users(limit: int = 100):
    if limit > 10000:  # 제한 있지만 너무 큼
        limit = 10000
    return db.query(User).limit(limit).all()  # 대량 데이터 추출 가능
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ slowapi + Redis 기반 Rate Limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import FastAPI, Request

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 엔드포인트별 세분화된 제한
@app.post("/api/auth/login")
@limiter.limit("5/minute;20/hour")      # 1분 5회, 1시간 20회
async def login(request: Request, credentials: LoginSchema):
    ...

@app.post("/api/auth/forgot-password")
@limiter.limit("3/hour")                # 비밀번호 재설정: 1시간 3회
async def forgot_password(request: Request, email: EmailStr):
    ...

@app.post("/api/auth/verify-otp")
@limiter.limit("5/15minutes")           # OTP: 15분 5회
async def verify_otp(request: Request, code: str):
    ...

@app.post("/api/ai/chat")
@limiter.limit("10/minute;100/day")     # AI: 1분 10회, 하루 100회
async def ai_chat(request: Request, message: str):
    ...

# ✅ 사용자 ID 기반 Rate Limiting (IP 우회 방지)
def get_user_id(request: Request) -> str:
    """인증된 사용자 ID를 Rate Limit 키로 사용"""
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    try:
        payload = verify_token(token)
        return f"user:{payload['sub']}"
    except Exception:
        return get_remote_address(request)  # 미인증은 IP로

user_limiter = Limiter(key_func=get_user_id)

@app.post("/api/ai/generate")
@user_limiter.limit("10/hour")  # 사용자당 1시간 10회
async def generate(request: Request, prompt: str):
    ...

# ✅ 응답 크기 + 페이지 크기 제한
from fastapi import Query

@app.get("/api/users")
async def list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, le=100),  # 최대 100개 강제
    current_user=Depends(require_admin)
):
    offset = (page - 1) * limit
    users = db.query(User).offset(offset).limit(limit).all()
    return {
        "users": users,
        "page": page,
        "limit": limit,
        "total": db.query(User).count()
    }
```

```typescript
// ✅ Next.js API Route Rate Limiting (upstash/ratelimit)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(5, "1 m"),  // 1분에 5회
    analytics: true,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const ip = req.headers['x-forwarded-for'] as string || 'anonymous';
    const { success, limit, reset, remaining } = await ratelimit.limit(ip);

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', reset);

    if (!success) {
        return res.status(429).json({
            error: 'Too Many Requests',
            retryAfter: Math.ceil((reset - Date.now()) / 1000)
        });
    }
    // 실제 로직
}
```

---

## 4️⃣ 심각도 판단

```
CRITICAL:
- OTP/MFA 검증 무제한 → 6자리 코드 브루트포스 수초 내 가능
- 비밀번호 재설정 무제한 → 이메일 스팸 + 계정 탈취

HIGH:
- 로그인 Rate Limit 없음 → Credential Stuffing
- LLM API 프록시 무제한 → 비용 폭탄
- 무거운 연산 엔드포인트 무제한 → DDoS

MEDIUM:
- IP 기반만 (VPN 우회 가능)
- 페이지 크기 제한 없음 → 대량 데이터 추출
- Rate Limit 있으나 임계값이 너무 높음 (1000/min)

LOW:
- 공개 읽기 전용 API에 Rate Limit 없음
```

---

*참조: OWASP API Security Top 10 - API4 (Unrestricted Resource Consumption)*
*구현 도구: slowapi (Python), @upstash/ratelimit (Next.js), Redis*
