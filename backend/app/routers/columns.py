from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_project_member, require_owner
from app.models.column import Column
from app.models.card import Card
from app.models.activity import ActivityEvent
from app.models.user import User
from app.schemas.column import ColumnCreate, ColumnOut, ColumnUpdate, ColumnReorderItem, ColumnDeleteRequest

router = APIRouter(prefix="/api/projects/{project_id}/columns", tags=["columns"])


@router.get("", response_model=list[ColumnOut])
async def list_columns(
    project_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Column)
        .where(Column.project_id == project_id)
        .order_by(Column.position)
    )
    return [ColumnOut.model_validate(c) for c in result.scalars().all()]


@router.post("", response_model=ColumnOut, status_code=201)
async def create_column(
    project_id: uuid.UUID,
    body: ColumnCreate,
    member_data: tuple = Depends(require_owner),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, _ = member_data
    max_result = await db.execute(
        select(func.max(Column.position)).where(Column.project_id == project_id)
    )
    max_pos = max_result.scalar() or Decimal("0")
    now = datetime.now(timezone.utc)
    col = Column(
        id=uuid.uuid4(),
        project_id=project_id,
        name=body.name.strip(),
        position=Decimal(str(max_pos)) + Decimal("1024"),
        is_completed=body.is_completed or False,
        created_at=now,
        updated_at=now,
    )
    db.add(col)
    db.add(ActivityEvent(
        id=uuid.uuid4(), project_id=project_id, actor_id=current_user.id,
        event_type="column.created", resource_type="column", resource_id=col.id,
        details={"name": col.name}, created_at=now,
    ))
    await db.commit()
    await db.refresh(col)
    return ColumnOut.model_validate(col)


@router.patch("/{column_id}", response_model=ColumnOut)
async def update_column(
    project_id: uuid.UUID,
    column_id: uuid.UUID,
    body: ColumnUpdate,
    member_data: tuple = Depends(require_owner),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Column).where(Column.id == column_id, Column.project_id == project_id)
    )
    col = result.scalar_one_or_none()
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")
    now = datetime.now(timezone.utc)
    if body.name is not None:
        col.name = body.name.strip()
    if body.is_completed is not None:
        col.is_completed = body.is_completed
    col.updated_at = now
    db.add(ActivityEvent(
        id=uuid.uuid4(), project_id=project_id, actor_id=current_user.id,
        event_type="column.updated", resource_type="column", resource_id=col.id,
        details={"name": col.name}, created_at=now,
    ))
    await db.commit()
    await db.refresh(col)
    return ColumnOut.model_validate(col)


@router.post("/reorder", status_code=204)
async def reorder_columns(
    project_id: uuid.UUID,
    body: list[ColumnReorderItem],
    member_data: tuple = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
):
    """Reorder columns. body is ordered list of {id}; positions are reassigned as multiples of 1024."""
    for i, item in enumerate(body):
        result = await db.execute(
            select(Column).where(Column.id == item.id, Column.project_id == project_id)
        )
        col = result.scalar_one_or_none()
        if col is None:
            raise HTTPException(status_code=404, detail=f"Column {item.id} not found")
        col.position = Decimal(str((i + 1) * 1024))
        col.updated_at = datetime.now(timezone.utc)
    await db.commit()


@router.delete("/{column_id}", status_code=204)
async def delete_column(
    project_id: uuid.UUID,
    column_id: uuid.UUID,
    body: ColumnDeleteRequest,
    member_data: tuple = Depends(require_owner),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a column. All cards must be moved to target_column_id first, or moved here."""
    result = await db.execute(
        select(Column).where(Column.id == column_id, Column.project_id == project_id)
    )
    col = result.scalar_one_or_none()
    if col is None:
        raise HTTPException(status_code=404, detail="Column not found")

    # Verify target column belongs to same project
    target_result = await db.execute(
        select(Column).where(Column.id == body.target_column_id, Column.project_id == project_id)
    )
    target_col = target_result.scalar_one_or_none()
    if target_col is None:
        raise HTTPException(status_code=404, detail="Target column not found")

    # Move all cards to target column (append to end)
    cards_result = await db.execute(
        select(Card).where(Card.column_id == column_id).order_by(Card.position)
    )
    cards = list(cards_result.scalars().all())
    if cards:
        max_result = await db.execute(
            select(func.max(Card.position)).where(Card.column_id == body.target_column_id)
        )
        max_pos = Decimal(str(max_result.scalar() or 0))
        now = datetime.now(timezone.utc)
        for i, card in enumerate(cards):
            card.column_id = body.target_column_id
            card.position = max_pos + Decimal(str((i + 1) * 1024))
            card.updated_at = now

    await db.delete(col)
    db.add(ActivityEvent(
        id=uuid.uuid4(), project_id=project_id, actor_id=current_user.id,
        event_type="column.deleted", resource_type="column", resource_id=column_id,
        details={"name": col.name, "target_column_id": str(body.target_column_id)},
        created_at=datetime.now(timezone.utc),
    ))
    await db.commit()
