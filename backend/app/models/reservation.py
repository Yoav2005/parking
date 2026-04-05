import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class ReservationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REFUNDED = "REFUNDED"


class Reservation(Base):
    __tablename__ = "reservations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    spot_id: Mapped[str] = mapped_column(String, ForeignKey("spots.id"), nullable=False, index=True)
    driver_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)
    stripe_payment_intent_id: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[ReservationStatus] = mapped_column(
        SAEnum(ReservationStatus), default=ReservationStatus.PENDING
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    arrival_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_cancel_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    spot = relationship("Spot", back_populates="reservations")
    driver = relationship("User", back_populates="reservations", foreign_keys=[driver_id])
    ratings = relationship("Rating", back_populates="reservation")
