from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEvent


async def get_project_activity(
    db: AsyncSession,
    project_id: uuid.UUID,
    page: int = 1,
    per_page: int = 25,
) -> tuple[list[ActivityEvent], int]:
    offset = (page - 1) * per_page
    count_result = await db.execute(
        select(func.count(ActivityEvent.id)).where(ActivityEvent.project_id == project_id)
    )
    total = count_result.scalar_one()

    result = await db.execute(
        select(ActivityEvent)
        .where(ActivityEvent.project_id == project_id)
        .order_by(ActivityEvent.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    events = list(result.scalars().all())
    return events, total
