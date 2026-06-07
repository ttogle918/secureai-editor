# 🟨 STACK_common_js — JavaScript/TypeScript 공통 보안 패턴
## 모든 JS/TS 스택 공유 | RAG 추가 대상

> **로드 조건:** .js, .ts, .jsx, .tsx 파일 감지 시 항상 로드.
> Express·NestJS·React·Next.js·Vue·Angular 스택 파일과 함께 사용.

---

## 1️⃣ JS/TS 공통 즉시 CRITICAL

```javascript
// eval() / new Function() — RCE
eval(userInput)
eval(apiResponse.code)
new Function(userCode)()
new Function('return ' + expression)()

// 동적 require/import
require(userInput)                               // RCE
const mod = require(`./plugins/${pluginName}`)   // CRITICAL

// 직접 DOM XSS
document.getElementById('x').innerHTML = userData
document.write(location.search)
element.insertAdjacentHTML('beforeend', userContent)

// 하드코딩 시크릿 (번들에 포함)
const JWT_SECRET = 'my-secret'
const API_KEY = 'sk-proj-abc123...'
const DB_PASSWORD = 'admin123'
const STRIPE_SECRET = 'sk_live_...'
```

---

## 2️⃣ JS/TS 공통 즉시 HIGH

```javascript
// localStorage에 JWT/Access Token 저장
localStorage.setItem('access_token', token)      // XSS로 탈취 HIGH
localStorage.setItem('jwt', jwtToken)
sessionStorage.setItem('token', accessToken)

// 약한 암호화
const crypto = require('crypto')
crypto.createHash('md5').update(password).digest('hex')   // 비밀번호 MD5
crypto.createHash('sha1').update(password).digest('hex')  // SHA1

// 예측 가능한 토큰
const token = Math.random().toString(36).substr(2)        // 예측 가능
const id = Date.now().toString()

// SSL 검증 비활성화
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'            // 전체 비활성화
axios.get(url, { httpsAgent: new https.Agent({ rejectUnauthorized: false }) })

// Prototype Pollution
Object.assign(target, JSON.parse(userInput))
// {"__proto__": {"isAdmin": true}} → 모든 객체에 isAdmin 주입
lodash.merge({}, JSON.parse(userInput))                   // lodash < 4.17.21
```

---

## 3️⃣ JS/TS 공통 확인 필요

```javascript
// 환경 변수 기본값
const secret = process.env.JWT_SECRET || 'fallback'      // 프로덕션에서 위험
const key = process.env.API_KEY ?? 'dev-key'             // 동일

// JSON.parse 에러 처리
const data = JSON.parse(userInput)  // try-catch 없음 → 앱 크래시 가능
// ✅ try-catch 또는 zod.safeParse() 사용

// package.json 버전 범위
"axios": "^1.0.0"   // ^ = 마이너 자동 업데이트 → MEDIUM
"lodash": "*"       // * = HIGH

// HTTPS fetch 검증
fetch(url)
// ✅ url이 사용자 입력이면 SSRF HIGH
// ✅ url이 하드코딩이면 OK
```

---

## 4️⃣ JS/TS 공통 올바른 패턴

```javascript
// ✅ 안전한 난수
import { randomBytes } from 'crypto'
const token = randomBytes(32).toString('hex')

// ✅ 비밀번호 해시 — bcrypt
import bcrypt from 'bcrypt'
const hash = await bcrypt.hash(password, 12)
const valid = await bcrypt.compare(input, hash)

// ✅ 토큰 메모리 저장
let _accessToken = null
const setToken = (t) => { _accessToken = t }
const getToken = () => _accessToken
// Refresh Token은 httpOnly 쿠키로 서버가 설정

// ✅ 환경변수 — 기본값 없음 (없으면 에러)
const secret = process.env.JWT_SECRET
if (!secret) throw new Error('JWT_SECRET is required')

// ✅ Prototype Pollution 방어
function safeMerge(target, source) {
  const parsed = JSON.parse(JSON.stringify(source))  // 깊은 복사
  delete parsed.__proto__
  delete parsed.constructor
  Object.assign(target, parsed)
}
// 또는 Object.create(null)로 프로토타입 없는 객체 생성

// ✅ CSP 헤더 (서버)
res.setHeader('Content-Security-Policy',
  "default-src 'self'; script-src 'self'; object-src 'none'")
```

---

## 5️⃣ 공통 의존성 점검

```
# 항상 실행
npm audit --audit-level=high
npx audit-ci --high

# 알려진 취약 패키지
lodash < 4.17.21     → Prototype Pollution (CVE-2020-8203)
node-fetch < 3.2.10  → 취약점 다수
axios < 1.6.x        → SSRF/CSRF 패치
jsonwebtoken < 9.0   → alg confusion 취약점
serialize-javascript < 6.0.2 → XSS
```
