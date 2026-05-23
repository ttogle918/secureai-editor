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
... (rest of the file)
