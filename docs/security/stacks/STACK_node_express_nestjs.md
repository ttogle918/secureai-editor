# 🟩 STACK_common_node — Node.js 공통 보안 패턴
## Express · NestJS 공유 지침 | RAG 추가 대상

> **로드 조건:** `.js` `.ts` 파일에서 `require('express')` 또는
> `@nestjs` import 감지 시. 프레임워크 특화 파일과 함께 로드하세요.

---

## 1️⃣ Node.js 공통 즉시 CRITICAL

```javascript
// ── SQL Injection ─────────────────────────────────────
const query = `SELECT * FROM users WHERE id = '${userId}'`;
db.query(query);

const sql = "SELECT * FROM orders WHERE user_id = " + req.body.userId;

knex.raw(`SELECT * FROM users WHERE id = ${req.params.id}`);
connection.query(`SELECT * FROM user WHERE id = '${id}'`);

// ── Command Injection ─────────────────────────────────
const { exec } = require('child_process');
exec(`convert ${req.body.filename} output.png`);
exec(`git clone ${req.query.repo}`);
exec(`ping ${req.params.host}`);

// ── Code Injection ────────────────────────────────────
eval(req.body.expression);
eval(req.query.code);
new Function(userCode)();

// ── Path Traversal ────────────────────────────────────
const filePath = path.join('./uploads', req.query.filename);
// filename = "../../etc/passwd" 가능
fs.readFileSync(`./static/${req.params.file}`);

// ── 하드코딩 자격증명 ────────────────────────────────
const JWT_SECRET = 'secret';
const DB_PASSWORD = 'admin123';
const STRIPE_KEY = 'sk_live_abc123...';
const API_KEY = 'sk-proj-...';
```
... (rest of the file)
