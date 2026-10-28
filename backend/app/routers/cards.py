from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_project_member
from app.models.column import Column
from app.models.card import Card
from app.models.activity import ActivityEvent
from app.models.user import User
from app.schemas.card import CardCreate, CardOut, CardUpdate, CardMoveRequest
from app.services import card_service
from datetime import datetime, timezone

router = APIRouter(prefix="/api/projects/{project_id}/cards", tags=["cards"])


async def _card_or_404(db, card_id, project_id):
    result = await db.execute(
        select(Card).where(Card.id == card_id, Card.project_id == project_id)
    )
    card = result.scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.get("", response_model=list[CardOut])
async def list_cards(
    project_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
    assignee_id: uuid.UUID | None = Query(default=None),
    label_id: uuid.UUID | None = Query(default=None),
    overdue: bool | None = Query(default=None),
):
    cards = await card_service.get_cards_for_project(
        db, project_id, assignee_id=assignee_id, label_id=label_id, overdue=overdue
    )
    return [CardOut.model_validate(c) for c in cards]


@router.post("", response_model=CardOut, status_code=201)
async def create_card(
    project_id: uuid.UUID,
    body: CardCreate,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate column belongs to project
    col_result = await db.execute(
        select(Column).where(Column.id == body.column_id, Column.project_id == project_id)
    )
    if col_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Column not found in this project")

    # Validate assignee is a project member
    if body.assignee_id is not None:
        from app.models.project import ProjectMember
        member_check = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == body.assignee_id,
            )
        )
        if member_check.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Assignee must be a project member")

    card = await card_service.create_card(
        db, project_id, body.column_id, body.title, body.description,
        current_user.id, body.assignee_id, body.due_date,
    )
    await db.commit()
    await db.refresh(card)
    return CardOut.model_validate(card)


@router.get("/{card_id}", response_model=CardOut)
async def get_card(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
):
    card = await _card_or_404(db, card_id, project_id)
    return CardOut.model_validate(card)


@router.patch("/{card_id}", response_model=CardOut)
async def update_card(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    body: CardUpdate,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _card_or_404(db, card_id, project_id)

    # Optimistic locking
    if body.version is not None and body.version != card.version:
        raise HTTPException(status_code=409, detail="Card was modified by another user (stale version)")

    now = datetime.now(timezone.utc)
    changes = {}
    if body.title is not None:
        changes["title"] = {"from": card.title, "to": body.title}
        card.title = body.title
    if body.description is not None:
        card.description = body.description
    if body.assignee_id is not None:
        # Validate assignee is project member
        from app.models.project import ProjectMember
        member_check = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == body.assignee_id,
            )
        )
        if member_check.scalar_one_or_none() is None:
            raise HTTPException(status_code=400, detail="Assignee must be a project member")
        changes["assignee_id"] = {"to": str(body.assignee_id)}
        card.assignee_id = body.assignee_id
    if body.due_date is not None:
        card.due_date = body.due_date
        changes["due_date"] = {"to": str(body.due_date)}
    if body.column_id is not None:
        col_result = await db.execute(
            select(Column).where(Column.id == body.column_id, Column.project_id == project_id)
        )
        if col_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Column not found in this project")
        card.column_id = body.column_id

    card.version = (card.version or 1) + 1
    card.updated_at = now

    db.add(ActivityEvent(
        id=uuid.uuid4(), project_id=project_id, actor_id=current_user.id,
        event_type="card.updated", resource_type="card", resource_id=card.id,
        details={"changes": changes, "title": card.title}, created_at=now,
    ))
    await db.commit()
    await db.refresh(card)
    return CardOut.model_validate(card)


@router.delete("/{card_id}", status_code=204)
async def delete_card(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _card_or_404(db, card_id, project_id)
    db.add(ActivityEvent(
        id=uuid.uuid4(), project_id=project_id, actor_id=current_user.id,
        event_type="card.deleted", resource_type="card", resource_id=card_id,
        details={"title": card.title}, created_at=datetime.now(timezone.utc),
    ))
    await db.delete(card)
    await db.commit()


@router.post("/{card_id}/move", response_model=CardOut)
async def move_card(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    body: CardMoveRequest,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate target column belongs to same project
    col_result = await db.execute(
        select(Column).where(Column.id == body.target_column_id, Column.project_id == project_id)
    )
    if col_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Target column not found in this project")

    card = await card_service.move_card(
        db, card_id, body.target_column_id, body.before_card_id,
        current_user.id, project_id,
    )
    await db.commit()
    await db.refresh(card)
    return CardOut.model_validate(card)


@router.post("/{card_id}/labels/{label_id}", status_code=204)
async def add_label(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    label_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
):
    await _card_or_404(db, card_id, project_id)
    await card_service.add_label_to_card(db, card_id, label_id, project_id)
    await db.commit()


@router.delete("/{card_id}/labels/{label_id}", status_code=204)
async def remove_label(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    label_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
):
    await _card_or_404(db, card_id, project_id)
    await card_service.remove_label_from_card(db, card_id, label_id)
    await db.commit()
