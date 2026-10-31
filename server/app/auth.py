"""Authentication and permissions.

- Passwords are stored only as bcrypt hashes.
- Login puts a signed JWT in an httpOnly cookie named "token" (JavaScript can never read it).
- get_current_user turns that cookie back into a User row (401 if anything is wrong).
- require_perm("x:y") is a FastAPI dependency that also checks the role's permission (403 if missing).
"""
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
from app.models import User

TOKEN_DAYS = 7
COOKIE_NAME = "token"
# secure=False only because the demo runs on http://localhost; set True behind HTTPS
COOKIE = dict(key=COOKIE_NAME, httponly=True, samesite="lax", secure=False, max_age=TOKEN_DAYS * 24 * 3600)

# shared/access.json is the single source of truth for permissions; the frontend menu reads the same file
ACCESS_FILE = Path(__file__).resolve().parents[2] / "shared" / "access.json"
ACCESS: dict[str, list[str]] = json.loads(ACCESS_FILE.read_text(encoding="utf-8"))


def hash_password(password: str) -> str:
    # cost 12: about a quarter of a second per hash, which makes brute force on a leaked DB slow
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:  # malformed hash in the DB: treat as wrong password, never crash
        return False


# Used when the login id doesn't exist, so a wrong id takes as long as a wrong password
# (an attacker can't learn which login ids exist by timing the response).
DUMMY_HASH = hash_password("not-a-real-password")


def make_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Logged-in user from the cookie. 401 if the cookie is missing, tampered, expired, or the user is inactive."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise ApiError(401, "Please log in")
    try:
        # algorithms is pinned so a token can't switch to "none" or another algorithm
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("kind") == "customer":
            raise ApiError(401, "Session expired, please log in again")
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise ApiError(401, "Session expired, please log in again")
    user = db.get(User, user_id)
    # reload from the DB every request: deactivation applies immediately, role comes from the DB not the token
    if user is None or not user.active:
        raise ApiError(401, "Session expired, please log in again")
    return user


def has_perm(user: User, perm: str) -> bool:
    perms = ACCESS.get(user.role.value, [])
    return "*" in perms or perm in perms


def require_perm(perm: str):
    """Dependency factory: Depends(require_perm("leads:read")) gives the user or raises 403."""

    def dependency(user: User = Depends(get_current_user)) -> User:
        if not has_perm(user, perm):
            raise ApiError(403, "You don't have permission to do this")
        return user

    return dependency
