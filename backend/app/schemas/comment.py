from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class CommentUpdate(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class CommentOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    card_id: uuid.UUID
    project_id: uuid.UUID
    author_id: uuid.UUID
    text: str
    created_at: datetime
    updated_at: datetime
    edited_at: datetime | None = None
