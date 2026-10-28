from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, List

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.label import Label
    from app.models.team import Team
    from app.models.task_access_grant import TaskAccessGrant


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    column_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("board_columns.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(10000), nullable=True)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    owner_team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    visibility: Mapped[str] = mapped_column(
        String(30), default="team_only", nullable=False
    )  # 'team_only', 'selected_teams', 'hr_only'
    due_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    position: Mapped[float] = mapped_column(Numeric(30, 12), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Many-to-many relationship to labels
    labels: Mapped[List["Label"]] = relationship(
        "Label",
        secondary="card_labels",
        lazy="selectin",
    )

    # Team ownership & access grants
    owner_team: Mapped["Team | None"] = relationship(
        "Team", back_populates="cards", foreign_keys=[owner_team_id], lazy="selectin"
    )
    access_grants: Mapped[List["TaskAccessGrant"]] = relationship(
        "TaskAccessGrant", back_populates="card", cascade="all, delete-orphan", lazy="selectin"
    )

    __table_args__ = (
        Index("ix_cards_column_position", "column_id", "position"),
    )
