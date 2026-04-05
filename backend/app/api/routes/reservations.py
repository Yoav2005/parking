import math
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.user import User
from app.models.spot import Spot, SpotStatus
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.reservation import ReservationCreate, ReservationOut
from app.schemas.common import ok
from app.services.payment_service import create_payment_intent, refund_payment_intent
from app.websocket.manager import manager
import uuid

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.get("")
async def list_reservations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Reservation)
        .where(Reservation.driver_id == current_user.id)
        .order_by(Reservation.created_at.desc())
    )
    reservations = result.scalars().all()

    out = []
    for res in reservations:
        spot = await db.get(Spot, res.spot_id)
        leaver = await db.get(User, spot.leaver_id) if spot else None
        out.append({
            **ReservationOut.model_validate(res).model_dump(mode="json"),
            "spot_address": spot.address if spot else "",
            "spot_price": spot.price if spot else 0,
            "spot_lat": spot.latitude if spot else None,
            "spot_lng": spot.longitude if spot else None,
            "leaver_id": spot.leaver_id if spot else None,
            "leaver_name": leaver.full_name if leaver else None,
            "leaver_rating": leaver.avg_rating if leaver else None,
            "leaver_car_make": leaver.car_make if leaver else None,
            "leaver_car_model": leaver.car_model if leaver else None,
        })
    return ok(out)


@router.post("")
async def create_reservation(
    body: ReservationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(Spot).where(Spot.id == body.spot_id).with_for_update(nowait=True)
        )
    except OperationalError:
        raise HTTPException(status_code=409, detail="Spot is being reserved by another driver")

    spot = result.scalar_one_or_none()
    if not spot:
        raise HTTPException(status_code=404, detail="Spot not found")
    if spot.status != SpotStatus.AVAILABLE:
        raise HTTPException(status_code=409, detail="Spot is no longer available")
    if spot.leaver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot reserve your own spot")

    existing = await db.execute(
        select(Reservation)
        .where(Reservation.driver_id == current_user.id)
        .where(Reservation.status == ReservationStatus.ACTIVE)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="You already have an active reservation")

    leaver = await db.get(User, spot.leaver_id)
    token_cost = max(1, math.ceil(spot.price))

    if settings.DEV_MODE:
        # Token payment
        if current_user.token_balance < token_cost:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient tokens. Need {token_cost}, have {current_user.token_balance}."
            )
        platform_cut = max(1, round(token_cost * settings.PLATFORM_FEE_PERCENT))
        leaver_cut = token_cost - platform_cut

        current_user.token_balance -= token_cost
        if leaver:
            leaver.token_balance += leaver_cut

        fake_intent_id = f"dev_tok_{uuid.uuid4().hex[:12]}"
        reservation = Reservation(
            id=str(uuid.uuid4()),
            spot_id=spot.id,
            driver_id=current_user.id,
            stripe_payment_intent_id=fake_intent_id,
            status=ReservationStatus.ACTIVE,
        )
        spot.status = SpotStatus.RESERVED
        spot.reserved_at = datetime.now(timezone.utc)
        db.add(reservation)
        await db.commit()
        await db.refresh(reservation)
        await manager.publish("spot_reserved", {
            "spot_id": spot.id,
            "reservation_id": reservation.id,
            "leaver_id": spot.leaver_id,
            "driver_name": current_user.full_name,
            "driver_car_make": current_user.car_make,
            "driver_car_model": current_user.car_model,
            "spot_address": spot.address,
        })
        return ok({
            "reservation": ReservationOut.model_validate(reservation).model_dump(mode="json"),
            "client_secret": None,
            "dev_mode": True,
            "tokens_spent": token_cost,
            "driver_balance": current_user.token_balance,
        })

    # Real Stripe payment
    try:
        idempotency_key = f"res-{body.spot_id}-{current_user.id}"
        intent = await create_payment_intent(
            amount_usd=spot.price,
            leaver_stripe_account_id=leaver.stripe_account_id if leaver else None,
            idempotency_key=idempotency_key,
        )
    except Exception as e:
        raise HTTPException(status_code=402, detail=f"Payment initiation failed: {str(e)}")

    reservation = Reservation(
        id=str(uuid.uuid4()),
        spot_id=spot.id,
        driver_id=current_user.id,
        stripe_payment_intent_id=intent.id,
        status=ReservationStatus.ACTIVE,
    )
    spot.status = SpotStatus.RESERVED
    spot.reserved_at = datetime.now(timezone.utc)
    db.add(reservation)
    await db.commit()
    await db.refresh(reservation)
    await manager.publish("spot_reserved", {
        "spot_id": spot.id,
        "leaver_id": spot.leaver_id,
        "driver_name": current_user.full_name,
        "spot_address": spot.address,
    })
    return ok({
        "reservation": ReservationOut.model_validate(reservation).model_dump(mode="json"),
        "client_secret": intent.client_secret,
        "dev_mode": False,
    })


@router.post("/{reservation_id}/confirm-arrival")
async def confirm_arrival(
    reservation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Driver taps 'I've Arrived' — marks arrival time and notifies leaver to confirm swap."""
    reservation = await db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your reservation")
    if reservation.status != ReservationStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Reservation is not active")

    now = datetime.now(timezone.utc)
    reservation.arrival_confirmed_at = now
    reservation.auto_cancel_at = now + timedelta(minutes=15)
    # Keep ACTIVE — leaver must confirm swap to complete

    spot = await db.get(Spot, reservation.spot_id)
    await db.commit()

    # Notify leaver so they can confirm the swap
    await manager.publish("driver_arrived", {
        "reservation_id": reservation_id,
        "leaver_id": spot.leaver_id if spot else None,
        "driver_name": current_user.full_name,
        "spot_address": spot.address if spot else "",
    })
    return ok(ReservationOut.model_validate(reservation).model_dump(mode="json"))


@router.post("/{reservation_id}/leaver-confirm")
async def leaver_confirm(
    reservation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Leaver confirms they've vacated — completes reservation for both parties."""
    reservation = await db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")

    spot = await db.get(Spot, reservation.spot_id)
    if not spot or spot.leaver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your spot")
    if reservation.status != ReservationStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Reservation is not active")
    if not reservation.arrival_confirmed_at:
        raise HTTPException(status_code=400, detail="Driver has not confirmed arrival yet")

    now = datetime.now(timezone.utc)
    reservation.status = ReservationStatus.COMPLETED
    spot.status = SpotStatus.COMPLETED
    spot.completed_at = now

    await db.commit()

    # Notify both parties that the swap is complete
    await manager.publish("reservation_completed", {
        "reservation_id": reservation_id,
        "driver_id": reservation.driver_id,
        "leaver_id": current_user.id,
    })
    return ok({"reservation_id": reservation_id, "status": "COMPLETED"})


@router.post("/{reservation_id}/cancel")
async def cancel_reservation(
    reservation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reservation = await db.get(Reservation, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.driver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your reservation")
    if reservation.status not in (ReservationStatus.ACTIVE, ReservationStatus.PENDING):
        raise HTTPException(status_code=400, detail="Cannot cancel this reservation")

    will_refund = reservation.arrival_confirmed_at is None
    spot = await db.get(Spot, reservation.spot_id)

    if settings.DEV_MODE:
        if will_refund:
            # Refund tokens to driver
            token_cost = max(1, math.ceil(spot.price)) if spot else 0
            current_user.token_balance += token_cost
            # Deduct from leaver if already paid
            if spot:
                leaver = await db.get(User, spot.leaver_id)
                platform_cut = max(1, round(token_cost * settings.PLATFORM_FEE_PERCENT))
                leaver_cut = token_cost - platform_cut
                if leaver:
                    leaver.token_balance = max(0, leaver.token_balance - leaver_cut)
            reservation.status = ReservationStatus.REFUNDED
        else:
            reservation.status = ReservationStatus.CANCELLED
    else:
        if will_refund:
            try:
                await refund_payment_intent(reservation.stripe_payment_intent_id)
                reservation.status = ReservationStatus.REFUNDED
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Refund failed: {str(e)}")
        else:
            reservation.status = ReservationStatus.CANCELLED

    leaver_id = None
    spot_id = None
    if spot and spot.status == SpotStatus.RESERVED:
        spot.status = SpotStatus.AVAILABLE
        spot.reserved_at = None
        leaver_id = spot.leaver_id
        spot_id = spot.id

    await db.commit()

    if leaver_id and spot_id:
        # Re-broadcast the spot as available so it reappears on drivers' maps
        await db.refresh(spot)
        from app.schemas.spot import SpotOut
        out = SpotOut.model_validate(spot)
        await manager.publish("spot_created", out.model_dump(mode="json"))
        # Notify the leaver their spot is available again
        await manager.publish("spot_cancelled", {
            "spot_id": spot_id,
            "reservation_id": reservation_id,
            "leaver_id": leaver_id,
            "cancelled_by": "driver",
        })

    return ok({
        "reservation_id": reservation_id,
        "status": reservation.status,
        "refunded": will_refund,
    })
