"""Authentication and permission helpers. Owner: B (contracts from §4 and §6)."""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.errors import ApiError
from app.models import Role, User

COOKIE = dict(key="token", httponly=True, samesite="lax", secure=False, max_age=7 * 24 * 3600)

SHARED_ACCESS_FILE = Path(__file__).resolve().parent.parent.parent / "shared" / "access.json"

ACCESS_CACHE: dict[str, list[str]] | None = None


def load_access_map() -> dict[str, list[str]]:
    global ACCESS_CACHE
    if ACCESS_CACHE is not None:
        return ACCESS_CACHE
    if SHARED_ACCESS_FILE.exists():
        ACCESS_CACHE = json.loads(SHARED_ACCESS_FILE.read_text())
        return ACCESS_CACHE
    # Fallback to defaults
    ACCESS_CACHE = {
        "DIRECTOR": ["*"],
        "SALES": [
            "dashboard:read", "leads:read", "leads:write", "surveys:read", "surveys:approve",
            "quotes:read", "quotes:write", "invoices:read", "invoices:write",
            "packages:read", "stock:read", "jobs:read", "users:read",
        ],
        "TECHNICIAN": ["jobs:mine", "surveys:read", "surveys:submit"],
        "WAREHOUSE": [
            "dashboard:read", "stock:read", "stock:write", "dispatches:read", "dispatches:write",
            "serials:read", "products:read", "packages:read", "jobs:read",
        ],
        "SUPPORT": [
            "dashboard:read", "tickets:read", "tickets:write", "serials:read", "jobs:read",
            "invoices:read", "users:read",
        ],
    }
    return ACCESS_CACHE


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def make_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
        "exp": now + timedelta(days=7),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("token")
    if not token:
        # Check Authorization header as fallback if present
        auth_hdr = request.headers.get("Authorization")
        if auth_hdr and auth_hdr.startswith("Bearer "):
            token = auth_hdr.split(" ", 1)[1]

    if not token:
        raise ApiError(401, "Not authenticated")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id = int(payload.get("sub"))
    except Exception:
        raise ApiError(401, "Invalid or expired session")

    user = db.get(User, user_id)
    if not user or not user.active:
        raise ApiError(401, "User not found or inactive")

    # Member A's requirement: commit read to prevent transaction locking issues
    db.commit()
    return user


def require_perm(perm: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        access = load_access_map()
        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
        perms = access.get(role_str, [])
        if "*" in perms or perm in perms:
            return user
        raise ApiError(403, f"Missing permission: {perm}")

    return dependency
