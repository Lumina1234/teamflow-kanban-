from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class CardCreate(BaseModel):
    column_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=10000)
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None


class CardUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=10000)
    assignee_id: uuid.UUID | None = None
    due_date: date | None = None
    column_id: uuid.UUID | None = None
    version: int | None = None  # For optimistic locking


class CardMoveRequest(BaseModel):
    target_column_id: uuid.UUID
    before_card_id: uuid.UUID | None = None  # None = move to end


class LabelRef(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    color: str


class CardOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    column_id: uuid.UUID
    title: str
    description: str | None
    assignee_id: uuid.UUID | None
    due_date: date | None
    position: float
    version: int
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    labels: list[LabelRef] = []
