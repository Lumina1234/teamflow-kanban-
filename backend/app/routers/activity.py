from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_project_member
from app.models.activity import ActivityEvent
from app.models.user import User
from app.schemas.activity import ActivityEventOut, ActivityPage
from app.services import card_service, task_auth_service

router = APIRouter(prefix="/api/projects/{project_id}/activity", tags=["activity"])


@router.get("", response_model=ActivityPage)
async def list_activity(
    project_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=25, ge=1, le=100),
):
    project, membership = member_data
    is_mgr = task_auth_service.is_manager(membership)

    # Fetch recent events for project
    result = await db.execute(
        select(ActivityEvent)
        .where(ActivityEvent.project_id == project_id)
        .order_by(ActivityEvent.created_at.desc())
    )
    all_events = list(result.scalars().all())

    if is_mgr:
        filtered_events = all_events
    else:
        # Load visible cards for this user
        all_cards = await card_service.get_cards_for_project(db, project_id)
        visible_cards = task_auth_service.filter_visible_cards(all_cards, membership, current_user.id)
        visible_card_ids = {str(c.id) for c in visible_cards}

        filtered_events = []
        for e in all_events:
            if e.resource_type == "card":
                if str(e.resource_id) in visible_card_ids:
                    filtered_events.append(e)
            elif e.resource_type == "comment":
                card_id_in_details = e.details.get("card_id") if e.details else None
                if card_id_in_details and str(card_id_in_details) in visible_card_ids:
                    filtered_events.append(e)
            else:
                # General project events (columns, membership)
                filtered_events.append(e)

    total = len(filtered_events)
    offset = (page - 1) * per_page
    paged_items = filtered_events[offset : offset + per_page]

    return ActivityPage(
        items=[ActivityEventOut.model_validate(e) for e in paged_items],
        total=total,
        page=page,
        per_page=per_page,
        pages=(total + per_page - 1) // per_page if total > 0 else 1,
    )
