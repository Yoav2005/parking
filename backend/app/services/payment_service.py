import stripe
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


async def create_payment_intent(
    amount_usd: float,
    leaver_stripe_account_id: str | None,
    idempotency_key: str,
) -> stripe.PaymentIntent:
    amount_cents = int(amount_usd * 100)
    application_fee = int(amount_cents * settings.PLATFORM_FEE_PERCENT)

    kwargs: dict = {
        "amount": amount_cents,
        "currency": "usd",
        "payment_method_types": ["card"],
        "metadata": {"platform": "parkpass"},
    }
    if leaver_stripe_account_id:
        kwargs["transfer_data"] = {"destination": leaver_stripe_account_id}
        kwargs["application_fee_amount"] = application_fee

    return stripe.PaymentIntent.create(**kwargs, idempotency_key=idempotency_key)


async def refund_payment_intent(payment_intent_id: str) -> stripe.Refund:
    return stripe.Refund.create(payment_intent=payment_intent_id)


async def create_connect_account(email: str) -> stripe.Account:
    return stripe.Account.create(
        type="express",
        email=email,
        capabilities={"transfers": {"requested": True}},
    )


async def get_connect_account(account_id: str) -> stripe.Account:
    return stripe.Account.retrieve(account_id)


async def create_account_link(account_id: str, refresh_url: str, return_url: str) -> str:
    link = stripe.AccountLink.create(
        account=account_id,
        refresh_url=refresh_url,
        return_url=return_url,
        type="account_onboarding",
    )
    return link.url
