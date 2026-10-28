from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any

import redis.asyncio as aioredis

from app.config import settings


class ConnectionManager:
    """Manages WebSocket connections and Redis pub/sub for real-time events."""

    def __init__(self) -> None:
        self._connections: dict[str, dict[str, Any]] = {}
        # { project_id_str: { ws_id: {"ws": websocket, "user_id": uuid} } }
        self._redis: aioredis.Redis | None = None

    def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    def _channel(self, project_id: str) -> str:
        return f"project:{project_id}"

    async def connect(
        self,
        websocket: Any,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        pid = str(project_id)
        ws_id = str(uuid.uuid4())
        if pid not in self._connections:
            self._connections[pid] = {}
        self._connections[pid][ws_id] = {"ws": websocket, "user_id": user_id, "ws_id": ws_id}

        # Subscribe to Redis channel and forward messages
        redis = self._get_redis()
        pubsub = redis.pubsub()
        await pubsub.subscribe(self._channel(pid))

        async def _listen() -> None:
            try:
                async for message in pubsub.listen():
                    if message["type"] == "message":
                        data = message["data"]
                        try:
                            payload = json.loads(data) if isinstance(data, str) else data
                            kick_user = payload.get("__kick_user")
                            if kick_user and str(user_id) == kick_user:
                                await websocket.close(code=4003, reason="Removed from project")
                                return
                            await websocket.send_text(
                                data if isinstance(data, str) else json.dumps(data)
                            )
                        except Exception:
                            pass
            except Exception:
                pass
            finally:
                await pubsub.unsubscribe(self._channel(pid))
                await pubsub.aclose()

        asyncio.create_task(_listen())

    async def disconnect(self, websocket: Any, project_id: uuid.UUID) -> None:
        pid = str(project_id)
        if pid in self._connections:
            self._connections[pid] = {
                ws_id: info
                for ws_id, info in self._connections[pid].items()
                if info["ws"] is not websocket
            }
            if not self._connections[pid]:
                del self._connections[pid]

    async def broadcast_to_project(
        self,
        project_id: uuid.UUID,
        event_type: str,
        data: dict,
    ) -> None:
        pid = str(project_id)
        payload = {"event": event_type, "data": data}
        redis = self._get_redis()
        await redis.publish(self._channel(pid), json.dumps(payload))

    async def kick_user_from_project(
        self,
        project_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> None:
        pid = str(project_id)
        payload = {"__kick_user": str(user_id)}
        redis = self._get_redis()
        await redis.publish(self._channel(pid), json.dumps(payload))


manager = ConnectionManager()
