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
... (rest of the file)
