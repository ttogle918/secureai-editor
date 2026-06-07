# B15: Supply Chain Attack (소프트웨어 공급망)
OWASP: A06:2021 + A08:2021 | CWE-829 | CVSS: 7.0~10.0

## 취약 패턴
```
# requirements.txt 버전 미고정
requests          ← 버전 없음 HIGH
fastapi>=0.100    ← >= 범위 HIGH
pydantic~=2.0    ← ~= 허용 MEDIUM
PyYAML==5.3      ← CVE-2020-14343 CRITICAL
Pillow==9.0.0    ← CVE-2022-22817 CRITICAL
```
```json
// package.json 버전 범위
"axios": "^1.0.0"   // ^ = 마이너 자동 업데이트 MEDIUM
"lodash": "*"       // * = 모든 버전 HIGH
```
```yaml
# GitHub Actions — 브랜치/태그 참조 CRITICAL
- uses: actions/checkout@main       # 브랜치 = 변조 가능
- uses: actions/checkout@v4         # 태그 = 재지정 가능
- uses: some-action@latest
```

## 수정 패턴
```bash
# ✅ Python — 정확한 버전 + 해시 고정
pip install pip-tools
pip-compile --generate-hashes requirements.in
# requests==2.31.0 --hash=sha256:58cd2187...

# ✅ 취약 패키지 스캔
pip-audit -r requirements.txt --strict
safety check -r requirements.txt

# ✅ npm — 정확한 버전
npm config set save-exact true
npm audit --audit-level=high
```
```yaml
# ✅ GitHub Actions — SHA 고정 (불변)
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
- uses: actions/setup-python@0b93645e9fea7318ecaed2b359559ac225c90a2
```
```yaml
# .github/dependabot.yml — 자동 업데이트
version: 2
updates:
  - package-ecosystem: "pip"
    directory: "/"
    schedule: { interval: "weekly" }
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
```

## 심각도
- CRITICAL: 알려진 CVE 버전 사용 + 직접 공격 경로
- HIGH: GitHub Actions 브랜치/latest 참조 / 버전 완전 미고정
- MEDIUM: ^ ~= >= 범위 지정
