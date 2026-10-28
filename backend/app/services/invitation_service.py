from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invitation import Invitation, InvitationRole
from app.models.project import Project, ProjectMember, ProjectRole
from app.models.user import User
from app.services.auth_service import hash_token


async def create_invitation(
    db: AsyncSession,
    project_id: uuid.UUID,
    invited_email: str,
    role: str,
    invited_by: uuid.UUID,
) -> tuple[str, Invitation]:
    """Returns (raw_token, invitation)."""
    normalized_email = invited_email.strip().lower()
    now = datetime.now(timezone.utc)
    raw_token = secrets.token_urlsafe(32)
    token_h = hash_token(raw_token)

    inv = Invitation(
        id=uuid.uuid4(),
        project_id=project_id,
        invited_email=normalized_email,
        token_hash=token_h,
        role=InvitationRole(role),
        expires_at=now + timedelta(days=7),
        invited_by=invited_by,
        created_at=now,
    )
    db.add(inv)
    await db.flush()
    return raw_token, inv


async def accept_invitation(
    db: AsyncSession,
    raw_token: str,
    accepting_user: User,
) -> ProjectMember:
    token_h = hash_token(raw_token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Invitation).where(Invitation.token_hash == token_h)
    )
    inv = result.scalar_one_or_none()

    if inv is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.revoked_at is not None:
        raise HTTPException(status_code=410, detail="Invitation has been revoked")
    if inv.accepted_at is not None:
        raise HTTPException(status_code=410, detail="Invitation has already been accepted")
    if inv.expires_at < now:
        raise HTTPException(status_code=410, detail="Invitation has expired")
    if inv.invited_email != accepting_user.email.strip().lower():
        raise HTTPException(status_code=403, detail="This invitation was not sent to your email")

    # Check if already a member
    existing = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == inv.project_id,
            ProjectMember.user_id == accepting_user.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Already a member of this project")

    membership = ProjectMember(
        id=uuid.uuid4(),
        project_id=inv.project_id,
        user_id=accepting_user.id,
        role=ProjectRole(inv.role.value),
        joined_at=now,
    )
    db.add(membership)
    inv.accepted_at = now
    await db.flush()
    return membership


async def revoke_invitation(
    db: AsyncSession,
    invitation_id: uuid.UUID,
    project_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(Invitation).where(
            Invitation.id == invitation_id,
            Invitation.project_id == project_id,
        )
    )
    inv = result.scalar_one_or_none()
    if inv is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    inv.revoked_at = datetime.now(timezone.utc)
    await db.flush()
