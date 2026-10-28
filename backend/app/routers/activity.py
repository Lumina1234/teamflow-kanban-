from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_project_member
from app.models.activity import ActivityEvent
from app.schemas.activity import ActivityEventOut, ActivityPage

router = APIRouter(prefix="/api/projects/{project_id}/activity", tags=["activity"])


@router.get("", response_model=ActivityPage)
async def list_activity(
    project_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
):
    offset = (page - 1) * per_page
    result = await db.execute(
        select(ActivityEvent)
        .where(ActivityEvent.project_id == project_id)
        .order_by(ActivityEvent.created_at.desc())
        .offset(offset)
        .limit(per_page)
    )
    events = list(result.scalars().all())

    # Count total
    from sqlalchemy import func
    count_result = await db.execute(
        select(func.count()).where(ActivityEvent.project_id == project_id)
    )
    total = count_result.scalar() or 0

    return ActivityPage(
        items=[ActivityEventOut.model_validate(e) for e in events],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if total > 0 else 1,
    )
