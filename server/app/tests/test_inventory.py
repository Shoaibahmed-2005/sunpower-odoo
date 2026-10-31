"""Member A's gates: scan, unscan, validate, stock adjust, warranty dates, profit. Each test starts from a fresh seed.

Run from server/: uv run pytest app/tests/test_inventory.py   (uses DATABASE_URL, which it resets)
"""
import threading
from datetime import date

import pytest
from sqlalchemy import select

from app import seed
from app.dates import add_months
from app.db import SessionLocal, engine
from app.errors import ApiError
from app.models import (
    Dispatch, DispatchStatus, Job, JobStatus, Lead, Product, Quotation, QuoteLine, QuoteStatus, SerialStatus, SerialUnit,
)
from app.routers.dashboard import crew_size, job_profit
from app.services import stock


@pytest.fixture
def db():
    seed.main()
    with SessionLocal() as session:
        yield session


def ready_dispatch(db) -> Dispatch:
    """Pooja's confirmed ON-3: READY, needs one INV-OG3 and one CC-60."""
    return db.scalar(select(Dispatch).where(Dispatch.status == DispatchStatus.READY))


def scan_ok(db, dispatch_id, serial):
    stock.scan_serial(db, dispatch_id, serial)
    db.commit()


def error_of(call) -> ApiError:
    with pytest.raises(ApiError) as caught:
        call()
    return caught.value


def test_scan_refuses_unknown_wrong_duplicate_and_not_in_stock(db):
    d = ready_dispatch(db)
    assert error_of(lambda: stock.scan_serial(db, d.id, "NOPE-1")).status == 404
    assert error_of(lambda: stock.scan_serial(db, d.id, "BAT-150-26A0001")).message == "Wrong product for this dispatch"
    # INV-OG3-26A0001 was delivered to Manoj by the seed
    assert error_of(lambda: stock.scan_serial(db, d.id, "INV-OG3-26A0001")).message == "Serial is not in stock"
    scan_ok(db, d.id, "INV-OG3-26A0003")
    assert error_of(lambda: stock.scan_serial(db, d.id, "INV-OG3-26A0003")).message == "Already scanned"
    assert error_of(lambda: stock.scan_serial(db, d.id, "INV-OG3-26A0004")).message == "All units of INV-OG3 already scanned"


def test_validate_refused_until_every_serial_scanned(db):
    d = ready_dispatch(db)
    scan_ok(db, d.id, "INV-OG3-26A0003")
    err = error_of(lambda: stock.validate_dispatch(db, d.id))
    assert (err.status, err.message) == (409, "Scan all serials first (1/2)")


def test_validate_delivers_starts_warranty_and_moves_stock(db):
    d = ready_dispatch(db)
    panels_before = db.scalar(select(Product.qty_on_hand).where(Product.code == "PNL-545"))
    scan_ok(db, d.id, "INV-OG3-26A0003")
    scan_ok(db, d.id, "CC-60-26A0005")
    stock.validate_dispatch(db, d.id)
    db.commit()

    inverter = db.scalar(select(SerialUnit).where(SerialUnit.serial == "INV-OG3-26A0003"))
    assert inverter.status == SerialStatus.DELIVERED
    assert inverter.warranty_until == add_months(date.today(), 24)
    lot = db.scalar(select(SerialUnit).where(SerialUnit.serial == f"LOT-{d.ref}-PNL-545"))
    assert (lot.qty, lot.warranty_until) == (6, add_months(date.today(), 240))
    assert db.scalar(select(Product.qty_on_hand).where(Product.code == "PNL-545")) == panels_before - 6
    db.refresh(d)
    assert (d.status, d.job.status) == (DispatchStatus.DONE, JobStatus.DISPATCHED)
    # validating twice is refused, not applied twice
    assert error_of(lambda: stock.validate_dispatch(db, d.id)).status == 409


def test_unscan_returns_unit_to_stock_and_only_for_this_dispatch(db):
    d = ready_dispatch(db)
    scan_ok(db, d.id, "INV-OG3-26A0003")
    assert error_of(lambda: stock.unscan_serial(db, d.id, "INV-OG3-26A0004")).message == \
        "Serial is not scanned on this dispatch"
    stock.unscan_serial(db, d.id, "INV-OG3-26A0003")
    db.commit()
    unit = db.scalar(select(SerialUnit).where(SerialUnit.serial == "INV-OG3-26A0003"))
    assert (unit.status, unit.dispatch_id) == (SerialStatus.IN_STOCK, None)


def test_adjust_only_counted_products(db):
    inverter = db.scalar(select(Product).where(Product.code == "INV-OG3"))
    assert error_of(lambda: stock.adjust_stock(db, inverter.id, 99)).status == 409
    cable = db.scalar(select(Product).where(Product.code == "CAB-DC4"))
    assert stock.adjust_stock(db, cable.id, 1500).qty_on_hand == 1500


def test_reserved_counts_confirmed_but_not_shipped(db):
    panel = db.scalar(select(Product).where(Product.code == "PNL-545"))
    assert stock.reserved_by_product(db)[panel.id] == 6   # Pooja's ON-3, still READY


def test_add_months_clamps_the_day():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 11, 15), 24) == date(2028, 11, 15)


def test_profit_counts_crew_and_free_repairs(db):
    assert (crew_size(""), crew_size("Arjun, Sameer")) == (1, 3)
    ramesh = db.scalar(select(Job).join(Lead).where(Lead.name == "Ramesh Kulkarni"))
    row = job_profit(db, ramesh)
    assert row.repair_cost == 58000 and row.profit < 0      # the free inverter repair made this job a loss
    anil = db.scalar(select(Job).join(Lead).where(Lead.name == "Anil Deshmukh"))
    assert job_profit(db, anil).profit > 0


@pytest.mark.skipif(engine.dialect.name != "postgresql", reason="row locks need PostgreSQL")
def test_two_dispatches_racing_for_the_last_unit(db):
    """Both dispatches need the last wiring box: exactly one validate may win."""
    first = ready_dispatch(db)
    scan_ok(db, first.id, "INV-OG3-26A0003")
    scan_ok(db, first.id, "CC-60-26A0005")
    # a second confirmed order that needs only one wiring box (no serials to scan)
    box = db.scalar(select(Product).where(Product.code == "DB-SET"))
    quote = Quotation(ref="SQ/9999", lead=first.job.lead, package=first.quotation.package,
                      status=QuoteStatus.CONFIRMED, total=box.price, subsidy=0)
    quote.lines.append(QuoteLine(product=box, qty=1, unit_price=box.price))
    job = Job(ref="JOB/9999", quotation=quote, lead=first.job.lead, technician=first.job.technician,
              scheduled_date=date.today())
    second = Dispatch(ref="SP/OUT/9999", quotation=quote, job=job)
    db.add(second)
    box.qty_on_hand = 1
    db.commit()

    results = []

    def run(dispatch_id):
        with SessionLocal() as session:
            try:
                stock.validate_dispatch(session, dispatch_id)
                session.commit()
                results.append("ok")
            except ApiError as err:
                results.append(err.message)

    threads = [threading.Thread(target=run, args=(i,)) for i in (first.id, second.id)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == ["Not enough stock for DB-SET", "ok"]
