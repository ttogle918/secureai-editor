# B06: SSRF
OWASP: A10:2021 | CWE-918 | CVSS: 7.5~10.0 HIGH~CRITICAL

## 취약 패턴
```python
requests.get(user_provided_url)                    # 검증 없음 CRITICAL
httpx.get(req.args.get('url'))
urllib.request.urlopen(user_url)
requests.get(url, allow_redirects=True)            # 리다이렉트 SSRF 가능
if "evil.com" not in url: requests.get(url)        # 블랙리스트 우회 가능
```
```javascript
fetch(req.body.url); axios.get(req.query.endpoint)  // CRITICAL
```
```java
restTemplate.getForObject(userUrl, String.class)   // CRITICAL
```

## 공격: url = "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
## → AWS IAM 자격증명 탈취 → 계정 전체 장악

## 수정 패턴
```python
import ipaddress; from urllib.parse import urlparse
BLOCKED = [ipaddress.ip_network(n) for n in [
    "10.0.0.0/8","172.16.0.0/12","192.168.0.0/16","169.254.0.0/16","127.0.0.0/8"]]
ALLOWED_DOMAINS = {"api.partner.com", "cdn.myapp.com"}

def validate_url(url):
    p = urlparse(url)
    if p.scheme != "https": raise ValueError("https only")
    if p.hostname not in ALLOWED_DOMAINS: raise ValueError("domain not allowed")
    return url

async with httpx.AsyncClient() as c:
    r = await c.get(validate_url(url), follow_redirects=False, timeout=5.0)
```

## 심각도
- CRITICAL: 클라우드 환경 + 검증 없음 → IAM 탈취
- HIGH: 일반 서버 + 검증 없음 → 내부망 탐색
- MEDIUM: 블랙리스트만 (우회 가능)
