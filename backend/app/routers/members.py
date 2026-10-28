from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_project_member, require_owner
from app.models.project import Project, ProjectMember, ProjectRole
from app.models.user import User
from app.schemas.project import MemberOut
from app.schemas.invitation import InvitationCreate, InvitationOut
from app.services import invitation_service

router = APIRouter(tags=["members"])


@router.get("/api/projects/{project_id}/members", response_model=list[MemberOut])
async def list_members(
    project_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
):
    project, _ = member_data
    members_result = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    )
    members = list(members_result.scalars().all())

    # Enrich with user info
    out = []
    for m in members:
        user_result = await db.execute(select(User).where(User.id == m.user_id))
        user = user_result.scalar_one_or_none()
        mo = MemberOut.model_validate(m)
        if user:
            mo.email = user.email
            mo.name = user.name
        out.append(mo)
    return out


@router.post("/api/projects/{project_id}/invitations", response_model=InvitationOut, status_code=201)
async def create_invitation(
    project_id: uuid.UUID,
    body: InvitationCreate,
    member_data: tuple = Depends(require_owner),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raw_token, inv = await invitation_service.create_invitation(
        db, project_id, body.email, body.role, current_user.id
    )
    await db.commit()
    await db.refresh(inv)
    # In production: email raw_token to the invitee. In dev: log it.
    import logging
    logging.getLogger("uvicorn").info(f"[DEV] Invitation token for {body.email}: {raw_token}")
    return InvitationOut.model_validate(inv)


@router.get("/api/projects/{project_id}/invitations", response_model=list[InvitationOut])
async def list_invitations(
    project_id: uuid.UUID,
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    from app.models.invitation import Invitation
    result = await db.execute(
        select(Invitation).where(Invitation.project_id == project_id)
    )
    return [InvitationOut.model_validate(inv) for inv in result.scalars().all()]


@router.delete("/api/projects/{project_id}/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    project_id: uuid.UUID,
    invitation_id: uuid.UUID,
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    await invitation_service.revoke_invitation(db, invitation_id, project_id)
    await db.commit()


@router.post("/api/invitations/{token}/accept")
async def accept_invitation(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    membership = await invitation_service.accept_invitation(db, token, current_user)
    await db.commit()
    return {"message": "Invitation accepted", "project_id": str(membership.project_id)}


@router.patch("/api/projects/{project_id}/members/{user_id}")
async def change_member_role(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str = Body(..., embed=True),
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if role not in ("owner", "member"):
        raise HTTPException(status_code=400, detail="Role must be 'owner' or 'member'")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    # Protection: Cannot demote the last remaining owner
    if member.role == ProjectRole.owner and role == "member":
        from sqlalchemy import func
        owner_count_res = await db.execute(
            select(func.count()).where(
                ProjectMember.project_id == project_id,
                ProjectMember.role == ProjectRole.owner,
            )
        )
        if (owner_count_res.scalar() or 0) <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last remaining owner")

    old_role = member.role.value
    member.role = ProjectRole(role)

    # Activity log
    from app.models.activity import ActivityEvent
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    db.add(ActivityEvent(
        id=uuid.uuid4(),
        project_id=project_id,
        actor_id=current_user.id,
        event_type="member.role_changed",
        resource_type="member",
        resource_id=member.id,
        details={"user_id": str(user_id), "old_role": old_role, "new_role": role},
        created_at=now,
    ))

    await db.commit()

    # Real-time notification
    from app.services.realtime_service import manager
    try:
        await manager.broadcast_to_project(project_id, "member.role_changed", {"user_id": str(user_id), "role": role})
    except Exception:
        pass

    return {"message": "Role updated"}


@router.delete("/api/projects/{project_id}/members/{user_id}", status_code=204)
async def remove_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.realtime_service import manager
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    # Protection: Cannot remove the last remaining owner
    if member.role == ProjectRole.owner:
        from sqlalchemy import func
        owner_count_res = await db.execute(
            select(func.count()).where(
                ProjectMember.project_id == project_id,
                ProjectMember.role == ProjectRole.owner,
            )
        )
        if (owner_count_res.scalar() or 0) <= 1:
            raise HTTPException(status_code=400, detail="Cannot remove the last remaining owner")

    # Activity log
    from app.models.activity import ActivityEvent
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    db.add(ActivityEvent(
        id=uuid.uuid4(),
        project_id=project_id,
        actor_id=current_user.id,
        event_type="member.removed",
        resource_type="member",
        resource_id=member.id,
        details={"user_id": str(user_id)},
        created_at=now,
    ))

    await db.delete(member)
    await db.commit()

    # Kick user from WebSocket connection immediately
    try:
        await manager.kick_user_from_project(project_id, user_id)
        await manager.broadcast_to_project(project_id, "member.removed", {"user_id": str(user_id)})
    except Exception:
        pass
