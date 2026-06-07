# B04: Command Injection / SSTI
OWASP: A03:2021 | CWE-78, CWE-94 | CVSS: 9.0~10.0 CRITICAL (전부)

## 취약 패턴 — Command Injection
```python
# Python - CRITICAL (발견 즉시 해당 엔드포인트 비활성화)
os.system(f"ping -c 1 {host}")
os.popen(f"convert {filename} output.png")
subprocess.run(user_cmd, shell=True)           # shell=True + 사용자 입력
subprocess.call(f"echo {message}", shell=True)
subprocess.Popen(f"git clone {repo_url}", shell=True)
```
```javascript
exec(`convert ${req.body.filename} output.png`)   // CRITICAL
exec(`ping ${req.params.host}`)
exec(`git clone ${req.query.repo}`)
```
```java
Runtime.getRuntime().exec("ping " + host)          // CRITICAL
new ProcessBuilder("sh", "-c", userInput).start()
```

## 취약 패턴 — SSTI
```python
# Jinja2 SSTI - CRITICAL (RCE 가능)
from jinja2 import Template
template = Template(user_input)          # 사용자가 템플릿 자체를 제어
result = template.render()

from flask import render_template_string
return render_template_string(f"Hello {username}!")  # {{config}} → 설정 노출
# 탐지: {{7*7}} → "49" 반환 시 SSTI 확인
# 공격: {{''.__class__.__mro__[1].__subclasses__()}} → RCE
```

## 수정 패턴
```python
# ✅ subprocess 리스트 방식 (쉘 해석 없음)
import re
if not re.match(r'^[a-zA-Z0-9.\-]+$', host):
    raise ValueError("Invalid hostname")
result = subprocess.run(["ping", "-c", "1", host],  # 리스트 = 인젝션 불가
    capture_output=True, text=True, timeout=5)

# ✅ SSTI 방지 — 입력은 변수로만
from jinja2 import Environment, select_autoescape
env = Environment(autoescape=select_autoescape())
template = env.from_string("Hello, {{ name }}!")  # 템플릿 고정
result = template.render(name=user_input)          # 입력은 변수
```
```javascript
// ✅ exec 대신 spawn (인자 분리)
const { spawn } = require('child_process')
const proc = spawn('ping', ['-c', '1', host])  // 쉘 없음
```

## 심각도
- CRITICAL: 모든 Command Injection, SSTI → 즉시 서버 장악 가능
- 발견 즉시 해당 엔드포인트 비활성화 후 수정
