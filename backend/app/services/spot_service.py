import math
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.spot import Spot, SpotStatus
from app.models.user import User
from app.schemas.spot import SpotOut


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def get_nearby_spots(
    db: AsyncSession, lat: float, lng: float, radius_km: float
) -> List[SpotOut]:
    result = await db.execute(
        select(Spot).where(Spot.status == SpotStatus.AVAILABLE)
    )
    spots = result.scalars().all()

    # Fetch all relevant leavers in one query
    leaver_ids = list({s.leaver_id for s in spots})
    leavers_result = await db.execute(
        select(User).where(User.id.in_(leaver_ids))
    )
    leavers = {u.id: u for u in leavers_result.scalars().all()}

    nearby = []
    for spot in spots:
        dist = haversine_km(lat, lng, spot.latitude, spot.longitude)
        if dist <= radius_km:
            leaver = leavers.get(spot.leaver_id)
            out = SpotOut.model_validate(spot)
            out.distance_km = round(dist, 3)
            out.leaver_avg_rating = leaver.avg_rating if leaver else 0.0
            nearby.append(out)

    nearby.sort(key=lambda s: s.distance_km or 0)
    return nearby
