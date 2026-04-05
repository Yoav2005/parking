from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.spot import Spot
from app.models.reservation import Reservation, ReservationStatus
from app.models.rating import Rating
from app.schemas.rating import RatingCreate, RatingOut
from app.schemas.common import ok
import uuid

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.post("")
async def create_rating(
    body: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reservation = await db.get(Reservation, body.reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.status != ReservationStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Can only rate completed reservations")

    spot = await db.get(Spot, reservation.spot_id)
    leaver_id = spot.leaver_id if spot else None

    valid_parties = {reservation.driver_id, leaver_id}
    valid_parties.discard(None)

    if current_user.id not in valid_parties:
        raise HTTPException(status_code=403, detail="Not a party to this reservation")
    if body.rated_id not in valid_parties:
        raise HTTPException(status_code=400, detail="rated_id must be a party to this reservation")
    if current_user.id == body.rated_id:
        raise HTTPException(status_code=400, detail="Cannot rate yourself")

    existing = await db.execute(
        select(Rating).where(
            Rating.reservation_id == body.reservation_id,
            Rating.rater_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already rated this reservation")

    rating = Rating(
        id=str(uuid.uuid4()),
        reservation_id=body.reservation_id,
        rater_id=current_user.id,
        rated_id=body.rated_id,
        score=body.score,
    )
    db.add(rating)
    await db.flush()

    # Recalculate avg_rating for the rated user
    avg_result = await db.execute(
        select(func.avg(Rating.score)).where(Rating.rated_id == body.rated_id)
    )
    avg = avg_result.scalar_one_or_none() or 0.0
    rated_user = await db.get(User, body.rated_id)
    if rated_user:
        rated_user.avg_rating = round(float(avg), 2)

    await db.commit()
    await db.refresh(rating)
    return ok(RatingOut.model_validate(rating).model_dump(mode="json"))
