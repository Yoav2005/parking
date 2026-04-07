import json
import asyncio
from typing import Set
from fastapi import WebSocket
import redis.asyncio as aioredis
from app.core.config import settings

CHANNEL = "parkpass:spots"


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self._redis: aioredis.Redis | None = None
        self._pubsub_task: asyncio.Task | None = None

    async def startup(self):
        try:
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await self._redis.ping()
            self._pubsub_task = asyncio.create_task(self._listen())
        except Exception as e:
            print(f"WARNING: Redis connection failed: {e}. WebSocket pub/sub disabled.")
            self._redis = None

    async def shutdown(self):
        if self._pubsub_task:
            self._pubsub_task.cancel()
        if self._redis:
            await self._redis.aclose()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def publish(self, event_type: str, data: dict):
        if self._redis:
            message = json.dumps({"event": event_type, "data": data})
            await self._redis.publish(CHANNEL, message)

    async def _listen(self):
        redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        pubsub = redis.pubsub()
        await pubsub.subscribe(CHANNEL)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    await self._broadcast_raw(message["data"])
        finally:
            await pubsub.unsubscribe(CHANNEL)
            await redis.aclose()

    async def _broadcast_raw(self, text: str):
        dead = set()
        for ws in list(self.active_connections):
            try:
                await ws.send_text(text)
            except Exception:
                dead.add(ws)
        self.active_connections -= dead


manager = ConnectionManager()
