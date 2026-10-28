from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_project_member
from app.models.team import Team
from app.schemas.team import TeamOut

router = APIRouter(prefix="/api/projects/{project_id}/teams", tags=["teams"])


@router.get("", response_model=List[TeamOut])
async def list_teams(
    project_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Team).where(Team.project_id == project_id).order_by(Team.name)
    )
    teams = list(result.scalars().all())
    return [TeamOut.model_validate(t) for t in teams]
