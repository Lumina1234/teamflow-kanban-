"""
pytest conftest — creates a fresh async DB session for every test.
Uses the real PostgreSQL instance (TEST_DATABASE_URL env var).
"""
from __future__ import annotations

import os
import uuid
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# ── Must set test DB before importing app ──────────────────────────────────────
TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://kanban:kanban_dev_password@localhost:5432/kanban_test_db",
)
os.environ["DATABASE_URL"] = TEST_DB_URL
os.environ.setdefault("SESSION_SECRET_KEY", "test-secret-key-at-least-32-chars!!")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ["ALLOWED_ORIGINS"] = '["http://localhost:5173"]'
os.environ.setdefault("COOKIE_SECURE", "false")

import app.database as app_db
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

# ── Engine / session factory with NullPool ────────────────────────────────────
test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)

# Override app's database engine and sessionmaker so all imports use test DB
app_db.engine = test_engine
app_db.AsyncSessionLocal = TestSessionLocal


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        async with TestSessionLocal() as session:
            try:
                yield session
            finally:
                await session.close()

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"origin": "http://localhost:5173"},
    ) as c:
        yield c
    app.dependency_overrides.clear()


# ── Helper fixtures ────────────────────────────────────────────────────────────

async def _register(client: AsyncClient, name: str, email: str, password: str):
    r = await client.post("/api/auth/register", json={"name": name, "email": email, "password": password})
    assert r.status_code == 201, r.text
    return r


async def _login(client: AsyncClient, email: str, password: str):
    r = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r


@pytest_asyncio.fixture
async def owner_client(client: AsyncClient):
    """An authenticated client for the 'owner' user."""
    await _register(client, "Owner User", f"owner_{uuid.uuid4().hex[:8]}@test.com", "Password123!")
    # Extract cookie for subsequent requests
    return client


@pytest_asyncio.fixture
async def owner_creds():
    return {"email": f"owner_{uuid.uuid4().hex[:8]}@test.com", "password": "Password123!"}


@pytest_asyncio.fixture
async def member_creds():
    return {"email": f"member_{uuid.uuid4().hex[:8]}@test.com", "password": "Password123!"}
