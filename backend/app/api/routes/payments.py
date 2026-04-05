from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.common import ok
from app.services.payment_service import create_connect_account, get_connect_account, create_account_link

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/create-connect-account")
async def create_connect(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.stripe_account_id:
        raise HTTPException(status_code=400, detail="Stripe Connect account already exists")
    try:
        account = await create_connect_account(current_user.email)
        current_user.stripe_account_id = account.id
        await db.commit()
        onboarding_url = await create_account_link(
            account.id,
            refresh_url="parkpass://payments/refresh",
            return_url="parkpass://payments/return",
        )
        return ok({"account_id": account.id, "onboarding_url": onboarding_url})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/connect-status")
async def connect_status(
    current_user: User = Depends(get_current_user),
):
    if not current_user.stripe_account_id:
        return ok({"connected": False, "account_id": None, "charges_enabled": False})
    try:
        account = await get_connect_account(current_user.stripe_account_id)
        return ok({
            "connected": True,
            "account_id": account.id,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
