from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.reservation import Reservation
from app.models.spot import Spot
from app.models.chat import ChatMessage
from app.schemas.chat import ChatMessageCreate, ChatMessageOut
from app.schemas.common import ok
from app.websocket.manager import manager
import uuid

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_reservation_parties(reservation_id: str, db: AsyncSession) -> tuple[str, str | None]:
    """Returns (driver_id, leaver_id) for a reservation."""
    reservation = await db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    spot = await db.get(Spot, reservation.spot_id)
    leaver_id = spot.leaver_id if spot else None
    return reservation.driver_id, leaver_id


@router.get("/{reservation_id}/messages")
async def get_messages(
    reservation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    driver_id, leaver_id = await _get_reservation_parties(reservation_id, db)
    if current_user.id not in {driver_id, leaver_id}:
        raise HTTPException(status_code=403, detail="Not a party to this reservation")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.reservation_id == reservation_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()

    # Bulk-fetch sender names
    sender_ids = list({m.sender_id for m in messages})
    names: dict[str, str] = {}
    for sid in sender_ids:
        u = await db.get(User, sid)
        if u:
            names[sid] = u.full_name

    out = [
        ChatMessageOut(
            id=m.id,
            reservation_id=m.reservation_id,
            sender_id=m.sender_id,
            sender_name=names.get(m.sender_id, "Unknown"),
            content=m.content,
            created_at=m.created_at,
        )
        for m in messages
    ]
    return ok([o.model_dump(mode="json") for o in out])


@router.post("/{reservation_id}/messages")
async def send_message(
    reservation_id: str,
    body: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    driver_id, leaver_id = await _get_reservation_parties(reservation_id, db)
    if current_user.id not in {driver_id, leaver_id}:
        raise HTTPException(status_code=403, detail="Not a party to this reservation")

    msg = ChatMessage(
        id=str(uuid.uuid4()),
        reservation_id=reservation_id,
        sender_id=current_user.id,
        content=body.content.strip(),
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    out = ChatMessageOut(
        id=msg.id,
        reservation_id=msg.reservation_id,
        sender_id=msg.sender_id,
        sender_name=current_user.full_name,
        content=msg.content,
        created_at=msg.created_at,
    )
    # Broadcast to all connected clients so the other party sees it instantly
    await manager.publish("chat_message", out.model_dump(mode="json"))

    return ok(out.model_dump(mode="json"))
