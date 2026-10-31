"""Invoices router. Owner: C (BUILD_PLAN §7).

Endpoints:
- GET /api/invoices: list all invoices with lead name, quotation/ticket ref, type, amount, status
- POST /api/invoices/{id}/mark-paid: transition DUE invoice to PAID (+paid_at)
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_perm
from app.db import get_db
from app.errors import ApiError
from app.models import Invoice, InvoiceStatus
from app.schemas.base import ApiModel
from app.transitions import assert_transition

router = APIRouter(prefix="/api/invoices", tags=["Invoices"])


# ── Response schemas ──────────────────────────────────────────

class InvoiceListItem(ApiModel):
    id: int
    ref: str
    lead_name: str
    quotation_ref: str | None = None
    ticket_ref: str | None = None
    type: str
    amount: int
    status: str
    created_at: str
    paid_at: str | None = None


# ── Routes ────────────────────────────────────────────────────

@router.get("", response_model=list[InvoiceListItem])
def list_invoices(
    status: str | None = None,
    user=Depends(require_perm("invoices:read")),
    db: Session = Depends(get_db),
):
    """List invoices, optionally filtered by status (DUE, PAID). Perm: invoices:read."""
    q = db.query(Invoice).order_by(Invoice.created_at.desc())
    if status:
        q = q.filter(Invoice.status == InvoiceStatus(status))
    invoices = q.all()

    return [
        InvoiceListItem(
            id=inv.id,
            ref=inv.ref,
            lead_name=inv.lead.name if inv.lead else "Unknown",
            quotation_ref=inv.quotation.ref if inv.quotation else None,
            ticket_ref=inv.ticket.ref if inv.ticket else None,
            type=inv.type.value,
            amount=inv.amount,
            status=inv.status.value,
            created_at=inv.created_at.isoformat(),
            paid_at=inv.paid_at.isoformat() if inv.paid_at else None,
        )
        for inv in invoices
    ]


@router.post("/{invoice_id}/mark-paid", response_model=InvoiceListItem)
def mark_invoice_paid(
    invoice_id: int,
    user=Depends(require_perm("invoices:write")),
    db: Session = Depends(get_db),
):
    """Mark a DUE invoice as PAID. Perm: invoices:write."""
    inv = db.get(Invoice, invoice_id)
    if not inv:
        raise ApiError(404, "Invoice not found")

    assert_transition("invoice", inv.status.value, "PAID")
    inv.status = InvoiceStatus.PAID
    inv.paid_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)

    return InvoiceListItem(
        id=inv.id,
        ref=inv.ref,
        lead_name=inv.lead.name if inv.lead else "Unknown",
        quotation_ref=inv.quotation.ref if inv.quotation else None,
        ticket_ref=inv.ticket.ref if inv.ticket else None,
        type=inv.type.value,
        amount=inv.amount,
        status=inv.status.value,
        created_at=inv.created_at.isoformat(),
        paid_at=inv.paid_at.isoformat() if inv.paid_at else None,
    )
