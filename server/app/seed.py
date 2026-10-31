"""`npm run reset` (= python -m app.seed): drop every table, recreate them, insert the demo data (BUILD_PLAN §10).

Master data (users, products, packages, serial stock) + one customer in every demo state.
The seed writes rows directly: it uses no router or service, so it runs even before other members' files exist.
"""
import math
from datetime import date, datetime, time, timedelta, timezone

import bcrypt

from app.dates import add_months
from app.db import Base, SessionLocal, engine
from app.models import (
    Counter,
    Dispatch,
    DispatchStatus,
    Invoice,
    InvoiceStatus,
    InvoiceType,
    Job,
    JobStatus,
    Lead,
    LeadSource,
    LeadStage,
    Package,
    PackageLine,
    PackageType,
    Product,
    Quotation,
    QuoteLine,
    QuoteStatus,
    Role,
    SerialStatus,
    SerialUnit,
    Survey,
    SurveyStatus,
    SystemType,
    Ticket,
    TicketStatus,
    Tracking,
    User,
)

PASSWORD = "sun123"
COUNTER_KEYS = ["ENQ", "SRV", "SQ", "JOB", "SP/OUT", "TKT", "INV"]

USERS = [
    # login_id, name, role, hourly_rate
    ("ravi", "Ravi Menon", Role.DIRECTOR, 0),
    ("priya", "Priya Shah", Role.SALES, 0),
    ("karan", "Karan Mehta", Role.SALES, 0),
    ("vikram", "Vikram Rao", Role.TECHNICIAN, 400),
    ("arjun", "Arjun Nair", Role.TECHNICIAN, 400),
    ("sameer", "Sameer Khan", Role.TECHNICIAN, 400),
    ("deepa", "Deepa Iyer", Role.WAREHOUSE, 0),
    ("farhan", "Farhan Ali", Role.SUPPORT, 0),
]

PRODUCTS = [
    # code, name, tracking, warranty_months, cost, price, qty_on_hand (SERIAL qty comes from SERIAL_STOCK)
    ("PNL-545", "Solar panel 545 Wp", Tracking.LOT, 240, 11500, 14000, 200),
    ("INV-OG3", "On-grid inverter 3 kW", Tracking.SERIAL, 24, 38000, 46000, 0),
    ("INV-OG5", "On-grid inverter 5 kW", Tracking.SERIAL, 24, 52000, 63000, 0),
    ("INV-OF5", "Off-grid inverter 5 kVA", Tracking.SERIAL, 24, 47000, 58000, 0),
    ("BAT-150", "Battery 150 Ah", Tracking.SERIAL, 24, 14500, 18000, 0),
    ("CC-60", "Charge controller 60 A", Tracking.SERIAL, 24, 6800, 8500, 0),
    ("MS-KW", "Mounting stand set (per kW)", Tracking.QTY, 0, 4200, 5500, 60),
    ("DB-SET", "AC/DC wiring box set", Tracking.QTY, 0, 3100, 4200, 30),
    ("CAB-DC4", "DC cable 4 sq mm (m)", Tracking.QTY, 0, 55, 80, 2000),
    ("ERT-KIT", "Earthing kit", Tracking.QTY, 0, 2400, 3200, 40),
    ("SVC-INST", "Installation (service)", Tracking.SERVICE, 0, 0, 15000, 0),
]

# product code -> how many units are in stock; serials look like INV-OG3-26A0001
SERIAL_STOCK = {"INV-OG3": 8, "INV-OG5": 4, "INV-OF5": 3, "BAT-150": 12, "CC-60": 10}

# a tiny white PNG: stands in for a real customer signature / site photo in seeded finished jobs
SIGNATURE = ("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
             "/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==")
PHOTO = "/brand/logo.jpg"

NOW = datetime.now(timezone.utc)
TODAY = NOW.date()


def days_ago(days: int, hour: int = 10) -> datetime:
    return datetime.combine(TODAY - timedelta(days=days), time(hour), tzinfo=timezone.utc)


# ---------- Master data ----------

def subsidy_for(kw: int, system_type: PackageType) -> int:
    """Sample rooftop subsidy: on-grid only, ₹30,000 per kW up to 2 kW, flat ₹78,000 from 3 kW."""
    if system_type != PackageType.ON_GRID:
        return 0
    return 30000 * kw if kw <= 2 else 78000


def system_lines(kw: int, system_type: PackageType) -> list[tuple[str, int]]:
    """Parts list for an ON-n / OFF-n package, as (product code, qty)."""
    if system_type == PackageType.ON_GRID:
        inverter = "INV-OG3" if kw <= 3 else "INV-OG5"
    else:
        inverter = "INV-OF5"
    lines = [
        ("PNL-545", math.ceil(kw * 1000 / 545)),
        (inverter, 1),
        ("CC-60", 1),
        ("MS-KW", kw),
        ("DB-SET", 1),
        ("CAB-DC4", 10 * kw),
        ("ERT-KIT", 3),
        ("SVC-INST", 1),
    ]
    if system_type == PackageType.OFF_GRID:
        lines.append(("BAT-150", 2 if kw <= 3 else 4))
    return lines


def seed_users(db) -> dict[str, User]:
    # one hash for everyone: bcrypt with 12 rounds is slow on purpose, and they share a password
    password_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(12)).decode()
    users = {}
    for login_id, name, role, rate in USERS:
        users[login_id] = User(login_id=login_id, name=name, role=role, hourly_rate=rate,
                               password_hash=password_hash)
        db.add(users[login_id])
    return users


def seed_products(db) -> dict[str, Product]:
    products = {}
    for code, name, tracking, warranty, cost, price, qty in PRODUCTS:
        products[code] = Product(code=code, name=name, tracking=tracking, warranty_months=warranty,
                                 cost=cost, price=price, qty_on_hand=qty)
        db.add(products[code])
    return products


def seed_serials(db, products: dict[str, Product]) -> dict[str, list[SerialUnit]]:
    """In-stock units; returned per product code so the demo orders can take some of them."""
    stock = {}
    for code, count in SERIAL_STOCK.items():
        product = products[code]
        stock[code] = [SerialUnit(serial=f"{code}-26A{n:04d}", product=product, unit_cost=product.cost)
                       for n in range(1, count + 1)]
        db.add_all(stock[code])
        # for SERIAL products, on-hand is exactly the number of units in stock
        product.qty_on_hand = count
    return stock


def add_package(db, products, code, name, type_, kw, subsidy, lines) -> Package:
    package = Package(code=code, name=name, type=type_, kw=kw, subsidy=subsidy)
    for product_code, qty in lines:
        package.lines.append(PackageLine(product=products[product_code], qty=qty))
    db.add(package)
    return package


def seed_packages(db, products: dict[str, Product]) -> dict[str, Package]:
    packages = {}
    for kw in range(1, 6):
        for type_, prefix, label in ((PackageType.ON_GRID, "ON", "On-Grid"), (PackageType.OFF_GRID, "OFF", "Off-Grid")):
            code = f"{prefix}-{kw}"
            packages[code] = add_package(db, products, code, f"{label} {kw} kW system", type_, kw,
                                         subsidy_for(kw, type_), system_lines(kw, type_))
    add_package(db, products, "PANEL-SET", "Panel set 1 kW (hardware only)", PackageType.HARDWARE, 1, 0,
                [("PNL-545", math.ceil(1000 / 545)), ("CAB-DC4", 10)])
    add_package(db, products, "INSTALL", "Installation only", PackageType.SERVICE, 0, 0, [("SVC-INST", 1)])
    return packages


# ---------- Demo customers ----------

class Demo:
    """Builds demo records in the same shape the real endpoints would leave them."""

    def __init__(self, db, users, products, packages, stock):
        self.db, self.users, self.products, self.packages, self.stock = db, users, products, packages, stock
        self.counters = {key: Counter(key=key, next=1) for key in COUNTER_KEYS}
        db.add_all(self.counters.values())
        self.old_serials = 0  # numbering for units of old installs

    def ref(self, key: str) -> str:
        counter = self.counters[key]
        n, counter.next = counter.next, counter.next + 1
        return f"{key}/{n:04d}"

    def lead(self, name, phone, kw, system_type, stage, source=LeadSource.CALL, created=None, **extra) -> Lead:
        lead = Lead(ref=self.ref("ENQ"), name=name, phone=phone, address=f"{name.split()[0]} House, Pune",
                    kw=kw, system_type=system_type, monthly_bill=800 * kw + 1000, subsidy_interest=True,
                    source=source, stage=stage, salesperson=self.users["priya"],
                    created_at=created or NOW, **extra)
        if stage not in (LeadStage.NEW, LeadStage.CONTACTED):
            lead.roof_area, lead.grid_ok = 120 * kw, True
        self.db.add(lead)
        return lead

    def survey(self, lead: Lead, status: SurveyStatus, technician="vikram", when=None) -> Survey:
        survey = Survey(ref=self.ref("SRV"), lead=lead, technician=self.users[technician],
                        visit_date=when or NOW, status=status)
        if status in (SurveyStatus.SUBMITTED, SurveyStatus.APPROVED):
            survey.direction, survey.tilt, survey.cable_distance, survey.area = "S", 18, 14.0, lead.roof_area
            survey.photos = [PHOTO]
        if status == SurveyStatus.APPROVED:
            survey.approved_by, survey.approved_at = self.users["priya"], when or NOW
        self.db.add(survey)
        return survey

    def quote(self, lead: Lead, package_code: str, status: QuoteStatus, created=None) -> Quotation:
        package = self.packages[package_code]
        quote = Quotation(ref=self.ref("SQ"), lead=lead, package=package, status=status,
                          subsidy=package.subsidy if lead.subsidy_interest else 0, created_at=created or NOW)
        for pl in package.lines:
            quote.lines.append(QuoteLine(product=pl.product, qty=pl.qty, unit_price=pl.product.price))
        quote.total = sum(line.qty * line.unit_price for line in quote.lines)
        self.db.add(quote)
        return quote

    def invoice(self, quote: Quotation, type_: InvoiceType, amount: int, status: InvoiceStatus, when=None):
        when = when or NOW
        self.db.add(Invoice(ref=self.ref("INV"), lead=quote.lead, quotation=quote, type=type_, amount=amount,
                            status=status, created_at=when, paid_at=when if status == InvoiceStatus.PAID else None))

    def confirm(self, quote: Quotation, technician: str, crew: str, scheduled: date, when=None) -> Job:
        quote.status, quote.confirmed_at = QuoteStatus.CONFIRMED, when or NOW
        quote.lead.stage = LeadStage.WON
        job = Job(ref=self.ref("JOB"), quotation=quote, lead=quote.lead, technician=self.users[technician],
                  crew=crew, scheduled_date=scheduled)
        self.db.add(job)
        self.db.add(Dispatch(ref=self.ref("SP/OUT"), quotation=quote, job=job))
        return job

    def sold(self, lead, package_code, technician, crew, days, paid_in_full=True) -> Job:
        """Survey approved, quoted, paid (full, or ₹50,000 advance + balance due) and confirmed `days` ago."""
        self.survey(lead, SurveyStatus.APPROVED, technician, days_ago(days + 3))
        quote = self.quote(lead, package_code, QuoteStatus.SENT, days_ago(days + 2))
        net = quote.total - quote.subsidy
        if paid_in_full:
            self.invoice(quote, InvoiceType.FULL, net, InvoiceStatus.PAID, days_ago(days))
        else:
            self.invoice(quote, InvoiceType.ADVANCE, 50000, InvoiceStatus.PAID, days_ago(days))
            self.invoice(quote, InvoiceType.BALANCE, net - 50000, InvoiceStatus.DUE, days_ago(days))
        return self.confirm(quote, technician, crew, (days_ago(days) + timedelta(days=2)).date(), days_ago(days))

    def deliver(self, job: Job, delivered_at: datetime, old_batch: str | None = None, special=None) -> None:
        """What validate does. Today's orders take units from stock; old installs (old_batch) get their own
        serials, e.g. INV-OF5-23C0001, because they left the warehouse long before today's stock count."""
        special = dict(special or {})  # copy: each special serial is used once
        dispatch = job.dispatch
        for line in job.quotation.lines:
            product = line.product
            if product.tracking == Tracking.SERVICE:
                continue
            if product.tracking == Tracking.LOT:
                unit = SerialUnit(serial=f"LOT-{dispatch.ref}-{product.code}", product=product, qty=line.qty,
                                  unit_cost=product.cost)
                self.db.add(unit)
                units = [unit]
            elif product.tracking == Tracking.SERIAL and old_batch:
                units = []
                for _ in range(line.qty):
                    self.old_serials += 1
                    serial = special.pop(product.code, None) or f"{product.code}-{old_batch}{self.old_serials:04d}"
                    units.append(SerialUnit(serial=serial, product=product, unit_cost=product.cost))
                self.db.add_all(units)
            elif product.tracking == Tracking.SERIAL:
                units = [self.stock[product.code].pop(0) for _ in range(line.qty)]
            else:
                units = []
            if not old_batch:
                product.qty_on_hand -= line.qty
            for unit in units:
                unit.status, unit.dispatch, unit.lead = SerialStatus.DELIVERED, dispatch, job.lead
                unit.delivered_at = delivered_at
                unit.warranty_until = add_months(delivered_at.date(), product.warranty_months)
        dispatch.status, dispatch.delivered_at = DispatchStatus.DONE, delivered_at
        job.status = JobStatus.DISPATCHED

    def finish(self, job: Job, started: datetime, hours: int) -> None:
        job.status, job.started_at = JobStatus.DONE, started
        job.finished_at = started + timedelta(hours=hours)
        job.size_confirmed, job.signature, job.photos = job.lead.kw, SIGNATURE, [PHOTO]


def seed_demo(demo: Demo) -> None:
    on, off = SystemType.ON_GRID, SystemType.OFF_GRID
    # scene 1: enquiries at every early stage
    demo.lead("Meera Joshi", "9822000001", 3, on, LeadStage.NEW, LeadSource.WEB)
    demo.lead("Rahul Verma", "9822000002", 2, on, LeadStage.CONTACTED, LeadSource.WHATSAPP,
              call_notes="Asked to call back after the bill arrives", created=days_ago(2))
    kavita = demo.lead("Kavita Patil", "9822000003", 3, on, LeadStage.SURVEY_SCHEDULED, created=days_ago(4))
    demo.survey(kavita, SurveyStatus.SUBMITTED, when=days_ago(1))                       # ready to approve
    suresh = demo.lead("Suresh Reddy", "9822000004", 4, on, LeadStage.SURVEY_APPROVED, created=days_ago(5))
    demo.survey(suresh, SurveyStatus.APPROVED, when=days_ago(2))                        # ready to quote

    # scene 2: a quote sent but unpaid, and one paid but not confirmed
    neha = demo.lead("Neha Gupta", "9822000005", 2, on, LeadStage.QUOTED, created=days_ago(6))
    demo.survey(neha, SurveyStatus.APPROVED, when=days_ago(4))
    demo.quote(neha, "ON-2", QuoteStatus.SENT, days_ago(3))
    imran = demo.lead("Imran Shaikh", "9822000006", 5, on, LeadStage.QUOTED, created=days_ago(7))
    demo.survey(imran, SurveyStatus.APPROVED, when=days_ago(5))
    imran_quote = demo.quote(imran, "ON-5", QuoteStatus.SENT, days_ago(4))
    demo.invoice(imran_quote, InvoiceType.ADVANCE, 50000, InvoiceStatus.PAID, days_ago(1))

    # scene 3: confirmed ON-3 waiting at the warehouse (needs 2 scans: inverter + controller)
    pooja = demo.lead("Pooja Nair", "9822000007", 3, on, LeadStage.QUOTED, created=days_ago(8))
    demo.sold(pooja, "ON-3", "vikram", "Arjun", days=0, paid_in_full=False)

    # scene 4: kit delivered, vikram can start today
    manoj = demo.lead("Manoj Pillai", "9822000008", 2, on, LeadStage.QUOTED, created=days_ago(10))
    manoj_job = demo.sold(manoj, "ON-2", "vikram", "Sameer", days=2)
    manoj_job.scheduled_date = TODAY
    demo.deliver(manoj_job, days_ago(1, 16))

    # a finished, profitable job
    anil = demo.lead("Anil Deshmukh", "9822000009", 3, on, LeadStage.QUOTED, created=days_ago(20))
    anil_job = demo.sold(anil, "ON-3", "arjun", "Sameer", days=8, paid_in_full=False)
    demo.deliver(anil_job, days_ago(6, 9))
    demo.finish(anil_job, days_ago(5, 9), hours=6)

    # scene 5: Ramesh (off-grid, inverter still covered) and Sunita (inverter warranty expired ~8 months ago)
    ramesh = demo.lead("Ramesh Kulkarni", "9822000010", 3, off, LeadStage.QUOTED, created=days_ago(560))
    ramesh_job = demo.sold(ramesh, "OFF-3", "sameer", "Vikram", days=550)
    demo.deliver(ramesh_job, days_ago(545), "23C", {"INV-OF5": "INV-OF5-23C0412"})
    demo.finish(ramesh_job, days_ago(544, 9), hours=7)
    sunita = demo.lead("Sunita Desai", "9822000011", 3, on, LeadStage.QUOTED, created=days_ago(980))
    sunita_job = demo.sold(sunita, "ON-3", "arjun", "Vikram", days=970)
    demo.deliver(sunita_job, days_ago(965), "22B", {"INV-OG3": "INV-OG3-22B0077"})
    demo.finish(sunita_job, days_ago(964, 9), hours=6)

    # Ramesh's free inverter repair is large enough to turn his job into a loss (profit report demo)
    ramesh_inverter = next(u for u in ramesh_job.dispatch.serial_units if u.serial == "INV-OF5-23C0412")
    demo.db.add(Ticket(ref=demo.ref("TKT"), serial_unit=ramesh_inverter, lead=ramesh,
                       issue="Inverter shuts down at noon", status=TicketStatus.RESOLVED, under_warranty=True,
                       technician=demo.users["sameer"], parts_cost=52000, labour_cost=6000, bill_amount=0,
                       created_at=days_ago(12), resolved_at=days_ago(10)))


def main() -> None:
    # importing app.models above registered every table on Base.metadata
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db, db.begin():
        users = seed_users(db)
        products = seed_products(db)
        stock = seed_serials(db, products)
        packages = seed_packages(db, products)
        seed_demo(Demo(db, users, products, packages, stock))
    print(f"Seeded {len(USERS)} users, {len(PRODUCTS)} products, 12 packages, "
          f"{sum(SERIAL_STOCK.values())} serial units in stock, 11 demo customers. Password for everyone: {PASSWORD}")


if __name__ == "__main__":
    main()
