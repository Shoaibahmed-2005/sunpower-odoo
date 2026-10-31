"""OTP service for customer phone authentication."""
from datetime import datetime, timedelta, timezone
import hashlib
import logging
import secrets
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import ApiError
from app.models import CustomerOTP

logger = logging.getLogger(__name__)


def to_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def hash_code(phone: str, code: str) -> str:
    salt = f"{phone}:{code}:{settings.jwt_secret}"
    return hashlib.sha256(salt.encode("utf-8")).hexdigest()


def deliver(phone: str, code: str) -> str | None:
    """The ONLY function to swap for an SMS provider."""
    masked = f"******{phone[-4:]}" if len(phone) >= 4 else phone
    if settings.otp_demo:
        msg = f"[SMS demo] OTP for {masked}: {code}"
        print(msg)
        logger.info(msg)
        return code
    return None


def send_otp(db: Session, phone: str, purpose: str = "signup") -> dict:
    now = datetime.now(timezone.utc)
    ten_min_ago = now - timedelta(minutes=10)
    thirty_sec_ago = now - timedelta(seconds=30)

    # Rate limits: 1 request per 30 s and 3 per 10 min for each phone (stops SMS flooding / guessing)
    recent = db.scalars(
        select(CustomerOTP.created_at).where(CustomerOTP.phone == phone).order_by(desc(CustomerOTP.created_at))
    ).first()
    if recent and to_utc(recent) >= thirty_sec_ago:
        raise ApiError(429, "Please wait 30 seconds before requesting another code")

    count_10m = db.scalar(
        select(func.count(CustomerOTP.id)).where(CustomerOTP.phone == phone, CustomerOTP.created_at >= ten_min_ago)
    )
    if count_10m >= 3:
        raise ApiError(429, "Too many OTP requests. Please wait 10 minutes")

    code = f"{secrets.randbelow(1_000_000):06d}"
    code_h = hash_code(phone, code)

    otp_record = CustomerOTP(
        phone=phone,
        code_hash=code_h,
        purpose=purpose,
        expires_at=now + timedelta(minutes=5),
        attempts=0,
        used_at=None,
    )
    db.add(otp_record)
    db.commit()

    demo_code = deliver(phone, code)
    return {"sent": True, "demo_code": demo_code}


def verify_otp(db: Session, phone: str, purpose: str, code: str) -> bool:
    now = datetime.now(timezone.utc)
    stmt = (
        select(CustomerOTP)
        .where(
            CustomerOTP.phone == phone,
            CustomerOTP.purpose == purpose,
            CustomerOTP.used_at.is_(None),
        )
        .order_by(desc(CustomerOTP.id))
        .limit(1)
        .with_for_update()
    )
    otp_record = db.execute(stmt).scalar_one_or_none()
    if not otp_record or to_utc(otp_record.expires_at) < now:
        raise ApiError(401, "Invalid or expired code")

    if otp_record.attempts >= 5:
        raise ApiError(429, "Too many failed attempts. Code burned, please request a new one")

    expected_hash = hash_code(phone, code.strip())
    if otp_record.code_hash != expected_hash:
        otp_record.attempts += 1
        db.commit()
        if otp_record.attempts >= 5:
            raise ApiError(429, "Too many failed attempts. Code burned, please request a new one")
        raise ApiError(401, "Invalid or expired code")

    otp_record.used_at = now
    db.commit()
    return True
