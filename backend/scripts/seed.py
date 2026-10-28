"""
Idempotent demo seed script.
Run: python -m scripts.seed   (from the backend/ directory)

Creates:
- 8 Team-based demo accounts + legacy demo accounts
- 7 Project Teams (Frontend, Backend, Database, Security, DevOps, Design, HR)
- Private team cards, explicitly shared cards, and HR-only cards
- Task access grants, comments, and activity log entries
"""

import asyncio
import hashlib
import os
import secrets
import sys
import uuid
from datetime import datetime, timedelta, timezone

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models import (
    ActivityEvent,
    Card,
    Column,
    Comment,
    Invitation,
    InvitationRole,
    Label,
    Project,
    ProjectMember,
    ProjectRole,
    TaskAccessGrant,
    Team,
    User,
    card_labels,
)
from app.services.auth_service import hash_password

NOW = datetime.now(timezone.utc)

TEAM_DEFS = [
    {"name": "Frontend Engineering", "slug": "frontend"},
    {"name": "Backend Engineering", "slug": "backend"},
    {"name": "Database & Real-Time", "slug": "database"},
    {"name": "Security Engineering", "slug": "security"},
    {"name": "QA & DevOps", "slug": "devops"},
    {"name": "UI/UX Design", "slug": "design"},
    {"name": "People Operations & HR", "slug": "hr"},
]

USER_DEFS = [
    {
        "email": "manager@kanban.dev",
        "password": "Manager123!",
        "name": "Alex Manager",
        "role": ProjectRole.owner,
        "job_role": "manager",
        "team_slug": None,
    },
    {
        "email": "designer@kanban.dev",
        "password": "Designer123!",
        "name": "Sam Designer",
        "role": ProjectRole.member,
        "job_role": "designer",
        "team_slug": "design",
    },
    {
        "email": "frontend@kanban.dev",
        "password": "Frontend123!",
        "name": "Fiona Frontend",
        "role": ProjectRole.member,
        "job_role": "frontend",
        "team_slug": "frontend",
    },
    {
        "email": "backend@kanban.dev",
        "password": "Backend123!",
        "name": "Ben Backend",
        "role": ProjectRole.member,
        "job_role": "backend",
        "team_slug": "backend",
    },
    {
        "email": "db_engineer@kanban.dev",
        "password": "DbEngineer123!",
        "name": "Dana Database",
        "role": ProjectRole.member,
        "job_role": "database",
        "team_slug": "database",
    },
    {
        "email": "security@kanban.dev",
        "password": "Security123!",
        "name": "Sean Security",
        "role": ProjectRole.member,
        "job_role": "security",
        "team_slug": "security",
    },
    {
        "email": "devops@kanban.dev",
        "password": "Devops123!",
        "name": "Devon DevOps",
        "role": ProjectRole.member,
        "job_role": "devops",
        "team_slug": "devops",
    },
    {
        "email": "hr_manager@kanban.dev",
        "password": "HrManager123!",
        "name": "Hannah HR",
        "role": ProjectRole.member,
        "job_role": "hr",
        "team_slug": "hr",
    },
    # Legacy demo users
    {
        "email": "demo_owner@kanban.dev",
        "password": "DemoOwner123!",
        "name": "Demo Owner",
        "role": ProjectRole.owner,
        "job_role": "manager",
        "team_slug": None,
    },
    {
        "email": "demo_member@kanban.dev",
        "password": "DemoMember123!",
        "name": "Demo Member",
        "role": ProjectRole.member,
        "job_role": "frontend",
        "team_slug": "frontend",
    },
]

LABEL_DEFS = [
    {"name": "Feature", "color": "#3b82f6"},
    {"name": "Backend", "color": "#a855f7"},
    {"name": "UI/UX", "color": "#ec4899"},
    {"name": "Security", "color": "#f59e0b"},
    {"name": "HR", "color": "#10b981"},
    {"name": "DevOps", "color": "#06b6d4"},
    {"name": "Database", "color": "#8b5cf6"},
]


async def get_or_create_user(
    db: AsyncSession, email: str, password: str, name: str
) -> tuple[User, bool]:
    res = await db.execute(select(User).where(User.email == email))
    user = res.scalar_one_or_none()
    if user:
        return user, False
    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(password),
        name=name,
        is_active=True,
        created_at=NOW,
        updated_at=NOW,
    )
    db.add(user)
    await db.flush()
    print(f"  [+] Created user: {email}")
    return user, True


async def get_or_create_project(
    db: AsyncSession, name: str, description: str, owner: User
) -> tuple[Project, bool]:
    res = await db.execute(select(Project).where(Project.name == name))
    p = res.scalar_one_or_none()
    if p:
        p.description = description
        await db.flush()
        return p, False
    p = Project(
        id=uuid.uuid4(),
        name=name,
        description=description,
        created_by=owner.id,
        created_at=NOW,
        updated_at=NOW,
    )
    db.add(p)
    await db.flush()
    print(f"  [+] Created project: {name}")
    return p, True


async def get_or_create_team(
    db: AsyncSession, project: Project, name: str, slug: str
) -> tuple[Team, bool]:
    res = await db.execute(
        select(Team).where(Team.project_id == project.id, Team.slug == slug)
    )
    team = res.scalar_one_or_none()
    if team:
        return team, False
    team = Team(id=uuid.uuid4(), project_id=project.id, name=name, slug=slug, created_at=NOW)
    db.add(team)
    await db.flush()
    print(f"  [+] Created team: {name} ({slug})")
    return team, True


async def get_or_create_member(
    db: AsyncSession,
    project: Project,
    user: User,
    role: ProjectRole,
    job_role: str | None = None,
    team: Team | None = None,
) -> tuple[ProjectMember, bool]:
    res = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
        )
    )
    m = res.scalar_one_or_none()
    if m:
        m.role = role
        m.job_role = job_role
        m.team_id = team.id if team else None
        await db.flush()
        return m, False
    m = ProjectMember(
        id=uuid.uuid4(),
        project_id=project.id,
        user_id=user.id,
        role=role,
        job_role=job_role,
        team_id=team.id if team else None,
        joined_at=NOW,
    )
    db.add(m)
    await db.flush()
    print(f"  [+] Added member: {user.email} as {role.value} ({job_role})")
    return m, True


async def get_or_create_column(
    db: AsyncSession, project: Project, name: str, position: float
) -> tuple[Column, bool]:
    res = await db.execute(
        select(Column).where(Column.project_id == project.id, Column.name == name)
    )
    c = res.scalar_one_or_none()
    if c:
        return c, False
    c = Column(
        id=uuid.uuid4(),
        project_id=project.id,
        name=name,
        position=position,
        is_completed=(name == "Done"),
        created_at=NOW,
        updated_at=NOW,
    )
    db.add(c)
    await db.flush()
    print(f"  [+] Created column: {name}")
    return c, True


async def get_or_create_label(
    db: AsyncSession, project: Project, name: str, color: str
) -> tuple[Label, bool]:
    res = await db.execute(
        select(Label).where(Label.project_id == project.id, Label.name == name)
    )
    lbl = res.scalar_one_or_none()
    if lbl:
        return lbl, False
    lbl = Label(id=uuid.uuid4(), project_id=project.id, name=name, color=color)
    db.add(lbl)
    await db.flush()
    print(f"  [+] Created label: {name}")
    return lbl, True


async def attach_label(db: AsyncSession, card: Card, label: Label) -> None:
    res = await db.execute(
        select(card_labels).where(
            card_labels.c.card_id == card.id, card_labels.c.label_id == label.id
        )
    )
    if res.first():
        return
    await db.execute(insert(card_labels).values(card_id=card.id, label_id=label.id))
    await db.flush()


async def get_or_create_card(
    db: AsyncSession,
    column: Column,
    project: Project,
    created_by: User,
    title: str,
    description: str,
    position: float,
    assignee: User | None = None,
    due_date: datetime | None = None,
    owner_team: Team | None = None,
    visibility: str = "team_only",
) -> tuple[Card, bool]:
    res = await db.execute(
        select(Card).where(Card.column_id == column.id, Card.title == title)
    )
    c = res.scalar_one_or_none()
    if c:
        c.description = description
        c.assignee_id = assignee.id if assignee else None
        c.due_date = due_date
        c.owner_team_id = owner_team.id if owner_team else None
        c.visibility = visibility
        await db.flush()
        return c, False
    c = Card(
        id=uuid.uuid4(),
        column_id=column.id,
        project_id=project.id,
        title=title,
        description=description,
        position=position,
        assignee_id=assignee.id if assignee else None,
        owner_team_id=owner_team.id if owner_team else None,
        visibility=visibility,
        due_date=due_date,
        created_by=created_by.id,
        created_at=NOW,
        updated_at=NOW,
    )
    db.add(c)
    await db.flush()
    print(f"  [+] Created card: {title!r} (team: {owner_team.slug if owner_team else 'None'}, vis: {visibility})")
    return c, True


async def get_or_create_grant(
    db: AsyncSession,
    card: Card,
    team: Team | None,
    user: User | None,
    permission: str,
    granted_by: User,
) -> tuple[TaskAccessGrant, bool]:
    res = await db.execute(
        select(TaskAccessGrant).where(
            TaskAccessGrant.card_id == card.id,
            TaskAccessGrant.team_id == (team.id if team else None),
            TaskAccessGrant.user_id == (user.id if user else None),
        )
    )
    g = res.scalar_one_or_none()
    if g:
        return g, False
    g = TaskAccessGrant(
        id=uuid.uuid4(),
        card_id=card.id,
        team_id=team.id if team else None,
        user_id=user.id if user else None,
        permission=permission,
        granted_by=granted_by.id,
        created_at=NOW,
    )
    db.add(g)
    await db.flush()
    print(f"  [+] Granted access for '{card.title}' to {team.name if team else user.name}")
    return g, True


async def get_or_create_comment(
    db: AsyncSession, card: Card, project: Project, author: User, text: str
) -> tuple[Comment, bool]:
    res = await db.execute(
        select(Comment).where(
            Comment.card_id == card.id,
            Comment.author_id == author.id,
            Comment.text == text,
        )
    )
    c = res.scalar_one_or_none()
    if c:
        return c, False
    c = Comment(
        id=uuid.uuid4(),
        card_id=card.id,
        project_id=project.id,
        author_id=author.id,
        text=text,
        created_at=NOW,
        updated_at=NOW,
    )
    db.add(c)
    await db.flush()
    return c, True


async def log_activity(
    db: AsyncSession,
    project: Project,
    actor: User,
    event_type: str,
    resource_type: str,
    resource_id: uuid.UUID,
    details: dict,
) -> None:
    res = await db.execute(
        select(ActivityEvent).where(
            ActivityEvent.project_id == project.id,
            ActivityEvent.actor_id == actor.id,
            ActivityEvent.event_type == event_type,
            ActivityEvent.resource_type == resource_type,
            ActivityEvent.resource_id == resource_id,
        )
    )
    if res.first():
        return
    ev = ActivityEvent(
        id=uuid.uuid4(),
        project_id=project.id,
        actor_id=actor.id,
        event_type=event_type,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        created_at=NOW,
    )
    db.add(ev)
    await db.flush()


async def seed() -> None:
    print("\n========================================")
    print("  Seeding Kanban Database (8-Role Team-Based)...")
    print("========================================\n")

    async with AsyncSessionLocal() as db:
        async with db.begin():
            # 1. Seed Users
            users: dict[str, User] = {}
            for udef in USER_DEFS:
                user, _ = await get_or_create_user(
                    db, udef["email"], udef["password"], udef["name"]
                )
                users[udef["email"]] = user

            mgr = users["manager@kanban.dev"]

            # 2. Seed Project
            project, _ = await get_or_create_project(
                db,
                name="Team Kanban Project",
                description="Production Kanban board with team-based private tasks and role access",
                owner=mgr,
            )

            # 3. Seed Teams
            teams: dict[str, Team] = {}
            for tdef in TEAM_DEFS:
                team, _ = await get_or_create_team(db, project, tdef["name"], tdef["slug"])
                teams[tdef["slug"]] = team

            # 4. Seed Project Members with team & job_role
            for udef in USER_DEFS:
                user = users[udef["email"]]
                team = teams.get(udef["team_slug"]) if udef["team_slug"] else None
                await get_or_create_member(
                    db, project, user, udef["role"], udef["job_role"], team
                )

            # 5. Seed Columns
            todo_col, _ = await get_or_create_column(db, project, "To Do", 1000.0)
            inprog_col, _ = await get_or_create_column(db, project, "In Progress", 2000.0)
            done_col, _ = await get_or_create_column(db, project, "Done", 3000.0)

            # 6. Seed Labels
            labels: dict[str, Label] = {}
            for ldef in LABEL_DEFS:
                lbl, _ = await get_or_create_label(db, project, ldef["name"], ldef["color"])
                labels[ldef["name"]] = lbl

            # 7. Seed Cards
            # Frontend Tasks
            card_fe_oauth, _ = await get_or_create_card(
                db,
                todo_col,
                project,
                users["frontend@kanban.dev"],
                title="Implement OAuth2 login UI",
                description="Build responsive login modal with social providers.",
                position=1000.0,
                assignee=users["frontend@kanban.dev"],
                owner_team=teams["frontend"],
                visibility="team_only",
                due_date=datetime(2026, 11, 10, tzinfo=timezone.utc),
            )
            await attach_label(db, card_fe_oauth, labels["UI/UX"])

            card_fe_board, _ = await get_or_create_card(
                db,
                inprog_col,
                project,
                users["frontend@kanban.dev"],
                title="Build responsive Kanban drag-and-drop board",
                description="Implement drag-and-drop reordering with optimistic updates.",
                position=1000.0,
                assignee=users["frontend@kanban.dev"],
                owner_team=teams["frontend"],
                visibility="team_only",
                due_date=datetime(2026, 11, 15, tzinfo=timezone.utc),
            )
            await attach_label(db, card_fe_board, labels["Feature"])

            # Backend Tasks
            card_be_schema, _ = await get_or_create_card(
                db,
                done_col,
                project,
                users["backend@kanban.dev"],
                title="Design PostgreSQL schema & migrations",
                description="Normalized schema with Alembic async migrations.",
                position=1000.0,
                assignee=users["backend@kanban.dev"],
                owner_team=teams["backend"],
                visibility="team_only",
                due_date=datetime(2026, 10, 25, tzinfo=timezone.utc),
            )
            await attach_label(db, card_be_schema, labels["Backend"])

            card_be_auth, _ = await get_or_create_card(
                db,
                done_col,
                project,
                users["backend@kanban.dev"],
                title="Implement session token authentication & rate limiting",
                description="Secure cookie session auth and slowapi rate limiting.",
                position=2000.0,
                assignee=users["backend@kanban.dev"],
                owner_team=teams["backend"],
                visibility="team_only",
                due_date=datetime(2026, 10, 27, tzinfo=timezone.utc),
            )
            await attach_label(db, card_be_auth, labels["Security"])

            # Database & Real-Time Tasks
            card_db_redis, _ = await get_or_create_card(
                db,
                inprog_col,
                project,
                users["db_engineer@kanban.dev"],
                title="Configure Redis pub/sub cluster for live events",
                description="Set up Redis cluster and broadcast board updates.",
                position=2000.0,
                assignee=users["db_engineer@kanban.dev"],
                owner_team=teams["database"],
                visibility="team_only",
                due_date=datetime(2026, 11, 5, tzinfo=timezone.utc),
            )
            await attach_label(db, card_db_redis, labels["Database"])

            # Security Engineering Tasks
            card_sec_audit, _ = await get_or_create_card(
                db,
                todo_col,
                project,
                users["security@kanban.dev"],
                title="OWASP top 10 authorization audit & CSP headers",
                description="Audit all FastAPI routes for least-privilege default-deny.",
                position=2000.0,
                assignee=users["security@kanban.dev"],
                owner_team=teams["security"],
                visibility="team_only",
                due_date=datetime(2026, 11, 12, tzinfo=timezone.utc),
            )
            await attach_label(db, card_sec_audit, labels["Security"])

            # QA & DevOps Tasks
            card_ops_ci, _ = await get_or_create_card(
                db,
                todo_col,
                project,
                users["devops@kanban.dev"],
                title="CI/CD automated test pipeline with Docker",
                description="Automated GitHub Actions workflow running pytest and Vite build.",
                position=3000.0,
                assignee=users["devops@kanban.dev"],
                owner_team=teams["devops"],
                visibility="team_only",
                due_date=datetime(2026, 11, 20, tzinfo=timezone.utc),
            )
            await attach_label(db, card_ops_ci, labels["DevOps"])

            # UI/UX Design Tasks
            card_des_theme, _ = await get_or_create_card(
                db,
                inprog_col,
                project,
                users["designer@kanban.dev"],
                title="Design high-contrast dark theme token palette",
                description="Create Tailwind color tokens and design system specs.",
                position=3000.0,
                assignee=users["designer@kanban.dev"],
                owner_team=teams["design"],
                visibility="team_only",
                due_date=datetime(2026, 11, 8, tzinfo=timezone.utc),
            )
            await attach_label(db, card_des_theme, labels["UI/UX"])

            # Explicitly Shared Task (Backend task shared with Frontend)
            card_shared_ws, _ = await get_or_create_card(
                db,
                inprog_col,
                project,
                users["backend@kanban.dev"],
                title="WebSocket real-time board sync protocol",
                description="Define bidirectional payload specs for live column and card moves.",
                position=4000.0,
                assignee=users["backend@kanban.dev"],
                owner_team=teams["backend"],
                visibility="selected_teams",
                due_date=datetime(2026, 11, 7, tzinfo=timezone.utc),
            )
            await attach_label(db, card_shared_ws, labels["Feature"])
            # Grant access to Frontend team
            await get_or_create_grant(
                db, card_shared_ws, teams["frontend"], None, "view", mgr
            )

            # HR-only Tasks
            card_hr_onboard, _ = await get_or_create_card(
                db,
                todo_col,
                project,
                users["hr_manager@kanban.dev"],
                title="Q4 engineering team onboarding & benefits orientation",
                description="Process paperwork, workstation setup, and 1-on-1 introductions.",
                position=4000.0,
                assignee=users["hr_manager@kanban.dev"],
                owner_team=teams["hr"],
                visibility="hr_only",
                due_date=datetime(2026, 11, 1, tzinfo=timezone.utc),
            )
            await attach_label(db, card_hr_onboard, labels["HR"])

            card_hr_review, _ = await get_or_create_card(
                db,
                done_col,
                project,
                users["hr_manager@kanban.dev"],
                title="Conduct annual employee satisfaction review",
                description="Analyze survey responses and prepare leadership report.",
                position=3000.0,
                assignee=users["hr_manager@kanban.dev"],
                owner_team=teams["hr"],
                visibility="hr_only",
                due_date=datetime(2026, 10, 20, tzinfo=timezone.utc),
            )
            await attach_label(db, card_hr_review, labels["HR"])

            # 8. Seed Comments
            await get_or_create_comment(
                db,
                card_shared_ws,
                project,
                users["backend@kanban.dev"],
                "WebSocket protocol spec v1 shared with Frontend team. Please check the reconnection handshake.",
            )
            await get_or_create_comment(
                db,
                card_shared_ws,
                project,
                users["frontend@kanban.dev"],
                "Reviewed! Looks great, integrating with the useWebSocket hook on frontend today.",
            )
            await get_or_create_comment(
                db,
                card_hr_onboard,
                project,
                users["hr_manager@kanban.dev"],
                "Welcome packages mailed out. Meeting scheduled for Monday.",
            )

            # 9. Seed Activity Log
            await log_activity(
                db,
                project,
                mgr,
                "created",
                "project",
                project.id,
                {"name": project.name},
            )
            await log_activity(
                db,
                project,
                users["frontend@kanban.dev"],
                "created",
                "card",
                card_fe_board.id,
                {"title": card_fe_board.title},
            )
            await log_activity(
                db,
                project,
                mgr,
                "shared",
                "card",
                card_shared_ws.id,
                {"card_title": card_shared_ws.title, "team": "frontend"},
            )
            await log_activity(
                db,
                project,
                users["hr_manager@kanban.dev"],
                "created",
                "card",
                card_hr_onboard.id,
                {"title": card_hr_onboard.title},
            )

    print("\n========================================")
    print("  Seed complete!")
    print("  Demo Accounts:")
    print("  1. Manager    : manager@kanban.dev     / Manager123!    (Alex Manager - Lead)")
    print("  2. Designer   : designer@kanban.dev    / Designer123!   (Sam Designer - UI/UX)")
    print("  3. Frontend   : frontend@kanban.dev    / Frontend123!   (Fiona Frontend - FE)")
    print("  4. Backend    : backend@kanban.dev     / Backend123!    (Ben Backend - BE)")
    print("  5. Database   : db_engineer@kanban.dev / DbEngineer123! (Dana Database - DB/RT)")
    print("  6. Security   : security@kanban.dev    / Security123!   (Sean Security - Sec)")
    print("  7. QA/DevOps  : devops@kanban.dev      / Devops123!     (Devon DevOps - QA)")
    print("  8. HR Manager : hr_manager@kanban.dev  / HrManager123!  (Hannah HR - HR)")
    print("========================================\n")


if __name__ == "__main__":
    asyncio.run(seed())
