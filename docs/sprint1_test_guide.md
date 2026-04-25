# Sprint 1 테스트 가이드

> Sprint 1 백로그 체크리스트 기준 실제 실행 가능한 명령어 모음

---

## 사전 준비

```bash
# 1. 환경 변수 설정
cp .env.example .env
# .env 에서 최소한 다음 값을 채워야 함:
#   DB_PASSWORD, REDIS_PASSWORD, JWT_SECRET (최소 32자), ENCRYPTION_KEY (64자 hex)
#   MAIL_* 설정 (이메일 없으면 로그로 대체 — 아래 참고)

# 2. 서비스 시작
docker compose up -d
docker compose ps          # 모든 서비스 healthy 확인

# 3. 편의를 위한 변수 설정
API="http://localhost:8080/api/v1"
```

---

## TASK-101: JWT 인증 시스템

### 1. 회원가입

```bash
curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123!",
    "displayName": "테스트 유저"
  }' | python -m json.tool
```

**기대 응답** (201 Created):
```json
{ "success": true, "data": { "email": "test@example.com", "message": "..." } }
```

### 2. 이메일 인증 토큰 확인

이메일 발송이 설정되지 않은 경우 DB에서 직접 확인:

```bash
docker compose exec postgres psql -U secureai -d secureai_db -c \
  "SELECT email_verify_token FROM users WHERE email='test@example.com';"
```

**이메일 인증**:
```bash
TOKEN="위에서_조회한_토큰"
curl -s "$API/auth/verify-email?token=$TOKEN" | python -m json.tool
```

**기대 응답** (200 OK):
```json
{ "success": true, "data": { "message": "이메일 인증이 완료되었습니다." } }
```

### 3. 로그인 & Access Token 저장

```bash
# 쿠키 파일 사용 (Refresh Token은 HttpOnly 쿠키로 설정됨)
curl -s -c /tmp/cookies.txt -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "test@example.com", "password": "password123!" }' \
  | python -m json.tool

# Access Token 추출
ACCESS_TOKEN=$(curl -s -c /tmp/cookies.txt -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "test@example.com", "password": "password123!" }' \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo "Access Token: $ACCESS_TOKEN"
```

**기대 응답**:
```json
{ "success": true, "data": { "accessToken": "eyJ...", "tokenType": "Bearer" } }
```
Refresh Token은 응답 헤더 `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict` 로 설정됨.

### 4. 보호된 엔드포인트 접근

```bash
curl -s "$API/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python -m json.tool
```

### 5. Refresh Token으로 토큰 갱신

```bash
# 쿠키 파일에 저장된 Refresh Token 자동 전송
curl -s -b /tmp/cookies.txt -c /tmp/cookies.txt \
  -X POST "$API/auth/refresh" | python -m json.tool
```

**기대 응답**: 새 `accessToken` 포함

### 6. 로그인 5회 실패 → 계정 잠금 검증

```bash
for i in {1..6}; do
  echo "시도 $i:"
  curl -s -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{ "email": "test@example.com", "password": "wrong_password" }' \
    | python -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('code','?'))"
done
# 5번째까지: AUTH_INVALID_CREDENTIALS
# 6번째: AUTH_ACCOUNT_LOCKED
```

### 7. 로그아웃

```bash
curl -s -b /tmp/cookies.txt -c /tmp/cookies.txt \
  -X POST "$API/auth/logout" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# 기대: 204 No Content

# 구 Refresh Token 재사용 시도 → 401 기대
curl -s -b /tmp/cookies.txt \
  -X POST "$API/auth/refresh" | python -m json.tool
```

---

## TASK-103: 플랜 체계 & Rate Limit

### 1. Rate Limit 확인

```bash
# 10회 이상 연속 요청 (Free 플랜 분당 10회 제한)
for i in {1..12}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $ACCESS_TOKEN" "$API/users/me")
  echo "$i: HTTP $STATUS"
done
# 10회 이후: 429 Too Many Requests
```

### 2. X-RateLimit 헤더 확인

```bash
curl -i -H "Authorization: Bearer $ACCESS_TOKEN" "$API/users/me" 2>/dev/null \
  | grep -i "x-ratelimit"
# X-RateLimit-Limit: 10
# X-RateLimit-Remaining: 9
# X-RateLimit-Reset: ...
```

### 3. Redis Rate Limit 카운터 직접 확인

```bash
USER_ID=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" "$API/users/me" \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")

docker compose exec redis redis-cli -a ${REDIS_PASSWORD:-''} \
  GET "secureai:ratelimit:${USER_ID}:api"
```

---

## TASK-104: 프로젝트 CRUD

### 1. 프로젝트 생성

```bash
curl -s -X POST "$API/projects" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project",
    "description": "테스트 프로젝트",
    "sourceType": "upload"
  }' | python -m json.tool

# PROJECT_ID 저장
PROJECT_ID=$(curl -s -X POST "$API/projects" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project-2", "sourceType": "upload"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Project ID: $PROJECT_ID"
```

### 2. 프로젝트 목록 조회

```bash
curl -s "$API/projects" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python -m json.tool
```

### 3. 프로젝트 상세 조회

```bash
curl -s "$API/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python -m json.tool
```

### 4. 팀 멤버 초대

```bash
# 먼저 초대할 사용자 계정 생성 (이메일 인증까지 완료)
curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "member@example.com", "username": "member1", "password": "password123!"}'

# DB에서 토큰 조회 후 이메일 인증
MEMBER_TOKEN=$(docker compose exec postgres psql -U secureai -d secureai_db -t -c \
  "SELECT email_verify_token FROM users WHERE email='member@example.com';" | tr -d ' ')
curl -s "$API/auth/verify-email?token=$MEMBER_TOKEN"

# 멤버 초대
curl -s -X POST "$API/projects/$PROJECT_ID/members/invite" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "member@example.com", "role": "viewer"}' | python -m json.tool
```

### 5. 프로젝트 삭제 & ProjectDeletedEvent 확인

```bash
curl -s -X DELETE "$API/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
# 기대: 204 No Content

# 삭제 후 DB에서 soft delete 확인
docker compose exec postgres psql -U secureai -d secureai_db -c \
  "SELECT id, name, deleted_at FROM projects WHERE id='$PROJECT_ID';"
# deleted_at이 NULL이 아니어야 함

# 로그에서 ProjectDeletedEvent 확인
docker compose logs backend 2>&1 | grep "Project soft-deleted"
```

---

## TASK-105: 사용자 정보 API

### 1. 사용자 정보 조회

```bash
curl -s "$API/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" | python -m json.tool
```

### 2. 프로필 수정

```bash
curl -s -X PATCH "$API/users/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName": "새 이름", "timezone": "UTC"}' | python -m json.tool
```

### 3. 비밀번호 변경

```bash
curl -s -X PUT "$API/users/me/password" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "password123!", "newPassword": "newpass456!"}' \
  | python -m json.tool
```

---

## 보안 항목 수동 검증

### Refresh Token 쿠키 속성 확인

```bash
curl -v -c /tmp/cookies.txt -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123!"}' 2>&1 \
  | grep -i "set-cookie"
# 기대: HttpOnly; Secure; SameSite=Strict 포함
```

### 에러 응답 일관성 확인 (타이밍 공격 방어)

```bash
# 존재하는 이메일, 틀린 비밀번호
time curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "wrong"}' > /dev/null

# 존재하지 않는 이메일
time curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "noexist@example.com", "password": "wrong"}' > /dev/null

# 두 응답이 유사한 에러 코드를 반환하고 응답 시간 차이 최소화되어야 함
```

---

## 프론트엔드 수동 검증

```
1. http://localhost:3000/login 접속
2. 회원가입 → 이메일 인증 → 로그인 → 대시보드 진입
3. 브라우저 DevTools > Application > Cookies:
   - refresh_token 쿠키: HttpOnly=true 확인
   - localStorage에 Access Token 없음 확인
4. DevTools > Network에서 /api/v1/auth/refresh 자동 호출 확인
   (토큰 만료 시뮬레이션: JWT_ACCESS_EXPIRY를 1분으로 설정 후 테스트)
5. 로그아웃 후 /dashboard 직접 접근 → /login 리다이렉트 확인
```

---

## Sprint 1 체크리스트 vs 이 가이드

원본 Sprint 1 백로그 체크리스트와 이 가이드의 대응 관계:

| 백로그 항목 | 이 가이드 섹션 |
|-----------|-------------|
| Bcrypt 단위 테스트 | TASK-101 #1 (회원가입 시 DB에서 hash 확인) |
| JWT 생성·검증·만료 | TASK-101 #3~5 |
| Refresh Token Rotation — 구 토큰 재사용 → 세션 무효화 | TASK-101 #5~7 |
| 로그인 실패 5회 → 잠금 15분 | TASK-101 #6 |
| 회원가입 → 이메일 인증 → 로그인 전체 플로우 | TASK-101 #1~3 |
| Rate Limit 1분 10회 초과 → 429 | TASK-103 #1 |
| X-RateLimit-* 헤더 | TASK-103 #2 |
| 프로젝트 soft delete 확인 | TASK-104 #5 |
| ProjectDeletedEvent 발행 | TASK-104 #5 (로그 확인) |
| Refresh Token HttpOnly Secure SameSite | 보안 항목 |
| 타이밍 공격 방어 | 보안 항목 |
| 프론트엔드 로그인 → 대시보드 | 프론트엔드 수동 검증 |
| Access Token localStorage 미저장 | 프론트엔드 수동 검증 |

**자동 테스트(단위·통합)는 아직 작성되지 않았습니다.**
본 가이드는 백로그의 `✅ 수동 검증` + `🛡️ 보안 검증` 항목을 curl로 재현한 것입니다.
`🧪 단위 테스트`, `🔬 통합 테스트` 항목은 JUnit/pytest 작성이 별도로 필요합니다.
