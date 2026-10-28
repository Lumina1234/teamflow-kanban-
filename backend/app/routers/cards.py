from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_project_member
from app.models.activity import ActivityEvent
from app.models.card import Card
from app.models.column import Column
from app.models.task_access_grant import TaskAccessGrant
from app.models.team import Team
from app.models.user import User
from app.schemas.card import (
    CardCreate,
    CardMoveRequest,
    CardOut,
    CardUpdate,
    TaskAccessGrantCreate,
    TaskAccessGrantOut,
)
from app.services import card_service, task_auth_service

router = APIRouter(prefix="/api/projects/{project_id}/cards", tags=["cards"])


def _format_card_out(card: Card) -> CardOut:
    out = CardOut.model_validate(card)
    if card.owner_team:
        out.team_slug = card.owner_team.slug
        out.team_name = card.owner_team.name
    shared: list[str] = []
    grants: list[TaskAccessGrantOut] = []
    if hasattr(card, "access_grants") and card.access_grants:
        for g in card.access_grants:
            go = TaskAccessGrantOut.model_validate(g)
            if g.team:
                go.team_name = g.team.name
                go.team_slug = g.team.slug
                if g.team.name not in shared:
                    shared.append(g.team.name)
            grants.append(go)
    out.shared_teams = shared
    out.access_grants = grants
    return out


async def _card_or_404(db: AsyncSession, card_id: uuid.UUID, project_id: uuid.UUID) -> Card:
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    assignee_id: uuid.UUID | None = Query(default=None),
    label_id: uuid.UUID | None = Query(default=None),
    overdue: bool | None = Query(default=None),
    team_id: uuid.UUID | None = Query(default=None),
    q: str | None = Query(default=None),
):
    project, membership = member_data
    cards = await card_service.get_cards_for_project(
        db,
        project_id,
        assignee_id=assignee_id,
        label_id=label_id,
        overdue=overdue,
        team_id=team_id,
        search=q,
    )
    visible_cards = task_auth_service.filter_visible_cards(cards, membership, current_user.id)
    return [_format_card_out(c) for c in visible_cards]


@router.get("/search", response_model=list[CardOut])
async def search_cards(
    project_id: uuid.UUID,
    q: str = Query(..., min_length=1),
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, membership = member_data
    cards = await card_service.get_cards_for_project(db, project_id, search=q)
    visible_cards = task_auth_service.filter_visible_cards(cards, membership, current_user.id)
    return [_format_card_out(c) for c in visible_cards]


@router.post("", response_model=CardOut, status_code=201)
async def create_card(
    project_id: uuid.UUID,
    body: CardCreate,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project, membership = member_data

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

    owner_team_id = body.owner_team_id
    visibility = body.visibility or "team_only"

    if not task_auth_service.is_manager(membership):
        if owner_team_id is None:
            owner_team_id = membership.team_id
        elif membership.team_id and owner_team_id != membership.team_id:
            raise HTTPException(status_code=403, detail="Cannot create cards for another team")
        if task_auth_service.is_hr(membership):
            visibility = "hr_only"

    card = await card_service.create_card(
        db,
        project_id,
        body.column_id,
        body.title,
        body.description,
        current_user.id,
        body.assignee_id,
        body.due_date,
        owner_team_id=owner_team_id,
        visibility=visibility,
    )
    await db.commit()
    await db.refresh(card)
    return _format_card_out(card)


@router.get("/{card_id}", response_model=CardOut)
async def get_card(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _card_or_404(db, card_id, project_id)
    project, membership = member_data
    if not task_auth_service.can_view_card(card, membership, current_user.id):
        raise HTTPException(status_code=404, detail="Card not found")
    return _format_card_out(card)


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
    project, membership = member_data

    # Check permission to edit card
    if not task_auth_service.can_edit_card(card, membership, current_user.id):
        raise HTTPException(status_code=403, detail="You do not have permission to edit this card")

    # Check permission to reassign owner team
    if body.owner_team_id is not None and body.owner_team_id != card.owner_team_id:
        if not task_auth_service.is_manager(membership):
            raise HTTPException(
                status_code=403, detail="Only project managers can reassign card owner team"
            )
        card.owner_team_id = body.owner_team_id

    # Check permission to change visibility
    if body.visibility is not None and body.visibility != card.visibility:
        if not task_auth_service.is_manager(membership):
            raise HTTPException(
                status_code=403, detail="Only project managers can change card visibility"
            )
        card.visibility = body.visibility

    # Optimistic locking
    if body.version is not None and body.version != card.version:
        raise HTTPException(
            status_code=409, detail="Card was modified by another user (stale version)"
        )

    now = datetime.now(timezone.utc)
    changes = {}
    if body.title is not None:
        changes["title"] = {"from": card.title, "to": body.title}
        card.title = body.title
    if body.description is not None:
        card.description = body.description
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

    db.add(
        ActivityEvent(
            id=uuid.uuid4(),
            project_id=project_id,
            actor_id=current_user.id,
            event_type="card.updated",
            resource_type="card",
            resource_id=card.id,
            details={"changes": changes, "title": card.title},
            created_at=now,
        )
    )
    await db.commit()
    await db.refresh(card)
    return _format_card_out(card)


@router.delete("/{card_id}", status_code=204)
async def delete_card(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _card_or_404(db, card_id, project_id)
    project, membership = member_data
    if not task_auth_service.can_delete_card(card, membership, current_user.id):
        raise HTTPException(
            status_code=403, detail="You do not have permission to delete this card"
        )

    db.add(
        ActivityEvent(
            id=uuid.uuid4(),
            project_id=project_id,
            actor_id=current_user.id,
            event_type="card.deleted",
            resource_type="card",
            resource_id=card_id,
            details={"title": card.title},
            created_at=datetime.now(timezone.utc),
        )
    )
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
    card = await _card_or_404(db, card_id, project_id)
    project, membership = member_data

    if not task_auth_service.can_edit_card(card, membership, current_user.id):
        raise HTTPException(status_code=403, detail="You do not have permission to move this card")

    # Validate target column belongs to same project
    col_result = await db.execute(
        select(Column).where(Column.id == body.target_column_id, Column.project_id == project_id)
    )
    if col_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Target column not found in this project")

    moved = await card_service.move_card(
        db,
        card_id,
        body.target_column_id,
        body.before_card_id,
        current_user.id,
        project_id,
    )
    await db.commit()
    await db.refresh(moved)
    return _format_card_out(moved)


@router.post("/{card_id}/share", response_model=TaskAccessGrantOut, status_code=201)
async def share_card(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    body: TaskAccessGrantCreate,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _card_or_404(db, card_id, project_id)
    project, membership = member_data

    if not task_auth_service.can_share_card(card, membership, current_user.id):
        raise HTTPException(status_code=403, detail="Only project managers can share cards")

    if not body.team_id and not body.user_id:
        raise HTTPException(status_code=400, detail="Must provide team_id or user_id")

    if body.team_id:
        team_check = await db.execute(
            select(Team).where(Team.id == body.team_id, Team.project_id == project_id)
        )
        team = team_check.scalar_one_or_none()
        if team is None:
            raise HTTPException(status_code=404, detail="Team not found in this project")

    # Check if grant already exists
    existing_grant = await db.execute(
        select(TaskAccessGrant).where(
            TaskAccessGrant.card_id == card_id,
            TaskAccessGrant.team_id == body.team_id,
            TaskAccessGrant.user_id == body.user_id,
        )
    )
    grant = existing_grant.scalar_one_or_none()
    if grant is not None:
        grant.permission = body.permission
    else:
        grant = TaskAccessGrant(
            id=uuid.uuid4(),
            card_id=card_id,
            team_id=body.team_id,
            user_id=body.user_id,
            permission=body.permission,
            granted_by=current_user.id,
            created_at=datetime.now(timezone.utc),
        )
        db.add(grant)

    if card.visibility == "team_only":
        card.visibility = "selected_teams"

    db.add(
        ActivityEvent(
            id=uuid.uuid4(),
            project_id=project_id,
            actor_id=current_user.id,
            event_type="card.shared",
            resource_type="card",
            resource_id=card.id,
            details={
                "card_title": card.title,
                "team_id": str(body.team_id) if body.team_id else None,
            },
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()
    await db.refresh(grant)
    go = TaskAccessGrantOut.model_validate(grant)
    if grant.team:
        go.team_name = grant.team.name
        go.team_slug = grant.team.slug
    return go


@router.delete("/{card_id}/share/{grant_id}", status_code=204)
async def revoke_share_grant(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    grant_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _card_or_404(db, card_id, project_id)
    project, membership = member_data

    if not task_auth_service.can_share_card(card, membership, current_user.id):
        raise HTTPException(
            status_code=403, detail="Only project managers can revoke card sharing"
        )

    grant_check = await db.execute(
        select(TaskAccessGrant).where(
            TaskAccessGrant.id == grant_id, TaskAccessGrant.card_id == card_id
        )
    )
    grant = grant_check.scalar_one_or_none()
    if grant is None:
        raise HTTPException(status_code=404, detail="Grant not found")

    await db.delete(grant)
    db.add(
        ActivityEvent(
            id=uuid.uuid4(),
            project_id=project_id,
            actor_id=current_user.id,
            event_type="card.share_revoked",
            resource_type="card",
            resource_id=card.id,
            details={"card_title": card.title, "grant_id": str(grant_id)},
            created_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()


@router.post("/{card_id}/labels/{label_id}", status_code=204)
async def add_label(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    label_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _card_or_404(db, card_id, project_id)
    project, membership = member_data
    if not task_auth_service.can_edit_card(card, membership, current_user.id):
        raise HTTPException(
            status_code=403, detail="You do not have permission to modify this card"
        )
    await card_service.add_label_to_card(db, card_id, label_id, project_id)
    await db.commit()


@router.delete("/{card_id}/labels/{label_id}", status_code=204)
async def remove_label(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    label_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _card_or_404(db, card_id, project_id)
    project, membership = member_data
    if not task_auth_service.can_edit_card(card, membership, current_user.id):
        raise HTTPException(
            status_code=403, detail="You do not have permission to modify this card"
        )
    await card_service.remove_label_from_card(db, card_id, label_id)
    await db.commit()
