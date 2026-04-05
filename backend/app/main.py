from contextlib import asynccontextmanager
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.routes import auth, spots, reservations, payments, ratings, users, chat, upload, admin
from app.websocket.manager import manager
from app.services.background_tasks import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    await manager.startup()
    start_scheduler()
    yield
    stop_scheduler()
    await manager.shutdown()


app = FastAPI(title="ParkPass API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(spots.router)
app.include_router(reservations.router)
app.include_router(payments.router)
app.include_router(ratings.router)
app.include_router(users.router)
app.include_router(chat.router)
app.include_router(upload.router)
app.include_router(admin.router)

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/spots")
async def websocket_spots(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/admin", include_in_schema=False)
async def serve_admin():
    admin_path = os.path.join(os.path.dirname(__file__), "admin.html")
    return FileResponse(admin_path)
