from __future__ import annotations

import uuid
from datetime import datetime, date, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select, func, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card
from app.models.label import Label, card_labels
from app.models.activity import ActivityEvent

_MIN_GAP = Decimal("0.0001")
_STEP = Decimal("1024")


async def _get_card_labels(db: AsyncSession, card_id: uuid.UUID) -> list[Label]:
    result = await db.execute(
        select(Label)
        .join(card_labels, card_labels.c.label_id == Label.id)
        .where(card_labels.c.card_id == card_id)
    )
    return list(result.scalars().all())


async def create_card(
    db: AsyncSession,
    project_id: uuid.UUID,
    column_id: uuid.UUID,
    title: str,
    description: str | None,
    created_by: uuid.UUID,
    assignee_id: uuid.UUID | None = None,
    due_date: date | None = None,
) -> Card:
    max_result = await db.execute(
        select(func.max(Card.position)).where(Card.column_id == column_id)
    )
    max_pos = max_result.scalar()
    new_pos = Decimal(str(max_pos)) + _STEP if max_pos is not None else _STEP

    now = datetime.now(timezone.utc)
    card = Card(
        id=uuid.uuid4(),
        project_id=project_id,
        column_id=column_id,
        title=title,
        description=description,
        assignee_id=assignee_id,
        due_date=due_date,
        position=new_pos,
        version=1,
        created_by=created_by,
        created_at=now,
        updated_at=now,
    )
    db.add(card)
    await db.flush()

    event = ActivityEvent(
        id=uuid.uuid4(),
        project_id=project_id,
        actor_id=created_by,
        event_type="card.created",
        resource_type="card",
        resource_id=card.id,
        details={"title": title, "column_id": str(column_id)},
        created_at=now,
    )
    db.add(event)
    await db.flush()
    return card


async def rebalance_column(db: AsyncSession, column_id: uuid.UUID) -> None:
    """Reassign positions as multiples of 1024 to all cards in column, preserving order."""
    result = await db.execute(
        select(Card).where(Card.column_id == column_id).order_by(Card.position)
    )
    cards = list(result.scalars().all())
    for i, card in enumerate(cards):
        card.position = Decimal(str((i + 1) * 1024))
    await db.flush()


async def move_card(
    db: AsyncSession,
    card_id: uuid.UUID,
    target_column_id: uuid.UUID,
    before_card_id: uuid.UUID | None,
    current_user_id: uuid.UUID,
    project_id: uuid.UUID,
) -> Card:
    """
    Server-side fractional position calculation.
    1. Lock target column (and source if different) in consistent UUID order
    2. Load cards in target column sorted by position (exclude moving card if same column)
    3. Find insertion point using before_card_id (None = end)
    4. Calculate midpoint between neighbors
    5. If gap < _MIN_GAP, trigger rebalance_column() then recalculate
    6. Update card.column_id and card.position and card.version
    7. Create activity event in same transaction
    """
    # Load the card being moved
    card_result = await db.execute(
        select(Card).where(Card.id == card_id, Card.project_id == project_id)
    )
    card = card_result.scalar_one_or_none()
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    source_column_id = card.column_id

    # Lock columns in consistent UUID order to avoid deadlocks
    cols_to_lock = sorted({source_column_id, target_column_id})
    for cid in cols_to_lock:
        await db.execute(
            text("SELECT id FROM board_columns WHERE id = :cid FOR UPDATE")
            .bindparams(cid=cid)
        )

    # Load cards in target column (exclude moving card if same column)
    cards_q = select(Card).where(Card.column_id == target_column_id).order_by(Card.position)
    cards_result = await db.execute(cards_q)
    target_cards = [c for c in cards_result.scalars().all() if c.id != card_id]

    # Find insertion index
    if before_card_id is not None:
        before_idx = next(
            (i for i, c in enumerate(target_cards) if c.id == before_card_id), None
        )
        if before_idx is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="before_card_id not found in target column",
            )
    else:
        before_idx = None  # means end

    # Calculate new position
    def _calc_position(cards: list[Card], idx: int | None) -> Decimal:
        if not cards:
            return _STEP
        if idx is None:
            # End: after last card
            return Decimal(str(cards[-1].position)) + _STEP
        if idx == 0:
            # Before first card
            prev_pos = Decimal("0")
        else:
            prev_pos = Decimal(str(cards[idx - 1].position))
        next_pos = Decimal(str(cards[idx].position))
        return (prev_pos + next_pos) / 2

    new_pos = _calc_position(target_cards, before_idx)

    # Check gap
    needs_rebalance = False
    if before_idx is not None:
        if before_idx == 0:
            prev_pos = Decimal("0")
        else:
            prev_pos = Decimal(str(target_cards[before_idx - 1].position))
        next_pos = Decimal(str(target_cards[before_idx].position))
        gap = next_pos - prev_pos
        if gap < _MIN_GAP:
            needs_rebalance = True
    
    if needs_rebalance:
        await rebalance_column(db, target_column_id)
        # Reload cards after rebalance
        cards_result2 = await db.execute(
            select(Card).where(Card.column_id == target_column_id).order_by(Card.position)
        )
        target_cards = [c for c in cards_result2.scalars().all() if c.id != card_id]
        new_pos = _calc_position(target_cards, before_idx)

    now = datetime.now(timezone.utc)
    old_column_id = card.column_id
    card.column_id = target_column_id
    card.position = new_pos
    card.version = (card.version or 1) + 1
    card.updated_at = now

    event = ActivityEvent(
        id=uuid.uuid4(),
        project_id=project_id,
        actor_id=current_user_id,
        event_type="card.moved",
        resource_type="card",
        resource_id=card.id,
        details={
            "from_column": str(old_column_id),
            "to_column": str(target_column_id),
            "before_card_id": str(before_card_id) if before_card_id else None,
        },
        created_at=now,
    )
    db.add(event)
    await db.flush()
    return card


async def get_cards_for_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    assignee_id: uuid.UUID | None = None,
    label_id: uuid.UUID | None = None,
    overdue: bool | None = None,
) -> list[Card]:
    q = select(Card).where(Card.project_id == project_id)
    if assignee_id is not None:
        q = q.where(Card.assignee_id == assignee_id)
    if overdue is True:
        from app.models.column import Column
        today = datetime.now(timezone.utc).date()
        q = (
            q.join(Column, Column.id == Card.column_id)
            .where(
                Card.due_date < today,
                Card.due_date.isnot(None),
                Column.is_completed.is_(False),  # Exclude completed columns
            )
        )
    if label_id is not None:
        q = q.join(card_labels, card_labels.c.card_id == Card.id).where(
            card_labels.c.label_id == label_id
        )
    q = q.order_by(Card.column_id, Card.position)
    result = await db.execute(q)
    return list(result.scalars().all())


async def add_label_to_card(
    db: AsyncSession,
    card_id: uuid.UUID,
    label_id: uuid.UUID,
    project_id: uuid.UUID,
) -> None:
    # Verify label belongs to project
    label_result = await db.execute(
        select(Label).where(Label.id == label_id, Label.project_id == project_id)
    )
    label = label_result.scalar_one_or_none()
    if label is None:
        raise HTTPException(status_code=404, detail="Label not found in this project")
    await db.execute(
        pg_insert(card_labels).values(card_id=card_id, label_id=label_id).on_conflict_do_nothing()
    )
    await db.flush()


async def remove_label_from_card(
    db: AsyncSession,
    card_id: uuid.UUID,
    label_id: uuid.UUID,
) -> None:
    await db.execute(
        card_labels.delete().where(
            card_labels.c.card_id == card_id,
            card_labels.c.label_id == label_id,
        )
    )
    await db.flush()
