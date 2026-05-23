import secrets
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config.settings import settings

_OPEN_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}
# SSE 로그 스트림은 브라우저가 직접 구독 — X-Internal-Key 불필요
_OPEN_PREFIXES = ("/agent/dast/logs/",)


class InternalKeyAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # CORS preflight는 인증 없이 통과
        if request.method == "OPTIONS":
            return await call_next(request)

        if request.url.path in _OPEN_PATHS:
            return await call_next(request)

        for prefix in _OPEN_PREFIXES:
            if request.url.path.startswith(prefix):
                return await call_next(request)

        provided = request.headers.get("X-Internal-Key", "")
        if not secrets.compare_digest(provided.encode(), settings.internal_api_key.encode()):
            return JSONResponse(status_code=401, content={"detail": "Invalid internal API key"})

        return await call_next(request)
