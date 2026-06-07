# B07: Cryptographic Failures
OWASP: A02:2021 | CWE-327, CWE-328 | CVSS: 5.9~9.1

## 취약 패턴
```python
# CRITICAL
hashlib.md5(password.encode()).hexdigest()
hashlib.sha1(password.encode()).hexdigest()
SECRET_KEY = "hardcoded-key"
AES_KEY = b"1234567890abcdef"
requests.get(url, verify=False)
ssl._create_default_https_context = ssl._create_unverified_context

# HIGH
AES.new(key, AES.MODE_ECB)         # ECB = 패턴 노출
os.urandom(16)                      # AES-128 → AES-256 권고
RSA.generate(1024)                  # 취약
random.randint(1,999999)            # 보안 목적 약한 난수
```
```javascript
crypto.createHash('md5').update(password)  // CRITICAL
const JWT_SECRET = 'hardcoded'            // CRITICAL
Math.random() /* for tokens */            // HIGH
```
```java
MessageDigest.getInstance("MD5")          // CRITICAL
Cipher.getInstance("AES/ECB/PKCS5Padding") // HIGH
Cipher.getInstance("DES")                 // HIGH
```

## 수정 패턴
```python
# ✅ 비밀번호
from passlib.context import CryptContext
pwd = CryptContext(schemes=["argon2"], deprecated="auto")

# ✅ 대칭 암호화 AES-256-GCM
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
key = os.urandom(32); nonce = os.urandom(12)
ct = AESGCM(key).encrypt(nonce, plaintext, None)

# ✅ 안전한 난수
import secrets; token = secrets.token_urlsafe(32)

# ✅ 모든 시크릿 환경변수에서
SECRET_KEY = os.environ["SECRET_KEY"]   # [] = 없으면 에러
```

## 심각도
- CRITICAL: 하드코딩 키 / MD5·SHA1 비밀번호 / SSL verify=False
- HIGH: AES-ECB / AES-128 / Math.random() 토큰
- MEDIUM: SHA-256 단독(장기 보관 데이터)
