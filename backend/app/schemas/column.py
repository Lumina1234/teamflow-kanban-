from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ColumnCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    is_completed: bool = False


class ColumnUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    is_completed: bool | None = None


class ColumnReorderItem(BaseModel):
    id: uuid.UUID


class ColumnDeleteRequest(BaseModel):
    target_column_id: uuid.UUID


class ColumnOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    position: float
    is_completed: bool
    created_at: datetime
    updated_at: datetime
