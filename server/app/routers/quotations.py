"""Quotations and payments router.

Gates:
- No quotation unless survey is APPROVED (409 "Survey not approved yet")
- No confirm without a payment (409 "Record a payment first")
- Payment amount must be 1 <= amount <= balance (400)
- Confirm creates exactly one Job (SCHEDULED) + Dispatch (READY) + BALANCE Invoice (if balance > 0)
"""
from datetime import datetime, timezone

from typing import Literal
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth import require_perm
from app.db import get_db
from app.errors import ApiError
from app.models import (
    Dispatch,
    DispatchStatus,
    Invoice,
    InvoiceStatus,
    InvoiceType,
    Job,
    JobStatus,
    Lead,
    LeadStage,
    Package,
    Quotation,
    QuoteLine,
    QuoteStatus,
    User,
)
from app.refs import next_ref
from app.schemas.base import ApiModel
from app.services.payments import settle_payment
from app.transitions import assert_transition

router = APIRouter(prefix="/api", tags=["Quotations"])


# ── Schemas ───────────────────────────────────────────────────

class CreateQuotationRequest(ApiModel):
    package_id: int


class UpdateQuotationRequest(ApiModel):
    package_id: int


class RecordPaymentRequest(ApiModel):
    amount: int
    method: Literal["UPI", "BANK", "CASH", "CARD"] = "UPI"  # offline payments; online ones come from Razorpay


class ConfirmQuotationRequest(ApiModel):
    scheduled_date: str
    technician_id: int
    crew: str = ""


class LeadBrief(ApiModel):
    id: int
    name: str
    phone: str
    address: str


class PackageBrief(ApiModel):
    id: int
    code: str
    name: str


class QuoteLineOut(ApiModel):
    product_id: int
    code: str
    name: str
    tracking: str
    qty: int
    unit_price: int
    line_total: int


class InvoiceBrief(ApiModel):
    id: int
    ref: str
    type: str
    amount: int
    status: str
    method: str | None = None
    created_at: str
    paid_at: str | None = None


class QuotationListItem(ApiModel):
    id: int
    ref: str
    lead_name: str
    package_code: str
    total: int
    paid: int
    status: str
    created_at: str


class QuotationDetail(ApiModel):
    id: int
    ref: str
    status: str
    lead: LeadBrief
    package: PackageBrief
    lines: list[QuoteLineOut]
    total: int
    subsidy: int
    net_payable: int
    paid: int
    balance: int
    job_id: int | None = None
    dispatch_id: int | None = None
    invoices: list[InvoiceBrief]
    created_at: str
    confirmed_at: str | None = None
    accepted_name: str | None = None  # set when the customer accepts in the portal
    accepted_at: str | None = None
    preferred_date: str | None = None
    online_paid: int = 0  # paid through Razorpay


class ConfirmResponse(ApiModel):
    quotation: QuotationDetail
    job_id: int
    dispatch_id: int


# ── Helpers ───────────────────────────────────────────────────

def _build_detail(db: Session, quote: Quotation) -> QuotationDetail:
    lines_out = []
    for ql in quote.lines:
        prod = ql.product
        lines_out.append(
            QuoteLineOut(
                product_id=prod.id,
                code=prod.code,
                name=prod.name,
                tracking=prod.tracking.value,
                qty=ql.qty,
                unit_price=ql.unit_price,
                line_total=ql.qty * ql.unit_price,
            )
        )

    paid = sum(
        inv.amount for inv in quote.invoices if inv.status == InvoiceStatus.PAID
    )
    net_payable = quote.total - quote.subsidy
    balance = max(0, net_payable - paid)

    job = db.query(Job).filter(Job.quotation_id == quote.id).first()
    dispatch = db.query(Dispatch).filter(Dispatch.quotation_id == quote.id).first()

    invoices_out = [
        InvoiceBrief(
            id=inv.id,
            ref=inv.ref,
            type=inv.type.value,
            amount=inv.amount,
            status=inv.status.value,
            method=inv.method,
            created_at=inv.created_at.isoformat(),
            paid_at=inv.paid_at.isoformat() if inv.paid_at else None,
        )
        for inv in sorted(quote.invoices, key=lambda x: x.id)
    ]

    return QuotationDetail(
        id=quote.id,
        ref=quote.ref,
        status=quote.status.value,
        lead=LeadBrief(
            id=quote.lead.id,
            name=quote.lead.name,
            phone=quote.lead.phone,
            address=quote.lead.address,
        ),
        package=PackageBrief(
            id=quote.package.id,
            code=quote.package.code,
            name=quote.package.name,
        ),
        lines=lines_out,
        total=quote.total,
        subsidy=quote.subsidy,
        net_payable=net_payable,
        paid=paid,
        balance=balance,
        job_id=job.id if job else None,
        dispatch_id=dispatch.id if dispatch else None,
        invoices=invoices_out,
        created_at=quote.created_at.isoformat(),
        confirmed_at=quote.confirmed_at.isoformat() if quote.confirmed_at else None,
        accepted_name=quote.accepted_name,
        accepted_at=quote.accepted_at.isoformat() if quote.accepted_at else None,
        preferred_date=quote.preferred_date.isoformat() if quote.preferred_date else None,
        online_paid=sum(
            inv.amount for inv in quote.invoices if inv.status == InvoiceStatus.PAID and inv.method == "ONLINE"
        ),
    )


# ── Routes ────────────────────────────────────────────────────

@router.post(
    "/leads/{lead_id}/quotation",
    response_model=QuotationDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_quotation(
    lead_id: int,
    body: CreateQuotationRequest,
    user=Depends(require_perm("quotes:write")),
    db: Session = Depends(get_db),
):
    """Create quotation from package for an approved lead. Gate: survey must be APPROVED."""
    lead = db.get(Lead, lead_id)
    if not lead:
        raise ApiError(404, "Lead not found")

    # Gate: no quotation unless survey APPROVED
    if lead.stage != LeadStage.SURVEY_APPROVED:
        raise ApiError(409, "Survey not approved yet")

    package = db.get(Package, body.package_id)
    if not package:
        raise ApiError(404, "Package not found")

    # Calculate total and copy package lines with current product prices
    quote_lines = []
    total = 0
    for pl in package.lines:
        line_price = pl.product.price
        quote_lines.append(
            QuoteLine(
                product_id=pl.product_id,
                qty=pl.qty,
                unit_price=line_price,
            )
        )
        total += pl.qty * line_price

    subsidy = package.subsidy if lead.subsidy_interest else 0

    assert_transition("lead", lead.stage.value, "QUOTED")
    lead.stage = LeadStage.QUOTED

    ref = next_ref(db, "SQ")
    quotation = Quotation(
        ref=ref,
        lead_id=lead.id,
        package_id=package.id,
        status=QuoteStatus.DRAFT,
        total=total,
        subsidy=subsidy,
        lines=quote_lines,
    )
    db.add(quotation)
    db.commit()
    db.refresh(quotation)

    return _build_detail(db, quotation)


@router.get("/quotations", response_model=list[QuotationListItem])
def list_quotations(
    status: str | None = None,
    user=Depends(require_perm("quotes:read")),
    db: Session = Depends(get_db),
):
    """List quotations with lead name, package code, total, paid, and status."""
    q = db.query(Quotation).order_by(Quotation.created_at.desc())
    if status:
        q = q.filter(Quotation.status == QuoteStatus(status))
    quotes = q.all()

    result = []
    for quote in quotes:
        paid = sum(
            inv.amount for inv in quote.invoices if inv.status == InvoiceStatus.PAID
        )
        result.append(
            QuotationListItem(
                id=quote.id,
                ref=quote.ref,
                lead_name=quote.lead.name,
                package_code=quote.package.code,
                total=quote.total,
                paid=paid,
                status=quote.status.value,
                created_at=quote.created_at.isoformat(),
            )
        )
    return result


@router.get("/quotations/{quotation_id}", response_model=QuotationDetail)
def get_quotation(
    quotation_id: int,
    user=Depends(require_perm("quotes:read")),
    db: Session = Depends(get_db),
):
    """Get full quotation details, lines, invoices, and totals."""
    quote = db.get(Quotation, quotation_id)
    if not quote:
        raise ApiError(404, "Quotation not found")
    return _build_detail(db, quote)


@router.patch("/quotations/{quotation_id}", response_model=QuotationDetail)
def update_quotation(
    quotation_id: int,
    body: UpdateQuotationRequest,
    user=Depends(require_perm("quotes:write")),
    db: Session = Depends(get_db),
):
    """Update quotation package. 409 if paid > 0 or not in DRAFT/SENT."""
    quote = db.get(Quotation, quotation_id)
    if not quote:
        raise ApiError(404, "Quotation not found")

    paid = sum(
        inv.amount for inv in quote.invoices if inv.status == InvoiceStatus.PAID
    )
    if paid > 0:
        raise ApiError(409, "Cannot modify quotation with recorded payments")

    if quote.status not in (QuoteStatus.DRAFT, QuoteStatus.SENT):
        raise ApiError(409, f"Cannot modify quotation in {quote.status.value} status")

    package = db.get(Package, body.package_id)
    if not package:
        raise ApiError(404, "Package not found")

    # Clear existing lines and rebuild
    quote.lines.clear()
    total = 0
    for pl in package.lines:
        line_price = pl.product.price
        quote.lines.append(
            QuoteLine(
                product_id=pl.product_id,
                qty=pl.qty,
                unit_price=line_price,
            )
        )
        total += pl.qty * line_price

    quote.package_id = package.id
    quote.total = total
    quote.subsidy = package.subsidy if quote.lead.subsidy_interest else 0

    db.commit()
    db.refresh(quote)
    return _build_detail(db, quote)


@router.post("/quotations/{quotation_id}/send", response_model=QuotationDetail)
def send_quotation(
    quotation_id: int,
    user=Depends(require_perm("quotes:write")),
    db: Session = Depends(get_db),
):
    """Mark quotation as SENT."""
    quote = db.get(Quotation, quotation_id)
    if not quote:
        raise ApiError(404, "Quotation not found")

    assert_transition("quotation", quote.status.value, "SENT")
    quote.status = QuoteStatus.SENT
    db.commit()
    return _build_detail(db, quote)


@router.post("/quotations/{quotation_id}/cancel", response_model=QuotationDetail)
def cancel_quotation(
    quotation_id: int,
    user=Depends(require_perm("quotes:write")),
    db: Session = Depends(get_db),
):
    """Cancel quotation. 409 if already CONFIRMED."""
    quote = db.get(Quotation, quotation_id)
    if not quote:
        raise ApiError(404, "Quotation not found")

    if quote.status == QuoteStatus.CONFIRMED:
        raise ApiError(409, "Cannot cancel a confirmed quotation")

    assert_transition("quotation", quote.status.value, "CANCELLED")
    quote.status = QuoteStatus.CANCELLED
    db.commit()
    return _build_detail(db, quote)


@router.post("/quotations/{quotation_id}/payments", response_model=QuotationDetail)
def record_payment(
    quotation_id: int,
    body: RecordPaymentRequest,
    user=Depends(require_perm("quotes:write")),
    db: Session = Depends(get_db),
):
    """Record payment for quotation. 1 <= amount <= balance."""
    # lock the row so two people can't record payments against the same balance at once
    quote = db.get(Quotation, quotation_id, with_for_update=True)
    if not quote:
        raise ApiError(404, "Quotation not found")

    if quote.status == QuoteStatus.CANCELLED:
        raise ApiError(409, "Cannot record payment on a cancelled quotation")

    net_payable = quote.total - quote.subsidy
    paid_before = sum(
        inv.amount for inv in quote.invoices if inv.status == InvoiceStatus.PAID
    )
    balance = net_payable - paid_before

    if body.amount <= 0 or body.amount > balance:
        raise ApiError(
            400,
            f"Payment amount must be between ₹1 and current balance of ₹{balance}",
        )

    # after confirmation this settles the existing BALANCE invoice instead of adding a second one
    settle_payment(db, quote, body.amount, method=body.method)
    db.commit()
    db.refresh(quote)

    return _build_detail(db, quote)


@router.post("/quotations/{quotation_id}/confirm", response_model=ConfirmResponse)
def confirm_quotation(
    quotation_id: int,
    body: ConfirmQuotationRequest,
    user=Depends(require_perm("quotes:write")),
    db: Session = Depends(get_db),
):
    """Confirm quotation. Gate: paid > 0. Creates Job + Dispatch + BALANCE invoice in one transaction."""
    quote = db.get(Quotation, quotation_id)
    if not quote:
        raise ApiError(404, "Quotation not found")

    # Gate: must have recorded a payment first
    paid = sum(
        inv.amount for inv in quote.invoices if inv.status == InvoiceStatus.PAID
    )
    if paid == 0:
        raise ApiError(409, "Record a payment first")

    # Gate: transition check
    assert_transition("quotation", quote.status.value, "CONFIRMED")

    tech = db.get(User, body.technician_id)
    if not tech:
        raise ApiError(404, "Technician not found")

    # Parse scheduled date
    try:
        if isinstance(body.scheduled_date, str):
            sched_date = datetime.strptime(body.scheduled_date[:10], "%Y-%m-%d").date()
        else:
            sched_date = body.scheduled_date
    except Exception:
        raise ApiError(400, "Invalid scheduled date (expected YYYY-MM-DD)")

    # Execute all database mutations atomically
    now = datetime.now(timezone.utc)
    quote.status = QuoteStatus.CONFIRMED
    quote.confirmed_at = now

    # 1. Create Job (SCHEDULED)
    job_ref = next_ref(db, "JOB")
    job = Job(
        ref=job_ref,
        quotation_id=quote.id,
        lead_id=quote.lead_id,
        technician_id=tech.id,
        crew=body.crew or "",
        status=JobStatus.SCHEDULED,
        scheduled_date=sched_date,
    )
    db.add(job)
    db.flush()

    # 2. Create Dispatch (READY)
    dispatch_ref = next_ref(db, "SP/OUT")
    dispatch = Dispatch(
        ref=dispatch_ref,
        quotation_id=quote.id,
        job_id=job.id,
        status=DispatchStatus.READY,
    )
    db.add(dispatch)

    # 3. If balance remains, create BALANCE Invoice (DUE)
    net_payable = quote.total - quote.subsidy
    balance = net_payable - paid
    if balance > 0:
        inv_ref = next_ref(db, "INV")
        balance_inv = Invoice(
            ref=inv_ref,
            lead_id=quote.lead_id,
            quotation_id=quote.id,
            type=InvoiceType.BALANCE,
            amount=balance,
            status=InvoiceStatus.DUE,
        )
        db.add(balance_inv)

    # 4. Lead advances to WON
    quote.lead.stage = LeadStage.WON

    db.commit()
    db.refresh(quote)

    return ConfirmResponse(
        quotation=_build_detail(db, quote),
        job_id=job.id,
        dispatch_id=dispatch.id,
    )
