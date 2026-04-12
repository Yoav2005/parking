import math
from datetime import datetime, timezone, timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import aliased
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.spot import Spot, SpotStatus
from app.models.reservation import Reservation, ReservationStatus
from app.schemas.common import ok
from app.core.config import settings

router = APIRouter(prefix="/admin", tags=["admin"])


async def require_admin(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _fmt_name(full_name: str) -> str:
    """'Michael Roberts' → 'Michael R.'"""
    parts = (full_name or "Unknown").split()
    if len(parts) >= 2:
        return f"{parts[0]} {parts[-1][0]}."
    return full_name or "Unknown"


def _extract_city(address: str) -> str | None:
    """Return the city part of an address.
    - 3+ parts: second-to-last (city, not district/country)
    - 2 parts: last part
    - 1 part (no comma): likely junk/test data, return None to exclude
    """
    parts = [p.strip() for p in (address or "").split(",")]
    if len(parts) >= 3:
        return parts[-2]  # city, not district
    if len(parts) == 2:
        return parts[-1]
    return None  # single-segment = no city info, exclude from map


def _spot_label(spot_id: str) -> str:
    return f"#{spot_id[:4].upper()}-{spot_id[-4:].upper()}"


def _fmt_date(dt: datetime) -> str:
    """Format datetime as 'Jan 1, 2024'"""
    return dt.strftime("%b %-d, %Y") if dt else ""


@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    sixty_days_ago = now - timedelta(days=60)

    Driver = aliased(User)
    Leaver = aliased(User)

    # ── All paid reservations (completed or cancelled-no-refund) ────────
    paid_statuses = [ReservationStatus.COMPLETED, ReservationStatus.CANCELLED]

    res_result = await db.execute(
        select(Reservation, Spot, Driver, Leaver)
        .join(Spot, Reservation.spot_id == Spot.id)
        .join(Driver, Reservation.driver_id == Driver.id)
        .join(Leaver, Spot.leaver_id == Leaver.id)
        .where(Reservation.status.in_(paid_statuses))
        .order_by(Reservation.created_at.desc())
    )
    rows = res_result.all()

    # ── Revenue calculations ────────────────────────────────────────────
    all_revenue = sum(spot.price for _, spot, _, _ in rows)
    current_revenue = sum(
        spot.price for res, spot, _, _ in rows
        if res.created_at >= thirty_days_ago
    )
    prev_revenue = sum(
        spot.price for res, spot, _, _ in rows
        if sixty_days_ago <= res.created_at < thirty_days_ago
    )
    revenue_change = (
        round((current_revenue - prev_revenue) / prev_revenue * 100, 1)
        if prev_revenue else 0
    )

    # ── Transaction counts ──────────────────────────────────────────────
    all_tx_result = await db.execute(
        select(func.count()).where(
            Reservation.status.in_(paid_statuses + [ReservationStatus.REFUNDED])
        ).select_from(Reservation)
    )
    total_transactions = all_tx_result.scalar() or 0

    current_tx = sum(1 for res, _, _, _ in rows if res.created_at >= thirty_days_ago)
    prev_tx = sum(1 for res, _, _, _ in rows if sixty_days_ago <= res.created_at < thirty_days_ago)
    tx_change = (
        round((current_tx - prev_tx) / prev_tx * 100, 1)
        if prev_tx else 0
    )

    # ── Active spots ────────────────────────────────────────────────────
    active_result = await db.execute(
        select(func.count()).where(
            Spot.status.in_([SpotStatus.AVAILABLE, SpotStatus.RESERVED])
        ).select_from(Spot)
    )
    active_spots = active_result.scalar() or 0

    # ── Platform fees ───────────────────────────────────────────────────
    fee_pct = settings.PLATFORM_FEE_PERCENT
    platform_fees_total = round(all_revenue * fee_pct, 2)
    platform_fees_current = round(current_revenue * fee_pct, 2)

    # ── Daily data for sparklines (last 7 days) ─────────────────────────
    daily_revenue: dict[str, float] = defaultdict(float)
    daily_tx: dict[str, int] = defaultdict(int)
    for res, spot, _, _ in rows:
        if res.created_at >= (now - timedelta(days=7)):
            day = res.created_at.strftime("%Y-%m-%d")
            daily_revenue[day] += spot.price
            daily_tx[day] += 1

    days_7 = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    revenue_daily = [round(daily_revenue.get(d, 0), 2) for d in days_7]
    tx_daily = [daily_tx.get(d, 0) for d in days_7]

    # ── Spots created per day (last 7 days) for Active Spots sparkline ──
    spots_daily_result = await db.execute(select(Spot.created_at))
    all_spot_dates = spots_daily_result.scalars().all()
    daily_spots: dict[str, int] = defaultdict(int)
    seven_days_ago = now - timedelta(days=7)
    for created_at in all_spot_dates:
        if created_at and created_at >= seven_days_ago:
            day = created_at.strftime("%Y-%m-%d")
            daily_spots[day] += 1
    spots_daily = [daily_spots.get(d, 0) for d in days_7]

    # ── Daily earnings for earnings chart (last 30 days) ───────────────
    daily_fees: dict[str, float] = defaultdict(float)
    daily_fee_days: dict[str, str] = {}  # day_key -> weekday name
    for res, spot, _, _ in rows:
        if res.created_at >= thirty_days_ago:
            day = res.created_at.strftime("%Y-%m-%d")
            daily_fees[day] += spot.price * fee_pct
            daily_fee_days[day] = res.created_at.strftime("%A")

    days_30 = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(29, -1, -1)]
    earnings_daily = [round(daily_fees.get(d, 0), 2) for d in days_30]
    earnings_labels = [(now - timedelta(days=i)).strftime("%b %d") for i in range(29, -1, -1)]

    # Peak day
    peak_day_key = max(daily_fees, key=daily_fees.get) if daily_fees else None
    peak_day_name = daily_fee_days.get(peak_day_key, "N/A") if peak_day_key else "N/A"
    peak_day_amount = round(daily_fees.get(peak_day_key, 0), 2) if peak_day_key else 0

    # ── Neighborhoods ───────────────────────────────────────────────────
    # Pull ALL spots so the map is populated even before any reservations complete
    all_spots_res = await db.execute(select(Spot))
    all_spot_objs = all_spots_res.scalars().all()

    neighborhood_revenue: dict[str, float] = defaultdict(float)
    neighborhood_coords: dict[str, tuple] = {}
    neighborhood_active: dict[str, int] = defaultdict(int)
    neighborhood_total_tx: dict[str, int] = defaultdict(int)
    neighborhood_addresses: dict[str, str] = {}

    # Revenue + total transactions from all paid reservations
    for res, spot, _, _ in rows:
        hood = _extract_city(spot.address)
        if hood is None:
            continue
        neighborhood_revenue[hood] += spot.price
        neighborhood_total_tx[hood] += 1

    # Coordinates, active counts from all spots
    for spot in all_spot_objs:
        hood = _extract_city(spot.address)
        if hood is None:
            continue
        if hood not in neighborhood_coords:
            neighborhood_coords[hood] = (spot.latitude, spot.longitude)
            neighborhood_addresses[hood] = hood
        if spot.status in (SpotStatus.AVAILABLE, SpotStatus.RESERVED):
            neighborhood_active[hood] += 1

    # Merge: include hoods that have any spots even if no revenue yet
    all_hoods = set(neighborhood_revenue.keys()) | set(neighborhood_coords.keys())
    hood_data = {h: neighborhood_revenue.get(h, 0.0) for h in all_hoods}

    top_neighborhoods = sorted(hood_data.items(), key=lambda x: x[1], reverse=True)[:5]

    neighborhoods = [
        {
            "name": name,
            "address": neighborhood_addresses.get(name, name),
            "revenue": round(rev, 2),
            "active_spots": neighborhood_active.get(name, 0),
            "total_transactions": neighborhood_total_tx.get(name, 0),
            "lat": neighborhood_coords.get(name, (None, None))[0],
            "lng": neighborhood_coords.get(name, (None, None))[1],
        }
        for name, rev in top_neighborhoods
    ]

    # ── Recent transactions (last 10) ───────────────────────────────────
    recent = []
    for res, spot, driver, leaver in rows[:10]:
        fee = round(spot.price * fee_pct, 2)
        recent.append({
            "date": res.created_at.strftime("%b %d, %H:%M"),
            "spot_id": _spot_label(spot.id),
            "spot_address": spot.address,
            "leaver": _fmt_name(leaver.full_name),
            "leaver_name": _fmt_name(leaver.full_name),
            "leaver_email": leaver.email,
            "driver": _fmt_name(driver.full_name),
            "driver_name": _fmt_name(driver.full_name),
            "driver_email": driver.email,
            "amount": round(spot.price, 2),
            "platform_fee": fee,
            "status": res.status.value,
            "created_at": res.created_at.strftime("%b %d, %H:%M"),
            "photo_url": spot.photo_url,
            "lat": spot.latitude,
            "lng": spot.longitude,
        })

    # ── Period label ────────────────────────────────────────────────────
    period_label = f"{thirty_days_ago.strftime('%b %d')} – {now.strftime('%b %d, %Y')}"

    return ok({
        "period_label": period_label,
        "total_revenue": round(all_revenue, 2),
        "revenue_change_pct": revenue_change,
        "revenue_daily": revenue_daily,
        "total_transactions": total_transactions,
        "transactions_change_pct": tx_change,
        "transactions_daily": tx_daily,
        "active_spots": active_spots,
        "spots_daily": spots_daily,
        "platform_fees_total": platform_fees_total,
        "platform_fees_current": platform_fees_current,
        "earnings_daily": earnings_daily,
        "earnings_labels": earnings_labels,
        "peak_day": peak_day_name,
        "peak_day_amount": peak_day_amount,
        "neighborhoods": neighborhoods,
        "recent_transactions": recent,
        "fee_pct": int(fee_pct * 100),
    })


@router.get("/users")
async def admin_users(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if q:
        search = f"%{q}%"
        condition = or_(
            User.full_name.ilike(search),
            User.email.ilike(search),
        )
        query = query.where(condition)
        count_query = count_query.where(condition)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(User.created_at.desc())
    query = query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    users = result.scalars().all()

    fee_pct = settings.PLATFORM_FEE_PERCENT
    user_list = []
    for user in users:
        # Count reservations as driver
        res_count_result = await db.execute(
            select(func.count()).select_from(Reservation).where(Reservation.driver_id == user.id)
        )
        total_reservations = res_count_result.scalar() or 0

        # Count spots as leaver
        spot_count_result = await db.execute(
            select(func.count()).select_from(Spot).where(Spot.leaver_id == user.id)
        )
        total_listings = spot_count_result.scalar() or 0

        user_list.append({
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "avg_rating": round(user.avg_rating, 2),
            "token_balance": user.token_balance,
            "is_admin": user.is_admin,
            "created_at": _fmt_date(user.created_at),
            "total_reservations": total_reservations,
            "total_listings": total_listings,
        })

    pages = math.ceil(total / per_page) if total > 0 else 1

    return ok({
        "users": user_list,
        "total": total,
        "page": page,
        "pages": pages,
    })


@router.get("/reservations")
async def admin_reservations(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    fee_pct = settings.PLATFORM_FEE_PERCENT

    Driver = aliased(User)
    Leaver = aliased(User)

    base_query = (
        select(Reservation, Spot, Driver, Leaver)
        .join(Spot, Reservation.spot_id == Spot.id)
        .join(Driver, Reservation.driver_id == Driver.id)
        .join(Leaver, Spot.leaver_id == Leaver.id)
    )

    conditions = []

    if status:
        try:
            status_enum = ReservationStatus(status.upper())
            conditions.append(Reservation.status == status_enum)
        except ValueError:
            pass

    if q:
        search = f"%{q}%"
        conditions.append(
            or_(
                Spot.address.ilike(search),
                Driver.full_name.ilike(search),
                Leaver.full_name.ilike(search),
            )
        )

    for cond in conditions:
        base_query = base_query.where(cond)

    # Count
    count_query = (
        select(func.count())
        .select_from(Reservation)
        .join(Spot, Reservation.spot_id == Spot.id)
        .join(Driver, Reservation.driver_id == Driver.id)
        .join(Leaver, Spot.leaver_id == Leaver.id)
    )
    for cond in conditions:
        count_query = count_query.where(cond)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    base_query = base_query.order_by(Reservation.created_at.desc())
    base_query = base_query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(base_query)
    rows = result.all()

    reservation_list = []
    for res, spot, driver, leaver in rows:
        reservation_list.append({
            "id": res.id,
            "status": res.status.value,
            "created_at": _fmt_date(res.created_at),
            "spot_address": spot.address,
            "spot_id": _spot_label(spot.id),
            "spot_raw_id": spot.id,
            "driver_name": _fmt_name(driver.full_name),
            "driver_email": driver.email,
            "leaver_name": _fmt_name(leaver.full_name),
            "leaver_email": leaver.email,
            "amount": round(spot.price, 2),
            "platform_fee": round(spot.price * fee_pct, 2),
            "photo_url": spot.photo_url,
            "lat": spot.latitude,
            "lng": spot.longitude,
        })

    pages = math.ceil(total / per_page) if total > 0 else 1

    return ok({
        "reservations": reservation_list,
        "total": total,
        "page": page,
        "pages": pages,
    })


@router.get("/spots")
async def admin_spots(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    LeaverAlias = aliased(User)

    base_query = (
        select(Spot, LeaverAlias)
        .join(LeaverAlias, Spot.leaver_id == LeaverAlias.id)
    )

    conditions = []

    if status:
        try:
            status_enum = SpotStatus(status.upper())
            conditions.append(Spot.status == status_enum)
        except ValueError:
            pass

    if q:
        conditions.append(or_(Spot.address.ilike(f"%{q}%"), Spot.id.ilike(f"%{q}%")))

    for cond in conditions:
        base_query = base_query.where(cond)

    count_query = (
        select(func.count())
        .select_from(Spot)
        .join(LeaverAlias, Spot.leaver_id == LeaverAlias.id)
    )
    for cond in conditions:
        count_query = count_query.where(cond)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    base_query = base_query.order_by(Spot.created_at.desc())
    base_query = base_query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(base_query)
    rows = result.all()

    spot_list = []
    for spot, leaver in rows:
        spot_list.append({
            "id": spot.id,
            "label": _spot_label(spot.id),
            "address": spot.address,
            "status": spot.status.value,
            "price": round(spot.price, 2),
            "leaver_name": _fmt_name(leaver.full_name),
            "leaver_email": leaver.email,
            "created_at": _fmt_date(spot.created_at),
            "leaving_in_minutes": spot.leaving_in_minutes,
            "photo_url": spot.photo_url,
            "lat": spot.latitude,
            "lng": spot.longitude,
        })

    pages = math.ceil(total / per_page) if total > 0 else 1

    return ok({
        "spots": spot_list,
        "total": total,
        "page": page,
        "pages": pages,
    })


@router.get("/transactions")
async def admin_transactions(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    fee_pct = settings.PLATFORM_FEE_PERCENT

    Driver = aliased(User)
    Leaver = aliased(User)

    base_query = (
        select(Reservation, Spot, Driver, Leaver)
        .join(Spot, Reservation.spot_id == Spot.id)
        .join(Driver, Reservation.driver_id == Driver.id)
        .join(Leaver, Spot.leaver_id == Leaver.id)
    )

    conditions = []

    if status:
        try:
            status_enum = ReservationStatus(status.upper())
            conditions.append(Reservation.status == status_enum)
        except ValueError:
            pass

    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            conditions.append(Reservation.created_at >= dt_from)
        except ValueError:
            pass

    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            dt_to = dt_to + timedelta(days=1)
            conditions.append(Reservation.created_at < dt_to)
        except ValueError:
            pass

    for cond in conditions:
        base_query = base_query.where(cond)

    count_query = (
        select(func.count())
        .select_from(Reservation)
        .join(Spot, Reservation.spot_id == Spot.id)
        .join(Driver, Reservation.driver_id == Driver.id)
        .join(Leaver, Spot.leaver_id == Leaver.id)
    )
    for cond in conditions:
        count_query = count_query.where(cond)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    base_query = base_query.order_by(Reservation.created_at.desc())
    base_query = base_query.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(base_query)
    rows = result.all()

    tx_list = []
    for res, spot, driver, leaver in rows:
        fee = round(spot.price * fee_pct, 2)
        tx_list.append({
            "id": res.id,
            "date": res.created_at.strftime("%b %d, %H:%M"),
            "created_at": _fmt_date(res.created_at),
            "status": res.status.value,
            "spot_id": _spot_label(spot.id),
            "spot_address": spot.address,
            "leaver": _fmt_name(leaver.full_name),
            "driver": _fmt_name(driver.full_name),
            "amount": round(spot.price, 2),
            "platform_fee": fee,
            "driver_email": driver.email,
            "leaver_email": leaver.email,
            "driver_name": _fmt_name(driver.full_name),
            "leaver_name": _fmt_name(leaver.full_name),
            "photo_url": spot.photo_url,
            "lat": spot.latitude,
            "lng": spot.longitude,
        })

    pages = math.ceil(total / per_page) if total > 0 else 1

    return ok({
        "transactions": tx_list,
        "total": total,
        "page": page,
        "pages": pages,
    })


@router.get("/search")
async def admin_search(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    search = f"%{q}%"

    # Search users
    user_result = await db.execute(
        select(User)
        .where(or_(User.full_name.ilike(search), User.email.ilike(search)))
        .limit(5)
    )
    users = user_result.scalars().all()
    user_list = [
        {"id": u.id, "full_name": u.full_name, "email": u.email, "is_admin": u.is_admin}
        for u in users
    ]

    # Search spots by address or spot ID
    spot_result = await db.execute(
        select(Spot)
        .where(or_(Spot.address.ilike(search), Spot.id.ilike(search)))
        .limit(5)
    )
    spots = spot_result.scalars().all()
    spot_list = []
    for s in spots:
        leaver = await db.get(User, s.leaver_id) if s.leaver_id else None
        spot_list.append({
            "id": s.id, "label": _spot_label(s.id),
            "address": s.address, "status": s.status.value,
            "price": round(s.price, 2),
            "lat": s.latitude, "lng": s.longitude,
            "photo_url": s.photo_url,
            "leaver_name": _fmt_name(leaver.full_name) if leaver else "—",
            "leaver_email": leaver.email if leaver else "—",
            "leaving_in_minutes": s.leaving_in_minutes,
            "created_at": _fmt_date(s.created_at),
        })

    # Search reservations by spot address
    Driver = aliased(User)
    Leaver = aliased(User)
    res_result = await db.execute(
        select(Reservation, Spot, Driver, Leaver)
        .join(Spot, Reservation.spot_id == Spot.id)
        .join(Driver, Reservation.driver_id == Driver.id)
        .join(Leaver, Spot.leaver_id == Leaver.id)
        .where(or_(Spot.address.ilike(search), Spot.id.ilike(search)))
        .limit(5)
    )
    res_rows = res_result.all()
    reservation_list = [
        {
            "id": res.id,
            "status": res.status.value,
            "spot_address": spot.address,
            "spot_id": _spot_label(spot.id),
            "spot_raw_id": spot.id,
            "driver_name": _fmt_name(driver.full_name),
            "driver_email": driver.email,
            "leaver_name": _fmt_name(leaver.full_name),
            "leaver_email": leaver.email,
            "lat": spot.latitude, "lng": spot.longitude,
            "photo_url": spot.photo_url,
            "amount": round(spot.price, 2),
            "platform_fee": round(spot.price * settings.PLATFORM_FEE_PERCENT, 2),
            "created_at": _fmt_date(res.created_at),
        }
        for res, spot, driver, leaver in res_rows
    ]

    return ok({
        "users": user_list,
        "spots": spot_list,
        "reservations": reservation_list,
    })


@router.get("/heatmap")
async def admin_heatmap(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Returns all spot coordinates with weights for heatmap rendering.
    Weight is based on total reservations for that spot (min 1).
    """
    # Get all spots with coordinates
    spots_result = await db.execute(select(Spot))
    all_spots = spots_result.scalars().all()

    # Count reservations per spot
    res_result = await db.execute(
        select(Reservation.spot_id, func.count(Reservation.id).label("cnt"))
        .group_by(Reservation.spot_id)
    )
    reservation_counts = {row.spot_id: row.cnt for row in res_result.all()}

    points = []
    for spot in all_spots:
        weight = reservation_counts.get(spot.id, 0) + 1  # min weight 1
        points.append({
            "lat": spot.latitude,
            "lng": spot.longitude,
            "weight": weight,
            "address": spot.address,
        })

    return ok({"points": points})


async def admin_user_detail(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Reservations as driver
    driver_res = await db.execute(
        select(Reservation).where(Reservation.driver_id == user_id).order_by(Reservation.created_at.desc())
    )
    driver_reservations = driver_res.scalars().all()

    # Reservations as leaver (via spots)
    leaver_spots_res = await db.execute(select(Spot).where(Spot.leaver_id == user_id))
    leaver_spots = {s.id: s for s in leaver_spots_res.scalars().all()}
    leaver_res = await db.execute(
        select(Reservation).where(Reservation.spot_id.in_(leaver_spots.keys())).order_by(Reservation.created_at.desc())
    )
    leaver_reservations = leaver_res.scalars().all()

    async def fmt_res(res, role):
        spot = await db.get(Spot, res.spot_id)
        other_id = spot.leaver_id if role == "driver" else res.driver_id
        other = await db.get(User, other_id) if other_id else None
        return {
            "id": res.id,
            "role": role,
            "status": res.status.value if hasattr(res.status, "value") else str(res.status),
            "spot_address": spot.address if spot else "—",
            "other_name": other.full_name if other else "—",
            "created_at": _fmt_date(res.created_at),
        }

    reservations = []
    for r in driver_reservations:
        reservations.append(await fmt_res(r, "driver"))
    for r in leaver_reservations:
        reservations.append(await fmt_res(r, "leaver"))
    reservations.sort(key=lambda x: x["created_at"], reverse=True)

    return ok({
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "avg_rating": round(user.avg_rating, 2),
        "token_balance": user.token_balance,
        "car_make": user.car_make,
        "car_model": user.car_model,
        "profile_photo_url": user.profile_photo_url,
        "is_admin": user.is_admin,
        "created_at": _fmt_date(user.created_at),
        "reservations": reservations,
    })


@router.get("/users/{user_id}")
async def _admin_user_detail_route(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return await admin_user_detail(user_id, db, admin)


@router.post("/users/{user_id}/adjust-tokens")
async def adjust_tokens(
    user_id: str,
    amount: int,
    reason: str = "",
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Add or subtract tokens from a user. amount can be negative."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    before = user.token_balance
    user.token_balance = max(0, user.token_balance + amount)
    await db.commit()
    return ok({
        "user_id": user_id,
        "before": before,
        "after": user.token_balance,
        "delta": amount,
        "reason": reason,
    })


@router.post("/make-admin")
async def make_admin(
    email: str,
    secret: str,
    db: AsyncSession = Depends(get_db),
):
    """Bootstrap: set a user as admin. Requires ADMIN_BOOTSTRAP_SECRET env var."""
    import os
    bootstrap_secret = os.getenv("ADMIN_BOOTSTRAP_SECRET", "")
    if not bootstrap_secret or secret != bootstrap_secret:
        raise HTTPException(status_code=403, detail="Invalid secret")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = True
    await db.commit()
    return ok({"message": f"{email} is now an admin"})
