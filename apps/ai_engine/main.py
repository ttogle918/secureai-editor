from infrastructure.langsmith_tracer import configure_langsmith

configure_langsmith()  # must run before any langchain import

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.middleware.internal_key_auth import InternalKeyAuthMiddleware
from api.routes.analyze import router as analyze_router
from api.routes.chat import router as chat_router
from api.routes.dast import router as dast_router
from api.routes.sbom import router as sbom_router
from api.routes.translate import router as translate_router
from api.routes.secret_scan import router as secret_scan_router
from config.settings import settings
from infrastructure.checkpointer import set_checkpointer

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

app.include_router(analyze_router)
app.include_router(chat_router)
app.include_router(dast_router)
app.include_router(sbom_router)
app.include_router(translate_router)
app.include_router(secret_scan_router)


@app.get("/health")
async def health():
    return JSONResponse({"status": "healthy", "service": settings.app_name})
