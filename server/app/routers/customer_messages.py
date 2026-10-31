"""Staff router for customer message conversations (/api/customer-messages)."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_perm
from app.db import get_db
from app.errors import ApiError
from app.models import CustomerAccount, CustomerMessage, User
from app.schemas.base import ApiModel

router = APIRouter(prefix="/api/customer-messages", tags=["customer-messages"])


class StaffReplyRequest(ApiModel):
    text: str = Field(..., min_length=1, max_length=2000)


@router.get("/threads")
def list_threads(
    user: User = Depends(require_perm("leads:read")),
    db: Session = Depends(get_db),
):
    """List customer conversation threads with last message and unread count."""
    customers = db.query(CustomerAccount).order_by(CustomerAccount.created_at.desc()).all()
    threads = []

    for c in customers:
        last_msg = (
            db.query(CustomerMessage)
            .filter(CustomerMessage.customer_id == c.id)
            .order_by(desc(CustomerMessage.created_at))
            .first()
        )
        if not last_msg:
            continue

        unread_count = db.scalars(
            select(func.count(CustomerMessage.id)).where(
                CustomerMessage.customer_id == c.id,
                CustomerMessage.sender_type == "CUSTOMER",
                CustomerMessage.read_at.is_(None),
            )
        ).scalar() or 0

        threads.append({
            "customerId": c.id,
            "customerName": c.name,
            "customerPhone": c.phone,
            "lastMessage": last_msg.text,
            "lastMessageAt": last_msg.created_at.isoformat(),
            "unreadCount": unread_count,
        })

    threads.sort(key=lambda t: t["lastMessageAt"], reverse=True)
    return threads


@router.get("/{customer_id}")
def get_thread(
    customer_id: int,
    user: User = Depends(require_perm("leads:read")),
    db: Session = Depends(get_db),
):
    """Get full message thread for a customer and mark customer messages as read."""
    customer = db.get(CustomerAccount, customer_id)
    if not customer:
        raise ApiError(404, "Customer not found")

    messages = (
        db.query(CustomerMessage)
        .filter(CustomerMessage.customer_id == customer_id)
        .order_by(CustomerMessage.created_at.asc())
        .all()
    )

    now = datetime.now(timezone.utc)
    updated = False
    for m in messages:
        if m.sender_type == "CUSTOMER" and not m.read_at:
            m.read_at = now
            updated = True
    if updated:
        db.commit()

    return {
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "phone": customer.phone,
        },
        "messages": [
            {
                "id": m.id,
                "senderType": m.sender_type,
                "senderId": m.sender_id,
                "text": m.text,
                "readAt": m.read_at.isoformat() if m.read_at else None,
                "createdAt": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/{customer_id}/reply")
def reply_to_customer(
    customer_id: int,
    req: StaffReplyRequest,
    user: User = Depends(require_perm("leads:read")),
    db: Session = Depends(get_db),
):
    """Staff replies to customer in thread."""
    customer = db.get(CustomerAccount, customer_id)
    if not customer:
        raise ApiError(404, "Customer not found")

    msg = CustomerMessage(
        customer_id=customer_id,
        sender_type="STAFF",
        sender_id=user.id,
        text=req.text.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {
        "id": msg.id,
        "senderType": msg.sender_type,
        "text": msg.text,
        "createdAt": msg.created_at.isoformat(),
    }

