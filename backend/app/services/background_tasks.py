import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.spot import Spot, SpotStatus
from app.models.reservation import Reservation, ReservationStatus
from app.services.payment_service import refund_payment_intent
from app.websocket.manager import manager

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def expire_stale_spots():
    async with AsyncSessionLocal() as db:
        try:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(Spot).where(
                    Spot.status == SpotStatus.AVAILABLE,
                    Spot.expires_at < now,
                )
            )
            spots = result.scalars().all()
            for spot in spots:
                spot.status = SpotStatus.EXPIRED
                await manager.publish("spot_expired", {"spot_id": spot.id})
            await db.commit()
            if spots:
                logger.info(f"Expired {len(spots)} stale spots")
        except Exception as e:
            logger.error(f"Error expiring spots: {e}")
            await db.rollback()


async def auto_cancel_reservations():
    async with AsyncSessionLocal() as db:
        try:
            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(Reservation).where(
                    Reservation.status == ReservationStatus.ACTIVE,
                    Reservation.auto_cancel_at != None,
                    Reservation.auto_cancel_at < now,
                )
            )
            reservations = result.scalars().all()
            for reservation in reservations:
                try:
                    await refund_payment_intent(reservation.stripe_payment_intent_id)
                except Exception as e:
                    logger.error(f"Refund failed for reservation {reservation.id}: {e}")
                reservation.status = ReservationStatus.REFUNDED
                spot_result = await db.execute(
                    select(Spot).where(Spot.id == reservation.spot_id)
                )
                spot = spot_result.scalar_one_or_none()
                if spot:
                    spot.status = SpotStatus.CANCELLED
                    await manager.publish("spot_cancelled", {"spot_id": spot.id})
            await db.commit()
            if reservations:
                logger.info(f"Auto-cancelled {len(reservations)} reservations")
        except Exception as e:
            logger.error(f"Error auto-cancelling reservations: {e}")
            await db.rollback()


def start_scheduler():
    scheduler.add_job(expire_stale_spots, "interval", minutes=1, id="expire_spots")
    scheduler.add_job(auto_cancel_reservations, "interval", minutes=1, id="auto_cancel")
    scheduler.start()


def stop_scheduler():
    scheduler.shutdown(wait=False)
