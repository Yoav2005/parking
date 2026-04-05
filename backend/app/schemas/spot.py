from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator
from app.models.spot import SpotStatus


class SpotCreate(BaseModel):
    latitude: float
    longitude: float
    address: str
    price: float
    leaving_in_minutes: int
    photo_url: Optional[str] = None

    @field_validator("price")
    @classmethod
    def price_minimum(cls, v: float) -> float:
        if v < 1.0:
            raise ValueError("Price must be at least $1.00")
        return v

    @field_validator("leaving_in_minutes")
    @classmethod
    def leaving_valid(cls, v: int) -> int:
        if v not in (0, 5, 10, 15):
            raise ValueError("leaving_in_minutes must be 0, 5, 10, or 15")
        return v


class SpotOut(BaseModel):
    id: str
    leaver_id: str
    latitude: float
    longitude: float
    address: str
    price: float
    status: SpotStatus
    leaving_in_minutes: int
    photo_url: Optional[str] = None
    created_at: datetime
    reserved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    expires_at: datetime
    distance_km: Optional[float] = None
    leaver_avg_rating: Optional[float] = None
    leaver_name: Optional[str] = None
    active_reservation_id: Optional[str] = None
    driver_name: Optional[str] = None
    driver_car_make: Optional[str] = None
    driver_car_model: Optional[str] = None

    model_config = {"from_attributes": True}
