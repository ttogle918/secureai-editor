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

---

## 2️⃣ Node.js 공통 즉시 HIGH

```javascript
// ── XSS ──────────────────────────────────────────────
res.send(`<html><body>${req.query.search}</body></html>`);
element.innerHTML = userData;              // 클라이언트
document.write(req.query.name);

// ── SSRF ─────────────────────────────────────────────
const response = await fetch(req.body.url);     // url 검증 없음
const data = await axios.get(req.query.endpoint);

// ── 약한 암호화 ───────────────────────────────────────
crypto.createHash('md5').update(password).digest('hex');
crypto.createHash('sha1').update(password).digest('hex');

// ── 예측 가능 토큰 ────────────────────────────────────
const token = Math.random().toString(36).substr(2);
const csrfToken = Math.random().toString(16);
const sessionId = Date.now().toString();

// ── SSL 검증 비활성화 ─────────────────────────────────
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
axios.get(url, { httpsAgent: new https.Agent({ rejectUnauthorized: false }) });

// ── 민감 정보 로깅 ────────────────────────────────────
console.log(`Login: ${username} / ${password}`);
logger.info(`Token: ${accessToken}`);

// ── JWT ───────────────────────────────────────────────
jwt.verify(token, secret, { algorithms: undefined });  // 알고리즘 미지정
const decoded = jwt.decode(token);                     // verify 아닌 decode
```

---

## 3️⃣ Node.js 공통 확인 필요

```javascript
// 환경 변수 없을 때 기본값
const secret = process.env.JWT_SECRET || 'fallback-secret';
// ✅ 프로덕션에서 'fallback-secret' 사용될 수 있음 → HIGH

// 패키지 버전 (package.json)
"dependencies": {
  "axios": "^1.0.0"   // ^ = 마이너 자동 업데이트 → MEDIUM
  "lodash": "*"       // * = 위험 → HIGH
}

// 미들웨어 순서
app.use(cors());        // cors가 auth보다 먼저? → CORS 설정 확인
app.use(authMiddleware);

// 파일 업로드
multer({ dest: 'uploads/' })
// ✅ fileFilter, limits 설정 있는지 확인 없으면 MEDIUM
```

---
---

# 🚂 STACK_node_express — Express.js 특화 보안 패턴

> **로드 조건:** `require('express')` 또는 `from 'express'` 감지 시.
> `STACK_common_node.md` 와 함께 로드하세요.

---

## Express 즉시 CRITICAL

```javascript
// ── helmet 미사용 (보안 헤더 전무) ───────────────────
const app = express();
// app.use(helmet()) 없음 → X-Frame-Options, CSP 등 없음

// ── CORS 와일드카드 + credentials ────────────────────
app.use(cors({ origin: '*', credentials: true }));

// ── Rate Limiting 없는 로그인 ────────────────────────
app.post('/login', async (req, res) => {
    // express-rate-limit 없음
    const user = await authenticate(req.body);
});

// ── 인증 미들웨어 없는 라우트 ────────────────────────
app.get('/api/admin/users', (req, res) => {
    // authMiddleware 없음
    res.json(User.findAll());
});
```

## Express 즉시 HIGH

```javascript
// ── 소유권 검증 없음 (IDOR) ──────────────────────────
app.get('/api/documents/:id', authenticate, async (req, res) => {
    const doc = await Document.findById(req.params.id);
    // req.user.id와 doc.userId 비교 없음
    res.json(doc);
});

// ── req.body 검증 없이 DB 직접 사용 ─────────────────
app.post('/api/users/:id', authenticate, async (req, res) => {
    await User.findByIdAndUpdate(req.params.id, req.body);
    // req.body에 { isAdmin: true } 포함 가능
});

// ── express-session 설정 미비 ────────────────────────
app.use(session({
    secret: 'keyboard cat',      // 약한 시크릿
    resave: false,
    saveUninitialized: true,     // 빈 세션 저장
    cookie: { secure: false }    // HTTP 전송 허용
}));
```

## Express 올바른 패턴 (참조)

```javascript
// ✅ 보안 설정 기본
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

app.use(helmet());                          // 보안 헤더 자동 적용

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
    credentials: true
}));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15분
    max: 10,                      // 10회
    message: { error: 'Too many login attempts' }
});
app.post('/login', loginLimiter, loginHandler);

// ✅ 소유권 검증
app.get('/api/documents/:id', authenticate, async (req, res) => {
    const doc = await Document.findOne({
        _id: req.params.id,
        userId: req.user.id       // 소유권 검증
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
});

// ✅ DTO 패턴 — 허용 필드만 추출
app.put('/api/users/me', authenticate, async (req, res) => {
    const { username, email, bio } = req.body;  // 명시적 추출
    // isAdmin, role 등은 절대 여기서 업데이트 안 함
    await User.findByIdAndUpdate(req.user.id, { username, email, bio });
});

// ✅ 경로 탈출 방지
app.get('/files/:filename', authenticate, (req, res) => {
    const filename = path.basename(req.params.filename); // 경로 구분자 제거
    const fullPath = path.resolve(UPLOAD_DIR, filename);
    if (!fullPath.startsWith(UPLOAD_DIR)) return res.status(400).end();
    res.sendFile(fullPath);
});
```

---
---

# 🦅 STACK_node_nestjs — NestJS 특화 보안 패턴

> **로드 조건:** `@nestjs/common` 또는 `@nestjs/core` import 감지 시.
> `STACK_common_node.md` 와 함께 로드하세요.

---

## NestJS 즉시 CRITICAL/HIGH

```typescript
// ── @UseGuards 누락 ───────────────────────────────────
@Controller('admin')
// @UseGuards(JwtAuthGuard) 없음
export class AdminController {
    @Delete('users/:id')
    deleteUser(@Param('id') id: string) {
        return this.userService.delete(id);   // 인가 없음
    }
}

// ── ValidationPipe 미적용 ────────────────────────────
async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    // app.useGlobalPipes(new ValidationPipe()) 없음
    // → class-validator 데코레이터가 있어도 검증 안 됨
}

// ── @Body()를 Entity에 직접 바인딩 ─────────────────
@Put('users/:id')
@UseGuards(JwtAuthGuard)
update(@Param('id') id: string, @Body() user: User) {
    // User Entity 직접 → isAdmin, role 등 조작 가능
    return this.userService.update(id, user);
}

// ── @Roles 가드 없는 관리자 기능 ─────────────────────
@Delete('admin/users/:id')
@UseGuards(JwtAuthGuard)      // 인증만, 인가(역할) 없음
deleteUser(@Param('id') id: string) { ... }
```

## NestJS 올바른 패턴 (참조)

```typescript
// ✅ 전역 보안 설정
async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // 전역 유효성 검증 (class-validator 활성화)
    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,        // DTO에 없는 필드 자동 제거 (Mass Assignment 방지)
        forbidNonWhitelisted: true,
        transform: true,
    }));

    app.use(helmet());
    app.enableCors({
        origin: process.env.ALLOWED_ORIGINS?.split(','),
        credentials: true,
    });
}

// ✅ DTO — whitelist:true와 함께 Mass Assignment 완전 방지
export class UpdateUserDto {
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    username: string;

    @IsEmail()
    email: string;
    // isAdmin, role 없음 → ValidationPipe whitelist가 제거
}

// ✅ 역할 기반 접근 제어
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
    @Delete('users/:id')
    deleteUser(@Param('id', ParseIntPipe) id: number) { ... }
}

// ✅ 소유권 검증
@Get('orders/:id')
@UseGuards(JwtAuthGuard)
async getOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: User,
) {
    const order = await this.orderService.findOne(id, user.id); // 소유권 검증
    if (!order) throw new NotFoundException();
    return order;
}
```

## NestJS 의존성 특이사항

```
@nestjs/* < 10.x   → 정기 패치 확인
class-validator 없이 ValidationPipe 사용 → 검증 무효
passport-jwt       → secretOrKey 환경 변수 확인 필수
@nestjs/throttler  → Rate Limiting 모듈 적용 여부 확인
typeorm            → find({where: {id: req.body.id}}) 안전
                     query(`...${id}`) 위험
```
