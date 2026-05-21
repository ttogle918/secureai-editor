# ── Stage 1: Build ──────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /workspace

# 의존성 레이어 캐시 (소스 변경 없을 시 재다운로드 방지)
COPY gradlew gradlew.bat settings.gradle.kts build.gradle.kts ./
COPY gradle gradle

RUN chmod +x ./gradlew
RUN ./gradlew dependencies --no-daemon -q 2>/dev/null || true

COPY src src
RUN ./gradlew bootJar -x test --no-daemon --info

# ── Stage 2: Runtime ────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Docker CLI 설치 (DAST 컨테이너 실행용, Sprint 6)
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
  "-Djava.net.preferIPv4Stack=true", \
  "-jar", "app.jar"]
