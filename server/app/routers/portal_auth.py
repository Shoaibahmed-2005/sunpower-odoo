"""Customer portal authentication router (/api/portal/auth)."""
from datetime import datetime, timedelta, timezone
import re
from fastapi import APIRouter, Depends, Response
from typing import Annotated
from pydantic import AfterValidator, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import DUMMY_HASH, hash_password, verify_password
from app.customer_auth import (
    clear_customer_cookie,
    get_current_customer,
    make_customer_token,
    set_customer_cookie,
)
from app.db import get_db
from app.errors import ApiError
from app.models import CustomerAccount
from app.schemas.base import ApiModel
from app.services.otp import send_otp, to_utc, verify_otp

router = APIRouter(prefix="/api/portal/auth", tags=["portal-auth"])

# One definition of a valid phone / password, reused by every request model below.
PHONE_REGEX = re.compile(r"^[6-9]\d{9}$")


def _check_phone(v: str) -> str:
    v = v.strip()
    if not PHONE_REGEX.match(v):
        raise ValueError("Enter a valid 10-digit mobile number")
    return v


def _check_code(v: str) -> str:
    v = v.strip()
    if not (len(v) == 6 and v.isdigit()):
        raise ValueError("Enter the 6-digit code")
    return v


Phone = Annotated[str, AfterValidator(_check_phone)]
OtpCode = Annotated[str, AfterValidator(_check_code)]
PASSWORD_REGEX = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,72}$")


def _check_password(v: str) -> str:
    if not PASSWORD_REGEX.match(v):
        raise ValueError("Password must be 8-72 characters and contain at least 1 letter and 1 digit")
    return v


class PhoneRequest(ApiModel):
    phone: Phone


class SignupVerifyRequest(ApiModel):
    phone: Phone
    code: OtpCode
    name: str = Field(..., min_length=2, max_length=100)
    password: str

    _password = field_validator("password")(_check_password)


class LoginRequest(ApiModel):
    phone: Phone
    password: str = Field(..., min_length=1, max_length=72)


class ResetPasswordRequest(ApiModel):
    phone: Phone
    code: OtpCode
    new_password: str

    _password = field_validator("new_password")(_check_password)


@router.post("/signup/start")
def signup_start(req: PhoneRequest, db: Session = Depends(get_db)):
    """Start signup by sending an OTP to the customer's phone."""
    existing = db.scalars(select(CustomerAccount).where(CustomerAccount.phone == req.phone)).first()
    if existing:
        raise ApiError(409, "An account already exists for this phone number")

    res = send_otp(db, req.phone, purpose="signup")
    return res


@router.post("/signup/verify")
def signup_verify(req: SignupVerifyRequest, response: Response, db: Session = Depends(get_db)):
    """Verify OTP and complete customer registration."""
    verify_otp(db, req.phone, purpose="signup", code=req.code)

    existing = db.scalars(select(CustomerAccount).where(CustomerAccount.phone == req.phone)).first()
    if existing:
        raise ApiError(409, "Account already exists")

    account = CustomerAccount(
        phone=req.phone,
        name=req.name.strip(),
        password_hash=hash_password(req.password),
    )
    db.add(account)
    try:
        db.commit()
        db.refresh(account)
    except IntegrityError:
        db.rollback()
        raise ApiError(409, "Account already exists")

    token = make_customer_token(account)
    set_customer_cookie(response, token)
    return {
        "account": {
            "id": account.id,
            "phone": account.phone,
            "name": account.name,
        }
    }


@router.post("/login")
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Log in customer with phone + password. Locks for 15 min after 5 failed attempts."""
    now = datetime.now(timezone.utc)
    account = db.scalars(
        select(CustomerAccount).where(CustomerAccount.phone == req.phone).with_for_update()
    ).first()

    if account and account.locked_until:
        locked_at = to_utc(account.locked_until)
        if locked_at > now:
            mins_left = max(1, int((locked_at - now).total_seconds() / 60))
            raise ApiError(423, f"Account locked due to too many failed attempts. Try again in {mins_left} minutes")
        else:
            account.locked_until = None
            account.failed_attempts = 0

    if not account:
        verify_password(req.password, DUMMY_HASH)
        raise ApiError(401, "Phone or password is incorrect")

    if not verify_password(req.password, account.password_hash):
        account.failed_attempts += 1
        if account.failed_attempts >= 5:
            account.locked_until = now + timedelta(minutes=15)
            account.failed_attempts = 0
            db.commit()
            raise ApiError(423, "Account locked due to too many failed attempts. Try again in 15 minutes")
        db.commit()
        raise ApiError(401, "Phone or password is incorrect")

    account.failed_attempts = 0
    account.locked_until = None
    db.commit()

    token = make_customer_token(account)
    set_customer_cookie(response, token)
    return {
        "account": {
            "id": account.id,
            "phone": account.phone,
            "name": account.name,
        }
    }


@router.post("/password/forgot")
def password_forgot(req: PhoneRequest, db: Session = Depends(get_db)):
    """Request OTP to reset password. Always returns {sent: true}."""
    account = db.scalars(select(CustomerAccount).where(CustomerAccount.phone == req.phone)).first()
    demo_code = None
    if account:
        res = send_otp(db, req.phone, purpose="forgot")
        demo_code = res.get("demo_code")

    return {"sent": True, "demo_code": demo_code}


@router.post("/password/reset")
def password_reset(req: ResetPasswordRequest, response: Response, db: Session = Depends(get_db)):
    """Verify OTP and set a new password."""
    verify_otp(db, req.phone, purpose="forgot", code=req.code)

    account = db.scalars(
        select(CustomerAccount).where(CustomerAccount.phone == req.phone).with_for_update()
    ).first()
    if not account:
        raise ApiError(404, "Account not found")

    account.password_hash = hash_password(req.new_password)
    account.failed_attempts = 0
    account.locked_until = None
    db.commit()

    token = make_customer_token(account)
    set_customer_cookie(response, token)
    return {"success": True}


@router.post("/logout")
def logout(response: Response):
    """Log out customer and clear customer cookie."""
    clear_customer_cookie(response)
    return Response(status_code=204)


@router.get("/me")
def me(account: CustomerAccount = Depends(get_current_customer)):
    """Return the authenticated customer profile."""
    phone_masked = f"{account.phone[:2]}******{account.phone[-2:]}" if len(account.phone) >= 4 else account.phone
    return {
        "account": {
            "id": account.id,
            "phone": account.phone,
            "phoneMasked": phone_masked,
            "name": account.name,
        }
    }
