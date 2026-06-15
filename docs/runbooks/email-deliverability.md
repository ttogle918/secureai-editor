# Email Deliverability Runbook — SecureAI Engine

## 한 줄 요약

발송 채널은 **프로바이더 중립 SMTP**다. `MAIL_HOST`/계정만 바꾸면 어떤 프로바이더로도 전환된다(코드 변경 0).
**dev = Gmail SMTP(무료) / 가벼운 프로덕션 = Brevo·SendGrid 무료 티어 / 규모 확장 시 = SES·Mailgun.**
도달률(스팸함 회피)이 필요해지면 발신 도메인에 SPF·DKIM·DMARC를 설정한다.

> 배포처 무관: 코드는 SMTP만 쓰므로 GCP·Fly.io·Render 등 어디에 올려도 동일하게 동작한다.
> AWS/SES SDK 의존성 없음.

---

## 아키텍처

```
EmailService (비즈니스 로직)
      │  @Async("emailExecutor")
      ▼
EmailSender (Strategy 인터페이스)
      │
      ▼
SmtpEmailSender (SMTP 구현체 — 프로바이더 무관)
  ├── 발송 전: email_suppression 조회 → 등록된 주소면 SUPPRESSED 스킵
  ├── 발송: JavaMailSender (MAIL_HOST 환경변수로 엔드포인트 교체)
  │         dev        → smtp.gmail.com:587
  │         light-prod → smtp-relay.brevo.com:587  또는  smtp.sendgrid.net:587
  ├── 재시도: 지수 백오프 최대 3회 (1s → 2s → 4s)
  └── 발송 후: email_log 기록 (SENT / FAILED / SUPPRESSED)

바운스 웹훅:
  프로바이더 이벤트 → POST /api/v1/webhooks/email/bounce
         → X-Webhook-Secret 검증
         → email_suppression 등록 (이후 발송 차단)
```

---

## 단계별 권장 (저렴 → 확장)

| 단계 | 프로바이더 | 비용 | 도메인 DKIM | 설정 |
|------|-----------|------|------------|------|
| **지금(배포 테스트/데모)** | **Gmail SMTP** | 무료(~500/일) | ❌ | **이미 기본값 — 변경 없음** (앱비밀번호만) |
| 가벼운 프로덕션 | **Brevo**(舊 Sendinblue) | 무료 300/일 | ✅ | `MAIL_HOST`만 교체 |
| 〃 | **SendGrid** | 무료 100/일 영구 | ✅ | `MAIL_HOST`만 교체 |
| 〃 | Resend | 무료 3,000/월 | ✅ | `MAIL_HOST`만 교체 |
| 규모 확장 | SES · Mailgun | 최저가(従량) | ✅ | 부록 참조 |

> **Gmail SMTP는 내 도메인 DKIM 서명이 안 돼** 실제 사용자 대상 프로덕션에선 스팸 위험. 테스트/데모엔 충분하지만,
> 진짜 사용자에게 보낼 땐 도메인 인증을 지원하는 Brevo/SendGrid로 넘어갈 것.

---

## ⚠️ GCP(및 대다수 클라우드) 배포 주의

- GCP는 **아웃바운드 25번 포트를 영구 차단**한다(스팸 방지). → **반드시 587(STARTTLS) 또는 465(SSL)** 로 외부 SMTP 프로바이더에 붙는다. 본 구현은 587 기본이라 그대로 동작.
- GCP에는 SES 같은 **자체 이메일 발송 서비스가 없다.** → 위 표의 외부 SMTP 프로바이더를 쓴다(코드 변경 0).
- 시크릿(`MAIL_PASSWORD`, `EMAIL_WEBHOOK_SECRET`)은 Secret Manager(GCP) 등으로 주입. 코드/이미지에 하드코딩 금지.

---

## 환경변수 — 프로바이더별 전환

발송 채널 추상화(Strategy) 덕분에 **애플리케이션 코드 변경 없이** `MAIL_*` 환경변수만 교체한다.

| 환경변수 | dev (Gmail) | Brevo | SendGrid |
|---------|------------|-------|----------|
| `MAIL_HOST` | `smtp.gmail.com` | `smtp-relay.brevo.com` | `smtp.sendgrid.net` |
| `MAIL_PORT` | `587` | `587` | `587` |
| `MAIL_USERNAME` | Gmail 주소 | Brevo 로그인/SMTP 키 ID | 리터럴 문자열 `apikey` |
| `MAIL_PASSWORD` | Gmail 앱 비밀번호 | Brevo SMTP 키 | SendGrid API Key |
| `EMAIL_WEBHOOK_SECRET` | (dev 생략 가능) | 강력한 무작위 32자+ | 강력한 무작위 32자+ |

```bash
# dev — Gmail SMTP (지금 단계: 이대로 두면 됨)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=noreply-dev@gmail.com
MAIL_PASSWORD=<Gmail 앱 비밀번호>

# light-prod — Brevo (무료 300/일)
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USERNAME=<Brevo SMTP 사용자>
MAIL_PASSWORD=<Brevo SMTP 키>

# light-prod — SendGrid (무료 100/일)
MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USERNAME=apikey            # 리터럴 그대로
MAIL_PASSWORD=<SendGrid API Key>
```

---

## 발신 도메인 DNS 설정 (도달률용 — light-prod 이상)

> 프로바이더가 콘솔에서 자기 전용 값을 제공한다. 아래는 형식 예시(`secureai.io` → 실제 도메인으로 치환).
> Gmail SMTP만 쓰는 테스트 단계에선 생략 가능.

### 1. SPF (TXT, `@`)
```
# Brevo
"v=spf1 include:spf.brevo.com ~all"
# SendGrid
"v=spf1 include:sendgrid.net ~all"
```
`~all`(SoftFail) 권장 → 안정화 후 `-all`(HardFail).

### 2. DKIM (CNAME, 프로바이더 콘솔이 발급)
- **Brevo**: Senders & IP → Domains → Authenticate → 제공 CNAME 2개 등록.
- **SendGrid**: Settings → Sender Authentication → Authenticate Your Domain → 제공 CNAME 3개 등록.
검증되면 모든 발송에 프로바이더가 자동 DKIM 서명.

### 3. DMARC (TXT, `_dmarc`)
```
"v=DMARC1; p=none; rua=mailto:dmarc-reports@secureai.io; sp=none; aspf=r;"
```
`p=none`(모니터링) → 2주 후 `p=quarantine` → `p=reject` 단계 강화.

### 4. 검증
```bash
dig TXT secureai.io | grep "v=spf1"
dig CNAME <selector>._domainkey.secureai.io
dig TXT _dmarc.secureai.io
# 종합 점수: https://www.mail-tester.com 로 실제 발송 테스트 (목표 ≥ 9/10)
```

---

## 바운스/스팸 신고 자동 처리 (Suppression)

엔드포인트는 **프로바이더 무관 범용 형식**(`{email, reason}`)을 받는다.

```json
{ "email": "bounce@example.com", "reason": "BOUNCE" }   // reason: BOUNCE | COMPLAINT
```
`X-Webhook-Secret` 헤더 = `EMAIL_WEBHOOK_SECRET` 값.

### 프로바이더 이벤트 웹훅 연결
- **Brevo**: Transactional → Settings → Webhook → `hard_bounce`/`spam` 이벤트 → URL `https://<host>/api/v1/webhooks/email/bounce`.
- **SendGrid**: Settings → Mail Settings → Event Webhook → `bounce`/`spamreport` 이벤트.
- ⚠️ 두 프로바이더의 이벤트 페이로드는 위 `{email, reason}` 형식과 **다르다.** 다음 중 택1:
  - (간단) 프로바이더 ↔ 우리 엔드포인트 사이에 페이로드를 매핑하는 얇은 변환(예: 프로바이더 웹훅을 받는 작은 함수/큐 또는 게이트웨이 변환 규칙).
  - (확장) provider별 `BounceWebhookAdapter` 추가 — 현재 컨트롤러는 범용 형식만 받으므로 provider 포맷 파서를 별도 엔드포인트로 신설.
  - 초기엔 **수동 등록(아래 curl)** 으로 충분.

### 수동 suppression 등록
```bash
curl -X POST https://<host>/api/v1/webhooks/email/bounce \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <EMAIL_WEBHOOK_SECRET>" \
  -d '{"email": "problem@example.com", "reason": "BOUNCE"}'
```

---

## 발송 로그 조회 (DB)

```sql
-- 최근 발송 실패
SELECT to_address, subject, attempts, error_message, created_at
FROM email_log WHERE status = 'FAILED' ORDER BY created_at DESC LIMIT 50;

-- 억제 목록
SELECT email_address, reason, created_at FROM email_suppression ORDER BY created_at DESC;

-- 시간대별 발송량
SELECT DATE_TRUNC('hour', created_at) AS hour, status, COUNT(*)
FROM email_log GROUP BY 1, 2 ORDER BY 1 DESC;
```

---

## 보안 — 웹훅 fail-closed

- `EMAIL_WEBHOOK_SECRET` 미설정 시 서명 검증을 건너뛴다(dev 편의). 미설정 = **누구나 임의 주소를 suppression 등록(메일 차단 DoS)** 가능.
- 따라서 **prod 프로파일에선 시크릿 미설정 시 기동이 중단된다(fail-closed)** — `EmailWebhookSignatureVerifier.enforceProdSecret()`. 배포 파이프라인이 이를 포착.
- prod 배포 전 `EMAIL_WEBHOOK_SECRET`(32자+ 무작위)를 Secret Manager에 반드시 설정.

---

## 트러블슈팅

| 증상 | 원인 | 조치 |
|------|------|------|
| 메일이 스팸으로 분류 | SPF/DKIM 미적용(특히 Gmail SMTP) | 도메인 인증 프로바이더(Brevo/SendGrid)로 전환 + DNS 설정 |
| 발송 자체가 안 됨(타임아웃) | 클라우드가 25번 포트 차단 | `MAIL_PORT=587`(또는 465) 확인 |
| 발송 로그 FAILED 다수 | SMTP 자격증명 만료/오류 | 프로바이더 키 재발급 후 `MAIL_PASSWORD` 교체 |
| 발송 한도 초과 | 무료 티어 일일 한도 도달 | 상위 플랜 또는 `emailExecutor` 풀/속도 조정 |
| 특정 주소 SUPPRESSED | 바운스 웹훅으로 등록됨 | `email_suppression`에서 해당 행 삭제 후 재발송 |
| 웹훅 401 | `EMAIL_WEBHOOK_SECRET` 불일치 | 발신 시스템과 서버 시크릿 동기화 |
| prod 기동 실패(IllegalStateException) | `EMAIL_WEBHOOK_SECRET` 미설정 | 시크릿 설정(fail-closed 가드) |

---

## 부록 — AWS SES (규모 확장 시)

従량 최저가가 필요하고 이미 AWS를 쓸 때의 옵션. SES도 **SMTP 인터페이스**를 제공하므로 본 구현 그대로 사용.

```bash
MAIL_HOST=email-smtp.ap-northeast-2.amazonaws.com   # 리전에 맞게
MAIL_PORT=587
MAIL_USERNAME=<SES SMTP 자격증명 사용자>
MAIL_PASSWORD=<SES SMTP 자격증명 비밀번호>
```
- 셋업: SES 콘솔 → Verified identities(도메인+Easy DKIM) → **샌드박스 탈출(Production access 요청, 1~3영업일)** → SMTP credentials 발급.
- 바운스: SES → SNS Topic(Bounce/Complaint) → HTTPS 구독으로 위 웹훅에 연결(페이로드 매핑 필요).
- SPF: `"v=spf1 include:amazonses.com ~all"`.
