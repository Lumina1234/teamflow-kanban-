"""
Comprehensive integration tests for Team-Based Kanban with Private Tasks.
Enforces OWASP least privilege and default-deny policies across 14 scenarios.
"""
from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.project import Project, ProjectMember, ProjectRole
from app.models.team import Team
from app.models.card import Card
from app.models.column import Column
from app.models.user import User
from app.services.auth_service import hash_password


async def create_user_helper(db, email: str, name: str) -> User:
    u = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password("Password123!"),
        name=name,
        is_active=True,
    )
    db.add(u)
    await db.flush()
    return u


async def setup_team_board():
    """
    Sets up a complete test environment:
    - 1 Project
    - 3 Columns (To Do, In Progress, Done)
    - 4 Teams (frontend, backend, design, hr)
    - 5 Users (manager, designer, frontend_eng, backend_eng, hr_user)
    - Private cards for Frontend, Backend, Design, HR
    """
    async with AsyncSessionLocal() as db:
        # Create Users
        mgr_user = await create_user_helper(db, f"mgr_{uuid.uuid4().hex[:6]}@kanban.dev", "Test Manager")
        des_user = await create_user_helper(db, f"des_{uuid.uuid4().hex[:6]}@kanban.dev", "Test Designer")
        fe_user = await create_user_helper(db, f"fe_{uuid.uuid4().hex[:6]}@kanban.dev", "Test Frontend")
        be_user = await create_user_helper(db, f"be_{uuid.uuid4().hex[:6]}@kanban.dev", "Test Backend")
        hr_user = await create_user_helper(db, f"hr_{uuid.uuid4().hex[:6]}@kanban.dev", "Test HR")

        # Create Project
        project = Project(
            id=uuid.uuid4(),
            name=f"Project_{uuid.uuid4().hex[:6]}",
            description="Team Authorization Project",
            created_by=mgr_user.id,
        )
        db.add(project)
        await db.flush()

        # Create Teams
        t_fe = Team(id=uuid.uuid4(), project_id=project.id, name="Frontend", slug="frontend")
        t_be = Team(id=uuid.uuid4(), project_id=project.id, name="Backend", slug="backend")
        t_des = Team(id=uuid.uuid4(), project_id=project.id, name="Design", slug="design")
        t_hr = Team(id=uuid.uuid4(), project_id=project.id, name="HR", slug="hr")
        db.add_all([t_fe, t_be, t_des, t_hr])
        await db.flush()

        # Add Memberships
        m_mgr = ProjectMember(id=uuid.uuid4(), project_id=project.id, user_id=mgr_user.id, role=ProjectRole.owner, job_role="manager")
        m_des = ProjectMember(id=uuid.uuid4(), project_id=project.id, user_id=des_user.id, role=ProjectRole.member, job_role="designer", team_id=t_des.id)
        m_fe = ProjectMember(id=uuid.uuid4(), project_id=project.id, user_id=fe_user.id, role=ProjectRole.member, job_role="frontend", team_id=t_fe.id)
        m_be = ProjectMember(id=uuid.uuid4(), project_id=project.id, user_id=be_user.id, role=ProjectRole.member, job_role="backend", team_id=t_be.id)
        m_hr = ProjectMember(id=uuid.uuid4(), project_id=project.id, user_id=hr_user.id, role=ProjectRole.member, job_role="hr", team_id=t_hr.id)
        db.add_all([m_mgr, m_des, m_fe, m_be, m_hr])
        await db.flush()

        # Create Column
        col = Column(id=uuid.uuid4(), project_id=project.id, name="To Do", position=1000.0)
        db.add(col)
        await db.flush()

        # Create Cards
        card_fe = Card(
            id=uuid.uuid4(),
            project_id=project.id,
            column_id=col.id,
            title="Frontend Secret UI Flow",
            description="Frontend confidential task",
            owner_team_id=t_fe.id,
            visibility="team_only",
            position=1000.0,
            created_by=fe_user.id,
        )
        card_be = Card(
            id=uuid.uuid4(),
            project_id=project.id,
            column_id=col.id,
            title="Backend Secret Encryption Architecture",
            description="Backend confidential task",
            owner_team_id=t_be.id,
            visibility="team_only",
            position=2000.0,
            created_by=be_user.id,
        )
        card_des = Card(
            id=uuid.uuid4(),
            project_id=project.id,
            column_id=col.id,
            title="Design System Mockup",
            description="Design confidential task",
            owner_team_id=t_des.id,
            visibility="team_only",
            position=3000.0,
            created_by=des_user.id,
        )
        card_hr = Card(
            id=uuid.uuid4(),
            project_id=project.id,
            column_id=col.id,
            title="HR Confidential Payroll Review",
            description="HR confidential task",
            owner_team_id=t_hr.id,
            visibility="hr_only",
            position=4000.0,
            created_by=hr_user.id,
        )
        db.add_all([card_fe, card_be, card_des, card_hr])
        await db.commit()

        return {
            "project_id": str(project.id),
            "column_id": str(col.id),
            "teams": {
                "frontend": str(t_fe.id),
                "backend": str(t_be.id),
                "design": str(t_des.id),
                "hr": str(t_hr.id),
            },
            "users": {
                "manager": (mgr_user.email, "Password123!"),
                "designer": (des_user.email, "Password123!"),
                "frontend": (fe_user.email, "Password123!"),
                "backend": (be_user.email, "Password123!"),
                "hr": (hr_user.email, "Password123!"),
            },
            "cards": {
                "frontend": str(card_fe.id),
                "backend": str(card_be.id),
                "design": str(card_des.id),
                "hr": str(card_hr.id),
            },
        }


@pytest.mark.asyncio
async def test_frontend_cannot_access_private_backend_card(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    be_card_id = data["cards"]["backend"]
    fe_email, fe_pw = data["users"]["frontend"]

    # Login as Frontend Engineer
    r_login = await client.post("/api/auth/login", json={"email": fe_email, "password": fe_pw})
    assert r_login.status_code == 200

    # Try to access Backend card by ID -> OWASP anti-enumeration requires 404
    r_card = await client.get(f"/api/projects/{pid}/cards/{be_card_id}")
    assert r_card.status_code == 404


@pytest.mark.asyncio
async def test_backend_cannot_access_private_frontend_card(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    fe_card_id = data["cards"]["frontend"]
    be_email, be_pw = data["users"]["backend"]

    # Login as Backend Engineer
    await client.post("/api/auth/login", json={"email": be_email, "password": be_pw})

    # Try to access Frontend card by ID -> 404
    r_card = await client.get(f"/api/projects/{pid}/cards/{fe_card_id}")
    assert r_card.status_code == 404


@pytest.mark.asyncio
async def test_manager_can_access_any_card(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    mgr_email, mgr_pw = data["users"]["manager"]

    # Login as Manager
    await client.post("/api/auth/login", json={"email": mgr_email, "password": mgr_pw})

    # Manager can access Frontend, Backend, Design, and HR cards
    for role, card_id in data["cards"].items():
        r = await client.get(f"/api/projects/{pid}/cards/{card_id}")
        assert r.status_code == 200, f"Manager should access {role} card"


@pytest.mark.asyncio
async def test_designer_views_backend_card_readonly(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    be_card_id = data["cards"]["backend"]
    des_email, des_pw = data["users"]["designer"]

    # Login as Designer
    await client.post("/api/auth/login", json={"email": des_email, "password": des_pw})

    # Designer has cross-team read visibility
    r_get = await client.get(f"/api/projects/{pid}/cards/{be_card_id}")
    assert r_get.status_code == 200
    card_data = r_get.json()
    assert card_data["title"] == "Backend Secret Encryption Architecture"

    # Designer cannot modify backend cards without explicit edit permission -> 403
    r_patch = await client.patch(
        f"/api/projects/{pid}/cards/{be_card_id}",
        json={"title": "Designer Tampered Title", "version": card_data["version"]},
    )
    assert r_patch.status_code == 403


@pytest.mark.asyncio
async def test_designer_can_edit_design_card(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    des_card_id = data["cards"]["design"]
    des_email, des_pw = data["users"]["designer"]

    # Login as Designer
    await client.post("/api/auth/login", json={"email": des_email, "password": des_pw})

    # Designer can edit Design team card
    r_get = await client.get(f"/api/projects/{pid}/cards/{des_card_id}")
    assert r_get.status_code == 200
    v = r_get.json()["version"]

    r_patch = await client.patch(
        f"/api/projects/{pid}/cards/{des_card_id}",
        json={"title": "Updated Design Tokens", "version": v},
    )
    assert r_patch.status_code == 200
    assert r_patch.json()["title"] == "Updated Design Tokens"


@pytest.mark.asyncio
async def test_hr_cannot_access_engineering_board(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    hr_email, hr_pw = data["users"]["hr"]

    # Login as HR Manager
    await client.post("/api/auth/login", json={"email": hr_email, "password": hr_pw})

    # Fetch all cards
    r = await client.get(f"/api/projects/{pid}/cards")
    assert r.status_code == 200
    cards = r.json()
    # Must only contain HR card, 0 engineering cards
    assert len(cards) == 1
    assert cards[0]["id"] == data["cards"]["hr"]


@pytest.mark.asyncio
async def test_hr_cannot_access_engineering_card_by_id(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    be_card_id = data["cards"]["backend"]
    fe_card_id = data["cards"]["frontend"]
    hr_email, hr_pw = data["users"]["hr"]

    await client.post("/api/auth/login", json={"email": hr_email, "password": hr_pw})

    # HR cannot view backend or frontend cards
    assert (await client.get(f"/api/projects/{pid}/cards/{be_card_id}")).status_code == 404
    assert (await client.get(f"/api/projects/{pid}/cards/{fe_card_id}")).status_code == 404


@pytest.mark.asyncio
async def test_hr_activity_log_excludes_engineering_events(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    be_card_id = data["cards"]["backend"]
    be_email, be_pw = data["users"]["backend"]
    hr_email, hr_pw = data["users"]["hr"]

    # Backend user comments on backend card to generate activity
    await client.post("/api/auth/login", json={"email": be_email, "password": be_pw})
    await client.post(
        f"/api/projects/{pid}/cards/{be_card_id}/comments",
        json={"text": "Backend private discussion"},
    )

    # HR views activity log
    await client.post("/api/auth/login", json={"email": hr_email, "password": hr_pw})
    r_act = await client.get(f"/api/projects/{pid}/activity")
    assert r_act.status_code == 200
    events = r_act.json()["items"]
    # No backend card events should be visible to HR
    for ev in events:
        if ev.get("details"):
            assert ev["details"].get("card_id") != be_card_id


@pytest.mark.asyncio
async def test_frontend_search_private_backend_card_returns_empty(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    fe_email, fe_pw = data["users"]["frontend"]

    await client.post("/api/auth/login", json={"email": fe_email, "password": fe_pw})

    # Search for "Encryption" (in Backend Secret Encryption Architecture)
    r = await client.get(f"/api/projects/{pid}/cards?q=Encryption")
    assert r.status_code == 200
    assert len(r.json()) == 0

    # Dedicated search endpoint also empty
    r_search = await client.get(f"/api/projects/{pid}/cards/search?q=Encryption")
    assert r_search.status_code == 200
    assert len(r_search.json()) == 0


@pytest.mark.asyncio
async def test_manager_shares_card_grants_access(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    be_card_id = data["cards"]["backend"]
    fe_team_id = data["teams"]["frontend"]
    mgr_email, mgr_pw = data["users"]["manager"]
    fe_email, fe_pw = data["users"]["frontend"]

    # 1. Frontend cannot see backend card initially
    await client.post("/api/auth/login", json={"email": fe_email, "password": fe_pw})
    assert (await client.get(f"/api/projects/{pid}/cards/{be_card_id}")).status_code == 404

    # 2. Manager shares card with Frontend team
    await client.post("/api/auth/login", json={"email": mgr_email, "password": mgr_pw})
    r_share = await client.post(
        f"/api/projects/{pid}/cards/{be_card_id}/share",
        json={"team_id": fe_team_id, "permission": "view"},
    )
    assert r_share.status_code == 201

    # 3. Frontend can now see backend card
    await client.post("/api/auth/login", json={"email": fe_email, "password": fe_pw})
    r_fe = await client.get(f"/api/projects/{pid}/cards/{be_card_id}")
    assert r_fe.status_code == 200
    assert r_fe.json()["title"] == "Backend Secret Encryption Architecture"


@pytest.mark.asyncio
async def test_manager_revokes_share_grant(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    be_card_id = data["cards"]["backend"]
    fe_team_id = data["teams"]["frontend"]
    mgr_email, mgr_pw = data["users"]["manager"]
    fe_email, fe_pw = data["users"]["frontend"]

    # Manager shares card
    await client.post("/api/auth/login", json={"email": mgr_email, "password": mgr_pw})
    r_share = await client.post(
        f"/api/projects/{pid}/cards/{be_card_id}/share",
        json={"team_id": fe_team_id, "permission": "view"},
    )
    grant_id = r_share.json()["id"]

    # Manager revokes grant
    r_del = await client.delete(f"/api/projects/{pid}/cards/{be_card_id}/share/{grant_id}")
    assert r_del.status_code == 204

    # Frontend access revoked -> 404
    await client.post("/api/auth/login", json={"email": fe_email, "password": fe_pw})
    assert (await client.get(f"/api/projects/{pid}/cards/{be_card_id}")).status_code == 404


@pytest.mark.asyncio
async def test_engineer_cannot_reassign_card_owner_team(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    fe_card_id = data["cards"]["frontend"]
    be_team_id = data["teams"]["backend"]
    fe_email, fe_pw = data["users"]["frontend"]

    await client.post("/api/auth/login", json={"email": fe_email, "password": fe_pw})

    # Frontend engineer tries to reassign card to Backend team -> 403 Forbidden
    r = await client.patch(
        f"/api/projects/{pid}/cards/{fe_card_id}",
        json={"owner_team_id": be_team_id},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_engineer_cannot_create_task_for_other_team(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    col_id = data["column_id"]
    be_team_id = data["teams"]["backend"]
    fe_email, fe_pw = data["users"]["frontend"]

    await client.post("/api/auth/login", json={"email": fe_email, "password": fe_pw})

    # Frontend engineer tries to create a card owned by Backend team -> 403 Forbidden
    r = await client.post(
        f"/api/projects/{pid}/cards",
        json={"column_id": col_id, "title": "Sneaky Card", "owner_team_id": be_team_id},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_unauthorized_user_cannot_comment_on_private_card(client: AsyncClient):
    data = await setup_team_board()
    pid = data["project_id"]
    be_card_id = data["cards"]["backend"]
    fe_email, fe_pw = data["users"]["frontend"]

    await client.post("/api/auth/login", json={"email": fe_email, "password": fe_pw})

    # Frontend engineer cannot post a comment on Backend private card -> 404
    r = await client.post(
        f"/api/projects/{pid}/cards/{be_card_id}/comments",
        json={"text": "Intruding comment"},
    )
    assert r.status_code == 404
