from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.schemas.common import ok

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return ok(UserOut.model_validate(current_user).model_dump())


@router.patch("/me")
async def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.full_name is not None:
        current_user.full_name = body.full_name
    if body.car_make is not None:
        current_user.car_make = body.car_make
    if body.car_model is not None:
        current_user.car_model = body.car_model
    if body.profile_photo_url is not None:
        current_user.profile_photo_url = body.profile_photo_url
    await db.commit()
    await db.refresh(current_user)
    return ok(UserOut.model_validate(current_user).model_dump())
