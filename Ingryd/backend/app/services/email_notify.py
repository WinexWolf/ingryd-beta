import os
import httpx

RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
ADMIN_NOTIFICATION_EMAIL = os.environ.get("ADMIN_NOTIFICATION_EMAIL")

# Resend requires the "from" address to be on a domain you've verified in
# their dashboard. Their sandbox address (onboarding@resend.dev) works
# without verification but is rate-limited and meant for testing only —
# swap this for your own verified domain address before relying on it.
FROM_ADDRESS = os.environ.get("RESEND_FROM_ADDRESS", "onboarding@resend.dev")


async def send_review_notification(product_name: str | None, brand: str | None, ingredient_count: int) -> bool:
    """Best-effort — never raises. A failed notification should never break
    the actual submission, which already succeeded (in Supabase) by the
    time this is called. Returns whether the email actually sent, so the
    caller can be honest about it rather than always claiming success."""
    if not RESEND_API_KEY or not ADMIN_NOTIFICATION_EMAIL:
        return False

    subject = f"New product submitted for review: {product_name or 'Unnamed'}"
    html = f"""
    <p>A new product was submitted for catalog review.</p>
    <ul>
      <li><strong>Name:</strong> {product_name or 'Not given'}</li>
      <li><strong>Brand:</strong> {brand or 'Not given'}</li>
      <li><strong>Ingredients:</strong> {ingredient_count}</li>
    </ul>
    <p>Review it at your app's /admin/review page.</p>
    """

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": FROM_ADDRESS,
                    "to": ADMIN_NOTIFICATION_EMAIL,
                    "subject": subject,
                    "html": html,
                },
            )
            return response.status_code < 300
    except Exception as e:
        print(f"[email_notify] Failed to send review notification (non-fatal): {e}")
        return False
