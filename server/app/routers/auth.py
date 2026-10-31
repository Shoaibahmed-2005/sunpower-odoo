"""Login, logout and "who am I"."""
from fastapi import APIRouter, Depends, Response
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import COOKIE, COOKIE_NAME, DUMMY_HASH, get_current_user, make_token, verify_password
from app.db import get_db
from app.errors import ApiError
from app.models import Role, User
from app.schemas.base import ApiModel

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(ApiModel):
    login_id: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class UserOut(ApiModel):
    id: int
    name: str
    login_id: str
    role: Role


class UserEnvelope(ApiModel):
    user: UserOut


@router.post("/login", response_model=UserEnvelope)
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    """Public. Sets the httpOnly JWT cookie. 401 with one generic message for any failure."""
    user = db.scalar(select(User).where(User.login_id == body.login_id.strip().lower()))
    # always run bcrypt, even for an unknown id, so timing doesn't reveal which ids exist
    password_ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not password_ok or not user.active:
        raise ApiError(401, "Invalid Login Id or Password")
    response.set_cookie(value=make_token(user), **COOKIE)
    return UserEnvelope(user=UserOut.model_validate(user))


@router.post("/logout", status_code=204)
def logout():
    """Any caller. Clears the cookie."""
    response = Response(status_code=204)
    response.delete_cookie(COOKIE_NAME, httponly=True, samesite="lax")
    return response


@router.get("/me", response_model=UserEnvelope)
def me(user: User = Depends(get_current_user)):
    """Logged-in user, or 401. The frontend calls this on start-up to restore the session."""
    return UserEnvelope(user=UserOut.model_validate(user))
