.PHONY: dev infra down logs clean rebuild backend frontend ai-engine help

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

help:
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | sort
	@echo ""
	@echo "Usage: make <target>"
