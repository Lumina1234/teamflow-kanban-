from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.config import settings
from app.routers import auth, projects, members, columns, cards, labels, comments, activity, websocket

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Kanban API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

# ── Rate limiting ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Security headers ───────────────────────────────────────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "connect-src 'self' wss:; "
            "frame-ancestors 'none';"
        )
    return response


# ── CSRF protection (Origin check for state-changing requests) ─────────────────
@app.middleware("http")
async def csrf_origin_check(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        # WebSocket upgrades skip CSRF
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await call_next(request)
        origin = request.headers.get("origin")
        if origin and origin not in settings.ALLOWED_ORIGINS:
            return JSONResponse(
                status_code=403,
                content={"code": "csrf_failed", "message": "Origin not allowed"},
            )
    return await call_next(request)


# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(members.router)
app.include_router(columns.router)
app.include_router(cards.router)
app.include_router(labels.router)
app.include_router(comments.router)
app.include_router(activity.router)
app.include_router(websocket.router)


# ── Health check & Docs redirects ──────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/docs", include_in_schema=False)
async def redirect_docs():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/docs")


@app.get("/openapi.json", include_in_schema=False)
async def redirect_openapi():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/api/openapi.json")
