from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.reservation import ReservationStatus


class ReservationCreate(BaseModel):
    spot_id: str


class ReservationOut(BaseModel):
    id: str
    spot_id: str
    driver_id: str
    stripe_payment_intent_id: str
    status: ReservationStatus
    created_at: datetime
    arrival_confirmed_at: Optional[datetime] = None
    auto_cancel_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReservationWithSecret(BaseModel):
    reservation: ReservationOut
    client_secret: str
