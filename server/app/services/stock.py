"""Stock rules: scan, unscan, validate a dispatch, reserved stock, manual adjust. Owner: A.

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
