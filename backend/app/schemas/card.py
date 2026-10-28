from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class TaskAccessGrantCreate(BaseModel):
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    permission: str = "view"  # "view" | "edit"


class TaskAccessGrantOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    card_id: uuid.UUID
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    permission: str
    granted_by: uuid.UUID
    created_at: datetime
    team_name: str | None = None
    team_slug: str | None = None


class CardCreate(BaseModel):
    column_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(None, max_length=10000)
    assignee_id: uuid.UUID | None = None
    owner_team_id: uuid.UUID | None = None
    visibility: str = "team_only"  # "team_only", "selected_teams", "hr_only"
    due_date: date | None = None


class CardUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = Field(None, max_length=10000)
    assignee_id: uuid.UUID | None = None
    owner_team_id: uuid.UUID | None = None
    visibility: str | None = None
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
    owner_team_id: uuid.UUID | None = None
    visibility: str = "team_only"
    team_slug: str | None = None
    team_name: str | None = None
    shared_teams: list[str] = []
    due_date: date | None
    position: float
    version: int
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    labels: list[LabelRef] = []
    access_grants: list[TaskAccessGrantOut] = []
