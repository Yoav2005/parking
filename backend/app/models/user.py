import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Float, DateTime, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    full_name: Mapped[str] = mapped_column(String, nullable=False)
    stripe_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    avg_rating: Mapped[float] = mapped_column(Float, default=0.0)
    token_balance: Mapped[int] = mapped_column(Integer, default=100)
    car_make: Mapped[str | None] = mapped_column(String, nullable=True)
    car_model: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    spots = relationship("Spot", back_populates="leaver", foreign_keys="Spot.leaver_id")
    reservations = relationship("Reservation", back_populates="driver", foreign_keys="Reservation.driver_id")
    ratings_given = relationship("Rating", back_populates="rater", foreign_keys="Rating.rater_id")
    ratings_received = relationship("Rating", back_populates="rated", foreign_keys="Rating.rated_id")
