"""Products, packages, stock, dispatches (scan / unscan / validate), serial lookup, receipts. Owner: A.

Paths are written in full under prefix "/api". Business rules live in services/stock.py;
every write endpoint here calls the service, then commits once.
"""
from datetime import date, datetime

from fastapi import APIRouter, Depends, Response
from pydantic import Field
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import require_perm
from app.db import get_db
from app.errors import ApiError
from app.models import (
    Dispatch,
    DispatchStatus,
    Lead,
    Package,
    PackageType,
    Product,
    Receipt,
    ReceiptStatus,
    SerialStatus,
    SerialUnit,
    Tracking,
)
from app.schemas.base import ApiModel
from app.services import stock

router = APIRouter(prefix="/api", tags=["Inventory"])


# ---------- Schemas ----------

class ProductOut(ApiModel):
    id: int
    code: str
    name: str
    tracking: Tracking
    warranty_months: int
    cost: int
    price: int
    qty_on_hand: int


class PackageOut(ApiModel):
    id: int
    code: str
    name: str
    type: PackageType
    kw: float
    subsidy: int
    price: int


class PackageLineOut(ApiModel):
    product_id: int
    code: str
    name: str
    tracking: Tracking
    qty: int
    unit_price: int


class PackageDetail(PackageOut):
    lines: list[PackageLineOut]


class StockRow(ApiModel):
    product_id: int
    code: str
    name: str
    tracking: Tracking
    on_hand: int
    reserved: int
    free: int
    cost: int


class StockAdjustIn(ApiModel):
    product_id: int
    new_qty: int = Field(ge=0, le=100000)


class DispatchListItem(ApiModel):
    id: int
    ref: str
    job_ref: str
    lead_name: str
    status: DispatchStatus
    scheduled_date: date
    scanned_count: int
    required_count: int


class LeadContact(ApiModel):
    name: str
    phone: str
    address: str


class DispatchLineOut(ApiModel):
    product_id: int
    code: str
    name: str
    tracking: Tracking
    qty: int
    scanned: list[str]


class WarrantyOut(ApiModel):
    serial: str
    product_name: str
    warranty_until: date


class DispatchDetail(ApiModel):
    id: int
    ref: str
    status: DispatchStatus
    lead: LeadContact
    job_id: int
    job_ref: str
    lines: list[DispatchLineOut]
    required_count: int
    scanned_count: int
    can_validate: bool
    warranties: list[WarrantyOut]


class SerialIn(ApiModel):
    serial: str = Field(min_length=1, max_length=60)


class SerialOut(ApiModel):
    serial: str
    product_name: str
    status: SerialStatus
    lead_name: str | None
    delivered_at: datetime | None
    warranty_until: date | None
    under_warranty: bool


# ---------- Builders ----------

def package_price(package: Package) -> int:
    return sum(line.qty * line.product.price for line in package.lines)


def package_out(package: Package) -> PackageOut:
    return PackageOut(id=package.id, code=package.code, name=package.name, type=package.type,
                      kw=package.kw, subsidy=package.subsidy, price=package_price(package))


def dispatch_detail(db: Session, dispatch: Dispatch) -> DispatchDetail:
    units = stock.scanned_units(db, dispatch)
    lines = [
        DispatchLineOut(
            product_id=line.product_id, code=line.product.code, name=line.product.name,
            tracking=line.product.tracking, qty=line.qty,
            scanned=[u.serial for u in units if u.product_id == line.product_id],
        )
        for line in stock.quote_lines(db, dispatch)
    ]
    required = sum(stock.required_serial_qty(db, dispatch).values())
    warranties = []
    if dispatch.status == DispatchStatus.DONE:
        warranties = [
            WarrantyOut(serial=u.serial, product_name=u.product.name, warranty_until=u.warranty_until)
            for u in dispatch.serial_units
        ]
    lead = dispatch.job.lead
    return DispatchDetail(
        id=dispatch.id, ref=dispatch.ref, status=dispatch.status,
        lead=LeadContact(name=lead.name, phone=lead.phone, address=lead.address),
        job_id=dispatch.job_id, job_ref=dispatch.job.ref, lines=lines,
        required_count=required, scanned_count=len(units),
        can_validate=dispatch.status == DispatchStatus.READY and len(units) == required,
        warranties=warranties,
    )


# ---------- Products and packages ----------

@router.get("/products", response_model=list[ProductOut])
def list_products(user=Depends(require_perm("products:read")), db: Session = Depends(get_db)):
    """All products, by code. Perm: products:read."""
    return list(db.scalars(select(Product).order_by(Product.code)))


@router.get("/packages", response_model=list[PackageOut])
def list_packages(user=Depends(require_perm("packages:read")), db: Session = Depends(get_db)):
    """All packages with their price (Σ line qty × current product price). Perm: packages:read."""
    return [package_out(p) for p in db.scalars(select(Package).order_by(Package.id))]


@router.get("/packages/{package_id}", response_model=PackageDetail)
def get_package(package_id: int, user=Depends(require_perm("packages:read")), db: Session = Depends(get_db)):
    """One package and its parts list. Perm: packages:read. 404 if unknown."""
    package = db.get(Package, package_id)
    if package is None:
        raise ApiError(404, "Package not found")
    lines = [
        PackageLineOut(product_id=l.product_id, code=l.product.code, name=l.product.name,
                       tracking=l.product.tracking, qty=l.qty, unit_price=l.product.price)
        for l in package.lines
    ]
    return PackageDetail(**package_out(package).model_dump(), lines=lines)


# ---------- Stock ----------

def stock_row(product: Product, reserved: dict[int, int]) -> StockRow:
    held = reserved.get(product.id, 0)
    return StockRow(product_id=product.id, code=product.code, name=product.name, tracking=product.tracking,
                    on_hand=product.qty_on_hand, reserved=held, free=product.qty_on_hand - held, cost=product.cost)


@router.get("/stock", response_model=list[StockRow])
def list_stock(user=Depends(require_perm("stock:read")), db: Session = Depends(get_db)):
    """On hand / reserved / free per stocked product (services excluded). Perm: stock:read."""
    reserved = stock.reserved_by_product(db)
    products = db.scalars(select(Product).where(Product.tracking != Tracking.SERVICE).order_by(Product.code))
    return [stock_row(p, reserved) for p in products]


@router.post("/stock/adjust", response_model=StockRow)
def adjust_stock(body: StockAdjustIn, user=Depends(require_perm("stock:write")), db: Session = Depends(get_db)):
    """Set a counted quantity (QTY/LOT products only). Perm: stock:write.
    Errors: 400 newQty < 0, 404 unknown product, 409 SERIAL/SERVICE product."""
    product = stock.adjust_stock(db, body.product_id, body.new_qty)
    db.commit()
    return stock_row(product, stock.reserved_by_product(db))


# ---------- Dispatches ----------

@router.get("/dispatches", response_model=list[DispatchListItem])
def list_dispatches(status: DispatchStatus | None = None, user=Depends(require_perm("dispatches:read")),
                    db: Session = Depends(get_db)):
    """Dispatches, newest first, optionally one status. Perm: dispatches:read."""
    query = select(Dispatch).order_by(Dispatch.id.desc())
    if status is not None:
        query = query.where(Dispatch.status == status)
    return [
        DispatchListItem(
            id=d.id, ref=d.ref, job_ref=d.job.ref, lead_name=d.job.lead.name, status=d.status,
            scheduled_date=d.job.scheduled_date, scanned_count=len(stock.scanned_units(db, d)),
            required_count=sum(stock.required_serial_qty(db, d).values()),
        )
        for d in db.scalars(query)
    ]


@router.get("/dispatches/{dispatch_id}", response_model=DispatchDetail)
def get_dispatch(dispatch_id: int, user=Depends(require_perm("dispatches:read")), db: Session = Depends(get_db)):
    """Dispatch with lines, scanned serials and (after DONE) warranties. Perm: dispatches:read. 404 if unknown."""
    return dispatch_detail(db, stock.get_dispatch(db, dispatch_id))


@router.post("/dispatches/{dispatch_id}/scan", response_model=DispatchDetail)
def scan(dispatch_id: int, body: SerialIn, user=Depends(require_perm("dispatches:write")),
         db: Session = Depends(get_db)):
    """Pick one serial for this dispatch. Perm: dispatches:write.
    Errors: 404 Unknown serial · 409 wrong product / not in stock / already scanned / product complete / not READY."""
    stock.scan_serial(db, dispatch_id, body.serial.strip())
    db.commit()
    return dispatch_detail(db, stock.get_dispatch(db, dispatch_id))


@router.post("/dispatches/{dispatch_id}/unscan", response_model=DispatchDetail)
def unscan(dispatch_id: int, body: SerialIn, user=Depends(require_perm("dispatches:write")),
           db: Session = Depends(get_db)):
    """Put a wrongly scanned serial back in stock. Perm: dispatches:write.
    Errors: 404 Unknown serial · 409 not scanned on this dispatch / dispatch not READY."""
    stock.unscan_serial(db, dispatch_id, body.serial.strip())
    db.commit()
    return dispatch_detail(db, stock.get_dispatch(db, dispatch_id))


@router.post("/dispatches/{dispatch_id}/validate", response_model=DispatchDetail)
def validate(dispatch_id: int, user=Depends(require_perm("dispatches:write")), db: Session = Depends(get_db)):
    """Ship it: stock down, serials DELIVERED with warranty, panel lots created, dispatch DONE, job DISPATCHED.
    Perm: dispatches:write. Errors: 409 Scan all serials first (n/m) · Not enough stock for <code> · not READY."""
    stock.validate_dispatch(db, dispatch_id)
    db.commit()
    return dispatch_detail(db, stock.get_dispatch(db, dispatch_id))


# ---------- Serials ----------

@router.get("/serials", response_model=list[SerialOut])
def search_serials(q: str = "", user=Depends(require_perm("serials:read")), db: Session = Depends(get_db)):
    """Find units by serial or customer name (max 50). Perm: serials:read."""
    query = select(SerialUnit).outerjoin(Lead, SerialUnit.lead_id == Lead.id).order_by(SerialUnit.serial).limit(50)
    if q.strip():
        pattern = f"%{q.strip()}%"
        query = query.where(or_(SerialUnit.serial.ilike(pattern), Lead.name.ilike(pattern)))
    today = date.today()
    return [
        SerialOut(serial=u.serial, product_name=u.product.name, status=u.status,
                  lead_name=u.lead.name if u.lead else None, delivered_at=u.delivered_at,
                  warranty_until=u.warranty_until,
                  # boundary: a warranty ending today still covers today
                  under_warranty=u.warranty_until is not None and u.warranty_until >= today)
        for u in db.scalars(query)
    ]


# ---------- Receipts ----------

class ReceiptLineIn(ApiModel):
    product_id: int
    qty: int = Field(ge=1, le=10000)
    unit_cost: int | None = Field(default=None, ge=0, le=10_000_000)  # empty = the product's usual cost


class ReceiptIn(ApiModel):
    vendor: str = Field(min_length=1, max_length=100)
    lines: list[ReceiptLineIn] = Field(min_length=1, max_length=50)


class ReceiveLineIn(ApiModel):
    line_id: int
    serials: list[str] = Field(max_length=10000)


class ReceiveIn(ApiModel):
    lines: list[ReceiveLineIn] = Field(default_factory=list, max_length=50)


class ReceiptListItem(ApiModel):
    id: int
    ref: str
    vendor: str
    status: ReceiptStatus
    line_count: int
    total_qty: int
    created_at: datetime
    received_at: datetime | None


class ReceiptLineOut(ApiModel):
    id: int
    product_id: int
    code: str
    name: str
    tracking: Tracking
    qty: int
    unit_cost: int
    serials: list[str]


class ReceiptDetail(ApiModel):
    id: int
    ref: str
    vendor: str
    status: ReceiptStatus
    created_at: datetime
    received_at: datetime | None
    lines: list[ReceiptLineOut]


def receipt_detail(receipt: Receipt) -> ReceiptDetail:
    lines = [
        ReceiptLineOut(id=l.id, product_id=l.product_id, code=l.product.code, name=l.product.name,
                       tracking=l.product.tracking, qty=l.qty, unit_cost=l.unit_cost, serials=l.serials)
        for l in receipt.lines
    ]
    return ReceiptDetail(id=receipt.id, ref=receipt.ref, vendor=receipt.vendor, status=receipt.status,
                         created_at=receipt.created_at, received_at=receipt.received_at, lines=lines)


@router.get("/receipts", response_model=list[ReceiptListItem])
def list_receipts(status: ReceiptStatus | None = None, user=Depends(require_perm("stock:read")),
                  db: Session = Depends(get_db)):
    """Receipts, newest first, optionally one status. Perm: stock:read."""
    query = select(Receipt).order_by(Receipt.id.desc())
    if status is not None:
        query = query.where(Receipt.status == status)
    return [
        ReceiptListItem(id=r.id, ref=r.ref, vendor=r.vendor, status=r.status, line_count=len(r.lines),
                        total_qty=sum(l.qty for l in r.lines), created_at=r.created_at, received_at=r.received_at)
        for r in db.scalars(query)
    ]


@router.get("/receipts/{receipt_id}", response_model=ReceiptDetail)
def get_receipt(receipt_id: int, user=Depends(require_perm("stock:read")), db: Session = Depends(get_db)):
    """One receipt with its lines (and serials once received). Perm: stock:read. 404 if unknown."""
    return receipt_detail(stock.get_receipt(db, receipt_id))


@router.post("/receipts", response_model=ReceiptDetail, status_code=201)
def create_receipt(body: ReceiptIn, user=Depends(require_perm("stock:write")), db: Session = Depends(get_db)):
    """Record goods on the way (DRAFT); stock doesn't change until it's received. Perm: stock:write.
    Errors: 400 bad vendor / qty / cost, or a service product · 404 unknown product."""
    vendor = body.vendor.strip()
    if not vendor:
        raise ApiError(400, "Vendor is required", "vendor")
    receipt = stock.create_receipt(db, vendor, [(l.product_id, l.qty, l.unit_cost) for l in body.lines])
    db.commit()
    return receipt_detail(receipt)


@router.delete("/receipts/{receipt_id}", status_code=204)
def delete_receipt(receipt_id: int, user=Depends(require_perm("stock:write")), db: Session = Depends(get_db)):
    """Delete a DRAFT receipt (to change one, delete it and create it again). Perm: stock:write.
    Errors: 404 unknown · 409 already received."""
    stock.delete_receipt(db, receipt_id)
    db.commit()
    return Response(status_code=204)


@router.post("/receipts/{receipt_id}/receive", response_model=ReceiptDetail)
def receive_receipt(receipt_id: int, body: ReceiveIn, user=Depends(require_perm("stock:write")),
                    db: Session = Depends(get_db)):
    """Count the goods in: new IN_STOCK serial units for SERIAL lines, stock up for every line, receipt DONE.
    Perm: stock:write. Errors: 400 serials on a counted line / unknown line · 404 unknown receipt ·
    409 already received / wrong number of serials / serial entered twice / serial already exists."""
    receipt = stock.receive_receipt(db, receipt_id, {l.line_id: l.serials for l in body.lines})
    try:
        db.commit()
    except IntegrityError:
        # the unique serial column caught a unit someone else added between our check and our commit
        db.rollback()
        raise ApiError(409, "One of these serials was just added by someone else, check and retry", "lines")
    return receipt_detail(receipt)
