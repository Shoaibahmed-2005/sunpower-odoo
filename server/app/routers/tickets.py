"""Tickets endpoints — lookup, list, create, transition (assign/resolve/close).
Owner: D. Gates: close needs customerConfirmed; resolve creates REPAIR invoice if not under warranty.
"""

from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db import get_db
from app.auth import require_perm
from app.errors import ApiError
from app.schemas.base import ApiModel
from app.transitions import assert_transition
from app.refs import next_ref
from app.models import (
    Ticket, TicketStatus, SerialUnit, SerialStatus, Lead, User,
    Invoice, InvoiceType, InvoiceStatus,
)

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


# ── Response schemas ──────────────────────────────────────────

class LookupResult(ApiModel):
    serial_unit_id: int
    serial: str
    product_name: str
    lead_id: int
    lead_name: str
    phone: str
    address: str
    delivered_at: str | None
    warranty_until: str | None
    under_warranty: bool


class TicketListItem(ApiModel):
    id: int
    ref: str
    lead_name: str
    serial: str | None
    issue: str
    under_warranty: bool
    status: str
    technician_name: str | None
    created_at: str


class InvoiceOut(ApiModel):
    id: int
    ref: str
    amount: int
    status: str


class TicketDetail(ApiModel):
    id: int
    ref: str
    status: str
    issue: str
    under_warranty: bool
    lead_name: str
    lead_phone: str
    lead_address: str
    serial: str | None
    product_name: str | None
    warranty_until: str | None
    technician_name: str | None
    parts_cost: int
    labour_cost: int
    bill_amount: int
    created_at: str
    resolved_at: str | None
    customer_confirmed_at: str | None
    invoice: InvoiceOut | None


# ── Request schemas ───────────────────────────────────────────

class CreateTicketRequest(ApiModel):
    serial_unit_id: int
    issue: str


class TransitionRequest(ApiModel):
    to: str
    technician_id: int | None = None
    parts_cost: int | None = None
    labour_cost: int | None = None
    customer_confirmed: bool | None = None


# ── Helpers ───────────────────────────────────────────────────

def _build_detail(db: Session, ticket: Ticket) -> TicketDetail:
    lead = db.get(Lead, ticket.lead_id)
    tech = db.get(User, ticket.technician_id) if ticket.technician_id else None
    serial_unit = db.get(SerialUnit, ticket.serial_unit_id) if ticket.serial_unit_id else None

    # Find linked repair invoice
    inv = (
        db.query(Invoice)
        .filter(Invoice.ticket_id == ticket.id)
        .first()
    )

    return TicketDetail(
        id=ticket.id,
        ref=ticket.ref,
        status=ticket.status.value,
        issue=ticket.issue,
        under_warranty=ticket.under_warranty,
        lead_name=lead.name,
        lead_phone=lead.phone,
        lead_address=lead.address,
        serial=serial_unit.serial if serial_unit else None,
        product_name=serial_unit.product.name if serial_unit else None,
        warranty_until=str(serial_unit.warranty_until) if serial_unit and serial_unit.warranty_until else None,
        technician_name=tech.name if tech else None,
        parts_cost=ticket.parts_cost,
        labour_cost=ticket.labour_cost,
        bill_amount=ticket.bill_amount,
        created_at=ticket.created_at.isoformat(),
        resolved_at=ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        customer_confirmed_at=ticket.customer_confirmed_at.isoformat() if ticket.customer_confirmed_at else None,
        invoice=InvoiceOut(
            id=inv.id, ref=inv.ref, amount=inv.amount, status=inv.status.value
        ) if inv else None,
    )


# ── Routes ────────────────────────────────────────────────────

@router.get("/lookup", response_model=list[LookupResult])
def lookup(
    q: str = "",
    user=Depends(require_perm("tickets:read")),
    db: Session = Depends(get_db),
):
    """Look up delivered serial units by serial, phone, or customer name. Perm: tickets:read."""
    if not q or len(q) < 2:
        return []

    rows = (
        db.query(SerialUnit, Lead)
        .join(Lead, SerialUnit.lead_id == Lead.id)
        .filter(
            SerialUnit.status == SerialStatus.DELIVERED,
            or_(
                SerialUnit.serial.ilike(f"%{q}%"),
                Lead.phone.ilike(f"%{q}%"),
                Lead.name.ilike(f"%{q}%"),
            ),
        )
        .limit(20)
        .all()
    )

    today = date.today()
    return [
        LookupResult(
            serial_unit_id=u.id,
            serial=u.serial,
            product_name=u.product.name,
            lead_id=lead.id,
            lead_name=lead.name,
            phone=lead.phone,
            address=lead.address,
            delivered_at=str(u.delivered_at) if u.delivered_at else None,
            warranty_until=str(u.warranty_until) if u.warranty_until else None,
            under_warranty=u.warranty_until >= today if u.warranty_until else False,
        )
        for u, lead in rows
    ]


@router.get("", response_model=list[TicketListItem])
def list_tickets(
    status: str | None = None,
    user=Depends(require_perm("tickets:read")),
    db: Session = Depends(get_db),
):
    """List tickets, optionally filtered by status. Perm: tickets:read."""
    q = db.query(Ticket)
    if status:
        q = q.filter(Ticket.status == TicketStatus(status))
    tickets = q.order_by(Ticket.created_at.desc()).all()

    result = []
    for t in tickets:
        lead = db.get(Lead, t.lead_id)
        tech = db.get(User, t.technician_id) if t.technician_id else None
        su = db.get(SerialUnit, t.serial_unit_id) if t.serial_unit_id else None
        result.append(
            TicketListItem(
                id=t.id,
                ref=t.ref,
                lead_name=lead.name,
                serial=su.serial if su else None,
                issue=t.issue,
                under_warranty=t.under_warranty,
                status=t.status.value,
                technician_name=tech.name if tech else None,
                created_at=t.created_at.isoformat(),
            )
        )
    return result


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_ticket(
    ticket_id: int,
    user=Depends(require_perm("tickets:read")),
    db: Session = Depends(get_db),
):
    """Full ticket detail with lead, serial, invoice. Perm: tickets:read."""
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise ApiError(404, "Ticket not found")
    return _build_detail(db, ticket)


@router.post("", response_model=TicketDetail, status_code=201)
def create_ticket(
    body: CreateTicketRequest,
    user=Depends(require_perm("tickets:write")),
    db: Session = Depends(get_db),
):
    """Create a ticket. under_warranty is computed from serial's warranty_until >= today. Perm: tickets:write."""
    su = db.get(SerialUnit, body.serial_unit_id)
    if not su:
        raise ApiError(404, "Serial unit not found")
    if su.status != SerialStatus.DELIVERED:
        raise ApiError(400, "Serial unit has not been delivered")
    if not su.lead_id:
        raise ApiError(400, "Serial unit has no associated customer")

    today = date.today()
    # warranty_until == today counts as covered
    under_warranty = su.warranty_until >= today if su.warranty_until else False

    with db.begin():
        ref = next_ref(db, "TKT")
        ticket = Ticket(
            ref=ref,
            serial_unit_id=su.id,
            lead_id=su.lead_id,
            issue=body.issue,
            status=TicketStatus.NEW,
            under_warranty=under_warranty,
            created_at=datetime.now(timezone.utc),
        )
        db.add(ticket)
        db.flush()

    return _build_detail(db, ticket)


@router.post("/{ticket_id}/transition", response_model=TicketDetail)
def transition_ticket(
    ticket_id: int,
    body: TransitionRequest,
    user=Depends(require_perm("tickets:write")),
    db: Session = Depends(get_db),
):
    """Transition a ticket. ASSIGNED needs technicianId. RESOLVED stores costs + creates invoice if billable.
    CLOSED needs customerConfirmed. Perm: tickets:write."""
    ticket = db.get(Ticket, ticket_id)
    if not ticket:
        raise ApiError(404, "Ticket not found")

    assert_transition("ticket", ticket.status.value, body.to)

    with db.begin():
        if body.to == "ASSIGNED":
            # Must provide a technician
            if not body.technician_id:
                raise ApiError(400, "Technician is required for assignment")
            tech = db.get(User, body.technician_id)
            if not tech:
                raise ApiError(404, "Technician not found")
            ticket.technician_id = body.technician_id
            ticket.status = TicketStatus.ASSIGNED

        elif body.to == "IN_REPAIR":
            ticket.status = TicketStatus.IN_REPAIR

        elif body.to == "RESOLVED":
            parts = body.parts_cost or 0
            labour = body.labour_cost or 0
            ticket.parts_cost = parts
            ticket.labour_cost = labour
            ticket.resolved_at = datetime.now(timezone.utc)

            if not ticket.under_warranty:
                # Billable: create a REPAIR invoice
                bill = parts + labour
                ticket.bill_amount = bill
                inv = Invoice(
                    ref=next_ref(db, "INV"),
                    lead_id=ticket.lead_id,
                    ticket_id=ticket.id,
                    type=InvoiceType.REPAIR,
                    amount=bill,
                    status=InvoiceStatus.DUE,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(inv)
            else:
                # Under warranty — no charge
                ticket.bill_amount = 0

            ticket.status = TicketStatus.RESOLVED

        elif body.to == "CLOSED":
            # Gate: customer must confirm
            if not body.customer_confirmed:
                raise ApiError(409, "Customer confirmation is required to close the ticket")
            ticket.customer_confirmed_at = datetime.now(timezone.utc)
            ticket.status = TicketStatus.CLOSED

    return _build_detail(db, ticket)
