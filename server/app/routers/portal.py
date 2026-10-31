"""Customer portal endpoints (/api/portal) for customer self-service."""
from datetime import date, datetime, timezone
import re
from fastapi import APIRouter, Depends
from pydantic import Field, field_validator
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.customer_auth import customer_lead_ids, get_current_customer
from app.db import get_db
from app.errors import ApiError
from app.models import (
    CustomerAccount,
    CustomerMessage,
    Invoice,
    InvoiceStatus,
    InvoiceType,
    Job,
    JobStatus,
    Lead,
    Product,
    Quotation,
    QuoteLine,
    QuoteStatus,
    SerialStatus,
    SerialUnit,
    Ticket,
    TicketStatus,
)
from app.refs import next_ref
from app.schemas.base import ApiModel

router = APIRouter(prefix="/api/portal", tags=["portal"])

REF_REGEX = re.compile(r"^[A-Za-z0-9-]{6,40}$")


class CustomerPaymentRequest(ApiModel):
    amount: int = Field(..., ge=1)
    reference: str = Field(..., min_length=6, max_length=40)

    @field_validator("reference")
    @classmethod
    def validate_reference(cls, v: str) -> str:
        v = v.strip()
        if not REF_REGEX.match(v):
            raise ValueError("Reference must be 6-40 alphanumeric characters or hyphens")
        return v


class CustomerTicketRequest(ApiModel):
    serial: str = Field(..., min_length=3, max_length=60)
    issue: str = Field(..., min_length=10, max_length=1000)


class CustomerMessageRequest(ApiModel):
    text: str = Field(..., min_length=1, max_length=2000)
    lead_id: int | None = None


class CallbackRequest(ApiModel):
    preferred_time: str | None = None
    note: str | None = None


class PortalEnquiryRequest(ApiModel):
    monthly_bill: int = Field(..., ge=100)
    roof_area: int | None = None
    system_type: str | None = "ON_GRID"


@router.get("/overview")
def get_overview(
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Overview dashboard for customer portal."""
    lead_ids = customer_lead_ids(db, customer)
    today = date.today()

    if not lead_ids:
        return {
            "name": customer.name,
            "phone": customer.phone,
            "productsCount": 0,
            "underWarrantyCount": 0,
            "activeJobsCount": 0,
            "openTicketsCount": 0,
            "pendingInvoicesCount": 0,
            "unreadMessagesCount": 0,
        }

    products_count = db.scalar(
        select(func.count(SerialUnit.id)).where(SerialUnit.lead_id.in_(lead_ids))
    ) or 0

    under_warranty_count = db.scalar(
        select(func.count(SerialUnit.id)).where(
            SerialUnit.lead_id.in_(lead_ids),
            SerialUnit.warranty_until >= today,
        )
    ) or 0

    active_jobs = db.scalar(
        select(func.count(Job.id)).where(
            Job.lead_id.in_(lead_ids),
            Job.status != JobStatus.DONE,
        )
    ) or 0

    open_tickets = db.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.lead_id.in_(lead_ids),
            Ticket.status != TicketStatus.CLOSED,
        )
    ) or 0

    pending_invoices = db.scalar(
        select(func.count(Invoice.id)).where(
            Invoice.lead_id.in_(lead_ids),
            Invoice.status == InvoiceStatus.PENDING,
        )
    ) or 0

    unread_messages = db.scalar(
        select(func.count(CustomerMessage.id)).where(
            CustomerMessage.customer_id == customer.id,
            CustomerMessage.sender_type == "STAFF",
            CustomerMessage.read_at.is_(None),
        )
    ) or 0

    return {
        "name": customer.name,
        "phone": customer.phone,
        "productsCount": products_count,
        "underWarrantyCount": under_warranty_count,
        "activeJobsCount": active_jobs,
        "openTicketsCount": open_tickets,
        "pendingInvoicesCount": pending_invoices,
        "unreadMessagesCount": unread_messages,
    }


@router.get("/products")
def get_products(
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Delivered equipment and warranties for customer's installations."""
    lead_ids = customer_lead_ids(db, customer)
    if not lead_ids:
        return []

    today = date.today()
    rows = (
        db.query(SerialUnit, Product.name, Lead.ref)
        .join(Product, SerialUnit.product_id == Product.id)
        .join(Lead, SerialUnit.lead_id == Lead.id)
        .filter(SerialUnit.lead_id.in_(lead_ids))
        .order_by(SerialUnit.delivered_at.desc())
        .all()
    )

    return [
        {
            "id": u.id,
            "serial": u.serial,
            "productName": p_name,
            "leadRef": lead_ref,
            "deliveredAt": u.delivered_at.isoformat() if u.delivered_at else None,
            "warrantyUntil": str(u.warranty_until) if u.warranty_until else None,
            "underWarranty": bool(u.warranty_until and u.warranty_until >= today),
        }
        for u, p_name, lead_ref in rows
    ]


@router.get("/quotations")
def get_quotations(
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer quotations with lines, payments, pending verification, and net balance."""
    lead_ids = customer_lead_ids(db, customer)
    if not lead_ids:
        return []

    quotes = (
        db.query(Quotation)
        .filter(Quotation.lead_id.in_(lead_ids))
        .order_by(Quotation.created_at.desc())
        .all()
    )

    result = []
    for q in quotes:
        net_payable = max(0, q.total - q.subsidy)
        paid = sum(inv.amount for inv in q.invoices if inv.status == InvoiceStatus.PAID)
        pending = sum(inv.amount for inv in q.invoices if inv.status == InvoiceStatus.PENDING)
        balance = max(0, net_payable - paid)

        lines = [
            {"id": line.id, "name": line.product.name, "qty": line.qty, "unitPrice": line.unit_price}
            for line in q.lines
        ]
        invoices = [
            {
                "id": inv.id,
                "ref": inv.ref,
                "type": inv.type.value,
                "amount": inv.amount,
                "status": inv.status.value,
                "reference": inv.reference,
                "submittedByCustomer": inv.submitted_by_customer,
                "paidAt": inv.paid_at.isoformat() if inv.paid_at else None,
            }
            for inv in q.invoices
        ]

        result.append(
            {
                "id": q.id,
                "ref": q.ref,
                "packageName": q.package.name,
                "total": q.total,
                "subsidy": q.subsidy,
                "netPayable": net_payable,
                "paid": paid,
                "pending": pending,
                "balance": balance,
                "status": q.status.value,
                "lines": lines,
                "invoices": invoices,
                "acceptedName": q.accepted_name,
                "acceptedAt": q.accepted_at.isoformat() if q.accepted_at else None,
            }
        )

    return result


@router.post("/quotations/{id}/payments")
def submit_payment(
    id: int,
    req: CustomerPaymentRequest,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer submits advance payment reference. Row locked; creates PENDING invoice."""
    lead_ids = customer_lead_ids(db, customer)
    quote = (
        db.query(Quotation)
        .filter(Quotation.id == id, Quotation.lead_id.in_(lead_ids))
        .with_for_update()
        .first()
    )
    if not quote:
        raise ApiError(404, "Quotation not found")

    if quote.status not in (QuoteStatus.DRAFT, QuoteStatus.SENT):
        raise ApiError(409, f"Cannot pay for quotation in {quote.status.value} status")

    net_payable = max(0, quote.total - quote.subsidy)
    paid = sum(inv.amount for inv in quote.invoices if inv.status == InvoiceStatus.PAID)
    pending = sum(inv.amount for inv in quote.invoices if inv.status == InvoiceStatus.PENDING)
    balance = max(0, net_payable - paid)

    if pending > 0:
        raise ApiError(409, "A payment is already pending verification for this quotation")

    max_allowed = balance - pending
    if req.amount > max_allowed:
        raise ApiError(400, f"Amount exceeds remaining balance ({max_allowed})")

    inv = Invoice(
        ref=next_ref(db, "INV"),
        lead_id=quote.lead_id,
        quotation_id=quote.id,
        type=InvoiceType.ADVANCE,
        amount=req.amount,
        status=InvoiceStatus.PENDING,
        reference=req.reference,
        submitted_by_customer=True,
        method="UPI",
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    return {
        "id": inv.id,
        "ref": inv.ref,
        "amount": inv.amount,
        "status": inv.status.value,
        "reference": inv.reference,
        "message": "Payment reference submitted for verification",
    }


@router.get("/tickets")
def get_tickets(
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer's service requests."""
    lead_ids = customer_lead_ids(db, customer)
    if not lead_ids:
        return []

    rows = (
        db.query(Ticket, SerialUnit.serial, Product.name)
        .outerjoin(SerialUnit, Ticket.serial_unit_id == SerialUnit.id)
        .outerjoin(Product, SerialUnit.product_id == Product.id)
        .filter(Ticket.lead_id.in_(lead_ids))
        .order_by(Ticket.created_at.desc())
        .all()
    )

    return [
        {
            "id": t.id,
            "ref": t.ref,
            "serial": serial,
            "productName": p_name,
            "issue": t.issue,
            "status": t.status.value,
            "underWarranty": t.under_warranty,
            "partsCost": t.parts_cost,
            "labourCost": t.labour_cost,
            "billAmount": t.bill_amount,
            "createdAt": t.created_at.isoformat(),
            "resolvedAt": t.resolved_at.isoformat() if t.resolved_at else None,
            "customerConfirmedAt": t.customer_confirmed_at.isoformat() if t.customer_confirmed_at else None,
            "source": t.source,
        }
        for t, serial, p_name in rows
    ]


@router.post("/tickets")
def create_ticket(
    req: CustomerTicketRequest,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer creates a service request for their delivered unit."""
    lead_ids = customer_lead_ids(db, customer)
    serial_unit = (
        db.query(SerialUnit)
        .filter(SerialUnit.serial == req.serial.strip(), SerialUnit.lead_id.in_(lead_ids))
        .first()
    )
    if not serial_unit:
        raise ApiError(404, "Product not found")

    # Max 3 open portal tickets
    open_count = db.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.lead_id.in_(lead_ids),
            Ticket.status.in_([TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_REPAIR]),
        )
    ) or 0
    if open_count >= 3:
        raise ApiError(429, "Maximum 3 open service requests allowed. Please wait until one is resolved")

    today = date.today()
    under_warranty = bool(serial_unit.warranty_until and serial_unit.warranty_until >= today)

    ticket = Ticket(
        ref=next_ref(db, "TKT"),
        serial_unit_id=serial_unit.id,
        lead_id=serial_unit.lead_id,
        issue=req.issue.strip(),
        under_warranty=under_warranty,
        source="PORTAL",
        status=TicketStatus.NEW,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return {
        "id": ticket.id,
        "ref": ticket.ref,
        "issue": ticket.issue,
        "underWarranty": ticket.under_warranty,
        "status": ticket.status.value,
        "createdAt": ticket.created_at.isoformat(),
    }


@router.post("/tickets/{id}/confirm")
def confirm_ticket_resolution(
    id: int,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer confirms ticket resolution and closes it."""
    lead_ids = customer_lead_ids(db, customer)
    ticket = db.query(Ticket).filter(Ticket.id == id, Ticket.lead_id.in_(lead_ids)).with_for_update().first()
    if not ticket:
        raise ApiError(404, "Ticket not found")

    if ticket.status != TicketStatus.RESOLVED:
        raise ApiError(409, f"Ticket cannot be confirmed in {ticket.status.value} status")

    ticket.customer_confirmed_at = datetime.now(timezone.utc)
    ticket.status = TicketStatus.CLOSED
    db.commit()

    return {"success": True, "message": "Resolution confirmed, ticket closed"}


@router.get("/messages")
def get_messages(
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Retrieve conversation messages and mark staff messages read."""
    messages = (
        db.query(CustomerMessage)
        .filter(CustomerMessage.customer_id == customer.id)
        .order_by(CustomerMessage.created_at.asc())
        .all()
    )

    now = datetime.now(timezone.utc)
    updated = False
    for m in messages:
        if m.sender_type == "STAFF" and not m.read_at:
            m.read_at = now
            updated = True
    if updated:
        db.commit()

    return [
        {
            "id": m.id,
            "senderType": m.sender_type,
            "text": m.text,
            "readAt": m.read_at.isoformat() if m.read_at else None,
            "createdAt": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.post("/messages")
def send_message(
    req: CustomerMessageRequest,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Send message to support/sales team."""
    lead_ids = customer_lead_ids(db, customer)
    lead_id = req.lead_id if (req.lead_id and req.lead_id in lead_ids) else (lead_ids[0] if lead_ids else None)

    msg = CustomerMessage(
        customer_id=customer.id,
        lead_id=lead_id,
        sender_type="CUSTOMER",
        sender_id=customer.id,
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


@router.post("/callback")
def request_callback(
    req: CallbackRequest,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer requests a phone call back from the support team."""
    lead_ids = customer_lead_ids(db, customer)
    lead_id = lead_ids[0] if lead_ids else None
    note_text = f"Customer requested callback. Preferred time: {req.preferred_time or 'Anytime'}. Note: {req.note or 'None'}"

    msg = CustomerMessage(
        customer_id=customer.id,
        lead_id=lead_id,
        sender_type="CUSTOMER",
        sender_id=customer.id,
        text=f"📞 [CALLBACK REQUEST] {note_text}",
    )
    db.add(msg)
    db.commit()
    return {"success": True, "message": "Callback requested. Our team will contact you shortly."}


@router.post("/enquiry")
def submit_enquiry(
    req: PortalEnquiryRequest,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer creates a new solar installation enquiry from portal."""
    lead = Lead(
        ref=next_ref(db, "ENQ"),
        name=customer.name,
        phone=customer.phone,
        monthly_bill=req.monthly_bill,
        roof_area=req.roof_area or 0,
        system_type=req.system_type or "ON_GRID",
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)

    return {
        "id": lead.id,
        "ref": lead.ref,
        "name": lead.name,
        "phone": lead.phone,
        "message": f"Enquiry {lead.ref} created successfully",
    }


@router.get("/notifications")
def get_notifications(
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Recent updates for customer notifications feed."""
    lead_ids = customer_lead_ids(db, customer)
    if not lead_ids:
        return []

    notifications = []
    # Check quotations
    quotes = db.query(Quotation).filter(Quotation.lead_id.in_(lead_ids)).order_by(Quotation.created_at.desc()).limit(3).all()
    for q in quotes:
        notifications.append({
            "id": f"q_{q.id}",
            "type": "QUOTATION",
            "title": f"Quotation {q.ref} is {q.status.value}",
            "message": f"Package {q.package.name} (₹{q.total:,})",
            "date": q.created_at.isoformat(),
        })

    # Check jobs
    jobs = db.query(Job).filter(Job.lead_id.in_(lead_ids)).order_by(Job.scheduled_date.desc()).limit(3).all()
    for j in jobs:
        notifications.append({
            "id": f"j_{j.id}",
            "type": "JOB",
            "title": f"Installation {j.ref}: {j.status.value}",
            "message": f"Scheduled date: {j.scheduled_date}",
            "date": j.started_at.isoformat() if j.started_at else str(j.scheduled_date),
        })

    # Check tickets
    tickets = db.query(Ticket).filter(Ticket.lead_id.in_(lead_ids)).order_by(Ticket.created_at.desc()).limit(3).all()
    for t in tickets:
        notifications.append({
            "id": f"t_{t.id}",
            "type": "TICKET",
            "title": f"Service request {t.ref}: {t.status.value}",
            "message": t.issue[:50] + ("..." if len(t.issue) > 50 else ""),
            "date": t.created_at.isoformat(),
        })

    notifications.sort(key=lambda x: x["date"], reverse=True)
    return notifications[:10]


@router.post("/notifications/seen")
def mark_notifications_seen():
    return {"success": True}
