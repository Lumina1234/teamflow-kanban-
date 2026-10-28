from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_project_member
from app.models.card import Card
from app.models.comment import Comment
from app.models.activity import ActivityEvent
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate

router = APIRouter(
    prefix="/api/projects/{project_id}/cards/{card_id}/comments", tags=["comments"]
)


async def _get_card(db, card_id, project_id):
    result = await db.execute(
        select(Card).where(Card.id == card_id, Card.project_id == project_id)
    )
    card = result.scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.get("", response_model=list[CommentOut])
async def list_comments(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    db: AsyncSession = Depends(get_db),
):
    await _get_card(db, card_id, project_id)
    result = await db.execute(
        select(Comment)
        .where(Comment.card_id == card_id, Comment.project_id == project_id)
        .order_by(Comment.created_at)
    )
    return [CommentOut.model_validate(c) for c in result.scalars().all()]


@router.post("", response_model=CommentOut, status_code=201)
async def create_comment(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    body: CommentCreate,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    card = await _get_card(db, card_id, project_id)
    now = datetime.now(timezone.utc)
    comment = Comment(
        id=uuid.uuid4(),
        card_id=card_id,
        project_id=project_id,
        author_id=current_user.id,
        text=body.text.strip(),
        created_at=now,
        updated_at=now,
    )
    db.add(comment)
    # Activity event in same transaction
    db.add(ActivityEvent(
        id=uuid.uuid4(), project_id=project_id, actor_id=current_user.id,
        event_type="comment.created", resource_type="comment", resource_id=comment.id,
        details={"card_title": card.title, "card_id": str(card_id)}, created_at=now,
    ))
    await db.commit()
    await db.refresh(comment)
    return CommentOut.model_validate(comment)


@router.patch("/{comment_id}", response_model=CommentOut)
async def update_comment(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    comment_id: uuid.UUID,
    body: CommentUpdate,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id, Comment.project_id == project_id)
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit another user's comment")
    now = datetime.now(timezone.utc)
    comment.text = body.text.strip()
    comment.edited_at = now
    comment.updated_at = now
    await db.commit()
    await db.refresh(comment)
    return CommentOut.model_validate(comment)


@router.delete("/{comment_id}", status_code=204)
async def delete_comment(
    project_id: uuid.UUID,
    card_id: uuid.UUID,
    comment_id: uuid.UUID,
    member_data: tuple = Depends(get_project_member),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id, Comment.project_id == project_id)
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    # Owner or author can delete
    _, membership = member_data
    if comment.author_id != current_user.id and membership.role != "owner":
        raise HTTPException(status_code=403, detail="Cannot delete this comment")
    await db.delete(comment)
    await db.commit()
