"""Stock rules: scan, unscan, validate a dispatch, reserved stock, manual adjust, receipts. Owner: A.

These functions only change the session; they never commit. The router commits once at the end,
so if any guard raises, nothing from that request is saved (the session closes and rolls back).
"""
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.dates import add_months
from app.errors import ApiError
from app.models import (
    Dispatch,
    DispatchStatus,
    JobStatus,
    Product,
    Quotation,
    QuoteLine,
    QuoteStatus,
    Receipt,
    ReceiptLine,
    ReceiptStatus,
    SerialStatus,
    SerialUnit,
    Tracking,
)
from app.transitions import assert_transition


def get_dispatch(db: Session, dispatch_id: int, lock: bool = False) -> Dispatch:
    # lock=True: SELECT ... FOR UPDATE, so a second validate of the same dispatch waits for the first
    dispatch = db.get(Dispatch, dispatch_id, with_for_update=lock)
    if dispatch is None:
        raise ApiError(404, "Dispatch not found")
    return dispatch


def quote_lines(db: Session, dispatch: Dispatch) -> list[QuoteLine]:
    return list(db.scalars(select(QuoteLine).where(QuoteLine.quotation_id == dispatch.quotation_id)))


def required_serial_qty(db: Session, dispatch: Dispatch) -> dict[int, int]:
    """product_id -> how many units of each SERIAL product this dispatch must scan."""
    need: dict[int, int] = {}
    for line in quote_lines(db, dispatch):
        if line.product.tracking == Tracking.SERIAL:
            need[line.product_id] = need.get(line.product_id, 0) + line.qty
    return need


def scanned_units(db: Session, dispatch: Dispatch) -> list[SerialUnit]:
    """SERIAL units attached to this dispatch (PICKED before validate, DELIVERED after). Panel lots excluded."""
    return list(db.scalars(
        select(SerialUnit).join(Product)
        .where(SerialUnit.dispatch_id == dispatch.id, Product.tracking == Tracking.SERIAL)
        .order_by(SerialUnit.id)
    ))


def require_ready(dispatch: Dispatch) -> None:
    if dispatch.status != DispatchStatus.READY:
        raise ApiError(409, f"Dispatch is {dispatch.status.value}, it can no longer change")


def scan_serial(db: Session, dispatch_id: int, serial: str) -> None:
    """Attach one in-stock unit to the dispatch (IN_STOCK -> PICKED)."""
    dispatch = get_dispatch(db, dispatch_id)
    require_ready(dispatch)
    unit = db.scalar(select(SerialUnit).where(SerialUnit.serial == serial))
    if unit is None:
        raise ApiError(404, "Unknown serial", "serial")
    if unit.dispatch_id == dispatch.id:
        raise ApiError(409, "Already scanned", "serial")
    need = required_serial_qty(db, dispatch)
    if unit.product_id not in need:
        raise ApiError(409, "Wrong product for this dispatch", "serial")
    if unit.status != SerialStatus.IN_STOCK:
        raise ApiError(409, "Serial is not in stock", "serial")
    have = sum(1 for u in scanned_units(db, dispatch) if u.product_id == unit.product_id)
    if have >= need[unit.product_id]:
        raise ApiError(409, f"All units of {unit.product.code} already scanned", "serial")

    # conditional update: if another dispatch picked this unit a moment ago, 0 rows change
    picked = db.execute(
        update(SerialUnit)
        .where(SerialUnit.id == unit.id, SerialUnit.status == SerialStatus.IN_STOCK)
        .values(status=SerialStatus.PICKED, dispatch_id=dispatch.id)
    ).rowcount
    if picked == 0:
        raise ApiError(409, "Serial is not in stock", "serial")


def unscan_serial(db: Session, dispatch_id: int, serial: str) -> None:
    """Undo a wrong scan before validate (PICKED -> IN_STOCK)."""
    dispatch = get_dispatch(db, dispatch_id)
    require_ready(dispatch)
    unit = db.scalar(select(SerialUnit).where(SerialUnit.serial == serial))
    if unit is None:
        raise ApiError(404, "Unknown serial", "serial")
    released = db.execute(
        update(SerialUnit)
        .where(SerialUnit.id == unit.id, SerialUnit.dispatch_id == dispatch.id,
               SerialUnit.status == SerialStatus.PICKED)
        .values(status=SerialStatus.IN_STOCK, dispatch_id=None)
    ).rowcount
    if released == 0:
        raise ApiError(409, "Serial is not scanned on this dispatch", "serial")


def validate_dispatch(db: Session, dispatch_id: int) -> None:
    """Ship the kit (BUILD_PLAN §8.1): stock goes down, serials are delivered, warranties start."""
    dispatch = get_dispatch(db, dispatch_id, lock=True)
    assert_transition("dispatch", dispatch.status.value, "DONE")
    need = sum(required_serial_qty(db, dispatch).values())
    picked = [u for u in scanned_units(db, dispatch) if u.status == SerialStatus.PICKED]
    if len(picked) != need:
        raise ApiError(409, f"Scan all serials first ({len(picked)}/{need})")
    assert_transition("job", dispatch.job.status.value, "DISPATCHED")

    for line in quote_lines(db, dispatch):
        if line.product.tracking == Tracking.SERVICE:
            continue
        # only subtract if enough is left, so two dispatches can't both take the last unit
        taken = db.execute(
            update(Product)
            .where(Product.id == line.product_id, Product.qty_on_hand >= line.qty)
            .values(qty_on_hand=Product.qty_on_hand - line.qty)
        ).rowcount
        if taken == 0:
            raise ApiError(409, f"Not enough stock for {line.product.code}")

    now = datetime.now(timezone.utc)
    today = now.date()
    for unit in picked:
        delivered = db.execute(
            update(SerialUnit)
            .where(SerialUnit.id == unit.id, SerialUnit.status == SerialStatus.PICKED)
            .values(status=SerialStatus.DELIVERED, lead_id=dispatch.job.lead_id, delivered_at=now,
                    warranty_until=add_months(today, unit.product.warranty_months))
        ).rowcount
        if delivered == 0:
            raise ApiError(409, f"{unit.serial} changed, scan again")

    # panels are not scanned one by one: one lot row per panel line carries their 20-year warranty
    for line in quote_lines(db, dispatch):
        if line.product.tracking == Tracking.LOT:
            db.add(SerialUnit(
                serial=f"LOT-{dispatch.ref}-{line.product.code}", product_id=line.product_id, qty=line.qty,
                status=SerialStatus.DELIVERED, unit_cost=line.product.cost, dispatch_id=dispatch.id,
                lead_id=dispatch.job.lead_id, delivered_at=now,
                warranty_until=add_months(today, line.product.warranty_months),
            ))

    dispatch.status = DispatchStatus.DONE
    dispatch.delivered_at = now
    dispatch.job.status = JobStatus.DISPATCHED


def reserved_by_product(db: Session) -> dict[int, int]:
    """product_id -> qty sold on confirmed quotations whose dispatch hasn't left yet."""
    rows = db.execute(
        select(QuoteLine.product_id, func.sum(QuoteLine.qty))
        .join(Quotation, Quotation.id == QuoteLine.quotation_id)
        .join(Dispatch, Dispatch.quotation_id == Quotation.id)
        .where(Quotation.status == QuoteStatus.CONFIRMED, Dispatch.status == DispatchStatus.READY)
        .group_by(QuoteLine.product_id)
    )
    return {product_id: int(qty) for product_id, qty in rows}


def adjust_stock(db: Session, product_id: int, new_qty: int) -> Product:
    """Set the counted quantity after a physical stock count. Only counted goods (QTY, LOT)."""
    product = db.get(Product, product_id)
    if product is None:
        raise ApiError(404, "Product not found", "productId")
    # a SERIAL product's count must always equal its IN_STOCK units, so it can't be typed in
    if product.tracking not in (Tracking.QTY, Tracking.LOT):
        raise ApiError(409, f"{product.code} is tracked by {product.tracking.value}, it can't be adjusted")
    product.qty_on_hand = new_qty
    return product


# ---------- Receipts (goods in from a vendor) ----------

def get_receipt(db: Session, receipt_id: int) -> Receipt:
    receipt = db.get(Receipt, receipt_id)
    if receipt is None:
        raise ApiError(404, "Receipt not found")
    return receipt


def create_receipt(db: Session, vendor: str, lines: list[tuple[int, int, int | None]]) -> Receipt:
    """lines = (product_id, qty, unit_cost or None for the product's usual cost). Stock is NOT changed yet."""
    receipt = Receipt(vendor=vendor)
    for product_id, qty, unit_cost in lines:
        product = db.get(Product, product_id)
        if product is None:
            raise ApiError(404, f"Product {product_id} not found", "productId")
        if product.tracking == Tracking.SERVICE:
            raise ApiError(400, f"{product.code} is a service, it can't be received", "productId")
        receipt.lines.append(ReceiptLine(product=product, qty=qty,
                                         unit_cost=product.cost if unit_cost is None else unit_cost))
    db.add(receipt)
    db.flush()  # gives the receipt its id, which the reference is built from
    receipt.ref = f"RCV/{receipt.id:04d}"
    return receipt


def delete_receipt(db: Session, receipt_id: int) -> None:
    receipt = get_receipt(db, receipt_id)
    if receipt.status != ReceiptStatus.DRAFT:
        raise ApiError(409, "A received receipt can't be deleted: its stock is already counted")
    db.delete(receipt)


def receive_receipt(db: Session, receipt_id: int, serials_by_line: dict[int, list[str]]) -> Receipt:
    """Count the goods in: SERIAL lines need exactly qty new serials; stock goes up for every line."""
    receipt = db.get(Receipt, receipt_id, with_for_update=True)  # two clicks on Receive: the second waits, then sees DONE
    if receipt is None:
        raise ApiError(404, "Receipt not found")
    if receipt.status != ReceiptStatus.DRAFT:
        raise ApiError(409, "Receipt already received")
    line_ids = {line.id for line in receipt.lines}
    unknown = set(serials_by_line) - line_ids
    if unknown:
        raise ApiError(400, f"Line {min(unknown)} is not on this receipt", "lines")

    seen: set[str] = set()
    for line in receipt.lines:
        serials = [s.strip() for s in serials_by_line.get(line.id, []) if s.strip()]
        if line.product.tracking != Tracking.SERIAL:
            if serials:
                raise ApiError(400, f"{line.product.code} is counted, not scanned: remove its serials", "lines")
            continue
        if len(serials) != line.qty:
            raise ApiError(409, f"{line.product.code}: scan {line.qty} serials ({len(serials)}/{line.qty})", "lines")
        for serial in serials:
            if serial in seen:
                raise ApiError(409, f"Serial {serial} entered twice", "lines")
            seen.add(serial)
        line.serials = serials

    existing = db.scalar(select(SerialUnit.serial).where(SerialUnit.serial.in_(seen))) if seen else None
    if existing:
        raise ApiError(409, f"Serial {existing} already exists", "lines")

    for line in receipt.lines:
        for serial in line.serials:
            db.add(SerialUnit(serial=serial, product_id=line.product_id, unit_cost=line.unit_cost))
        # add in SQL, not in Python, so a dispatch validating at the same moment can't overwrite this count
        db.execute(update(Product).where(Product.id == line.product_id)
                   .values(qty_on_hand=Product.qty_on_hand + line.qty))
    receipt.status = ReceiptStatus.DONE
    receipt.received_at = datetime.now(timezone.utc)
    return receipt
