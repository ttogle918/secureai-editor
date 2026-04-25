import secrets
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware

from config.settings import settings

_OPEN_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


class InternalKeyAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _OPEN_PATHS:
            return await call_next(request)

        provided = request.headers.get("X-Internal-Key", "")
        if not secrets.compare_digest(provided.encode(), settings.internal_api_key.encode()):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal API key")

        return await call_next(request)
