# 🐍 STACK_common_python — Python 공통 보안 패턴
## FastAPI · Flask 공유 지침 | RAG 추가 대상

> **로드 조건:** `.py` 파일 분석 시 항상 로드.
> FastAPI/Flask 특화 파일과 **함께** 사용하세요.

---

## 1️⃣ 즉시 CRITICAL — Python 공통 위험 패턴

```python
# 아래 패턴 발견 시 컨텍스트 무관하게 CRITICAL 선언

# ── 인젝션 ──────────────────────────────────────────
f"SELECT * FROM {table} WHERE id = '{user_input}'"   # SQLi
f"SELECT * FROM users WHERE name = '{name}'"
"SELECT" + " * FROM users WHERE id = " + user_id

os.system(f"ping {host}")                            # Command Injection
os.popen(f"convert {filename}")
subprocess.run(user_cmd, shell=True)
subprocess.call(cmd_string, shell=True)

eval(user_input)                                     # Code Injection
exec(user_code)
Template(user_input).render()                        # SSTI

# ── 역직렬화 ─────────────────────────────────────────
pickle.loads(request_data)                           # RCE
pickle.loads(base64.b64decode(cookie))
marshal.loads(user_data)
yaml.load(user_input)          # safe_load 아님 → RCE

# ── 자격증명 ─────────────────────────────────────────
SECRET_KEY = "secret"          # 약한 JWT 시크릿
SECRET_KEY = "password"
AWS_SECRET = "wJalrX..."       # AWS 키 하드코딩
password_hash = hashlib.md5(pw.encode()).hexdigest()
password_hash = hashlib.sha1(pw.encode()).hexdigest()

# ── 파일/경로 ────────────────────────────────────────
open(f"./uploads/{user_filename}")                   # Path Traversal
open(f"/data/{request.args.get('file')}")
path = base_dir + user_input                         # os.path.join 아닌 단순 연결
```

---

## 2️⃣ 즉시 HIGH — Python 공통

```python
# ── 인증 ─────────────────────────────────────────────
jwt.decode(token, options={"verify_signature": False})  # 서명 검증 스킵
header = jwt.get_unverified_header(token)
jwt.decode(token, key, algorithms=[header["alg"]])      # alg 클라이언트 지정

import random
token = random.randint(100000, 999999)                  # 예측 가능한 토큰
session_id = str(random.random())

# ── 암호화 ───────────────────────────────────────────
from Crypto.Cipher import AES
cipher = AES.new(key, AES.MODE_ECB)                    # ECB 모드
aes_key = os.urandom(16)                               # AES-128 (→ AES-256 권고)
rsa_key = RSA.generate(1024)                           # RSA-1024 취약
rsa_key = RSA.generate(2048)                           # RSA-2048 (→ 4096 권고)

# ── 네트워크 ─────────────────────────────────────────
requests.get(url, verify=False)                        # SSL 검증 비활성화
httpx.get(url, verify=False)
ssl._create_default_https_context = ssl._create_unverified_context

# ── 외부 요청 ────────────────────────────────────────
requests.get(user_provided_url)                        # SSRF
httpx.get(req.args.get('url'))
urllib.request.urlopen(user_url)

# ── 정보 노출 ────────────────────────────────────────
logger.info(f"password: {password}")                   # 민감 정보 로깅
logger.debug(f"token: {access_token}")
print(f"API key: {os.environ['SECRET_KEY']}")
```

---

## 3️⃣ 확인 필요 패턴 (컨텍스트 보고 판단)

```python
# 아래는 반드시 주변 코드를 확인한 후 판단

db.execute(text(query))
# → query 변수가 f-string 또는 + 조합이면 SQLi CRITICAL
# → :param 바인딩이면 안전

subprocess.run(cmd, ...)
# → shell=True + 사용자 입력이면 CRITICAL
# → shell=False + 리스트면 안전

yaml.safe_load(data)
# → safe_load면 안전 (load만 위험)

os.path.join(base, user_input)
# → resolve() 후 base 내부 검증 없으면 Path Traversal HIGH
# → 검증 있으면 안전

requests.get(url)
# → url이 하드코딩이면 안전
# → url이 사용자 입력이면 SSRF HIGH

open(path)
# → path가 하드코딩이면 안전
# → path에 사용자 입력 포함이면 Path Traversal HIGH

from dotenv import load_dotenv
# → .env 파일을 .gitignore에서 확인 필요 (코드 자체는 OK)
```

---

## 4️⃣ Python 보안 올바른 패턴 (비교 참조용)

```python
# ✅ SQL — SQLAlchemy ORM 또는 파라미터 바인딩
user = db.query(User).filter(User.id == user_id).first()
db.execute(text("SELECT * FROM users WHERE id = :uid"), {"uid": user_id})

# ✅ 비밀번호 해시 — Argon2 (변경 불필요한 코드 발견 시 OK 표시)
from passlib.context import CryptContext
pwd = CryptContext(schemes=["argon2"], deprecated="auto")

# ✅ 안전한 난수
import secrets
token = secrets.token_urlsafe(32)

# ✅ subprocess 안전 사용
subprocess.run(["ping", "-c", "1", host], capture_output=True, timeout=5)

# ✅ 파일 경로 검증
target = (BASE_DIR / user_input).resolve()
assert str(target).startswith(str(BASE_DIR))

# ✅ SSRF 방어 — 화이트리스트
ALLOWED_DOMAINS = {"api.partner.com"}
parsed = urlparse(url)
assert parsed.netloc in ALLOWED_DOMAINS

# ✅ 환경 변수에서만 시크릿 로드
SECRET_KEY = os.environ["JWT_SECRET_KEY"]   # get() 대신 [] (없으면 에러)
```

---

## 5️⃣ Python 의존성 — 즉시 체크 항목

```
requirements.txt 발견 시 아래 패턴 탐지:

🔴 버전 없음:     requests             → HIGH (최신 취약 버전 설치 가능)
🔴 범위 지정:    requests>=2.0        → MEDIUM
🔴 ~= 허용:      pydantic~=2.0       → MEDIUM
🟠 알려진 취약:  Pillow==9.0.0       → CVE 확인 필요
🟠 구버전:       PyYAML==5.3         → CVE-2020-14343
🟢 정확한 고정: requests==2.31.0     → OK (pip-audit 별도 권고)
```

---

*공통 파일 — FastAPI·Flask 스택 파일과 함께 로드*
*참조: Python Security Best Practices, Bandit Rules B3xx/B6xx*
