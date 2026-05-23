.PHONY: dev infra down logs clean rebuild backend frontend ai-engine viewer dast-runner perf-test ssl-cert help

# ──────────────────────────────────────────────────────────────────
# make dev        전체 서비스 (postgres, redis, backend, ai_engine, frontend)
# make infra      인프라만 (postgres, redis) — 로컬 개발 시
# make down       모든 컨테이너 중지
# make clean      컨테이너 + 볼륨 삭제 (데이터 초기화)
# make logs       전체 로그 스트리밍
# make rebuild    backend 이미지 재빌드 후 재시작
# make backend    백엔드 로컬 실행 (Gradle, infra 필요)
# make frontend   프론트엔드 로컬 실행 (npm dev)
# make ai-engine  AI 엔진 로컬 실행 (uvicorn, infra 필요)
# make viewer     세션 로그 뷰어 빌드 & 서빙 (localhost:8082)
# ──────────────────────────────────────────────────────────────────

dev:
	cp -n .env.example .env 2>/dev/null || true
	docker compose up -d
	@echo "✓ 전체 서비스 기동 완료"
	@echo "  Backend  : http://localhost:8080/actuator/health"
	@echo "  AI Engine: http://localhost:8000/health"
	@echo "  Frontend : cd apps/frontend && npm run dev  (http://localhost:3000)"

infra:
	cp -n .env.example .env 2>/dev/null || true
	docker compose up -d postgres redis
	@echo "✓ 인프라 기동 완료 (postgres:5432, redis:6379)"

down:
	docker compose down

clean:
	docker compose down -v --remove-orphans
	@echo "✓ 컨테이너 및 볼륨 삭제 완료"

logs:
	docker compose logs -f

logs-backend:
	docker compose logs -f backend

rebuild:
	docker compose up -d --build backend
	@echo "✓ 백엔드 재빌드 완료"

dast-runner:
	@echo "▶ DAST 샌드박스 이미지 빌드 중..."
	docker build -f apps/dast_runner/Dockerfile -t secureai/dast-runner:latest apps/ai_engine/
	@echo "✓ secureai/dast-runner:latest 빌드 완료"

backend:
	cd apps/backend && ./gradlew bootRun

frontend:
	cd apps/frontend && npm run dev

ai-engine:
	cd apps/ai_engine && uvicorn main:app --reload --port 8000

db:
	docker compose exec postgres psql -U $${DB_USER:-secureai} -d $${DB_NAME:-secureai}

redis-cli:
	docker compose exec redis redis-cli -a $${REDIS_PASSWORD}

viewer:
	@echo "▶ 세션 로그 빌드 중..."
	python scripts/build_session_log.py
	@echo "▶ http://localhost:8082 에서 뷰어를 시작합니다 (Ctrl+C 로 종료)"
	cd docs/portfolio/viewer && python -m http.server 8082

perf-test: ## k6 부하 테스트 실행 (Docker 기동 상태 필요)
	docker compose --profile perf run --rm k6 run /scripts/load-test.js

ssl-cert: ## 개발용 자체 서명 인증서 생성 (nginx/certs/server.key, server.crt)
	mkdir -p nginx/certs
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
	  -keyout nginx/certs/server.key \
	  -out nginx/certs/server.crt \
	  -subj "/C=KR/ST=Seoul/L=Seoul/O=SecureAI/CN=localhost"
	@echo "✓ 인증서 생성 완료: nginx/certs/server.crt, nginx/certs/server.key"

help:
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | sort
	@echo ""
	@echo "Usage: make <target>"
