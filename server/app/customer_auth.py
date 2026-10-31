"""Customer authentication and lead scoping."""
from datetime import datetime, timedelta, timezone
from fastapi import Depends, Request, Response
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import ApiError
from app.models import CustomerAccount, Lead

COOKIE_NAME = "customer_token"
TOKEN_HOURS = 8
COOKIE_CONFIG = dict(key=COOKIE_NAME, httponly=True, samesite="lax", secure=False, max_age=TOKEN_HOURS * 3600)


def customer_secret() -> str:
    return settings.jwt_secret + ":customer"


def make_customer_token(account: CustomerAccount) -> str:
    payload = {
        "sub": str(account.id),
        "kind": "customer",
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, customer_secret(), algorithm="HS256")


def set_customer_cookie(response: Response, token: str) -> None:
    response.set_cookie(**COOKIE_CONFIG, value=token)


def clear_customer_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, httponly=True, samesite="lax", secure=False)


def get_current_customer(request: Request, db: Session = Depends(get_db)) -> CustomerAccount:
    """Read and authenticate customer_token cookie. Reject staff tokens or missing cookies."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise ApiError(401, "Please log in")

    try:
        payload = jwt.decode(token, customer_secret(), algorithms=["HS256"])
        if payload.get("kind") != "customer":
            raise ApiError(401, "Invalid session type")
        account_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise ApiError(401, "Session expired, please log in again")

    account = db.get(CustomerAccount, account_id)
    if not account:
        raise ApiError(401, "Account not found, please log in again")

    return account


def customer_lead_ids(db: Session, account: CustomerAccount) -> list[int]:
    """All lead IDs associated with this customer's phone number."""
    leads = db.scalars(select(Lead.id).where(Lead.phone == account.phone)).all()
    return list(leads)

