from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.label import Label
from app.models.activity import ActivityEvent


async def get_labels(db: AsyncSession, project_id: uuid.UUID) -> list[Label]:
    result = await db.execute(
        select(Label).where(Label.project_id == project_id).order_by(Label.name)
    )
    return list(result.scalars().all())


async def create_label(
    db: AsyncSession,
    project_id: uuid.UUID,
    name: str,
    color: str,
    actor_id: uuid.UUID,
) -> Label:
    label = Label(
        id=uuid.uuid4(),
        project_id=project_id,
        name=name,
        color=color,
    )
    db.add(label)
    await db.flush()
    event = ActivityEvent(
        id=uuid.uuid4(),
        project_id=project_id,
        actor_id=actor_id,
        event_type="label.created",
        resource_type="label",
        resource_id=label.id,
        details={"name": name, "color": color},
        created_at=datetime.now(timezone.utc),
    )
    db.add(event)
    await db.flush()
    return label


async def update_label(
    db: AsyncSession,
    label_id: uuid.UUID,
    project_id: uuid.UUID,
    name: str | None,
    color: str | None,
) -> Label:
    from fastapi import HTTPException
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.project_id == project_id)
    )
    label = result.scalar_one_or_none()
    if label is None:
        raise HTTPException(status_code=404, detail="Label not found")
    if name is not None:
        label.name = name
    if color is not None:
        label.color = color
    await db.flush()
    return label


async def delete_label(
    db: AsyncSession,
    label_id: uuid.UUID,
    project_id: uuid.UUID,
) -> None:
    from fastapi import HTTPException
    result = await db.execute(
        select(Label).where(Label.id == label_id, Label.project_id == project_id)
    )
    label = result.scalar_one_or_none()
    if label is None:
        raise HTTPException(status_code=404, detail="Label not found")
    await db.delete(label)
    await db.flush()
