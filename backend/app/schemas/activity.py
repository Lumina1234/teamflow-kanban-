from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ActivityEventOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    actor_id: uuid.UUID
    event_type: str
    resource_type: str
    resource_id: uuid.UUID | None = None
    details: dict[str, Any] | None = None
    created_at: datetime


class ActivityPage(BaseModel):
    items: list[ActivityEventOut]
    total: int
    page: int
    per_page: int
    pages: int
