import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings


async def send_otp_email(to_email: str, otp: str, full_name: str) -> None:
    """Send a 6-digit OTP verification email."""
    if not settings.SMTP_USER or not settings.SMTP_PASS:
        # Dev mode: just print OTP to console
        print(f"[DEV] OTP for {to_email}: {otp}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{otp} is your ParkPass verification code"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <div style="background:#1E3DB8;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="color:#fff;font-size:32px;font-weight:900">P</span>
        <span style="color:#fff;font-size:20px;font-weight:800;margin-left:8px">ParkPass</span>
      </div>
      <h2 style="color:#111827;margin:0 0 8px">Verify your email</h2>
      <p style="color:#6B7280;margin:0 0 24px">Hi {full_name}, use the code below to complete your sign-up.</p>
      <div style="background:#F3F4F6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#1E3DB8">{otp}</span>
      </div>
      <p style="color:#9CA3AF;font-size:13px">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>
    """
    msg.attach(MIMEText(html, "html"))

    await aiosmtplib.send(
        msg,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASS,
        start_tls=True,
    )
