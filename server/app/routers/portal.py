"""Customer portal endpoints (/api/portal): overview, products, quotations + online payment, tickets, messages."""
from datetime import date, datetime, timezone
import math
from typing import Literal
from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.customer_auth import customer_lead_ids, get_current_customer
from app.db import get_db
from app.errors import ApiError
from app.models import (
    CustomerAccount,
    CustomerMessage,
    Invoice,
    InvoiceStatus,
    Job,
    JobStatus,
    Lead,
    LeadSource,
    LeadStage,
    PaymentOrder,
    Product,
    Quotation,
    QuoteLine,
    QuoteStatus,
    SerialUnit,
    SystemType,
    Ticket,
    TicketStatus,
)
from app.refs import next_ref
from app.schemas.base import ApiModel
from app.services.payments import settle_payment
from app.services.razorpay import RazorpayError, create_razorpay_order, razorpay_enabled, signature_valid

router = APIRouter(prefix="/api/portal", tags=["portal"])

ADVANCE_PERCENT = 25  # minimum advance to book an installation


class AcceptRequest(ApiModel):
    name: str = Field(..., min_length=2, max_length=100)
    agree: Literal[True]  # the terms checkbox must be ticked
    preferred_date: date | None = None


class OrderRequest(ApiModel):
    kind: Literal["ADVANCE", "FULL", "PART"]
    amount: int | None = Field(None, ge=1)  # only used for PART


class VerifyRequest(ApiModel):
    razorpay_order_id: str = Field(..., min_length=5, max_length=64)
    razorpay_payment_id: str = Field(..., min_length=5, max_length=64)
    razorpay_signature: str = Field(..., min_length=10, max_length=128)


class CustomerTicketRequest(ApiModel):
    serial: str = Field(..., min_length=3, max_length=60)
    issue: str = Field(..., min_length=10, max_length=1000)


class CustomerMessageRequest(ApiModel):
    text: str = Field(..., min_length=1, max_length=1000)


class CallbackRequest(ApiModel):
    preferred_time: str | None = Field(None, max_length=60)
    note: str | None = Field(None, max_length=300)


class PortalEnquiryRequest(ApiModel):
    address: str = Field(..., min_length=5, max_length=300)
    kw: float = Field(..., ge=1, le=10)
    system_type: SystemType = SystemType.ON_GRID
    monthly_bill: int = Field(..., ge=100, le=1_000_000)
    roof_area: int | None = Field(None, ge=1, le=100_000)
    subsidy_interest: bool = True


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
            Invoice.status == InvoiceStatus.DUE,
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


def _money(quote: Quotation) -> tuple[int, int, int]:
    """(net payable, paid, balance) for a quotation. Only PAID invoices count as paid."""
    net_payable = max(0, quote.total - quote.subsidy)
    paid = sum(inv.amount for inv in quote.invoices if inv.status == InvoiceStatus.PAID)
    return net_payable, paid, max(0, net_payable - paid)


def _min_advance(net_payable: int, balance: int) -> int:
    """25% of the net payable, rounded up, but never more than what is left to pay."""
    return min(balance, math.ceil(net_payable * ADVANCE_PERCENT / 100))


def _own_quote(db: Session, customer: CustomerAccount, quote_id: int, lock: bool = False) -> Quotation:
    """A SENT/CONFIRMED quotation on one of this customer's leads, else 404 (never 403, so ids can't be probed)."""
    q = db.query(Quotation).filter(
        Quotation.id == quote_id,
        Quotation.lead_id.in_(customer_lead_ids(db, customer)),
        Quotation.status.in_([QuoteStatus.SENT, QuoteStatus.CONFIRMED]),
    )
    quote = (q.with_for_update() if lock else q).first()
    if not quote:
        raise ApiError(404, "Quotation not found")
    return quote


@router.get("/quotations")
def get_quotations(
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer's SENT and CONFIRMED quotations (never drafts) with money summary, acceptance and booking."""
    lead_ids = customer_lead_ids(db, customer)
    if not lead_ids:
        return []

    quotes = (
        db.query(Quotation)
        .options(
            selectinload(Quotation.package),
            selectinload(Quotation.lines).selectinload(QuoteLine.product),
            selectinload(Quotation.invoices),
        )
        .filter(
            Quotation.lead_id.in_(lead_ids),
            Quotation.status.in_([QuoteStatus.SENT, QuoteStatus.CONFIRMED]),
        )
        .order_by(Quotation.created_at.desc())
        .all()
    )
    # one query for the booked jobs of all these quotations
    jobs = {
        j.quotation_id: j
        for j in db.query(Job).options(selectinload(Job.technician))
        .filter(Job.quotation_id.in_([q.id for q in quotes]))
    }

    result = []
    for q in quotes:
        net_payable, paid, balance = _money(q)
        job = jobs.get(q.id)
        result.append(
            {
                "id": q.id,
                "ref": q.ref,
                "packageName": q.package.name,
                "total": q.total,
                "subsidy": q.subsidy,
                "netPayable": net_payable,
                "paid": paid,
                "balance": balance,
                "minAdvance": _min_advance(net_payable, balance),
                "status": q.status.value,
                "acceptedName": q.accepted_name,
                "acceptedAt": q.accepted_at.isoformat() if q.accepted_at else None,
                "preferredDate": q.preferred_date.isoformat() if q.preferred_date else None,
                "onlinePaymentsEnabled": razorpay_enabled(),
                "job": {
                    "scheduledDate": str(job.scheduled_date),
                    "technicianName": job.technician.name if job.technician else None,
                    "status": job.status.value,
                } if job else None,
                "lines": [
                    {"id": line.id, "name": line.product.name, "qty": line.qty, "unitPrice": line.unit_price}
                    for line in q.lines
                ],
                "invoices": [
                    {
                        "id": inv.id,
                        "ref": inv.ref,
                        "type": inv.type.value,
                        "amount": inv.amount,
                        "status": inv.status.value,
                        "method": inv.method,
                        "paidAt": inv.paid_at.isoformat() if inv.paid_at else None,
                    }
                    for inv in sorted(q.invoices, key=lambda i: i.id)
                ],
            }
        )
    return result


@router.post("/quotations/{quote_id}/accept")
def accept_quotation(
    quote_id: int,
    req: AcceptRequest,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer accepts a SENT quotation by typing their name. 409 if not SENT or already accepted."""
    quote = _own_quote(db, customer, quote_id, lock=True)
    if quote.status != QuoteStatus.SENT:
        raise ApiError(409, "This quotation can no longer be accepted")
    if quote.accepted_at:
        raise ApiError(409, "Quotation already accepted")
    if req.preferred_date and req.preferred_date < date.today():
        raise ApiError(400, "Preferred date can't be in the past", "preferredDate")

    quote.accepted_name = req.name.strip()
    quote.accepted_at = datetime.now(timezone.utc)
    quote.preferred_date = req.preferred_date
    db.commit()
    return {"success": True}


@router.post("/quotations/{quote_id}/order")
def create_payment_order(
    quote_id: int,
    req: OrderRequest,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Create a Razorpay order. The amount is always computed here from the quotation, never trusted from the browser."""
    if not razorpay_enabled():
        raise ApiError(503, "Online payments not configured")
    # lock so two tabs can't create orders against the same balance at once
    quote = _own_quote(db, customer, quote_id, lock=True)
    if quote.status == QuoteStatus.SENT and not quote.accepted_at:
        raise ApiError(409, "Accept the quotation first")

    net_payable, _, balance = _money(quote)
    if balance <= 0:
        raise ApiError(409, "Already fully paid")
    min_advance = _min_advance(net_payable, balance)

    if quote.status == QuoteStatus.CONFIRMED:
        amount = balance  # after booking, the only payment left is the remaining balance
    elif req.kind == "ADVANCE":
        amount = min_advance
    elif req.kind == "FULL":
        amount = balance
    else:  # PART: customer's own amount, between the advance and the balance
        if req.amount is None or not (min_advance <= req.amount <= balance):
            raise ApiError(400, f"Enter an amount between ₹{min_advance:,} and ₹{balance:,}", "amount")
        amount = req.amount

    try:
        order = create_razorpay_order(amount * 100, receipt=f"{quote.ref}-{quote.lead_id}", notes={"quotation": quote.ref})
    except RazorpayError:
        raise ApiError(502, "Payment gateway error, please try again")

    db.add(PaymentOrder(
        order_id=order["id"],
        quotation_id=quote.id,
        customer_id=customer.id,
        amount=amount,
        status="CREATED",
        receipt=order.get("receipt"),
    ))
    db.commit()

    return {
        "keyId": settings.razorpay_key_id,  # public key; the secret never leaves the server
        "orderId": order["id"],
        "amount": amount * 100,
        "currency": "INR",
        "name": "SunPower Solutions",
        "description": f"{'Full payment' if amount == balance else 'Advance'} for {quote.ref}",
        "prefill": {"name": customer.name, "contact": customer.phone},
    }


@router.post("/payments/verify")
def verify_payment(
    req: VerifyRequest,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Check Razorpay's signature, then record a PAID invoice. Calling it twice never creates two invoices."""
    order = (
        db.query(PaymentOrder)
        .filter(PaymentOrder.order_id == req.razorpay_order_id, PaymentOrder.customer_id == customer.id)
        .with_for_update()
        .first()
    )
    if not order:
        raise ApiError(404, "Payment not found")
    if order.status == "PAID":
        return {"success": True, "alreadyRecorded": True}

    if not signature_valid(req.razorpay_order_id, req.razorpay_payment_id, req.razorpay_signature):
        order.status = "FAILED"
        db.commit()
        raise ApiError(400, "Payment could not be verified")

    quote = db.query(Quotation).filter(Quotation.id == order.quotation_id).with_for_update().first()
    net_payable, paid, balance = _money(quote)
    if order.amount > balance:
        # paid elsewhere meanwhile (e.g. offline): keep the record for a refund instead of overpaying
        raise ApiError(409, "This quotation was already paid. Contact SunPower for a refund")

    inv = settle_payment(db, quote, order.amount, method="ONLINE", gateway_ref=req.razorpay_payment_id)
    order.status = "PAID"
    db.commit()
    return {"success": True, "invoiceRef": inv.ref, "amount": inv.amount}


@router.post("/payments/{order_id}/failed")
def mark_payment_failed(
    order_id: str,
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Customer closed or failed the checkout: CREATED → FAILED (a PAID order is never touched)."""
    order = db.query(PaymentOrder).filter(
        PaymentOrder.order_id == order_id, PaymentOrder.customer_id == customer.id
    ).first()
    if not order:
        raise ApiError(404, "Payment not found")
    if order.status == "CREATED":
        order.status = "FAILED"
        db.commit()
    return {"success": True}


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
    lead_id = max(lead_ids) if lead_ids else None  # attach to the newest enquiry

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
    lead_id = max(lead_ids) if lead_ids else None
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
    """Logged-in customer asks for a site survey: creates a WEB lead with their name and phone. 409 if one is still open."""
    open_lead = db.scalar(
        select(func.count(Lead.id)).where(
            Lead.phone == customer.phone, Lead.stage.not_in([LeadStage.WON, LeadStage.LOST])
        )
    )
    if open_lead:
        raise ApiError(409, "You already have an active enquiry. Our team will contact you")

    lead = Lead(
        ref=next_ref(db, "ENQ"),
        name=customer.name,
        phone=customer.phone,
        address=req.address.strip(),
        kw=req.kw,
        system_type=req.system_type,
        monthly_bill=req.monthly_bill,
        subsidy_interest=req.subsidy_interest,
        roof_area=req.roof_area,
        source=LeadSource.WEB,
        stage=LeadStage.NEW,
    )
    db.add(lead)
    db.commit()
    return {"id": lead.id, "ref": lead.ref, "message": f"Enquiry {lead.ref} received. We'll call you to schedule a survey"}


@router.get("/notifications")
def get_notifications(
    customer: CustomerAccount = Depends(get_current_customer),
    db: Session = Depends(get_db),
):
    """Updates worked out from existing records (nothing extra is stored): quotes, payments, bookings, tickets."""
    lead_ids = customer_lead_ids(db, customer)
    if not lead_ids:
        return []

    items = []
    quotes = db.query(Quotation).filter(
        Quotation.lead_id.in_(lead_ids), Quotation.status.in_([QuoteStatus.SENT, QuoteStatus.CONFIRMED])
    ).all()
    for q in quotes:
        items.append({"id": f"q{q.id}", "type": "QUOTATION", "title": f"Quotation {q.ref} is ready",
                      "message": f"Total ₹{q.total:,}, review and accept it", "date": q.created_at.isoformat()})
        if q.confirmed_at:
            items.append({"id": f"c{q.id}", "type": "BOOKING", "title": f"Booking confirmed for {q.ref}",
                          "message": "Your installation has been scheduled", "date": q.confirmed_at.isoformat()})

    for inv in db.query(Invoice).filter(Invoice.lead_id.in_(lead_ids), Invoice.status == InvoiceStatus.PAID):
        items.append({"id": f"p{inv.id}", "type": "PAYMENT", "title": f"Payment received ₹{inv.amount:,}",
                      "message": f"Receipt {inv.ref}", "date": inv.paid_at.isoformat() if inv.paid_at else inv.created_at.isoformat()})

    quotes_by_id = {q.id: q for q in quotes}
    for j in db.query(Job).filter(Job.lead_id.in_(lead_ids)):
        when = j.finished_at or j.started_at
        q = quotes_by_id.get(j.quotation_id)
        if j.status == JobStatus.DONE and q and _money(q)[2] > 0:
            items.append({"id": f"b{j.id}", "type": "PAYMENT", "title": f"Installation complete: balance ₹{_money(q)[2]:,} due",
                          "message": f"Pay the remaining amount for {q.ref} under Quotations", "date": when.isoformat() if when else f"{j.scheduled_date}T00:00:00"})
        items.append({"id": f"j{j.id}", "type": "JOB", "title": f"Installation {j.ref}: {j.status.value.replace('_', ' ').title()}",
                      "message": f"Scheduled for {j.scheduled_date}", "date": when.isoformat() if when else f"{j.scheduled_date}T00:00:00"})

    for t in db.query(Ticket).filter(Ticket.lead_id.in_(lead_ids)):
        items.append({"id": f"t{t.id}", "type": "TICKET", "title": f"Service request {t.ref}: {t.status.value.replace('_', ' ').title()}",
                      "message": t.issue[:60], "date": t.created_at.isoformat()})

    items.sort(key=lambda x: x["date"], reverse=True)
    return items[:15]
