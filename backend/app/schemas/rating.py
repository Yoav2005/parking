from datetime import datetime
from pydantic import BaseModel, field_validator


class RatingCreate(BaseModel):
    reservation_id: str
    rated_id: str
    score: int

    @field_validator("score")
    @classmethod
    def score_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Score must be between 1 and 5")
        return v


class RatingOut(BaseModel):
    id: str
    reservation_id: str
    rater_id: str
    rated_id: str
    score: int
    created_at: datetime

    model_config = {"from_attributes": True}
