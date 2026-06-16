# Date: 2026-06-16
# Description: TASK-1210 Email Infrastructure Manual Verification Script

import urllib.request
import urllib.parse
import urllib.error
import json
import base64
import time
import subprocess
import random

def get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read()
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read()
        return e.code, json.loads(body) if body else {}
    except Exception as ex:
        return -1, str(ex)

def post(url, data, headers=None):
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers or {})
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read()
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read()
        return e.code, json.loads(body) if body else {}
    except Exception as ex:
        print(f"Exception details: {ex}")
        return -1, str(ex)

def run_sql(query):
    cmd = ['docker', 'exec', 'secureai-postgres', 'psql', '-U', 'secureai', '-d', 'secureai_db', '-t', '-c', query]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        if res.returncode != 0:
            return f"SQL Error: {res.stderr.strip()}"
        return res.stdout.strip()
    except Exception as e:
        return f"Process Error: {str(e)}"

print("=" * 60)
print("=== TASK-1210: 이메일 인프라 수동 검증 시작 ===")
print("=" * 60)

# 1. 기본 발송 테스트
print("\n[1] 메일 발송 테스트 (회원가입 및 비밀번호 재설정)")
timestamp = int(time.time())
test_email = f"test_{timestamp}@example.com"
status, data = post("http://localhost:8080/api/v1/auth/register", {
    "email": test_email,
    "password": "Password123!",
    "username": f"user{timestamp}",
    "termsAgreed": True,
    "privacyAgreed": True
})
print(f"  회원가입 API 호출: HTTP {status}")
time.sleep(2)

# Mailpit 확인
status, data = get("http://localhost:8025/api/v1/messages")
if status == 200 and data.get("messages"):
    msgs = [m for m in data["messages"] if m["To"][0]["Address"] == test_email]
    if msgs:
        print(f"  ✅ Mailpit 수신 확인: {msgs[0]['Subject']}")
    else:
        print(f"  ❌ Mailpit에서 {test_email} 메일 찾을 수 없음")
else:
    print(f"  ❌ Mailpit 접근 실패 (HTTP {status})")

# 비밀번호 재설정 테스트
status, data = post("http://localhost:8080/api/v1/auth/forgot-password", {
    "email": test_email
})
print(f"  비밀번호 재설정 API 호출: HTTP {status}")
time.sleep(2)
status, data = get("http://localhost:8025/api/v1/messages")
if status == 200 and data.get("messages"):
    msgs = [m for m in data["messages"] if m["To"][0]["Address"] == test_email and "비밀번호" in m["Subject"]]
    if msgs:
        print(f"  ✅ Mailpit 수신 확인 (비밀번호 재설정): {msgs[0]['Subject']}")
    else:
        print(f"  ❌ Mailpit에서 비밀번호 재설정 메일 찾을 수 없음")


# 2. 바운스 웹훅 + Suppression 테스트
print("\n[2] 바운스 웹훅 및 Suppression 테스트")
bounce_email = "bounced@test.com"
webhook_url = "http://localhost:8080/api/v1/webhooks/email/bounce"
webhook_data = '{"email": "bounced@test.com", "reason": "BOUNCE"}'

# 올바른 시크릿
res = subprocess.run(["curl", "-s", "-o", "NUL", "-w", "%{http_code}", "-X", "POST", webhook_url, "-H", "Content-Type: application/json", "-H", "X-Webhook-Secret: testsecret", "-d", webhook_data], capture_output=True, text=True)
print(f"  올바른 시크릿 호출: HTTP {res.stdout.strip()} (예상: 200)")

# 잘못된 시크릿
res = subprocess.run(["curl", "-s", "-o", "NUL", "-w", "%{http_code}", "-X", "POST", webhook_url, "-H", "Content-Type: application/json", "-H", "X-Webhook-Secret: wrongsecret", "-d", webhook_data], capture_output=True, text=True)
print(f"  잘못된 시크릿 호출: HTTP {res.stdout.strip()} (예상: 401/403)")

# 중복 호출 (멱등성)
subprocess.run(["curl", "-s", "-o", "NUL", "-w", "%{http_code}", "-X", "POST", webhook_url, "-H", "Content-Type: application/json", "-H", "X-Webhook-Secret: testsecret", "-d", webhook_data], capture_output=True, text=True)
count_sql = f"SELECT count(*) FROM email_suppression WHERE email_address = '{bounce_email}'"
count = run_sql(count_sql)
print(f"  중복 호출 후 DB 행 개수: {count.strip()} (예상: 1)")

# Bounced 이메일로 발송 시도
print(f"  Bounced 계정({bounce_email})으로 비밀번호 재설정 메일 발송 시도...")
post("http://localhost:8080/api/v1/auth/forgot-password", {"email": bounce_email})
time.sleep(1)


# 4. DB 로그 확인
print("\n[4] 데이터베이스 (email_log, email_suppression) 확인")
log_sql = "SELECT to_address, subject, status, attempts FROM email_log ORDER BY created_at DESC LIMIT 3;"
logs = run_sql(log_sql)
print("  email_log 최근 3건:")
for line in logs.split('\\n'):
    if line.strip(): print(f"    {line.strip()}")

suppress_sql = "SELECT email_address, reason FROM email_suppression LIMIT 3;"
suppressions = run_sql(suppress_sql)
print("\n  email_suppression 데이터:")
for line in suppressions.split('\\n'):
    if line.strip(): print(f"    {line.strip()}")

fw_sql = "SELECT version, description FROM flyway_schema_history WHERE version IN ('057', '058');"
fw_hist = run_sql(fw_sql)
print("\n  Flyway 마이그레이션 적용 여부:")
for line in fw_hist.split('\\n'):
    if line.strip(): print(f"    {line.strip()}")

print("\n" + "=" * 60)
print("=== 수동 검증 완료 ===")
print("=" * 60)
