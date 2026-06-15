# Email Deliverability Runbook — SecureAI Engine

## 한 줄 요약

발신 도메인 SPF·DKIM·DMARC 설정 + AWS SES SMTP 전환으로 트랜잭션 이메일 도달률을 최대화한다.

---

## 아키텍처

```
EmailService (비즈니스 로직)
      │  @Async("emailExecutor")
      ▼
EmailSender (Strategy 인터페이스)
      │
      ▼
SmtpEmailSender (SMTP 구현체)
  ├── 발송 전: email_suppression 조회 → 등록된 주소면 SUPPRESSED 스킵
  ├── 발송: JavaMailSender (MAIL_HOST 환경변수로 엔드포인트 교체)
  │         dev  → smtp.gmail.com:587
  │         prod → email-smtp.ap-northeast-2.amazonaws.com:587 (SES)
  ├── 재시도: 지수 백오프 최대 3회 (1s → 2s → 4s)
  └── 발송 후: email_log 기록 (SENT / FAILED / SUPPRESSED)

바운스 웹훅:
  SES SNS → POST /api/v1/webhooks/email/bounce
         → X-Webhook-Secret 검증
         → email_suppression 등록
```

---

## 발신 도메인 DNS 설정 (secureai.io 기준)

### 1. SPF 레코드

발신 서버를 SES로 제한하는 SPF 레코드를 추가한다.

```
Type: TXT
Name: @  (또는 secureai.io.)
Value: "v=spf1 include:amazonses.com ~all"
TTL: 3600
```

> `~all` (SoftFail): 초기 도입 시 권장. SPF 확인 실패를 에러가 아닌 경고로 처리.
> 안정화 후 `-all` (HardFail)로 강화.

### 2. DKIM 레코드 (SES DKIM 서명)

AWS SES 콘솔 → Verified identities → secureai.io → DKIM에서 자동 생성된 CNAME 3개를 DNS에 추가.

```
Type: CNAME
Name: <selector1>._domainkey.secureai.io
Value: <selector1>.dkim.amazonses.com
(selector2, selector3도 동일하게 추가)
```

DKIM 상태가 "Verified"로 바뀌면 모든 발송 메일에 SES가 자동으로 서명한다.

### 3. DMARC 레코드

```
Type: TXT
Name: _dmarc.secureai.io
Value: "v=DMARC1; p=none; rua=mailto:dmarc-reports@secureai.io; sp=none; aspf=r;"
TTL: 3600
```

- `p=none`: 초기 모니터링 모드 (실패해도 차단 안 함).
- `rua`: DMARC 집계 리포트 수신 주소.
- 2주 모니터링 후 `p=quarantine` → `p=reject` 단계적 강화.

### 4. DNS 검증

```bash
# SPF
dig TXT secureai.io | grep "v=spf1"

# DKIM
dig CNAME selector1._domainkey.secureai.io

# DMARC
dig TXT _dmarc.secureai.io
```

---

## AWS SES 셋업 절차

### Step 1: 도메인 검증

```
AWS Console → SES → Verified identities → Create identity
  → Identity type: Domain
  → Domain: secureai.io
  → Easy DKIM: Enabled (RSA 2048-bit)
  → Custom MAIL FROM domain: mail.secureai.io (선택, 이메일 클라이언트 표시용)
```

DNS에 SES가 제공하는 레코드를 추가하면 자동 검증(최대 72h).

### Step 2: 샌드박스 탈출 (Production Access)

SES 신규 계정은 기본 샌드박스 모드 — 검증된 주소만 수신 가능.

```
AWS Console → SES → Account dashboard → Request production access
  → Use case: Transactional emails (verification, password reset, etc.)
  → Sending limits: 필요한 일일 한도 기입
  → 설명: "SecureAI Engine — security analysis SaaS. Sends account verification,
           password reset, org invitation, nightly scan report emails to registered users."
```

응답 대기 1~3 영업일.

### Step 3: SMTP 자격증명 생성

```
AWS Console → SES → SMTP settings → Create SMTP credentials
  → IAM 사용자 자동 생성 → 액세스 키(SMTP 사용자명/비밀번호) 다운로드
```

> 다운로드 직후 한 번만 표시됨 — 즉시 시크릿 매니저에 저장.

### Step 4: 환경변수 설정

| 환경변수 | dev (Gmail) | prod (SES) |
|---------|------------|-----------|
| `MAIL_HOST` | `smtp.gmail.com` | `email-smtp.ap-northeast-2.amazonaws.com` |
| `MAIL_PORT` | `587` | `587` |
| `MAIL_USERNAME` | Gmail 주소 | SES SMTP 자격증명 사용자명 |
| `MAIL_PASSWORD` | Gmail 앱 비밀번호 | SES SMTP 자격증명 비밀번호 |
| `EMAIL_WEBHOOK_SECRET` | (생략 가능) | 강력한 무작위 문자열 (32자+) |

---

## Gmail SMTP (dev) vs SES (prod) 전환 방법

`application.yaml`에서 `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` 환경변수만 교체하면 된다.

발송 채널 추상화(Strategy) 덕분에 애플리케이션 코드 변경 없음.

```bash
# dev — Gmail SMTP
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=noreply-dev@gmail.com
MAIL_PASSWORD=<Gmail App Password>

# prod — AWS SES SMTP
MAIL_HOST=email-smtp.ap-northeast-2.amazonaws.com
MAIL_PORT=587
MAIL_USERNAME=<SES SMTP credentials username>
MAIL_PASSWORD=<SES SMTP credentials password>
```

---

## 바운스/스팸 신고 자동 처리 (Suppression)

### SES → SNS → 웹훅 연결

```
AWS Console → SES → Verified identities → secureai.io
  → Notifications → Bounces: SNS Topic 선택 (또는 신규 생성)
  → Complaints: 동일 SNS Topic
  → SNS Topic → Subscriptions → Create subscription
      Protocol: HTTPS
      Endpoint: https://api.secureai.io/api/v1/webhooks/email/bounce
```

SNS 구독 확인 요청(SubscriptionConfirmation)은 별도 처리 불필요 — SNS가 재시도.

### 웹훅 페이로드 형식

```json
{
  "email": "bounce@example.com",
  "reason": "BOUNCE"
}
```

`X-Webhook-Secret` 헤더: `EMAIL_WEBHOOK_SECRET` 값.

### 직접 suppression 등록 (수동)

```bash
curl -X POST https://api.secureai.io/api/v1/webhooks/email/bounce \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <EMAIL_WEBHOOK_SECRET>" \
  -d '{"email": "problem@example.com", "reason": "BOUNCE"}'
```

---

## 발송 로그 조회 (DB)

```sql
-- 최근 발송 실패 목록
SELECT to_address, subject, attempts, error_message, created_at
FROM email_log
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 50;

-- 억제 목록 확인
SELECT email_address, reason, created_at
FROM email_suppression
ORDER BY created_at DESC;

-- 시간대별 발송량
SELECT DATE_TRUNC('hour', created_at) AS hour, status, COUNT(*)
FROM email_log
GROUP BY 1, 2
ORDER BY 1 DESC;
```

---

## 트러블슈팅

| 증상 | 원인 | 조치 |
|------|------|------|
| 메일이 스팸으로 분류 | SPF/DKIM 미적용 | DNS 레코드 확인 후 SES에서 검증 |
| SES 발송 한도 초과 (ThrottlingException) | 분당 발송량 과다 | `emailExecutor` 풀 크기 조정 또는 SES 한도 상향 요청 |
| 발송 로그 FAILED 다수 | SMTP 자격증명 만료 | SES SMTP 자격증명 재발급 후 환경변수 교체 |
| 특정 주소 SUPPRESSED | 바운스 웹훅으로 등록됨 | `email_suppression` 에서 해당 행 삭제 후 재발송 |
| 웹훅 401 오류 | `EMAIL_WEBHOOK_SECRET` 불일치 | 발신 시스템과 서버 시크릿 동기화 |
