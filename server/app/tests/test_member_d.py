"""Tests for Member D: job start/finish gates and ticket transitions.
Uses isolated in-memory SQLite DB so it never touches Postgres.
"""
from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password
from app.db import Base, get_db
from app.main import app
from app.models import (
    Counter,
    Dispatch,
    DispatchStatus,
    Invoice,
    InvoiceType,
    InvoiceStatus,
    Job,
    JobStatus,
    Lead,
    LeadSource,
    LeadStage,
    Product,
    Role,
    SerialStatus,
    SerialUnit,
    SystemType,
    Ticket,
    TicketStatus,
    Tracking,
    User,
)

engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestSession = sessionmaker(bind=engine, expire_on_commit=False)
PASSWORD = "sun123"

SAMPLE_SIG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGP6zwAA/8cB+f+vWn8AAAAASUVORK5CYII="


def override_db():
    with TestSession() as db:
        yield db


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestSession() as db:
        pw = hash_password(PASSWORD)
        ravi = User(name="Ravi", login_id="ravi", password_hash=pw, role=Role.ADMIN)
        priya = User(name="Priya", login_id="priya", password_hash=pw, role=Role.SALES)
        vikram = User(name="Vikram", login_id="vikram", password_hash=pw, role=Role.TECHNICIAN)
        arjun = User(name="Arjun", login_id="arjun", password_hash=pw, role=Role.TECHNICIAN)
        deepa = User(name="Deepa", login_id="deepa", password_hash=pw, role=Role.WAREHOUSE)
        farhan = User(name="Farhan", login_id="farhan", password_hash=pw, role=Role.SUPPORT)
        db.add_all([ravi, priya, vikram, arjun, deepa, farhan])

        for k in ["ENQ", "SRV", "SQ", "JOB", "SP/OUT", "TKT", "INV"]:
            db.add(Counter(key=k, next=1))

        # Test Lead
        lead = Lead(
            ref="ENQ/0001",
            name="Ramesh Test",
            phone="9822000001",
            address="123 Sol Park",
            kw=3.0,
            system_type=SystemType.ON_GRID,
            monthly_bill=3500,
            subsidy_interest=True,
            source=LeadSource.WEB,
            stage=LeadStage.WON,
        )
        db.add(lead)
        db.flush()

        # Test Product
        prod = Product(
            code="INV-OG3",
            name="On-grid inverter 3 kW",
            tracking=Tracking.SERIAL,
            warranty_months=24,
            cost=25000,
            price=35000,
            qty_on_hand=10,
        )
        db.add(prod)
        db.flush()

        # Serial unit 1: Expired warranty
        su_expired = SerialUnit(
            serial="INV-EXP-001",
            product_id=prod.id,
            lead_id=lead.id,
            qty=1,
            unit_cost=25000,
            status=SerialStatus.DELIVERED,
            delivered_at=date(2020, 1, 1),
            warranty_until=date(2022, 1, 1),
        )
        # Serial unit 2: Covered under warranty
        su_covered = SerialUnit(
            serial="INV-COV-001",
            product_id=prod.id,
            lead_id=lead.id,
            qty=1,
            unit_cost=25000,
            status=SerialStatus.DELIVERED,
            delivered_at=date(2025, 1, 1),
            warranty_until=date(2027, 1, 1),
        )
        db.add_all([su_expired, su_covered])
        db.flush()

        # Job 1: Assigned to Vikram, Dispatch NOT done (READY)
        j1 = Job(
            ref="JOB/0001",
            quotation_id=1,
            lead_id=lead.id,
            technician_id=vikram.id,
            crew="Arjun",
            scheduled_date=date.today(),
            status=JobStatus.DISPATCHED,
            photos=[],
        )
        db.add(j1)
        db.flush()
        d1 = Dispatch(
            ref="SP/OUT/0001",
            quotation_id=1,
            job_id=j1.id,
            status=DispatchStatus.READY,
        )
        db.add(d1)

        # Job 2: Assigned to Vikram, Dispatch DONE, status IN_PROGRESS
        j2 = Job(
            ref="JOB/0002",
            quotation_id=2,
            lead_id=lead.id,
            technician_id=vikram.id,
            crew="Arjun",
            scheduled_date=date.today(),
            status=JobStatus.IN_PROGRESS,
            started_at=datetime.now(timezone.utc),
            photos=[],
        )
        db.add(j2)
        db.flush()
        d2 = Dispatch(
            ref="SP/OUT/0002",
            quotation_id=2,
            job_id=j2.id,
            status=DispatchStatus.DONE,
        )
        db.add(d2)

        # Job 3: Assigned to Arjun
        j3 = Job(
            ref="JOB/0003",
            quotation_id=3,
            lead_id=lead.id,
            technician_id=arjun.id,
            crew="Vikram",
            scheduled_date=date.today(),
            status=JobStatus.DISPATCHED,
            photos=[],
        )
        db.add(j3)
        db.flush()
        d3 = Dispatch(
            ref="SP/OUT/0003",
            quotation_id=3,
            job_id=j3.id,
            status=DispatchStatus.DONE,
        )
        db.add(d3)

        db.commit()

    app.dependency_overrides[get_db] = override_db
    yield
    app.dependency_overrides.clear()


def client_as(login_id: str | None) -> TestClient:
    c = TestClient(app)
    if login_id:
        r = c.post("/api/auth/login", json={"loginId": login_id, "password": PASSWORD})
        assert r.status_code == 200, r.text
    return c


def test_start_409_before_dispatch_done():
    """Start 409 before dispatch DONE."""
    c = client_as("vikram")
    r = c.post("/api/jobs/1/start")
    assert r.status_code == 409
    assert "Dispatch not done yet" in r.json()["error"]


def test_finish_409_without_signature():
    """Finish 409 without signature."""
    c = client_as("vikram")
    r = c.post(
        "/api/jobs/2/finish",
        json={"signature": "", "photos": ["/uploads/roof.png"], "sizeConfirmed": 3.0},
    )
    assert r.status_code == 409
    assert "Customer signature required" in r.json()["error"]


def test_finish_409_without_photo():
    """Finish 409 without photo."""
    c = client_as("vikram")
    r = c.post(
        "/api/jobs/2/finish",
        json={"signature": SAMPLE_SIG, "photos": [], "sizeConfirmed": 3.0},
    )
    assert r.status_code == 409
    assert "Add at least one photo" in r.json()["error"]


def test_expired_ticket_resolve_creates_repair_invoice():
    """Expired -> REPAIR invoice."""
    c = client_as("farhan")
    # 1. Create ticket on expired serial
    r = c.post("/api/tickets", json={"serialUnitId": 1, "issue": "Inverter displays error code E04"})
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["underWarranty"] is False

    # 2. Transition to ASSIGNED with vikram
    r_assign = c.post(f"/api/tickets/{t['id']}/transition", json={"to": "ASSIGNED", "technicianId": 3})
    assert r_assign.status_code == 200, r_assign.text
    assert r_assign.json()["status"] == "ASSIGNED"

    # 3. Transition to IN_REPAIR
    r_repair = c.post(f"/api/tickets/{t['id']}/transition", json={"to": "IN_REPAIR"})
    assert r_repair.status_code == 200

    # 4. Transition to RESOLVED with costs
    r_resolve = c.post(
        f"/api/tickets/{t['id']}/transition",
        json={"to": "RESOLVED", "partsCost": 3500, "labourCost": 1500},
    )
    assert r_resolve.status_code == 200
    res = r_resolve.json()
    assert res["status"] == "RESOLVED"
    assert res["billAmount"] == 5000
    assert res["invoice"] is not None
    assert res["invoice"]["amount"] == 5000
    assert res["invoice"]["status"] == "DUE"


def test_covered_ticket_resolve_no_invoice():
    """Covered -> no invoice."""
    c = client_as("farhan")
    # 1. Create ticket on covered serial
    r = c.post("/api/tickets", json={"serialUnitId": 2, "issue": "Inverter light blinking orange"})
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["underWarranty"] is True

    # 2. Transition through ASSIGNED -> IN_REPAIR -> RESOLVED
    c.post(f"/api/tickets/{t['id']}/transition", json={"to": "ASSIGNED", "technicianId": 3})
    c.post(f"/api/tickets/{t['id']}/transition", json={"to": "IN_REPAIR"})
    r_resolve = c.post(
        f"/api/tickets/{t['id']}/transition",
        json={"to": "RESOLVED", "partsCost": 2000, "labourCost": 1000},
    )
    assert r_resolve.status_code == 200
    res = r_resolve.json()
    assert res["status"] == "RESOLVED"
    assert res["billAmount"] == 0
    assert res["invoice"] is None


def test_close_needs_customer_confirmed():
    """Close needs customerConfirmed."""
    c = client_as("farhan")
    # Create ticket on covered serial and resolve
    r = c.post("/api/tickets", json={"serialUnitId": 2, "issue": "Connector check"})
    tid = r.json()["id"]
    c.post(f"/api/tickets/{tid}/transition", json={"to": "ASSIGNED", "technicianId": 3})
    c.post(f"/api/tickets/{tid}/transition", json={"to": "IN_REPAIR"})
    c.post(f"/api/tickets/{tid}/transition", json={"to": "RESOLVED"})

    # Try closing without customerConfirmed
    r_close_bad = c.post(f"/api/tickets/{tid}/transition", json={"to": "CLOSED", "customerConfirmed": False})
    assert r_close_bad.status_code == 409
    assert "Customer confirmation is required" in r_close_bad.json()["error"]

    # Close with customerConfirmed
    r_close_ok = c.post(f"/api/tickets/{tid}/transition", json={"to": "CLOSED", "customerConfirmed": True})
    assert r_close_ok.status_code == 200
    assert r_close_ok.json()["status"] == "CLOSED"


def test_transition_persists_after_new_request():
    """A transition persists after a new request."""
    c = client_as("farhan")
    r = c.post("/api/tickets", json={"serialUnitId": 1, "issue": "Persistence check"})
    tid = r.json()["id"]

    r_trans = c.post(f"/api/tickets/{tid}/transition", json={"to": "ASSIGNED", "technicianId": 3})
    assert r_trans.status_code == 200

    # New separate request
    c_new = client_as("farhan")
    r_get = c_new.get(f"/api/tickets/{tid}")
    assert r_get.status_code == 200
    detail = r_get.json()
    assert detail["status"] == "ASSIGNED"
    assert detail["technicianName"] == "Vikram"


def test_technician_can_open_only_their_own_job():
    """A technician can open only their own job."""
    c_vikram = client_as("vikram")
    # Job 2 is assigned to Vikram -> 200 OK
    r2 = c_vikram.get("/api/jobs/2")
    assert r2.status_code == 200
    assert r2.json()["ref"] == "JOB/0002"

    # Job 3 is assigned to Arjun -> 403 Forbidden
    r3 = c_vikram.get("/api/jobs/3")
    assert r3.status_code == 403
    assert "Not your job" in r3.json()["error"]

    # Sales user (Priya) has jobs:read -> can open Job 3
    c_priya = client_as("priya")
    r3_priya = c_priya.get("/api/jobs/3")
    assert r3_priya.status_code == 200
    assert r3_priya.json()["ref"] == "JOB/0003"
