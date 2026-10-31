"""One place that turns a received payment into a PAID invoice (used by the portal and by staff)."""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Invoice, InvoiceStatus, InvoiceType, Quotation
from app.refs import next_ref


def settle_payment(db: Session, quote: Quotation, amount: int, method: str, gateway_ref: str | None = None) -> Invoice:
    """Record `amount` as paid on `quote`. Caller has already checked 1 <= amount <= balance and commits.

    After a booking is confirmed, the remaining amount already exists as a BALANCE invoice (DUE).
    Paying exactly that amount marks it PAID instead of adding a second invoice, so nothing shows as owed twice.
    """
    now = datetime.now(timezone.utc)
    due_balance = next(
        (i for i in quote.invoices if i.type == InvoiceType.BALANCE and i.status == InvoiceStatus.DUE and i.amount == amount),
        None,
    )
    if due_balance:
        due_balance.status, due_balance.paid_at = InvoiceStatus.PAID, now
        due_balance.method, due_balance.gateway_ref = method, gateway_ref
        return due_balance

    paid_before = sum(i.amount for i in quote.invoices if i.status == InvoiceStatus.PAID)
    net_payable = quote.total - quote.subsidy
    invoice = Invoice(
        ref=next_ref(db, "INV"),
        lead_id=quote.lead_id,
        quotation_id=quote.id,
        type=InvoiceType.FULL if (paid_before == 0 and amount == net_payable) else InvoiceType.ADVANCE,
        amount=amount,
        status=InvoiceStatus.PAID,
        method=method,
        gateway_ref=gateway_ref,
        paid_at=now,
    )
    db.add(invoice)
    return invoice
