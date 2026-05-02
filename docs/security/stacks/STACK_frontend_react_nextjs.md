# ⚛️ STACK_frontend_react_nextjs — React · Next.js 보안 패턴
## RAG 추가 대상 | 로드 조건: .tsx/.jsx 또는 next.config 감지 시

---

## 1️⃣ React/Next.js 공통 즉시 CRITICAL

```tsx
// ── XSS — dangerouslySetInnerHTML + 사용자 입력 ──────
<div dangerouslySetInnerHTML={{ __html: userInput }} />
<div dangerouslySetInnerHTML={{ __html: post.content }} />
<div dangerouslySetInnerHTML={{ __html: props.description }} />
// ↑ 새니타이징(DOMPurify) 없이 사용 = XSS CRITICAL

// ── javascript: URL 삽입 ──────────────────────────────
<a href={userUrl}>링크</a>
// userUrl = "javascript:alert(document.cookie)"

// ── eval() / new Function() ───────────────────────────
eval(apiResponse.code);
new Function(templateString)();
// ↑ API 응답을 즉시 실행

// ── 하드코딩 시크릿 (번들에 포함됨) ─────────────────
const API_SECRET = 'sk-secret-abc123';
const STRIPE_SECRET = 'sk_live_...';    // 클라이언트에 노출
```

---

## 2️⃣ React/Next.js 공통 즉시 HIGH

```tsx
// ── JWT를 localStorage에 저장 ────────────────────────
localStorage.setItem('access_token', token);     // XSS로 즉시 탈취
localStorage.setItem('jwt', accessToken);
sessionStorage.setItem('token', jwtToken);       // 동일 위험

// ── CSRF 토큰 없는 state-changing 요청 ───────────────
fetch('/api/transfer', {
    method: 'POST',
    body: JSON.stringify({ amount: 1000, to: 'attacker' })
    // X-CSRF-Token 헤더 없음
});

// ── 사용자 입력을 URL로 직접 리다이렉트 ──────────────
const next = new URLSearchParams(window.location.search).get('next');
window.location.href = next;             // Open Redirect
router.push(next as string);            // Next.js router

// ── DOM XSS ──────────────────────────────────────────
const name = new URLSearchParams(window.location.search).get('name');
document.getElementById('greeting').innerHTML = name;  // DOM XSS
document.write(name);

// ── 서드파티 스크립트 무결성 미검증 ──────────────────
<script src="https://cdn.example.com/lib.js"></script>
// integrity (SRI) 속성 없음
```

---

## 3️⃣ Next.js 특화 즉시 HIGH

```typescript
// ── API Route 인증 누락 ───────────────────────────────
// pages/api/admin/users.ts 또는 app/api/admin/users/route.ts
export default async function handler(req, res) {
    // getServerSession() 또는 auth() 없음
    const users = await prisma.user.findMany();
    res.json(users);
}

// ── NEXT_PUBLIC_ 접두사로 시크릿 노출 ────────────────
NEXT_PUBLIC_API_SECRET=sk-secret-key    // .env 파일
NEXT_PUBLIC_DB_PASSWORD=mypassword      // 클라이언트 번들에 포함!

// ── getServerSideProps에서 인증 없는 민감 데이터 ──────
export const getServerSideProps = async (ctx) => {
    // 세션 확인 없음
    const users = await prisma.user.findMany();   // 인증 없이 DB 쿼리
    return { props: { users } };
};

// ── 검증 없는 리다이렉트 ─────────────────────────────
export const getServerSideProps = async (ctx) => {
    const next = ctx.query.next;
    return { redirect: { destination: next, permanent: false } };
    // next = "https://phishing.com" 가능
};

// ── Server Action 인증 누락 (App Router) ─────────────
'use server'
async function deleteUser(userId: string) {
    // auth() 또는 세션 확인 없음
    await prisma.user.delete({ where: { id: userId } });
}

// ── middleware.ts 미설정 (App Router) ────────────────
// middleware.ts 파일 없음 = 모든 /api 경로 인증 없이 접근 가능
```

---

## 4️⃣ React/Next.js 확인 필요 패턴

```tsx
// dangerouslySetInnerHTML + 고정 HTML 확인
<div dangerouslySetInnerHTML={{ __html: t('static.content') }} />
// ✅ 번역 키가 하드코딩된 HTML이면 안전
// ❌ 사용자 입력이 번역 값에 포함되면 XSS

// useEffect + DOM 조작
useEffect(() => {
    document.getElementById('content').innerHTML = data;
    // ✅ data가 서버에서 오는 안전한 HTML이면 OK
    // ❌ 사용자 입력 포함이면 XSS HIGH
}, [data]);

// next/headers 사용 (App Router)
import { headers, cookies } from 'next/headers';
const session = cookies().get('session');
// ✅ 서버 컴포넌트에서는 안전한 방식
// 클라이언트 컴포넌트에서 세션 토큰 직접 접근이면 확인 필요

// fetch with credentials
fetch('/api/data', { credentials: 'include' });
// ✅ same-origin 요청이면 정상
// 교차 출처 요청인데 CORS * 설정이면 SSRF/CSRF 연계 확인
```

---

## 5️⃣ 올바른 패턴 (참조)

```tsx
// ✅ 안전한 HTML 렌더링 — DOMPurify 새니타이징
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(userHtml, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p'],
        ALLOWED_ATTR: []
    })
}} />

// ✅ URL 검증 — javascript: 차단
function SafeLink({ href, children }: { href: string; children: React.ReactNode }) {
    const isSafe = /^https?:\/\//i.test(href) || href.startsWith('/');
    return <a href={isSafe ? href : '#'}>{children}</a>;
}

// ✅ 토큰 저장 — 메모리 변수 (XSS 방어)
let _accessToken: string | null = null;
export const setToken = (t: string) => { _accessToken = t; };
export const getToken = () => _accessToken;
// Refresh Token은 httpOnly 쿠키로 서버가 설정

// ✅ axios 인터셉터 — CSRF 토큰 자동 첨부
api.interceptors.request.use((config) => {
    if (['post','put','patch','delete'].includes(config.method ?? '')) {
        config.headers['X-CSRF-Token'] = getCsrfFromCookie();
    }
    return config;
});

// ✅ Next.js API Route 인증 (App Router)
import { auth } from '@/lib/auth';
export async function GET(request: Request) {
    const session = await auth();
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    // ...
}

// ✅ Server Action 인증 (App Router)
'use server'
import { auth } from '@/lib/auth';
async function deletePost(postId: string) {
    const session = await auth();
    if (!session?.user) throw new Error('Unauthorized');
    // 소유권도 추가 검증
    const post = await prisma.post.findFirst({
        where: { id: postId, authorId: session.user.id }
    });
    if (!post) throw new Error('Not found');
    await prisma.post.delete({ where: { id: postId } });
}

// ✅ 안전한 리다이렉트 (Next.js)
function getSafeRedirect(url: string | string[] | undefined): string {
    const redirect = Array.isArray(url) ? url[0] : url ?? '/';
    if (redirect.startsWith('/') && !redirect.startsWith('//')) return redirect;
    return '/';
}

// ✅ 환경 변수 분리
// .env.local
API_SECRET=sk-secret          // 서버 전용 (NEXT_PUBLIC_ 없음)
NEXT_PUBLIC_API_URL=https://api.myapp.com  // 공개 OK
```

---

## 6️⃣ CSP 설정 (Next.js)

```javascript
// next.config.js — Content-Security-Policy 설정
const securityHeaders = [
    {
        key: 'Content-Security-Policy',
        value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",  // nonce 방식 권장
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ].join('; ')
    },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

module.exports = {
    async headers() {
        return [{ source: '/(.*)', headers: securityHeaders }];
    }
};
```
