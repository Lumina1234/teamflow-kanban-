from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.comment import Comment
from app.models.card import Card
from app.models.activity import ActivityEvent


async def get_comments(
    db: AsyncSession, card_id: uuid.UUID, project_id: uuid.UUID
) -> list[Comment]:
    result = await db.execute(
        select(Comment)
        .where(Comment.card_id == card_id, Comment.project_id == project_id)
        .order_by(Comment.created_at)
    )
    return list(result.scalars().all())


async def create_comment(
    db: AsyncSession,
    card_id: uuid.UUID,
    project_id: uuid.UUID,
    author_id: uuid.UUID,
    text: str,
) -> Comment:
    # Verify card exists
    card_result = await db.execute(
        select(Card).where(Card.id == card_id, Card.project_id == project_id)
    )
    if card_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Card not found")

    now = datetime.now(timezone.utc)
    comment = Comment(
        id=uuid.uuid4(),
        card_id=card_id,
        project_id=project_id,
        author_id=author_id,
        text=text,
        created_at=now,
        updated_at=now,
    )
    db.add(comment)
    await db.flush()

    event = ActivityEvent(
        id=uuid.uuid4(),
        project_id=project_id,
        actor_id=author_id,
        event_type="comment.created",
        resource_type="comment",
        resource_id=comment.id,
        details={"card_id": str(card_id), "text_preview": text[:100]},
        created_at=now,
    )
    db.add(event)
    await db.flush()
    return comment


async def update_comment(
    db: AsyncSession,
    comment_id: uuid.UUID,
    card_id: uuid.UUID,
    project_id: uuid.UUID,
    author_id: uuid.UUID,
    text: str,
) -> Comment:
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.card_id == card_id,
            Comment.project_id == project_id,
        )
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != author_id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")
    now = datetime.now(timezone.utc)
    comment.text = text
    comment.edited_at = now
    comment.updated_at = now
    await db.flush()
    return comment


async def delete_comment(
    db: AsyncSession,
    comment_id: uuid.UUID,
    card_id: uuid.UUID,
    project_id: uuid.UUID,
    author_id: uuid.UUID,
    is_owner: bool = False,
) -> None:
    result = await db.execute(
        select(Comment).where(
            Comment.id == comment_id,
            Comment.card_id == card_id,
            Comment.project_id == project_id,
        )
    )
    comment = result.scalar_one_or_none()
    if comment is None:
        raise HTTPException(status_code=404, detail="Comment not found")
    if not is_owner and comment.author_id != author_id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    await db.delete(comment)
    await db.flush()
