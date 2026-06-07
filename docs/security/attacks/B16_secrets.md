# B16: Hardcoded Secrets & Credential Exposure
OWASP: A02:2021 + A05:2021 | CWE-798 | CVSS: 9.1~9.8 CRITICAL

## 탐지 패턴 (전부 CRITICAL)
```python
# AWS
AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/..."
boto3.client('s3', aws_access_key_id='AKIA...', aws_secret_access_key='...')

# JWT
SECRET_KEY = "secret"
SECRET_KEY = "password"
SECRET_KEY = "your-256-bit-secret"   # 라이브러리 기본값

# DB
DATABASE_URL = "postgresql://admin:password123@localhost/mydb"
SQLALCHEMY_DATABASE_URI = "mysql://root:root@db:3306/prod"

# API 키
OPENAI_API_KEY = "sk-proj-abc123..."
STRIPE_SECRET_KEY = "sk_live_abc123..."
SENDGRID_API_KEY = "SG.abc123..."
SLACK_TOKEN = "xoxb-abc123..."

# 기본값 있는 getenv (위험)
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
```
```javascript
// CRITICAL
const JWT_SECRET = 'hardcoded-secret'
const stripe = Stripe('sk_live_abc123...')     // 비밀키
const API_KEY = 'sk-proj-...'
```
```
# .env 파일
NEXT_PUBLIC_API_SECRET=sk-secret    # NEXT_PUBLIC_ = 클라이언트 번들에 포함!
```

## 정규식 탐지 패턴
```
AKIA[0-9A-Z]{16}                     # AWS Access Key
sk-proj-[a-zA-Z0-9]{20,}            # OpenAI API Key
sk_live_[a-zA-Z0-9]{24,}            # Stripe Secret
xox[baprs]-[0-9a-zA-Z]{10,}         # Slack Token
ghp_[a-zA-Z0-9]{36}                  # GitHub Personal Token
(?:password|passwd|secret|key)\s*=\s*['"][^'"]{4,}  # 일반 패턴
```

## 수정 패턴
```python
# ✅ 환경변수에서만 로드 (기본값 없음)
SECRET_KEY = os.environ["JWT_SECRET_KEY"]   # [] = 없으면 에러로 조기 발견
DATABASE_URL = os.environ["DATABASE_URL"]

# ✅ Pydantic Settings
from pydantic_settings import BaseSettings
class Settings(BaseSettings):
    jwt_secret_key: str
    database_url: str
    model_config = {"env_file": ".env"}
```
```bash
# ✅ .gitignore 필수
echo -e ".env\n.env.*\n!.env.example\n*.pem\n*.key\n*.p12" >> .gitignore

# ✅ 이미 커밋된 경우
bfg --delete-files .env --no-blob-protection
# 즉시 키 로테이션!
```

## 심각도
- CRITICAL: AWS/GCP/결제 키 / JWT 시크릿 / DB 비밀번호 / NEXT_PUBLIC_ 시크릿
- HIGH: 내부 서비스 API 키 / 약한 시크릿(8자 이하)
- MEDIUM: .env가 .gitignore에 없음 (미커밋 상태)
