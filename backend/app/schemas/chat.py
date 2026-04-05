from datetime import datetime
from pydantic import BaseModel


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageOut(BaseModel):
    id: str
    reservation_id: str
    sender_id: str
    sender_name: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
