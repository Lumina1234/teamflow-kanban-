from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_project_member, require_owner
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services import project_service

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    projects = await project_service.get_user_projects(db, current_user.id)
    results = []
    for p in projects:
        member_result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == p.id,
                ProjectMember.user_id == current_user.id,
            )
        )
        membership = member_result.scalar_one_or_none()
        out = ProjectOut.model_validate(p)
        out.my_role = membership.role.value if membership else None
        results.append(out)
    return results


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(
    body: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.create_project(
        db, body.name, body.description, current_user.id
    )
    await db.commit()
    out = ProjectOut.model_validate(project)
    out.my_role = "owner"
    return out


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    member_data: tuple = Depends(get_project_member),
):
    project, membership = member_data
    out = ProjectOut.model_validate(project)
    out.my_role = membership.role.value
    return out


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    project, _ = member_data
    if body.name is not None:
        project.name = body.name
    if body.description is not None:
        project.description = body.description
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    project, _ = member_data
    await db.delete(project)
    await db.commit()
