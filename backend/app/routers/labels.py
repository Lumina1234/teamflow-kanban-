from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_project_member, require_owner
from app.models.label import Label
from app.models.user import User
from app.schemas.label import LabelCreate, LabelOut, LabelUpdate

router = APIRouter(prefix="/api/projects/{project_id}/labels", tags=["labels"])


@router.get("", response_model=list[LabelOut])
async def list_labels(
    project_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Label).where(Label.project_id == project_id).order_by(Label.name)
    )
    return [LabelOut.model_validate(lb) for lb in result.scalars().all()]


@router.post("", response_model=LabelOut, status_code=201)
async def create_label(
    project_id: uuid.UUID,
    body: LabelCreate,
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    lb = Label(
        id=uuid.uuid4(),
        project_id=project_id,
        name=body.name.strip(),
        color=body.color,
    )
    db.add(lb)
    await db.commit()
    await db.refresh(lb)
    return LabelOut.model_validate(lb)


@router.patch("/{label_id}", response_model=LabelOut)
async def update_label(
    project_id: uuid.UUID,
    label_id: uuid.UUID,
    body: LabelUpdate,
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.project_id == project_id)
    )
    lb = result.scalar_one_or_none()
    if lb is None:
        raise HTTPException(status_code=404, detail="Label not found")
    if body.name is not None:
        lb.name = body.name.strip()
    if body.color is not None:
        lb.color = body.color
    await db.commit()
    await db.refresh(lb)
    return LabelOut.model_validate(lb)


@router.delete("/{label_id}", status_code=204)
async def delete_label(
    project_id: uuid.UUID,
    label_id: uuid.UUID,
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.project_id == project_id)
    )
    lb = result.scalar_one_or_none()
    if lb is None:
        raise HTTPException(status_code=404, detail="Label not found")
    await db.delete(lb)
    await db.commit()
