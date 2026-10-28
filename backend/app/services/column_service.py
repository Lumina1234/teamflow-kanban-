from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.column import Column
from app.models.card import Card
from app.models.activity import ActivityEvent


async def get_columns_for_project(db: AsyncSession, project_id: uuid.UUID) -> list[Column]:
    result = await db.execute(
        select(Column)
        .where(Column.project_id == project_id)
        .order_by(Column.position)
    )
    return list(result.scalars().all())


async def create_column(
    db: AsyncSession,
    project_id: uuid.UUID,
    name: str,
    is_completed: bool,
    actor_id: uuid.UUID,
) -> Column:
    # Place at end: find max position
    max_result = await db.execute(
        select(func.max(Column.position)).where(Column.project_id == project_id)
    )
    max_pos = max_result.scalar() or 0
    new_pos = float(max_pos) + 1024

    now = datetime.now(timezone.utc)
    col = Column(
        id=uuid.uuid4(),
        project_id=project_id,
        name=name,
        position=new_pos,
        is_completed=is_completed,
        created_at=now,
        updated_at=now,
    )
    db.add(col)
    await db.flush()

    event = ActivityEvent(
        id=uuid.uuid4(),
        project_id=project_id,
        actor_id=actor_id,
        event_type="column.created",
        resource_type="column",
        resource_id=col.id,
        details={"name": name},
        created_at=now,
    )
    db.add(event)
    await db.flush()
    return col


async def reorder_columns(
    db: AsyncSession,
    project_id: uuid.UUID,
    items: list[dict],  # [{id, before_column_id}]
    actor_id: uuid.UUID,
) -> list[Column]:
    """
    items is a list of {id: UUID, before_column_id: UUID|None}.
    Recompute positions using fractional approach.
    """
    # Load all columns
    result = await db.execute(
        select(Column).where(Column.project_id == project_id).order_by(Column.position)
    )
    all_cols = {col.id: col for col in result.scalars().all()}

    # Build ordered list from items
    ordered_ids = [item["id"] for item in items]
    # Assign positions as multiples of 1024
    for i, col_id in enumerate(ordered_ids):
        if col_id in all_cols:
            all_cols[col_id].position = (i + 1) * 1024
            all_cols[col_id].updated_at = datetime.now(timezone.utc)

    await db.flush()

    result2 = await db.execute(
        select(Column).where(Column.project_id == project_id).order_by(Column.position)
    )
    return list(result2.scalars().all())


async def delete_column(
    db: AsyncSession,
    column_id: uuid.UUID,
    project_id: uuid.UUID,
    target_column_id: uuid.UUID,
    actor_id: uuid.UUID,
) -> None:
    """Delete a column, moving its cards to target_column_id first."""
    from sqlalchemy import update

    # Verify target column exists and belongs to project
    target_result = await db.execute(
        select(Column).where(
            Column.id == target_column_id,
            Column.project_id == project_id,
        )
    )
    target_col = target_result.scalar_one_or_none()
    if target_col is None:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=400, detail="Target column not found in this project")

    # Get max position in target column
    max_result = await db.execute(
        select(func.max(Card.position)).where(Card.column_id == target_column_id)
    )
    max_pos = float(max_result.scalar() or 0)

    # Move cards
    cards_result = await db.execute(
        select(Card).where(Card.column_id == column_id).order_by(Card.position)
    )
    cards = list(cards_result.scalars().all())
    now = datetime.now(timezone.utc)
    for i, card in enumerate(cards):
        card.column_id = target_column_id
        card.position = max_pos + (i + 1) * 1024
        card.updated_at = now

    await db.flush()

    # Delete column
    col_result = await db.execute(
        select(Column).where(Column.id == column_id, Column.project_id == project_id)
    )
    col = col_result.scalar_one_or_none()
    if col:
        await db.delete(col)

    event = ActivityEvent(
        id=uuid.uuid4(),
        project_id=project_id,
        actor_id=actor_id,
        event_type="column.deleted",
        resource_type="column",
        resource_id=column_id,
        details={"moved_cards_to": str(target_column_id)},
        created_at=now,
    )
    db.add(event)
    await db.flush()
