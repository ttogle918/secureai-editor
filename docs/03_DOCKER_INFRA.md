# SecureAI — Docker 환경 & 인프라 설계서
> 작성자: 시니어 백엔드 개발자  
> 작성일: 2026-04-19 | 버전: v1.0

---

## 1. 전체 컨테이너 구조

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network: secureai-net          │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐    │
│  │ frontend │   │ backend  │   │ postgres:15       │    │
│  │ Next.js  │──►│ Spring   │──►│ port: 5432        │    │
│  │ :3000    │   │ Boot 3   │   └──────────────────┘    │
│  └──────────┘   │ :8080    │   ┌──────────────────┐    │
│                 │          │──►│ redis:7           │    │
│                 │          │   │ port: 6379        │    │
│                 └────┬─────┘   └──────────────────┘    │
│                      │                                  │
│                      │ Docker Socket                    │
│                      ▼                                  │
│  ┌─────────────────────────────────────────────┐        │
│  │  DAST Sandbox Containers (동적 생성/삭제)    │        │
│  │  network: dast-isolated-bridge               │        │
│  │  memory: 512MB limit, cpu: 0.5               │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘

외부 통신:
backend ──► Claude API (api.anthropic.com)
backend ──► GitHub API (api.github.com)
backend ──► NVD API (services.nvd.nist.gov)
DAST ──────► 검증된 타겟 도메인만 (custom iptables)
```

---

## 2. 환경변수 목록 (.env.example)

```env
# === Database ===
DB_PASSWORD=changeme_in_production
DB_NAME=secureai
DB_USER=secureai

# === Redis ===
REDIS_PASSWORD=changeme_in_production

# === JWT ===
JWT_SECRET=minimum-32-characters-random-secret-key
JWT_ACCESS_EXPIRY_SECONDS=900
JWT_REFRESH_EXPIRY_DAYS=30

# === Encryption ===
# 32바이트 랜덤 (openssl rand -hex 32)
SECUREAI_ENCRYPTION_KEY=your-32-byte-hex-key-here

# === Claude API ===
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514

# === GitHub OAuth ===
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:8080/api/v1/auth/github/callback

# === NVD API ===
NVD_API_KEY=your-nvd-api-key  # 없어도 동작, 있으면 rate limit 완화

# === Application ===
APP_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8080

# === Report Storage ===
REPORT_STORAGE_PATH=/app/reports

# === DAST ===
DAST_SANDBOX_IMAGE=secureai-dast-sandbox:latest
DAST_MAX_CONCURRENT=3
DAST_TIMEOUT_SECONDS=300
DAST_MEMORY_LIMIT=536870912  # 512MB in bytes
```

---

## 3. Spring Boot Dockerfile

```dockerfile
# backend/Dockerfile
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace

COPY gradlew .
COPY gradle gradle
COPY build.gradle.kts settings.gradle.kts ./
COPY src src

RUN chmod +x ./gradlew && ./gradlew bootJar -x test --no-daemon

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Docker CLI 설치 (DAST 컨테이너 실행용)
RUN apk add --no-cache docker-cli

# 보안: non-root 실행
RUN addgroup -S secureai && adduser -S secureai -G secureai
RUN mkdir -p /app/reports && chown -R secureai:secureai /app

COPY --from=builder /workspace/build/libs/*.jar app.jar
RUN chown secureai:secureai app.jar

USER secureai

EXPOSE 8080

ENTRYPOINT ["java", \
  "-XX:+UseZGC", \
  "-XX:MaxRAMPercentage=75", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
```

---

## 4. DAST Sandbox Dockerfile

```dockerfile
# dast-sandbox/Dockerfile
FROM python:3.12-slim

RUN pip install --no-cache-dir requests httpx

# 보안: 네트워크 도구 제거
RUN apt-get remove --purge -y curl wget && apt-get autoremove -y

WORKDIR /sandbox
COPY dast_runner.py .

# 최소 권한 실행
RUN useradd -r -s /bin/false sandbox
USER sandbox

ENTRYPOINT ["python", "dast_runner.py"]
```

---

## 5. Flyway 설정

```yaml
# application.yml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
    validate-on-migrate: true
    out-of-order: false
```

---

## 6. 개발 시작 명령어

```bash
# 전체 환경 시작
cp .env.example .env
# .env 파일의 민감 값 수정

docker compose up -d

# 로그 확인
docker compose logs -f backend

# DB 접속
docker compose exec postgres psql -U secureai -d secureai

# Redis 접속
docker compose exec redis redis-cli -a $REDIS_PASSWORD

# DAST 샌드박스 이미지 빌드
docker build -t secureai-dast-sandbox:latest ./dast-sandbox/

# 백엔드만 재빌드
docker compose up -d --build backend
```

---

## 7. 헬스체크 엔드포인트

```
GET /actuator/health       # 전체 헬스 (DB + Redis 포함)
GET /actuator/info         # 버전 정보
GET /actuator/metrics      # Micrometer 메트릭
```

---

*이전 문서: [02_API_DESIGN.md]*
