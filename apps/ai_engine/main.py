from infrastructure.langsmith_tracer import configure_langsmith

configure_langsmith()  # must run before any langchain import

import logging
import logging.config
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from api.middleware.internal_key_auth import InternalKeyAuthMiddleware
from infrastructure.sentry_filter import scrub_sentry_event
from api.routes.analyze import router as analyze_router
from api.routes.chat import router as chat_router
from api.routes.confirm import router as confirm_router
from api.routes.dast import router as dast_router
from api.routes.sbom import router as sbom_router
from api.routes.translate import router as translate_router
from api.routes.secret_scan import router as secret_scan_router
from api.routes.validate_key import router as validate_key_router
from config.settings import settings
from infrastructure.checkpointer import set_checkpointer

# OpenTelemetry 초기화 — OTEL_ENABLED=true 시에만 활성화
# asyncio Task 경계에서 ContextVar 전파 단절 방지를 위해 앱 시작 직전에 설정한다.
if settings.otel_enabled:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource, SERVICE_NAME

    _resource = Resource(attributes={SERVICE_NAME: settings.otel_service_name})
    _provider = TracerProvider(resource=_resource)
    _provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint))
    )
    trace.set_tracer_provider(_provider)

# ── 로그 포맷 설정 — trace_id 포함 (Loki Trace ID 상관관계, TASK-1603) ──
# Promtail pipeline_stages의 regex가 "[trace_id=<id>]" 패턴을 레이블로 추출한다.
logging.config.dictConfig({
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "structured": {
            "format": "%(asctime)s %(levelname)s [trace_id=%(trace_id)s] %(name)s - %(message)s",
            "defaults": {"trace_id": "-"},
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
        }
    },
    "root": {
        "level": "INFO",
        "handlers": ["console"],
    },
    "loggers": {
        "uvicorn": {"level": "INFO", "propagate": True},
        "uvicorn.access": {"level": "WARNING", "propagate": True},
    },
})

# Sentry 에러 추적 — SENTRY_DSN 있을 때만 활성화 (env-gated, TASK-1804)
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            LoggingIntegration(level=logging.ERROR, event_level=logging.ERROR),
        ],
        before_send=scrub_sentry_event,
        # PII 자동 수집 비활성화 (IP/사용자 정보 전송 금지)
        send_default_pii=False,
        traces_sample_rate=0.1,
        environment="production" if not settings.debug else "development",
    )

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # LangGraph checkpointer — PostgreSQL 접속 가능할 때만 활성화
    _pool = None
    try:
        from psycopg_pool import AsyncConnectionPool
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        _pool = AsyncConnectionPool(
            conninfo=settings.postgres_url,
            min_size=1,
            max_size=5,
            kwargs={"autocommit": True},
            open=False,
        )
        await _pool.open()
        saver = AsyncPostgresSaver(_pool)
        await saver.setup()
        set_checkpointer(saver)
        logger.info("LangGraph AsyncPostgresSaver initialized")
    except Exception as exc:
        logger.warning(
            "LangGraph checkpointer 비활성화 (postgres 미연결): %s", exc
        )

    yield

    if _pool is not None:
        await _pool.close()
        logger.info("PostgreSQL connection pool closed")


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
    lifespan=lifespan,
)


app.add_middleware(InternalKeyAuthMiddleware)
# CORSMiddleware는 InternalKeyAuth 바깥(outermost)에 위치해야 OPTIONS preflight가 먼저 처리됨
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus 메트릭 — /metrics 엔드포인트 노출
# _OPEN_PATHS 에 "/metrics" 추가 + docker-compose에서 8000 포트를 expose(내부망 전용)로
# 제한하여 Prometheus 컨테이너만 수집 가능하고 외부에서 직접 접근 불가
Instrumentator().instrument(app).expose(app)

app.include_router(analyze_router)
app.include_router(chat_router)
app.include_router(confirm_router)
app.include_router(dast_router)
app.include_router(sbom_router)
app.include_router(translate_router)
app.include_router(secret_scan_router)
app.include_router(validate_key_router)


@app.get("/health")
async def health():
    return JSONResponse({"status": "healthy", "service": settings.app_name})
