"""Staff users. No public sign-up: only the Admin creates accounts."""
from datetime import datetime

from fastapi import APIRouter, Depends, Response
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import hash_password, require_perm
from app.db import get_db
from app.errors import ApiError
from app.models import Role, User
from app.schemas.base import ApiModel

router = APIRouter(prefix="/api/users", tags=["users"])


class UserListItem(ApiModel):
    id: int
    name: str
    role: Role


class UserCreate(ApiModel):
    name: str = Field(min_length=2, max_length=100)
    login_id: str = Field(pattern=r"^[a-z][a-z0-9.]{2,29}$")
    password: str = Field(min_length=8, max_length=128)
    role: Role
    hourly_rate: int = Field(default=0, ge=0, le=10000)


class UserDetail(ApiModel):
    id: int
    name: str
    login_id: str
    role: Role
    hourly_rate: int
    active: bool
    created_at: datetime


class UserUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    role: Role | None = None
    hourly_rate: int | None = Field(default=None, ge=0, le=10000)
    active: bool | None = None


class ResetPasswordRequest(ApiModel):
    password: str = Field(min_length=8, max_length=128)


@router.get("", response_model=list[UserListItem])
def list_users(
    role: Role | None = None,
    _: User = Depends(require_perm("users:read")),
    db: Session = Depends(get_db),
):
    """users:read (Sales, Support, Admin). Active users for dropdowns, optionally one role. Never returns hashes."""
    stmt = select(User).where(User.active.is_(True)).order_by(User.name)
    if role is not None:
        stmt = stmt.where(User.role == role)
    return [UserListItem.model_validate(u) for u in db.scalars(stmt)]


@router.get("/all", response_model=list[UserDetail])
def list_all_users(
    _: User = Depends(require_perm("users:write")),
    db: Session = Depends(get_db),
):
    """Admin only (users:write). All users including inactive."""
    stmt = select(User).order_by(User.id)
    return [UserDetail.model_validate(u) for u in db.scalars(stmt)]


@router.post("", response_model=UserDetail, status_code=201)
def create_user(
    body: UserCreate,
    _: User = Depends(require_perm("users:write")),
    db: Session = Depends(get_db),
):
    """Admin only (users:write). 409 if the login id is taken."""
    try:
        if db.scalar(select(User).where(User.login_id == body.login_id.strip().lower())):
            raise ApiError(409, "That Login Id is already taken", "loginId")
        user = User(
            name=body.name.strip(),
            login_id=body.login_id.strip().lower(),
            password_hash=hash_password(body.password),
            role=body.role,
            hourly_rate=body.hourly_rate,
            active=True,
        )
        db.add(user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return UserDetail.model_validate(user)


@router.patch("/{id}", response_model=UserDetail)
def update_user(
    id: int,
    body: UserUpdate,
    current_user: User = Depends(require_perm("users:write")),
    db: Session = Depends(get_db),
):
    """Admin only (users:write). Update name, role, hourlyRate, active status."""
    try:
        # lock the row to avoid concurrent status/role race conditions
        target = db.get(User, id, with_for_update=True)
        if not target:
            raise ApiError(404, "User not found")

        # Guard: at least one active admin is required
        if target.role == Role.ADMIN and target.active:
            will_change_role = body.role is not None and body.role != Role.ADMIN
            will_deactivate = body.active is False
            if will_change_role or will_deactivate:
                other_admins = db.scalar(
                    select(func.count(User.id)).where(
                        User.role == Role.ADMIN,
                        User.active.is_(True),
                        User.id != target.id,
                    )
                ) or 0
                if other_admins == 0:
                    raise ApiError(409, "At least one active admin is required")

        # Guard: an admin cannot demote or deactivate themself
        if target.id == current_user.id:
            if body.role is not None and body.role != target.role:
                raise ApiError(409, "You cannot change your own role", "role")
            if body.active is False:
                raise ApiError(409, "You cannot deactivate your own account", "active")

        if body.name is not None:
            target.name = body.name.strip()
        if body.role is not None:
            target.role = body.role
        if body.hourly_rate is not None:
            target.hourly_rate = body.hourly_rate
        if body.active is not None:
            target.active = body.active

        db.commit()
    except Exception:
        db.rollback()
        raise
    return UserDetail.model_validate(target)


@router.post("/{id}/reset-password", status_code=204)
def reset_password(
    id: int,
    body: ResetPasswordRequest,
    _: User = Depends(require_perm("users:write")),
    db: Session = Depends(get_db),
):
    """Admin only (users:write). Reset a user's password using bcrypt."""
    try:
        # lock the row
        target = db.get(User, id, with_for_update=True)
        if not target:
            raise ApiError(404, "User not found")

        target.password_hash = hash_password(body.password)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return Response(status_code=204)
