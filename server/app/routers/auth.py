"""Auth router. Owner: B (BUILD_PLAN §7).

Endpoints:
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
"""
from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import COOKIE, get_current_user, make_token, verify_password
from app.db import get_db
from app.errors import ApiError
from app.models import User
from app.schemas.base import ApiModel

router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginRequest(ApiModel):
    login_id: str
    password: str


class UserOut(ApiModel):
    id: int
    name: str
    login_id: str
    role: str


class AuthResponse(ApiModel):
    user: UserOut


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate with login_id + password, set httpOnly session cookie."""
    user = db.query(User).filter(User.login_id == body.login_id.strip()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise ApiError(401, "Invalid Login Id or Password")
    if not user.active:
        raise ApiError(401, "Account is disabled")

    token = make_token(user)
    response.set_cookie(value=token, **COOKIE)
    return AuthResponse(
        user=UserOut(
            id=user.id,
            name=user.name,
            login_id=user.login_id,
            role=user.role.value,
        )
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    """Clear session cookie."""
    response.delete_cookie(key=COOKIE["key"], httponly=COOKIE["httponly"], samesite=COOKIE["samesite"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=AuthResponse)
def me(user: User = Depends(get_current_user)):
    """Get currently logged-in user."""
    return AuthResponse(
        user=UserOut(
            id=user.id,
            name=user.name,
            login_id=user.login_id,
            role=user.role.value,
        )
    )
