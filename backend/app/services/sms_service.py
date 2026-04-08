from twilio.rest import Client
from app.core.config import settings


def send_otp_sms(phone: str, otp: str) -> None:
    """Send OTP via Twilio SMS. Raises on failure."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_FROM_NUMBER:
        raise RuntimeError("Twilio credentials not configured")

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    client.messages.create(
        body=f"Your ParkPass verification code is: {otp}",
        from_=settings.TWILIO_FROM_NUMBER,
        to=phone,
    )
