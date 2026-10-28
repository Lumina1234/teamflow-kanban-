"""
Idempotent demo seed script.
Run: python -m scripts.seed   (from the backend/ directory)

Creates demo accounts, a sample project, columns, labels, cards, comments,
and an invitation token if they don't already exist.
"""

import asyncio
import hashlib
import secrets
import sys
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Bootstrap path so the script can be run from the backend/ directory as
#   python -m scripts.seed
# ---------------------------------------------------------------------------
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_BACKEND = os.path.dirname(_HERE)
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
# Import all models so their metadata is registered with Base
from app.models import (  # noqa: F401
    User,
    Project,
    ProjectMember,
    ProjectRole,
    Invitation,
    InvitationRole,
    Column,
    Card,
    Label,
    card_labels,
    Comment,
    ActivityEvent,
)
from app.services.auth_service import hash_password

# ---------------------------------------------------------------------------
# Seed constants
# ---------------------------------------------------------------------------

OWNER_EMAIL = "demo_owner@kanban.dev"
OWNER_PASSWORD = "DemoOwner123!"
OWNER_NAME = "Demo Owner"

MEMBER_EMAIL = "demo_member@kanban.dev"
MEMBER_PASSWORD = "DemoMember123!"
MEMBER_NAME = "Demo Member"

PROJECT_NAME = "Demo Kanban Project"
PROJECT_DESC = (
    "A fully-featured demo project showcasing all Kanban board capabilities "
    "including cards, labels, assignments, comments, and activity logging."
)

LABEL_DEFS = [
    {"name": "Bug",     "color": "#ef4444"},  # red-500
    {"name": "Feature", "color": "#3b82f6"},  # blue-500
    {"name": "Urgent",  "color": "#f97316"},  # orange-500
    {"name": "Design",  "color": "#a855f7"},  # purple-500
]

NOW = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def get_or_create_user(
    db: AsyncSession,
    email: str,
    password: str,
    name: str,
) -> tuple[User, bool]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        return user, False

    user = User(
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
    db: AsyncSession,
    name: str,
    description: str,
    owner: User,
) -> tuple[Project, bool]:
    result = await db.execute(select(Project).where(Project.name == name))
    project = result.scalar_one_or_none()
    if project:
        return project, False

    project = Project(
        name=name,
        description=description,
        created_by=owner.id,
        created_at=NOW,
        updated_at=NOW,
    )
    db.add(project)
    await db.flush()
    print(f"  [+] Created project: {name}")
    return project, True


async def get_or_create_member(
    db: AsyncSession,
    project: Project,
    user: User,
    role: ProjectRole,
) -> tuple[ProjectMember, bool]:
    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
        )
    )
    member = result.scalar_one_or_none()
    if member:
        return member, False

    member = ProjectMember(
        project_id=project.id,
        user_id=user.id,
        role=role,
        joined_at=NOW,
    )
    db.add(member)
    await db.flush()
    print(f"  [+] Added member: {user.email} as {role.value}")
    return member, True


async def get_or_create_column(
    db: AsyncSession,
    project: Project,
    name: str,
    position: float,
) -> tuple[Column, bool]:
    result = await db.execute(
        select(Column).where(
            Column.project_id == project.id,
            Column.name == name,
        )
    )
    col = result.scalar_one_or_none()
    if col:
        return col, False

    col = Column(
        project_id=project.id,
        name=name,
        position=position,
        is_completed=(name == "Done"),
        created_at=NOW,
        updated_at=NOW,
    )
    db.add(col)
    await db.flush()
    print(f"  [+] Created column: {name}")
    return col, True


async def get_or_create_label(
    db: AsyncSession,
    project: Project,
    name: str,
    color: str,
) -> tuple[Label, bool]:
    result = await db.execute(
        select(Label).where(
            Label.project_id == project.id,
            Label.name == name,
        )
    )
    label = result.scalar_one_or_none()
    if label:
        return label, False

    label = Label(
        project_id=project.id,
        name=name,
        color=color,
    )
    db.add(label)
    await db.flush()
    print(f"  [+] Created label: {name} ({color})")
    return label, True


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
) -> tuple[Card, bool]:
    result = await db.execute(
        select(Card).where(
            Card.column_id == column.id,
            Card.title == title,
        )
    )
    card = result.scalar_one_or_none()
    if card:
        return card, False

    card = Card(
        column_id=column.id,
        project_id=project.id,
        title=title,
        description=description,
        position=position,
        assignee_id=assignee.id if assignee else None,
        due_date=due_date,
        created_by=created_by.id,
        created_at=NOW,
        updated_at=NOW,
    )
    db.add(card)
    await db.flush()
    print(f"  [+] Created card: {title!r} in column {column.name!r}")
    return card, True


async def attach_label(
    db: AsyncSession,
    card: Card,
    label: Label,
) -> None:
    # card_labels is a plain Table — check existence then insert
    result = await db.execute(
        select(card_labels).where(
            card_labels.c.card_id == card.id,
            card_labels.c.label_id == label.id,
        )
    )
    if result.first():
        return
    await db.execute(
        insert(card_labels).values(card_id=card.id, label_id=label.id)
    )
    await db.flush()


async def get_or_create_comment(
    db: AsyncSession,
    card: Card,
    project: Project,
    author: User,
    text: str,
) -> tuple[Comment, bool]:
    result = await db.execute(
        select(Comment).where(
            Comment.card_id == card.id,
            Comment.author_id == author.id,
            Comment.text == text,
        )
    )
    comment = result.scalar_one_or_none()
    if comment:
        return comment, False

    comment = Comment(
        card_id=card.id,
        project_id=project.id,
        author_id=author.id,
        text=text,
        created_at=NOW,
        updated_at=NOW,
    )
    db.add(comment)
    await db.flush()
    print(f"  [+] Created comment by {author.email} on card {card.title!r}")
    return comment, True


async def log_activity(
    db: AsyncSession,
    project: Project,
    actor: User,
    event_type: str,
    resource_type: str,
    resource_id,
    details: dict,
) -> None:
    entry = ActivityEvent(
        project_id=project.id,
        actor_id=actor.id,
        event_type=event_type,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        created_at=NOW,
    )
    db.add(entry)
    await db.flush()


async def get_or_create_invite(
    db: AsyncSession,
    project: Project,
    email: str,
    role: InvitationRole,
    invited_by: User,
) -> tuple[Invitation, bool, str | None]:
    """Returns (invite, created, raw_token). raw_token is None if invite already existed."""
    result = await db.execute(
        select(Invitation).where(
            Invitation.project_id == project.id,
            Invitation.invited_email == email,
            Invitation.accepted_at.is_(None),
            Invitation.revoked_at.is_(None),
        )
    )
    invite = result.scalar_one_or_none()
    if invite:
        return invite, False, None

    raw_token = secrets.token_urlsafe(32)
    invite = Invitation(
        project_id=project.id,
        invited_email=email,
        token_hash=_hash_token(raw_token),
        role=role,
        expires_at=NOW + timedelta(days=7),
        invited_by=invited_by.id,
        created_at=NOW,
    )
    db.add(invite)
    await db.flush()
    print(f"  [+] Created invite for {email} (role={role.value})")
    return invite, True, raw_token


# ---------------------------------------------------------------------------
# Main seed routine
# ---------------------------------------------------------------------------

async def seed() -> None:
    print("\n========================================")
    print("  Kanban Board — Demo Seed")
    print("========================================\n")

    raw_invite_token: str | None = None

    async with AsyncSessionLocal() as db:
        async with db.begin():

            # ------------------------------------------------------------------
            # Users
            # ------------------------------------------------------------------
            print("── Users ─────────────────────────────")
            owner, _ = await get_or_create_user(db, OWNER_EMAIL, OWNER_PASSWORD, OWNER_NAME)
            member, _ = await get_or_create_user(db, MEMBER_EMAIL, MEMBER_PASSWORD, MEMBER_NAME)

            # ------------------------------------------------------------------
            # Project
            # ------------------------------------------------------------------
            print("\n── Project ───────────────────────────")
            project, _ = await get_or_create_project(db, PROJECT_NAME, PROJECT_DESC, owner)

            # ------------------------------------------------------------------
            # Members
            # ------------------------------------------------------------------
            print("\n── Members ───────────────────────────")
            await get_or_create_member(db, project, owner, ProjectRole.owner)
            await get_or_create_member(db, project, member, ProjectRole.member)

            # ------------------------------------------------------------------
            # Columns
            # ------------------------------------------------------------------
            print("\n── Columns ───────────────────────────")
            todo_col, _ = await get_or_create_column(db, project, "To Do", 1000.0)
            inprog_col, _ = await get_or_create_column(db, project, "In Progress", 2000.0)
            done_col, _ = await get_or_create_column(db, project, "Done", 3000.0)

            # ------------------------------------------------------------------
            # Labels
            # ------------------------------------------------------------------
            print("\n── Labels ────────────────────────────")
            label_map: dict[str, Label] = {}
            for ldata in LABEL_DEFS:
                lbl, _ = await get_or_create_label(db, project, ldata["name"], ldata["color"])
                label_map[ldata["name"]] = lbl

            bug = label_map["Bug"]
            feature = label_map["Feature"]
            urgent = label_map["Urgent"]
            design = label_map["Design"]

            # ------------------------------------------------------------------
            # Cards — To Do
            # ------------------------------------------------------------------
            print("\n── Cards (To Do) ─────────────────────")

            card_auth, _ = await get_or_create_card(
                db, todo_col, project, owner,
                title="Implement OAuth2 login",
                description=(
                    "Add Google and GitHub OAuth2 providers using authlib. "
                    "Store OAuth identity alongside existing email/password accounts."
                ),
                position=1000.0,
                assignee=member,
                due_date=NOW + timedelta(days=14),
            )
            await attach_label(db, card_auth, feature)

            card_notif, _ = await get_or_create_card(
                db, todo_col, project, owner,
                title="Build in-app notification centre",
                description=(
                    "Design a bell-icon notification centre that shows card assignments, "
                    "mentions, and due-date reminders. Persist to DB and mark as read."
                ),
                position=2000.0,
                assignee=owner,
                due_date=NOW + timedelta(days=21),
            )
            await attach_label(db, card_notif, feature)
            await attach_label(db, card_notif, design)

            card_mobile, _ = await get_or_create_card(
                db, todo_col, project, owner,
                title="Optimize touch drag-and-drop for mobile",
                description=(
                    "Current DnD library performs poorly on iOS Safari. "
                    "Evaluate @dnd-kit/sortable and test on real devices."
                ),
                position=3000.0,
                assignee=None,
                due_date=NOW + timedelta(days=30),
            )
            await attach_label(db, card_mobile, design)

            card_export, _ = await get_or_create_card(
                db, todo_col, project, owner,
                title="Activity log CSV/JSON export",
                description=(
                    "Add a download endpoint `GET /projects/{id}/activity/export` "
                    "that streams the full activity log as CSV or JSON."
                ),
                position=4000.0,
                assignee=member,
                due_date=NOW + timedelta(days=10),
            )
            await attach_label(db, card_export, feature)

            # ------------------------------------------------------------------
            # Cards — In Progress
            # ------------------------------------------------------------------
            print("\n── Cards (In Progress) ───────────────")

            card_ws, _ = await get_or_create_card(
                db, inprog_col, project, owner,
                title="WebSocket real-time board sync",
                description=(
                    "Replace polling with WebSocket connections so all open board tabs "
                    "update instantly when cards are moved or created."
                ),
                position=1000.0,
                assignee=owner,
                due_date=NOW + timedelta(days=5),
            )
            await attach_label(db, card_ws, feature)
            await attach_label(db, card_ws, urgent)

            card_attach, _ = await get_or_create_card(
                db, inprog_col, project, owner,
                title="File attachments on cards",
                description=(
                    "Allow users to upload images and documents to cards. "
                    "Store in S3-compatible bucket; show thumbnail previews."
                ),
                position=2000.0,
                assignee=member,
                due_date=NOW + timedelta(days=7),
            )
            await attach_label(db, card_attach, feature)

            card_ratelimit_bug, _ = await get_or_create_card(
                db, inprog_col, project, owner,
                title="Fix rate limiter bypass via X-Forwarded-For spoofing",
                description=(
                    "When behind a misconfigured proxy, clients can spoof their IP "
                    "via X-Forwarded-For. Add trusted proxy configuration to slowapi."
                ),
                position=3000.0,
                assignee=owner,
                due_date=NOW + timedelta(days=2),
            )
            await attach_label(db, card_ratelimit_bug, bug)
            await attach_label(db, card_ratelimit_bug, urgent)

            # ------------------------------------------------------------------
            # Cards — Done
            # ------------------------------------------------------------------
            print("\n── Cards (Done) ──────────────────────")

            card_auth_session, _ = await get_or_create_card(
                db, done_col, project, owner,
                title="Server-side session management with Redis",
                description=(
                    "Implemented Redis-backed session store using itsdangerous. "
                    "Sessions expire after configurable TTL; logout clears store entry."
                ),
                position=1000.0,
                assignee=owner,
                due_date=NOW - timedelta(days=5),
            )
            await attach_label(db, card_auth_session, feature)

            card_rbac, _ = await get_or_create_card(
                db, done_col, project, owner,
                title="Role-based access control (owner / member)",
                description=(
                    "Owner can manage members and project settings; "
                    "members can interact with cards and comments only."
                ),
                position=2000.0,
                assignee=member,
                due_date=NOW - timedelta(days=10),
            )
            await attach_label(db, card_rbac, feature)

            card_labels_feat, _ = await get_or_create_card(
                db, done_col, project, owner,
                title="Color-coded labels with multi-attach support",
                description=(
                    "Labels can be created per-project with a hex color. "
                    "Multiple labels may be attached to a single card."
                ),
                position=3000.0,
                assignee=member,
                due_date=NOW - timedelta(days=3),
            )
            await attach_label(db, card_labels_feat, feature)
            await attach_label(db, card_labels_feat, design)

            # ------------------------------------------------------------------
            # Comments
            # ------------------------------------------------------------------
            print("\n── Comments ──────────────────────────")

            await get_or_create_comment(
                db, card_ws, project, owner,
                "Starting implementation with FastAPI WebSocket endpoint. "
                "Will use a per-project room model so clients only subscribe to "
                "updates relevant to the board they're viewing.",
            )
            await get_or_create_comment(
                db, card_ws, project, member,
                "Tested the prototype on a slow 3G connection — latency is fine. "
                "The main challenge is reconnection logic on mobile network switches.",
            )
            await get_or_create_comment(
                db, card_ratelimit_bug, project, owner,
                "Root cause confirmed: slowapi reads `request.client.host` directly. "
                "Need to set `app.state.trusted_proxies` and override the key function.",
            )
            await get_or_create_comment(
                db, card_auth, project, member,
                "Checked authlib docs — the OAuth2 flow for FastAPI is well-documented. "
                "I'll spike this in a branch and share a PR for review by end of week.",
            )
            await get_or_create_comment(
                db, card_auth_session, project, owner,
                "Deployed and verified in staging. Sessions survive pod restarts since "
                "state lives in Redis, not in-process memory.",
            )

            # ------------------------------------------------------------------
            # Activity log entries
            # ------------------------------------------------------------------
            print("\n── Activity ──────────────────────────")

            await log_activity(
                db, project, owner,
                event_type="created",
                resource_type="project",
                resource_id=project.id,
                details={"name": PROJECT_NAME},
            )
            await log_activity(
                db, project, owner,
                event_type="member_added",
                resource_type="member",
                resource_id=member.id,
                details={"email": MEMBER_EMAIL, "role": "member"},
            )
            await log_activity(
                db, project, owner,
                event_type="moved",
                resource_type="card",
                resource_id=card_ws.id,
                details={"from_column": "To Do", "to_column": "In Progress"},
            )
            await log_activity(
                db, project, member,
                event_type="moved",
                resource_type="card",
                resource_id=card_rbac.id,
                details={"from_column": "In Progress", "to_column": "Done"},
            )
            print("  [+] Seeded activity log entries")

            # ------------------------------------------------------------------
            # Invitation token (for a hypothetical third user)
            # ------------------------------------------------------------------
            print("\n── Invitation ────────────────────────")
            invite, created, raw_invite_token = await get_or_create_invite(
                db, project,
                email="new_colleague@example.com",
                role=InvitationRole.member,
                invited_by=owner,
            )

    # Committed — now safe to print token
    if raw_invite_token:
        print(f"\n  Invite token for new_colleague@example.com:")
        print(f"    Raw token : {raw_invite_token}")
        print(f"    URL       : http://localhost:8000/invitations/{raw_invite_token}/accept")
        print(f"    Expires   : {invite.expires_at.isoformat()}")
    else:
        print("\n  [skip] Invitation already exists for new_colleague@example.com")

    print("\n========================================")
    print("  Seed complete!")
    print("  Login at http://localhost:5173")
    print(f"    Owner  : {OWNER_EMAIL} / {OWNER_PASSWORD}")
    print(f"    Member : {MEMBER_EMAIL} / {MEMBER_PASSWORD}")
    print("========================================\n")


if __name__ == "__main__":
    asyncio.run(seed())
