# B20: CI/CD Pipeline Security
OWASP: A08:2021 | CWE-829, CWE-494 | CVSS: 8.0~10.0 HIGH~CRITICAL

## 취약 패턴
```yaml
# CRITICAL — 외부 Action 브랜치/태그 참조 (변조 가능)
- uses: actions/checkout@main         # 브랜치 = 언제든 변조
- uses: actions/checkout@v4           # 태그 = 재지정 가능
- uses: some-third-party/action@latest

# CRITICAL — 빌드 로그에 시크릿 에코
- run: echo "API Key: ${{ secrets.API_KEY }}"   # 로그에 노출!
- run: curl -H "Auth: ${{ secrets.TOKEN }}" ...  # 로그에 노출!

# HIGH — CI Injection (사용자 입력을 run에 직접 삽입)
- run: echo "Branch: ${{ github.head_ref }}"
  # head_ref = "feature/x; rm -rf /" → 명령어 인젝션

# HIGH — 과도한 GITHUB_TOKEN 권한
permissions:
  contents: write     # 필요 없으면 read
  actions: write      # 대부분 불필요

# MEDIUM — 보안 스캔 없는 배포 파이프라인
on:
  push:
    branches: ['*']   # 모든 브랜치 → 프로덕션 배포
```

## 수정 패턴
```yaml
# ✅ 보안 강화 워크플로우
name: Secure Deploy
on:
  push:
    branches: [main]     # main만

permissions:             # 최소 권한 (기본 read-only)
  contents: read
  id-token: write        # OIDC 배포 시만

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      # ✅ SHA 고정 (불변)
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
      - uses: actions/setup-python@0b93645e9fea7318ecaed2b359559ac225c90a2

      # ✅ 사용자 입력 환경변수로 격리 (CI Injection 방지)
      - name: Process
        env:
          BRANCH: ${{ github.head_ref }}   # 환경변수로 격리
        run: echo "Branch: $BRANCH"        # ${{ }} 직접 사용 X

      # ✅ OIDC 인증 (장기 AWS 키 없음)
      - uses: aws-actions/configure-aws-credentials@e3dd6a429d7300a6542e0d4fed081e4d4a497f0e
        with:
          role-to-assume: ${{ vars.AWS_DEPLOY_ROLE }}
          aws-region: us-east-1

      # ✅ 시크릿은 환경변수로만 (echo 금지)
      - name: Deploy
        env:
          SECRET_KEY: ${{ secrets.SECRET_KEY }}
        run: python deploy.py              # 코드에서 os.environ으로 읽음

  # ✅ 보안 스캔 (배포 전 필수)
  security:
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: gitleaks/gitleaks-action@v2
        env: { GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}" }
      - uses: semgrep/semgrep-action@v1
        with: { config: "p/owasp-top-ten p/python p/secrets" }
```

## 심각도
- CRITICAL: 외부 Action @main/@latest / 빌드 로그 시크릿 에코
- HIGH: CI Injection / 모든 브랜치 프로덕션 배포 / GITHUB_TOKEN 과다 권한
- MEDIUM: 보안 스캔 없는 파이프라인 / Dependabot 미설정
