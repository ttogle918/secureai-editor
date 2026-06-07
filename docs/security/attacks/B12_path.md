# B12: Path Traversal
OWASP: A01:2021 | CWE-22 | CVSS: 6.5~9.8 HIGH~CRITICAL

## 취약 패턴
```python
# CRITICAL — 경로 검증 없음
@app.get("/files/{filename}")
async def get_file(filename: str):
    path = f"/app/uploads/{filename}"     # filename = "../../etc/passwd"
    return FileResponse(path)

with open(f"./static/{filename}", "rb"):  # 탈출 가능
    ...

# CRITICAL — os.path.join 함정
base = "/app/uploads"
path = os.path.join(base, filename)
# filename = "/etc/passwd" → os.path.join = "/etc/passwd" (base 무시!)

# HIGH — 블랙리스트만
if ".." in filename: raise ValueError()   # "....//....//etc" 우회 가능
```
```javascript
const filePath = path.join('./uploads', req.query.filename)  // CRITICAL
fs.readFileSync(`./static/${req.params.file}`)
```

## 수정 패턴
```python
# ✅ resolve() + base 검증 (핵심 패턴)
from pathlib import Path
import re

BASE_DIR = Path("/app/uploads").resolve()
ALLOWED_EXT = {'.pdf', '.png', '.jpg', '.jpeg'}

def safe_file_path(filename: str) -> Path:
    if not re.match(r'^[a-zA-Z0-9_\-\.]+$', filename):
        raise HTTPException(400, "Invalid filename")
    if Path(filename).suffix.lower() not in ALLOWED_EXT:
        raise HTTPException(400, "File type not allowed")
    target = (BASE_DIR / filename).resolve()
    if not str(target).startswith(str(BASE_DIR)):
        security_logger.warning(f"Path traversal: {filename}")
        raise HTTPException(400, "Invalid path")
    return target
```
```typescript
const fullPath = path.resolve(BASE_DIR, filename)
if (!fullPath.startsWith(BASE_DIR + path.sep)) return res.status(400).end()
```

## 심각도
- CRITICAL: 경로 검증 없음 → /etc/passwd, .env, 소스코드 노출
- HIGH: 블랙리스트만 (우회 가능) / 파일 쓰기 포함
- MEDIUM: 확장자만 검증 (경로 탈출 일부 가능)
