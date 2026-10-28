from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.session import Session
from app.models.project import ProjectMember
from app.models.user import User
from app.services.realtime_service import manager

router = APIRouter(tags=["websocket"])


@router.websocket("/api/ws/{project_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    project_id: uuid.UUID,
    token: str = Query(...),
):
    """
    Authenticated WebSocket for project real-time updates.
    Token is the raw session token passed as a query param.
    Validates session, membership, and origin before accepting.
    """
    # Validate origin
    origin = websocket.headers.get("origin")
    if origin and origin not in settings.ALLOWED_ORIGINS:
        await websocket.close(code=4003, reason="Origin not allowed")
        return

    # Validate session token
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        session_result = await db.execute(
            select(Session).where(
                Session.token_hash == token_hash,
                Session.revoked_at.is_(None),
                Session.expires_at > now,
            )
        )
        session = session_result.scalar_one_or_none()
        if session is None:
            await websocket.close(code=4001, reason="Invalid or expired session")
            return

        user_result = await db.execute(
            select(User).where(User.id == session.user_id, User.is_active.is_(True))
        )
        user = user_result.scalar_one_or_none()
        if user is None:
            await websocket.close(code=4001, reason="User not found")
            return

        # Validate project membership
        member_result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user.id,
            )
        )
        if member_result.scalar_one_or_none() is None:
            await websocket.close(code=4004, reason="Not a project member")
            return

        user_id = user.id

    # Accept and register connection
    await websocket.accept()
    await manager.connect(websocket, project_id, user_id)
    try:
        while True:
            # Keep connection alive; client sends pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await manager.disconnect(websocket, project_id)
