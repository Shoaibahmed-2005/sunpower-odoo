"""Users router. Owner: B (BUILD_PLAN §7).

Endpoints:
- GET /api/users?role=TECHNICIAN: list users, optionally filtered by role
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_perm
from app.db import get_db
from app.models import Role, User
from app.schemas.base import ApiModel

router = APIRouter(prefix="/api/users", tags=["Users"])


class UserItem(ApiModel):
    id: int
    name: str
    role: str


@router.get("", response_model=list[UserItem])
def list_users(
    role: str | None = None,
    user=Depends(require_perm("users:read")),
    db: Session = Depends(get_db),
):
    """List active users for dropdowns and admin. Perm: users:read."""
    q = db.query(User).filter(User.active == True)
    if role:
        q = q.filter(User.role == Role(role))
    users = q.order_by(User.name.asc()).all()
    return [
        UserItem(
            id=u.id,
            name=u.name,
            role=u.role.value,
        )
        for u in users
    ]
