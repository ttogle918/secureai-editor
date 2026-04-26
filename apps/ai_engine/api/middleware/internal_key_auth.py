import secrets
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config.settings import settings

_OPEN_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class InternalKeyAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _OPEN_PATHS:
            return await call_next(request)

        provided = request.headers.get("X-Internal-Key", "")
        if not secrets.compare_digest(provided.encode(), settings.internal_api_key.encode()):
            return JSONResponse(status_code=401, content={"detail": "Invalid internal API key"})

        return await call_next(request)
