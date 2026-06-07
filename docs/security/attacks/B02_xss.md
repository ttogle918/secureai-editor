# B02: Cross-Site Scripting (XSS)
OWASP: A03:2021 | CWE-79 | CVSS: 5.4~8.8 MEDIUM~HIGH

## 취약 패턴
```jsx
// React - CRITICAL
<div dangerouslySetInnerHTML={{ __html: userInput }} />
<div dangerouslySetInnerHTML={{ __html: post.content }} />
<div dangerouslySetInnerHTML={{ __html: props.html }} />
// href javascript: - HIGH
<a href={userUrl}>링크</a>   // javascript:alert(1) 가능
```
```javascript
// DOM XSS - CRITICAL
document.getElementById('out').innerHTML = userData
element.insertAdjacentHTML('beforeend', userContent)
document.write(req.query.name)
// Node.js - CRITICAL
res.send(`<html><body>${req.query.search}</body></html>`)
```
```python
# Python - CRITICAL
return render_template_string(f"Hello {username}!")  # SSTI 겸용
return HTMLResponse(f"<html>{user_comment}</html>")
from markupsafe import Markup; return Markup(user_input)
# Jinja2 autoescape=False + 사용자 입력 - CRITICAL
env = Environment(autoescape=False)
```

## 수정 패턴
```jsx
// ✅ React 기본 렌더링 (자동 이스케이프)
<div>{userInput}</div>
// ✅ DOMPurify 새니타이징 (dangerouslySetInnerHTML 필요 시)
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, {
  ALLOWED_TAGS: ['b','i','em','strong'], ALLOWED_ATTR: []
}) }} />
// ✅ URL 검증
const safe = /^https?:\/\//i.test(url) ? url : '#'
```
```python
# ✅ CSP 헤더
response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'"
# ✅ Jinja2 - 항상 autoescape=True (기본값 유지)
```

## 심각도
- CRITICAL: Stored XSS + 관리자 페이지 → 관리자 세션 탈취
- HIGH: Stored XSS + 일반 사용자 / Reflected XSS + 자동 배포 가능
- MEDIUM: Reflected XSS + 클릭 필요
- LOW: Self-XSS (본인만 영향)
