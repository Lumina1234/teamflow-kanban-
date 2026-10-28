from __future__ import annotations

from urllib.parse import urlparse

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings

# Methods that mutate state and require CSRF check
_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Paths exempt from CSRF (e.g. WebSocket upgrade is not cookie auth, login itself)
_CSRF_EXEMPT_PREFIXES = ["/api/auth/login", "/api/auth/register", "/api/invitations/"]


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds security headers and CSRF origin check for cookie-authenticated mutations."""

    async def dispatch(self, request: Request, call_next):
        # CSRF: check Origin header for mutating methods that carry the session cookie
        if (
            request.method in _MUTATING_METHODS
            and request.cookies.get("kanban_session")
        ):
            # Check if exempt
            path = request.url.path
            exempt = any(path.startswith(p) for p in _CSRF_EXEMPT_PREFIXES)
            if not exempt:
                origin = request.headers.get("origin") or request.headers.get("referer")
                if origin:
                    parsed = urlparse(origin)
                    origin_base = f"{parsed.scheme}://{parsed.netloc}"
                    if origin_base not in settings.ALLOWED_ORIGINS:
                        return JSONResponse(
                            {"detail": "CSRF check failed: origin not allowed"},
                            status_code=403,
                        )
                # If no Origin header on a mutating request with a cookie — still allow
                # (e.g., same-origin form posts in non-browser clients, Postman, etc.)

        response: Response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.ENVIRONMENT != "development":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response
