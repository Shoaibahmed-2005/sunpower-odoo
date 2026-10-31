"""All SQLAlchemy tables and enums (BUILD_PLAN §5). Owner: A only; others request changes via [SCHEMA].

Money is integer rupees. Times are timezone-aware UTC.
"""
import enum
from datetime import date, datetime, timezone

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Enums (str, so role.value == "DIRECTOR" and JSON shows the name) ----------

class Role(str, enum.Enum):
    DIRECTOR = "DIRECTOR"
    SALES = "SALES"
    TECHNICIAN = "TECHNICIAN"
    WAREHOUSE = "WAREHOUSE"
    SUPPORT = "SUPPORT"


class LeadSource(str, enum.Enum):
    WEB = "WEB"
    WHATSAPP = "WHATSAPP"
    CALL = "CALL"


class SystemType(str, enum.Enum):
    ON_GRID = "ON_GRID"
    OFF_GRID = "OFF_GRID"


class LeadStage(str, enum.Enum):
    NEW = "NEW"
    CONTACTED = "CONTACTED"
    QUALIFIED = "QUALIFIED"
    SURVEY_SCHEDULED = "SURVEY_SCHEDULED"
    SURVEY_APPROVED = "SURVEY_APPROVED"
    QUOTED = "QUOTED"
    WON = "WON"
    LOST = "LOST"


class SurveyStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Tracking(str, enum.Enum):
    SERIAL = "SERIAL"    # one row per unit, scanned at dispatch (inverter, battery, controller)
    LOT = "LOT"          # panels: one serial_units row per dispatch line, created on validate
    QTY = "QTY"          # counted only (stands, cable, boxes)
    SERVICE = "SERVICE"  # labour, never in stock


class PackageType(str, enum.Enum):
    HARDWARE = "HARDWARE"
    ON_GRID = "ON_GRID"
    OFF_GRID = "OFF_GRID"
    SERVICE = "SERVICE"


class QuoteStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class InvoiceType(str, enum.Enum):
    ADVANCE = "ADVANCE"
    BALANCE = "BALANCE"
    FULL = "FULL"
    REPAIR = "REPAIR"


class InvoiceStatus(str, enum.Enum):
    DUE = "DUE"
    PAID = "PAID"


class JobStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    DISPATCHED = "DISPATCHED"
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class DispatchStatus(str, enum.Enum):
    READY = "READY"
    DONE = "DONE"
    CANCELLED = "CANCELLED"


class SerialStatus(str, enum.Enum):
    IN_STOCK = "IN_STOCK"
    PICKED = "PICKED"
    DELIVERED = "DELIVERED"


class TicketStatus(str, enum.Enum):
    NEW = "NEW"
    ASSIGNED = "ASSIGNED"
    IN_REPAIR = "IN_REPAIR"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


# ---------- Tables ----------

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    login_id: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(Enum(Role))
    hourly_rate: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Counter(Base):
    """Next number for each reference series (ENQ/0007). Incremented atomically by refs.next_ref."""
    __tablename__ = "counters"
    key: Mapped[str] = mapped_column(String(20), primary_key=True)
    next: Mapped[int] = mapped_column(Integer, default=1)


class Lead(Base):
    __tablename__ = "leads"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(10), index=True)
    email: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(300))
    kw: Mapped[float] = mapped_column(Float)
    system_type: Mapped[SystemType] = mapped_column(Enum(SystemType))
    monthly_bill: Mapped[int] = mapped_column(Integer)
    subsidy_interest: Mapped[bool] = mapped_column(Boolean)
    source: Mapped[LeadSource] = mapped_column(Enum(LeadSource))
    roof_area: Mapped[int | None] = mapped_column(Integer)
    grid_ok: Mapped[bool | None] = mapped_column(Boolean)
    call_notes: Mapped[str | None] = mapped_column(Text)
    stage: Mapped[LeadStage] = mapped_column(Enum(LeadStage), default=LeadStage.NEW)
    lost_reason: Mapped[str | None] = mapped_column(String(300))
    salesperson_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    salesperson: Mapped[User | None] = relationship()
    surveys: Mapped[list["Survey"]] = relationship(back_populates="lead")
    quotations: Mapped[list["Quotation"]] = relationship(back_populates="lead")


class Survey(Base):
    __tablename__ = "surveys"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(20), unique=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"))
    technician_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    visit_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    direction: Mapped[str | None] = mapped_column(String(2))  # N, NE, E, SE, S, SW, W, NW
    tilt: Mapped[int | None] = mapped_column(Integer)
    cable_distance: Mapped[float | None] = mapped_column(Float)
    area: Mapped[int | None] = mapped_column(Integer)
    photos: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[SurveyStatus] = mapped_column(Enum(SurveyStatus), default=SurveyStatus.SCHEDULED)
    reject_reason: Mapped[str | None] = mapped_column(String(300))
    approved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lead: Mapped[Lead] = relationship(back_populates="surveys")
    # two FKs point at users, so each relationship names the column it follows
    technician: Mapped[User] = relationship(foreign_keys=[technician_id])
    approved_by: Mapped[User | None] = relationship(foreign_keys=[approved_by_id])


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    tracking: Mapped[Tracking] = mapped_column(Enum(Tracking))
    warranty_months: Mapped[int] = mapped_column(Integer)
    cost: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)
    qty_on_hand: Mapped[int] = mapped_column(Integer, default=0)


class Package(Base):
    __tablename__ = "packages"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)  # ON-3
    name: Mapped[str] = mapped_column(String(100))
    type: Mapped[PackageType] = mapped_column(Enum(PackageType))
    kw: Mapped[float] = mapped_column(Float)
    subsidy: Mapped[int] = mapped_column(Integer, default=0)

    lines: Mapped[list["PackageLine"]] = relationship(back_populates="package")


class PackageLine(Base):
    __tablename__ = "package_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    qty: Mapped[int] = mapped_column(Integer)

    package: Mapped[Package] = relationship(back_populates="lines")
    product: Mapped[Product] = relationship()


class Quotation(Base):
    __tablename__ = "quotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(20), unique=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"))
    package_id: Mapped[int] = mapped_column(ForeignKey("packages.id"))
    status: Mapped[QuoteStatus] = mapped_column(Enum(QuoteStatus), default=QuoteStatus.DRAFT)
    total: Mapped[int] = mapped_column(Integer)
    subsidy: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lead: Mapped[Lead] = relationship(back_populates="quotations")
    package: Mapped[Package] = relationship()
    lines: Mapped[list["QuoteLine"]] = relationship(back_populates="quotation", cascade="all, delete-orphan")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="quotation")


class QuoteLine(Base):
    __tablename__ = "quote_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    quotation_id: Mapped[int] = mapped_column(ForeignKey("quotations.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    qty: Mapped[int] = mapped_column(Integer)
    # copied from product.price when the quote is made, so a later price change doesn't alter a sent quote
    unit_price: Mapped[int] = mapped_column(Integer)

    quotation: Mapped[Quotation] = relationship(back_populates="lines")
    product: Mapped[Product] = relationship()


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(20), unique=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"))
    quotation_id: Mapped[int | None] = mapped_column(ForeignKey("quotations.id"))
    ticket_id: Mapped[int | None] = mapped_column(ForeignKey("tickets.id"))
    type: Mapped[InvoiceType] = mapped_column(Enum(InvoiceType))
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    lead: Mapped[Lead] = relationship()
    quotation: Mapped[Quotation | None] = relationship(back_populates="invoices")
    ticket: Mapped["Ticket | None"] = relationship()


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(20), unique=True)
    # unique: one confirmed quotation makes exactly one job
    quotation_id: Mapped[int] = mapped_column(ForeignKey("quotations.id"), unique=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"))
    technician_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    crew: Mapped[str] = mapped_column(String(300), default="")  # names, comma separated
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.SCHEDULED)
    scheduled_date: Mapped[date] = mapped_column(Date)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    size_confirmed: Mapped[float | None] = mapped_column(Float)
    signature: Mapped[str | None] = mapped_column(Text)  # data URL from the signature pad
    photos: Mapped[list] = mapped_column(JSON, default=list)

    quotation: Mapped[Quotation] = relationship()
    lead: Mapped[Lead] = relationship()
    technician: Mapped[User] = relationship()
    dispatch: Mapped["Dispatch | None"] = relationship(back_populates="job", uselist=False)


class Dispatch(Base):
    __tablename__ = "dispatches"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(20), unique=True)
    quotation_id: Mapped[int] = mapped_column(ForeignKey("quotations.id"))
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id"))
    status: Mapped[DispatchStatus] = mapped_column(Enum(DispatchStatus), default=DispatchStatus.READY)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    quotation: Mapped[Quotation] = relationship()
    job: Mapped[Job] = relationship(back_populates="dispatch")
    serial_units: Mapped[list["SerialUnit"]] = relationship(back_populates="dispatch")


class SerialUnit(Base):
    __tablename__ = "serial_units"
    id: Mapped[int] = mapped_column(primary_key=True)
    # unique: the same physical unit can never be in stock twice or go to two customers
    serial: Mapped[str] = mapped_column(String(60), unique=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    qty: Mapped[int] = mapped_column(Integer, default=1)  # > 1 only for panel lots
    status: Mapped[SerialStatus] = mapped_column(Enum(SerialStatus), default=SerialStatus.IN_STOCK)
    unit_cost: Mapped[int] = mapped_column(Integer)
    dispatch_id: Mapped[int | None] = mapped_column(ForeignKey("dispatches.id"))
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # stored once at delivery; "under warranty" is computed as warranty_until >= today
    warranty_until: Mapped[date | None] = mapped_column(Date)

    product: Mapped[Product] = relationship()
    dispatch: Mapped[Dispatch | None] = relationship(back_populates="serial_units")
    lead: Mapped[Lead | None] = relationship()


class Ticket(Base):
    __tablename__ = "tickets"
    id: Mapped[int] = mapped_column(primary_key=True)
    ref: Mapped[str] = mapped_column(String(20), unique=True)
    serial_unit_id: Mapped[int | None] = mapped_column(ForeignKey("serial_units.id"))
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"))
    issue: Mapped[str] = mapped_column(Text)
    status: Mapped[TicketStatus] = mapped_column(Enum(TicketStatus), default=TicketStatus.NEW)
    # decided once when the ticket is opened, so a warranty that lapses mid-repair doesn't change the bill
    under_warranty: Mapped[bool] = mapped_column(Boolean)
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    parts_cost: Mapped[int] = mapped_column(Integer, default=0)
    labour_cost: Mapped[int] = mapped_column(Integer, default=0)
    bill_amount: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    customer_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    serial_unit: Mapped[SerialUnit | None] = relationship()
    lead: Mapped[Lead] = relationship()
    technician: Mapped[User | None] = relationship()
