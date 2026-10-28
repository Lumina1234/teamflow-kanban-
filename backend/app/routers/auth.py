from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UpdateProfileRequest,
    UserOut,
)
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "kanban_session"


def _set_session_cookie(response: Response, token: str, settings_obj=None) -> None:
    from app.config import settings as s
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=s.COOKIE_SECURE,
        samesite=s.COOKIE_SAMESITE,
        max_age=60 * 60 * 24 * 7,  # 7 days
        path="/",
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    from slowapi import Limiter
    from app.config import settings
    user = await auth_service.register_user(db, body.name, body.email, body.password)
    raw_token, _ = await auth_service.create_session(db, user.id)
    await db.commit()
    _set_session_cookie(response, raw_token)
    return AuthResponse(user=UserOut.model_validate(user), message="Registered")


@router.post("/login", response_model=AuthResponse)
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException, status
    user = await auth_service.authenticate_user(db, body.email, body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    raw_token, _ = await auth_service.create_session(db, user.id)
    await db.commit()
    _set_session_cookie(response, raw_token)
    return AuthResponse(user=UserOut.model_validate(user), message="Logged in")


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import hashlib
    raw_token = request.cookies.get(COOKIE_NAME, "")
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    from sqlalchemy import select, update
    from app.models.session import Session
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Session)
        .where(Session.token_hash == token_hash)
        .values(revoked_at=now)
    )
    await db.commit()
    response.delete_cookie(COOKIE_NAME)
    return {"message": "Logged out"}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)


@router.patch("/profile", response_model=UserOut)
async def update_profile(
    body: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    if body.new_password:
        if not body.current_password or not auth_service.verify_password(body.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        current_user.password_hash = auth_service.hash_password(body.new_password)
    if body.name:
        current_user.name = body.name.strip()
    await db.commit()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)


@router.get("/ws-token")
async def get_ws_token(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Return the raw session token so the frontend can pass it to the WebSocket
    endpoint as ?token=... (WS cannot send cookies cross-origin reliably).
    The token is already scoped to the authenticated session — no new secret.
    """
    raw_token = request.cookies.get(COOKIE_NAME, "")
    return {"token": raw_token}


@router.post("/forgot-password")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    # Always return 200 to prevent user enumeration
    raw_token = await auth_service.request_password_reset(db, body.email)
    await db.commit()
    # In production: send email with raw_token. For now, return a hint in dev.
    return {"message": "If that email exists, a reset link was sent."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    ok = await auth_service.reset_password(db, body.token, body.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    await db.commit()
    return {"message": "Password reset successful"}
