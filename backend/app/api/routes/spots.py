import math
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.user import User
from app.models.spot import Spot, SpotStatus
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.spot import SpotCreate, SpotOut
from app.schemas.common import ok
from app.services.spot_service import get_nearby_spots
from app.services.payment_service import refund_payment_intent
from app.websocket.manager import manager

router = APIRouter(prefix="/spots", tags=["spots"])


@router.post("")
async def create_spot(
    body: SpotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Block if user has an active reservation as a driver
    active_res = await db.execute(
        select(Reservation)
        .where(Reservation.driver_id == current_user.id)
        .where(Reservation.status == ReservationStatus.ACTIVE)
    )
    if active_res.scalars().first():
        raise HTTPException(status_code=400, detail="You can't list a spot while you have an active reservation.")

    spot = Spot(
        id=str(uuid.uuid4()),
        leaver_id=current_user.id,
        latitude=body.latitude,
        longitude=body.longitude,
        address=body.address,
        price=body.price,
        leaving_in_minutes=body.leaving_in_minutes,
        photo_url=body.photo_url,
    )
    db.add(spot)
    await db.commit()
    await db.refresh(spot)
    out = SpotOut.model_validate(spot)
    await manager.publish("spot_created", out.model_dump(mode="json"))
    return ok(out.model_dump(mode="json"))


@router.get("/my-listing")
async def my_listing(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the current user's AVAILABLE or RESERVED spot, if any."""
    result = await db.execute(
        select(Spot)
        .where(Spot.leaver_id == current_user.id)
        .where(Spot.status.in_(["AVAILABLE", "RESERVED"]))
        .order_by(Spot.created_at.desc())
    )
    spot = result.scalars().first()
    if not spot:
        return ok(None)
    out = SpotOut.model_validate(spot)
    # Include active reservation id so leaver can open chat
    if spot.status == SpotStatus.RESERVED:
        res_result = await db.execute(
            select(Reservation)
            .where(Reservation.spot_id == spot.id)
            .where(Reservation.status == ReservationStatus.ACTIVE)
        )
        res = res_result.scalars().first()
        if res:
            out.active_reservation_id = res.id
            driver = await db.get(User, res.driver_id)
            if driver:
                out.driver_name = driver.full_name
                out.driver_car_make = driver.car_make
                out.driver_car_model = driver.car_model
    return ok(out.model_dump(mode="json"))


@router.get("/nearby")
async def nearby_spots(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_km: float = Query(2.0),
    db: AsyncSession = Depends(get_db),
):
    spots = await get_nearby_spots(db, lat, lng, radius_km)
    return ok([s.model_dump(mode="json") for s in spots])


@router.get("/{spot_id}")
async def get_spot(spot_id: str, db: AsyncSession = Depends(get_db)):
    spot = await db.get(Spot, spot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Spot not found")
    leaver = await db.get(User, spot.leaver_id)
    out = SpotOut.model_validate(spot)
    out.leaver_avg_rating = leaver.avg_rating if leaver else 0.0
    out.leaver_name = leaver.full_name if leaver else None
    return ok(out.model_dump(mode="json"))


@router.patch("/{spot_id}/cancel")
async def cancel_spot(
    spot_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    spot = await db.get(Spot, spot_id)
    if not spot:
        raise HTTPException(status_code=404, detail="Spot not found")
    if spot.leaver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your spot")
    if spot.status not in (SpotStatus.AVAILABLE, SpotStatus.RESERVED):
        raise HTTPException(status_code=400, detail="This spot cannot be cancelled")

    spot_id_val = spot.id
    driver_id_to_notify = None

    if spot.status == SpotStatus.RESERVED:
        # Cancel the active reservation and refund the driver
        res_result = await db.execute(
            select(Reservation)
            .where(Reservation.spot_id == spot.id)
            .where(Reservation.status == ReservationStatus.ACTIVE)
        )
        reservation = res_result.scalars().first()
        if reservation:
            driver_id_to_notify = reservation.driver_id
            if settings.DEV_MODE:
                token_cost = max(1, math.ceil(spot.price))
                driver = await db.get(User, reservation.driver_id)
                if driver:
                    driver.token_balance += token_cost
                    platform_cut = max(1, round(token_cost * settings.PLATFORM_FEE_PERCENT))
                    leaver_cut = token_cost - platform_cut
                    current_user.token_balance = max(0, current_user.token_balance - leaver_cut)
                reservation.status = ReservationStatus.REFUNDED
            else:
                try:
                    await refund_payment_intent(reservation.stripe_payment_intent_id)
                    reservation.status = ReservationStatus.REFUNDED
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")

    spot.status = SpotStatus.CANCELLED

    await db.commit()

    await manager.publish("spot_cancelled", {
        "spot_id": spot_id_val,
        "cancelled_by": "leaver",
        "driver_id": driver_id_to_notify,
    })

    return ok({"spot_id": spot_id_val, "status": "CANCELLED"})
