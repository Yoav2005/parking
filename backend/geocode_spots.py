"""
One-time script: reverse-geocode all spots whose address looks like coordinates.
Run inside the app container: python geocode_spots.py
"""
import asyncio
import re
import httpx
from sqlalchemy import create_engine, text

DB_URL = "postgresql+psycopg2://parkpass:parkpass@db:5432/parkpass"
COORD_RE = re.compile(r'^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$')

engine = create_engine(DB_URL)

async def reverse_geocode(client: httpx.AsyncClient, lat: float, lng: float) -> str:
    try:
        r = await client.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lng, "format": "json"},
            headers={"Accept-Language": "en", "User-Agent": "ParkPass-Admin/1.0"},
            timeout=10,
        )
        r.raise_for_status()
        j = r.json()
        a = j.get("address", {})
        parts = [
            a.get("road") or a.get("pedestrian") or a.get("footway"),
            a.get("city") or a.get("town") or a.get("village") or a.get("suburb"),
        ]
        parts = [p for p in parts if p]
        return ", ".join(parts) if parts else j.get("display_name", f"{lat:.4f}, {lng:.4f}")
    except Exception as e:
        print(f"  Geocode failed for {lat},{lng}: {e}")
        return f"{lat:.4f}, {lng:.4f}"

async def main():
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, address, latitude, longitude FROM spots")).fetchall()

    to_update = [(row.id, row.latitude, row.longitude) for row in rows if COORD_RE.match(row.address.strip())]
    print(f"Found {len(to_update)} spots to geocode...")

    async with httpx.AsyncClient() as client:
        for i, (spot_id, lat, lng) in enumerate(to_update):
            address = await reverse_geocode(client, lat, lng)
            with engine.connect() as conn:
                conn.execute(text("UPDATE spots SET address = :addr WHERE id = :id"), {"addr": address, "id": spot_id})
                conn.commit()
            print(f"  [{i+1}/{len(to_update)}] {lat:.4f},{lng:.4f} → {address}")
            await asyncio.sleep(1.1)  # Nominatim rate limit: 1 req/sec

    print("Done.")

asyncio.run(main())
