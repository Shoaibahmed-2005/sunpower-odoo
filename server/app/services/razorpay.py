"""Razorpay (test mode) helpers: create an order and check a payment signature.

Uses only the standard library, so no new dependency. Keys come from server/.env.
"""
import base64
import hashlib
import hmac
import json
import urllib.error
import urllib.request

from app.config import settings

ORDERS_URL = "https://api.razorpay.com/v1/orders"


class RazorpayError(Exception):
    """Razorpay could not be reached or refused the request."""


def razorpay_enabled() -> bool:
    return bool(settings.razorpay_key_id and settings.razorpay_key_secret)


def create_razorpay_order(amount_paise: int, receipt: str, notes: dict) -> dict:
    """POST /v1/orders with HTTP basic auth (key id : secret). Returns Razorpay's order JSON."""
    body = json.dumps({"amount": amount_paise, "currency": "INR", "receipt": receipt[:40], "notes": notes}).encode()
    auth = base64.b64encode(f"{settings.razorpay_key_id}:{settings.razorpay_key_secret}".encode()).decode()
    request = urllib.request.Request(
        ORDERS_URL, data=body, method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Basic {auth}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as res:
            return json.loads(res.read())
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise RazorpayError(str(exc)) from exc


def signature_valid(order_id: str, payment_id: str, signature: str) -> bool:
    """Razorpay signs "order_id|payment_id" with our key secret (HMAC-SHA256). Only Razorpay and we know the secret."""
    expected = hmac.new(
        settings.razorpay_key_secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)  # constant-time compare
