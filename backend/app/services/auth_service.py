from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import PasswordResetToken
from app.models.session import Session
from app.models.user import User

_ph = PasswordHasher()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hash: str) -> bool:
    try:
        return _ph.verify(hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def create_session(
    db: AsyncSession,
    user_id: uuid.UUID,
    expires_hours: int = 24 * 7,
) -> tuple[str, Session]:
    """Returns (raw_token, session)."""
    raw_token = generate_session_token()
    token_h = hash_token(raw_token)
    now = datetime.now(timezone.utc)
    session = Session(
        id=uuid.uuid4(),
        user_id=user_id,
        token_hash=token_h,
        expires_at=now + timedelta(hours=expires_hours),
        created_at=now,
    )
    db.add(session)
    await db.flush()
    return raw_token, session


async def revoke_user_sessions(db: AsyncSession, user_id: uuid.UUID) -> None:
    now = datetime.now(timezone.utc)
    await db.execute(
        update(Session)
        .where(Session.user_id == user_id, Session.revoked_at.is_(None))
        .values(revoked_at=now)
    )


async def register_user(
    db: AsyncSession, name: str, email: str, password: str
) -> User:
    normalized = email.strip().lower()
    # Check duplicate
    existing = await db.execute(select(User).where(User.email == normalized))
    if existing.scalar_one_or_none():
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = User(
        id=uuid.uuid4(),
        email=normalized,
        name=name.strip(),
        password_hash=hash_password(password),
    )
    db.add(user)
    await db.flush()
    return user


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> User | None:
    normalized = email.strip().lower()
    result = await db.execute(
        select(User).where(User.email == normalized, User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def request_password_reset(db: AsyncSession, email: str) -> str | None:
    """Returns raw token or None if user not found."""
    normalized = email.strip().lower()
    result = await db.execute(select(User).where(User.email == normalized))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    raw_token = secrets.token_urlsafe(32)
    token_h = hash_token(raw_token)
    now = datetime.now(timezone.utc)
    prt = PasswordResetToken(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=token_h,
        expires_at=now + timedelta(hours=1),
        created_at=now,
    )
    db.add(prt)
    await db.flush()
    return raw_token


async def reset_password(db: AsyncSession, token: str, new_password: str) -> bool:
    token_h = hash_token(token)
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_h,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > now,
        )
    )
    prt = result.scalar_one_or_none()
    if prt is None:
        return False
    # Mark token used
    prt.used_at = now
    # Update user password
    user_result = await db.execute(select(User).where(User.id == prt.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        return False
    user.password_hash = hash_password(new_password)
    user.updated_at = now
    await db.flush()
    return True
