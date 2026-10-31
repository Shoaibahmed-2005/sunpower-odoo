"""Staff users (Member B). No public sign-up: only the Director creates accounts."""
from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
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


@router.get("", response_model=list[UserListItem])
def list_users(role: Role | None = None, _: User = Depends(require_perm("users:read")), db: Session = Depends(get_db)):
    """users:read (Sales, Support, Director). Active users for dropdowns, optionally one role. Never returns hashes."""
    stmt = select(User).where(User.active.is_(True)).order_by(User.name)
    if role is not None:
        stmt = stmt.where(User.role == role)
    return [UserListItem.model_validate(u) for u in db.scalars(stmt)]


@router.post("", response_model=UserDetail, status_code=201)
def create_user(body: UserCreate, _: User = Depends(require_perm("users:write")), db: Session = Depends(get_db)):
    """Director only ("*"). 409 if the login id is taken."""
    try:
        if db.scalar(select(User).where(User.login_id == body.login_id)):
            raise ApiError(409, "That Login Id is already taken", "loginId")
        user = User(name=body.name.strip(), login_id=body.login_id, password_hash=hash_password(body.password),
                    role=body.role, hourly_rate=body.hourly_rate, active=True)
        db.add(user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return UserDetail.model_validate(user)
