import json
import random
import string
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as aioredis
from app.core.database import get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin, TokenRefresh, UserOut, TokenResponse
from app.schemas.common import ok, err
from app.services.email_service import send_otp_email
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])

OTP_TTL = 600  # 10 minutes
OTP_PREFIX = "otp:"


def _redis() -> aioredis.Redis:
    return aioredis.from_url(settings.REDIS_URL, decode_responses=True)


def _gen_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


# ── Two-step registration ──────────────────────────────────────────────

@router.post("/register/initiate")
async def register_initiate(body: UserRegister, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Step 1: validate fields, send OTP email, store pending registration in Redis."""
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    otp = _gen_otp()
    pending = {
        "email": body.email,
        "hashed_password": hash_password(body.password),
        "full_name": body.full_name,
        "otp": otp,
    }
    try:
        r = _redis()
        await r.set(f"{OTP_PREFIX}{body.email}", json.dumps(pending), ex=OTP_TTL)
        await r.aclose()
    except Exception as e:
        print(f"[redis] failed to store OTP: {e}")
        raise HTTPException(status_code=503, detail=f"Registration unavailable (Redis error): {e}")

    async def _send():
        try:
            await send_otp_email(body.email, otp, body.full_name)
        except Exception as e:
            print(f"[email] failed to send OTP: {e}")
            print(f"[DEV] OTP for {body.email}: {otp}")

    background_tasks.add_task(_send)
    return ok({"message": "OTP sent", "email": body.email})


@router.post("/register/verify")
async def register_verify(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Step 2: verify OTP, create account, return tokens."""
    email = body.get("email", "").strip().lower()
    otp = body.get("otp", "").strip()

    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and OTP required")

    r = _redis()
    raw = await r.get(f"{OTP_PREFIX}{email}")
    if not raw:
        raise HTTPException(status_code=400, detail="OTP expired or not found. Please restart sign-up.")

    pending = json.loads(raw)
    if pending["otp"] != otp:
        raise HTTPException(status_code=400, detail="Incorrect verification code")

    # Double-check email not taken in the meantime
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        await r.delete(f"{OTP_PREFIX}{email}")
        await r.aclose()
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        id=str(uuid.uuid4()),
        email=pending["email"],
        hashed_password=pending["hashed_password"],
        full_name=pending["full_name"],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await r.delete(f"{OTP_PREFIX}{email}")
    await r.aclose()

    return ok({
        "access_token": create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer",
        "user": UserOut.model_validate(user).model_dump(),
    })


# ── Login ──────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return ok({
        "access_token": create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer",
        "user": UserOut.model_validate(user).model_dump(),
    })


@router.post("/refresh")
async def refresh(body: TokenRefresh, db: AsyncSession = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await db.get(User, payload["sub"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return ok({"access_token": create_access_token(user.id)})
