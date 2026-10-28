from __future__ import annotations

import uuid
from datetime import datetime
from pydantic import BaseModel


class TeamOut(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    slug: str
    created_at: datetime
