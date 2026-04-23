from infrastructure.langsmith_tracer import configure_langsmith

configure_langsmith()  # must run before any langchain import

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from api.middleware.internal_key_auth import InternalKeyAuthMiddleware
from config.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(InternalKeyAuthMiddleware)


@app.get("/health")
async def health():
    return JSONResponse({"status": "healthy", "service": settings.app_name})
