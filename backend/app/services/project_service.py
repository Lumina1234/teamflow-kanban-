from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project, ProjectMember, ProjectRole
from app.models.column import Column
from app.models.activity import ActivityEvent


async def create_project(
    db: AsyncSession,
    name: str,
    description: str | None,
    created_by: uuid.UUID,
) -> Project:
    now = datetime.now(timezone.utc)
    project = Project(
        id=uuid.uuid4(),
        name=name,
        description=description,
        created_by=created_by,
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    await db.flush()

    # Creator is automatically owner
    membership = ProjectMember(
        id=uuid.uuid4(),
        project_id=project.id,
        user_id=created_by,
        role=ProjectRole.owner,
        joined_at=now,
    )
    db.add(membership)

    # Create 3 default columns
    default_columns = [
        Column(
            id=uuid.uuid4(),
            project_id=project.id,
            name="To Do",
            position=1024,
            is_completed=False,
            created_at=now,
            updated_at=now,
        ),
        Column(
            id=uuid.uuid4(),
            project_id=project.id,
            name="In Progress",
            position=2048,
            is_completed=False,
            created_at=now,
            updated_at=now,
        ),
        Column(
            id=uuid.uuid4(),
            project_id=project.id,
            name="Done",
            position=3072,
            is_completed=True,
            created_at=now,
            updated_at=now,
        ),
    ]
    for col in default_columns:
        db.add(col)

    # Activity event
    event = ActivityEvent(
        id=uuid.uuid4(),
        project_id=project.id,
        actor_id=created_by,
        event_type="project.created",
        resource_type="project",
        resource_id=project.id,
        details={"name": name},
        created_at=now,
    )
    db.add(event)

    await db.flush()
    return project


async def get_user_projects(db: AsyncSession, user_id: uuid.UUID) -> list[Project]:
    result = await db.execute(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(ProjectMember.user_id == user_id)
        .order_by(Project.created_at.desc())
    )
    return list(result.scalars().all())
