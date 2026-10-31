"""Quotations, payments, confirm gates and invoices."""
from datetime import date
import pytest
from sqlalchemy import select

from app import seed
from app.db import SessionLocal
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
    QuoteStatus,
    Role,
    User,
)
from app.routers.invoices import mark_invoice_paid
from app.routers.quotations import (
    ConfirmQuotationRequest,
    CreateQuotationRequest,
    RecordPaymentRequest,
    UpdateQuotationRequest,
    cancel_quotation,
    confirm_quotation,
    create_quotation,
    record_payment,
    send_quotation,
    update_quotation,
)


@pytest.fixture
def db():
    seed.main()
    with SessionLocal() as session:
        yield session


def get_user_by_role(db, role: Role) -> User:
    return db.query(User).filter(User.role == role).first()


def test_quotation_gate_survey_approved(db):
    """Gate: cannot create quotation unless survey is APPROVED (409)."""
    user = get_user_by_role(db, Role.SALES)
    # Find a lead whose stage is NOT SURVEY_APPROVED
    lead = db.query(Lead).filter(Lead.stage == LeadStage.NEW).first()
    pkg = db.query(Package).first()

    req = CreateQuotationRequest(package_id=pkg.id)
    with pytest.raises(ApiError) as exc:
        create_quotation(lead.id, req, user=user, db=db)
    assert exc.value.status == 409
    assert "Survey not approved yet" in exc.value.message


def test_quotation_creation_and_pricing(db):
    """Quotation copies lines with product prices, computes subsidy, sets stage to QUOTED."""
    user = get_user_by_role(db, Role.SALES)
    # In seed, an approved survey lead exists
    lead = db.query(Lead).filter(Lead.stage == LeadStage.SURVEY_APPROVED).first()
    if not lead:
        # Create or adjust a lead to SURVEY_APPROVED for the test
        lead = db.query(Lead).first()
        lead.stage = LeadStage.SURVEY_APPROVED
        db.commit()

    pkg = db.query(Package).filter(Package.code == "ON-3").first()
    req = CreateQuotationRequest(package_id=pkg.id)

    res = create_quotation(lead.id, req, user=user, db=db)
    assert res.ref.startswith("SQ/")
    assert res.status == "DRAFT"
    assert len(res.lines) == len(pkg.lines)
    assert res.total > 0
    assert res.subsidy == pkg.subsidy if lead.subsidy_interest else 0
    assert res.net_payable == res.total - res.subsidy
    assert res.paid == 0
    assert res.balance == res.net_payable

    db.refresh(lead)
    assert lead.stage == LeadStage.QUOTED


def test_payment_validation_and_types(db):
    """Payment must be 1 <= amount <= balance. Creates FULL or ADVANCE invoice."""
    user = get_user_by_role(db, Role.SALES)
    quote = db.query(Quotation).filter(Quotation.status == QuoteStatus.DRAFT).first()
    if not quote:
        lead = db.query(Lead).filter(Lead.stage == LeadStage.SURVEY_APPROVED).first()
        pkg = db.query(Package).first()
        res = create_quotation(lead.id, CreateQuotationRequest(package_id=pkg.id), user=user, db=db)
        quote = db.query(Quotation).filter(Quotation.id == res.id).first()
    net = quote.total - quote.subsidy

    # Payment > balance -> 400
    with pytest.raises(ApiError) as exc:
        record_payment(quote.id, RecordPaymentRequest(amount=net + 1000), user=user, db=db)
    assert exc.value.status == 400

    # Payment <= 0 -> 400
    with pytest.raises(ApiError) as exc:
        record_payment(quote.id, RecordPaymentRequest(amount=0), user=user, db=db)
    assert exc.value.status == 400

    # Partial payment -> ADVANCE invoice
    advance_amount = 50000
    res = record_payment(quote.id, RecordPaymentRequest(amount=advance_amount), user=user, db=db)
    assert res.paid == advance_amount
    assert res.balance == net - advance_amount

    inv = db.query(Invoice).filter(Invoice.quotation_id == quote.id).first()
    assert inv.type == InvoiceType.ADVANCE
    assert inv.status == InvoiceStatus.PAID
    assert inv.amount == advance_amount


def test_confirm_gate_no_payment(db):
    """Gate: cannot confirm quotation without recording a payment first (409)."""
    user = get_user_by_role(db, Role.SALES)
    tech = db.query(User).filter(User.role == Role.TECHNICIAN).first()

    # Find unpaid quotation
    quote = db.query(Quotation).filter(Quotation.status == QuoteStatus.SENT).first()
    if not quote:
        quote = db.query(Quotation).filter(Quotation.status == QuoteStatus.DRAFT).first()
    if not quote:
        lead = db.query(Lead).filter(Lead.stage == LeadStage.SURVEY_APPROVED).first()
        pkg = db.query(Package).first()
        res = create_quotation(lead.id, CreateQuotationRequest(package_id=pkg.id), user=user, db=db)
        quote = db.query(Quotation).filter(Quotation.id == res.id).first()
    # Ensure no paid invoices
    for inv in quote.invoices:
        db.delete(inv)
    db.commit()

    req = ConfirmQuotationRequest(
        scheduled_date="2026-11-10",
        technician_id=tech.id,
        crew="Vikram, Arjun",
    )
    with pytest.raises(ApiError) as exc:
        confirm_quotation(quote.id, req, user=user, db=db)
    assert exc.value.status == 409
    assert "Record a payment first" in exc.value.message


def test_confirm_creates_job_dispatch_balance_invoice(db):
    """Confirming a partially paid quotation creates Job + Dispatch + BALANCE invoice, sets lead WON."""
    user = get_user_by_role(db, Role.SALES)
    tech = db.query(User).filter(User.role == Role.TECHNICIAN).first()

    # Find or prepare a quotation with partial payment
    quote = db.query(Quotation).filter(Quotation.status.in_([QuoteStatus.DRAFT, QuoteStatus.SENT])).first()
    net = quote.total - quote.subsidy
    advance_amount = 40000

    # Clear existing invoices and record advance
    for inv in quote.invoices:
        db.delete(inv)
    db.commit()

    record_payment(quote.id, RecordPaymentRequest(amount=advance_amount), user=user, db=db)

    req = ConfirmQuotationRequest(
        scheduled_date="2026-11-15",
        technician_id=tech.id,
        crew="Vikram, Sameer",
    )
    confirm_res = confirm_quotation(quote.id, req, user=user, db=db)

    assert confirm_res.job_id > 0
    assert confirm_res.dispatch_id > 0
    assert confirm_res.quotation.status == "CONFIRMED"

    # Verify Job
    job = db.get(Job, confirm_res.job_id)
    assert job.status == JobStatus.SCHEDULED
    assert job.technician_id == tech.id
    assert job.ref.startswith("JOB/")

    # Verify Dispatch
    dispatch = db.get(Dispatch, confirm_res.dispatch_id)
    assert dispatch.status == DispatchStatus.READY
    assert dispatch.ref.startswith("SP/OUT/")

    # Verify BALANCE Invoice
    balance_inv = db.query(Invoice).filter(
        Invoice.quotation_id == quote.id,
        Invoice.type == InvoiceType.BALANCE,
    ).first()
    assert balance_inv is not None
    assert balance_inv.status == InvoiceStatus.DUE
    assert balance_inv.amount == net - advance_amount

    # Verify Lead stage is WON
    db.refresh(quote)
    assert quote.lead.stage == LeadStage.WON


def test_cancel_and_update_gates(db):
    """Cannot update quote after payment; cannot cancel confirmed quote."""
    user = get_user_by_role(db, Role.SALES)
    quote = db.query(Quotation).filter(Quotation.status == QuoteStatus.DRAFT).first()
    if not quote:
        lead = db.query(Lead).filter(Lead.stage == LeadStage.SURVEY_APPROVED).first()
        pkg = db.query(Package).first()
        res = create_quotation(lead.id, CreateQuotationRequest(package_id=pkg.id), user=user, db=db)
        quote = db.query(Quotation).filter(Quotation.id == res.id).first()
    pkg2 = db.query(Package).filter(Package.id != quote.package_id).first()

    # Record a payment
    record_payment(quote.id, RecordPaymentRequest(amount=10000), user=user, db=db)

    # Patch should fail with 409
    with pytest.raises(ApiError) as exc:
        update_quotation(quote.id, UpdateQuotationRequest(package_id=pkg2.id), user=user, db=db)
    assert exc.value.status == 409
    assert "recorded payments" in exc.value.message

    # Cannot cancel confirmed quotation
    confirmed_quote = db.query(Quotation).filter(Quotation.status == QuoteStatus.CONFIRMED).first()
    if confirmed_quote:
        with pytest.raises(ApiError) as exc:
            cancel_quotation(confirmed_quote.id, user=user, db=db)
        assert exc.value.status == 409
        assert "Cannot cancel a confirmed quotation" in exc.value.message


def test_invoice_mark_paid(db):
    """Mark a DUE invoice as PAID."""
    user = get_user_by_role(db, Role.SALES)
    inv = db.query(Invoice).filter(Invoice.status == InvoiceStatus.DUE).first()
    if not inv:
        # Create a DUE invoice for testing
        lead = db.query(Lead).first()
        inv = Invoice(
            ref="INV/9999",
            lead_id=lead.id,
            type=InvoiceType.BALANCE,
            amount=25000,
            status=InvoiceStatus.DUE,
        )
        db.add(inv)
        db.commit()

    res = mark_invoice_paid(inv.id, user=user, db=db)
    assert res.status == "PAID"
    assert res.paid_at is not None

    db.refresh(inv)
    assert inv.status == InvoiceStatus.PAID
