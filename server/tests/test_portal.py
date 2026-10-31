"""Tests for Customer Portal (Member D / WP4-D).
Runs on SQLite in-memory, completely isolated from Postgres.
"""
from datetime import date, datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password, make_token
from app.customer_auth import make_customer_token
from app.db import Base, get_db
from app.main import app
from app.models import (
    Counter,
    CustomerAccount,
    CustomerMessage,
    CustomerOTP,
    Invoice,
    InvoiceStatus,
    InvoiceType,
    Lead,
    LeadSource,
    LeadStage,
    Package,
    PackageType,
    Product,
    Quotation,
    QuoteLine,
    QuoteStatus,
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


def override_db():
    with TestSession() as db:
        yield db


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestSession() as db:
        pw = hash_password(PASSWORD)
        admin = User(name="Admin", login_id="admin", password_hash=pw, role=Role.ADMIN)
        sales = User(name="Priya", login_id="priya", password_hash=pw, role=Role.SALES)
        tech = User(name="Vikram", login_id="vikram", password_hash=pw, role=Role.TECHNICIAN)
        db.add_all([admin, sales, tech])

        for key in ["ENQ", "SRV", "SQ", "JOB", "SP/OUT", "TKT", "INV"]:
            db.add(Counter(key=key, next=2))

        # Seed 2 leads for customer A, 1 lead for customer B
        lead_a1 = Lead(
            ref="ENQ/0001",
            name="Ramesh Kulkarni",
            phone="9822000010",
            address="12 Main St, Pune",
            kw=3,
            monthly_bill=3500,
            subsidy_interest=True,
            roof_area=400,
            system_type=SystemType.OFF_GRID,
            stage=LeadStage.QUOTED,
            source=LeadSource.WEB,
        )
        lead_b = Lead(
            ref="ENQ/0002",
            name="Sunita Desai",
            phone="9822000011",
            address="45 Park Rd, Pune",
            kw=5,
            monthly_bill=5000,
            subsidy_interest=True,
            roof_area=600,
            system_type=SystemType.ON_GRID,
            stage=LeadStage.QUOTED,
            source=LeadSource.CALL,
        )
        db.add_all([lead_a1, lead_b])
        db.flush()

        prod_inv = Product(code="INV-OF5", name="Off-grid Inverter 5kW", price=85000, cost=65000, tracking=Tracking.SERIAL, warranty_months=24)
        prod_pan = Product(code="PAN-540", name="Mono PERC Panel 540W", price=16000, cost=12000, tracking=Tracking.LOT, warranty_months=240)
        db.add_all([prod_inv, prod_pan])
        db.flush()

        pkg = Package(code="OFF-5", name="Off-grid 5kW System", type=PackageType.OFF_GRID, kw=5.0, subsidy=50000)
        db.add(pkg)
        db.flush()

        # Serial delivered to Ramesh
        unit_ramesh = SerialUnit(
            serial="INV-OF5-TEST001",
            product_id=prod_inv.id,
            status=SerialStatus.DELIVERED,
            unit_cost=65000,
            lead_id=lead_a1.id,
            delivered_at=datetime.now(timezone.utc) - timedelta(days=30),
            warranty_until=date.today() + timedelta(days=700),
        )
        # Serial delivered to Sunita
        unit_sunita = SerialUnit(
            serial="INV-OF5-TEST002",
            product_id=prod_inv.id,
            status=SerialStatus.DELIVERED,
            unit_cost=65000,
            lead_id=lead_b.id,
            delivered_at=datetime.now(timezone.utc) - timedelta(days=60),
            warranty_until=date.today() - timedelta(days=10),  # expired
        )
        db.add_all([unit_ramesh, unit_sunita])

        # Quotation for Ramesh
        q_ramesh = Quotation(
            ref="SQ/0001",
            lead_id=lead_a1.id,
            package_id=pkg.id,
            status=QuoteStatus.SENT,
            total=250000,
            subsidy=50000,
        )
        db.add(q_ramesh)
        db.flush()
        db.add(QuoteLine(quotation_id=q_ramesh.id, product_id=prod_inv.id, qty=1, unit_price=85000))

        # Customer account for Ramesh
        acc_ramesh = CustomerAccount(
            phone="9822000010",
            name="Ramesh Kulkarni",
            password_hash=hash_password(PASSWORD),
        )
        db.add(acc_ramesh)
        db.commit()

    app.dependency_overrides[get_db] = override_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_customer_signup_and_login_flow(client: TestClient):
    # 1. Start signup with valid phone
    phone = "9822999999"
    r = client.post("/api/portal/auth/signup/start", json={"phone": phone})
    assert r.status_code == 200
    data = r.json()
    assert data["sent"] is True
    demo_code = data["demo_code"]
    assert len(demo_code) == 6

    # 2. Verify with wrong code -> 401
    r_bad = client.post("/api/portal/auth/signup/verify", json={
        "phone": phone,
        "code": "000000",
        "name": "New Customer",
        "password": "Password123"
    })
    assert r_bad.status_code == 401

    # 3. Verify with correct code -> 200 + sets cookie
    r_good = client.post("/api/portal/auth/signup/verify", json={
        "phone": phone,
        "code": demo_code,
        "name": "New Customer",
        "password": "Password123"
    })
    assert r_good.status_code == 200
    assert "customer_token" in r_good.cookies
    assert r_good.json()["account"]["name"] == "New Customer"

    # 4. Check /me
    r_me = client.get("/api/portal/auth/me", cookies=r_good.cookies)
    assert r_me.status_code == 200
    assert r_me.json()["account"]["phoneMasked"] == "98******99"


def test_customer_login_lockout(client: TestClient):
    phone = "9822000010"
    # 4 bad attempts
    for _ in range(4):
        r = client.post("/api/portal/auth/login", json={"phone": phone, "password": "wrongpassword1"})
        assert r.status_code == 401
        assert "Phone or password is incorrect" in r.text

    # 5th bad attempt -> 423
    r5 = client.post("/api/portal/auth/login", json={"phone": phone, "password": "wrongpassword1"})
    assert r5.status_code == 423
    assert "Account locked" in r5.text

    # Next attempt also locked
    r6 = client.post("/api/portal/auth/login", json={"phone": phone, "password": "sun123"})
    assert r6.status_code == 423


def test_customer_products_scoping(client: TestClient):
    # Log in as Ramesh
    r_login = client.post("/api/portal/auth/login", json={"phone": "9822000010", "password": "sun123"})
    assert r_login.status_code == 200
    cookies = r_login.cookies

    # Products list
    r_prod = client.get("/api/portal/products", cookies=cookies)
    assert r_prod.status_code == 200
    items = r_prod.json()
    assert len(items) == 1
    assert items[0]["serial"] == "INV-OF5-TEST001"
    assert items[0]["underWarranty"] is True

    # Customer B cannot see Ramesh's product
    with TestSession() as db:
        acc_sunita = CustomerAccount(phone="9822000011", name="Sunita Desai", password_hash=hash_password(PASSWORD))
        db.add(acc_sunita)
        db.commit()
        sunita_token = make_customer_token(acc_sunita)

    r_sunita_prod = client.get("/api/portal/products", cookies={"customer_token": sunita_token})
    assert r_sunita_prod.status_code == 200
    sunita_items = r_sunita_prod.json()
    assert len(sunita_items) == 1
    assert sunita_items[0]["serial"] == "INV-OF5-TEST002"
    assert sunita_items[0]["underWarranty"] is False


def test_customer_payment_and_tickets(client: TestClient):
    r_login = client.post("/api/portal/auth/login", json={"phone": "9822000010", "password": "sun123"})
    cookies = r_login.cookies

    # View quotations
    r_quotes = client.get("/api/portal/quotations", cookies=cookies)
    assert r_quotes.status_code == 200
    quotes = r_quotes.json()
    assert len(quotes) == 1
    q = quotes[0]
    assert q["total"] == 250000
    assert q["subsidy"] == 50000
    assert q["netPayable"] == 200000
    assert q["balance"] == 200000

    # Submit payment reference
    r_pay = client.post(
        f"/api/portal/quotations/{q['id']}/payments",
        json={"amount": 50000, "reference": "UPI-REF-998877"},
        cookies=cookies,
    )
    assert r_pay.status_code == 200
    assert r_pay.json()["status"] == "PENDING"

    # Second payment blocked while one is pending -> 409
    r_pay2 = client.post(
        f"/api/portal/quotations/{q['id']}/payments",
        json={"amount": 20000, "reference": "UPI-REF-998878"},
        cookies=cookies,
    )
    assert r_pay2.status_code == 409

    # Create ticket for Ramesh's serial
    r_tkt = client.post(
        "/api/portal/tickets",
        json={"serial": "INV-OF5-TEST001", "issue": "Inverter displays error code E-04"},
        cookies=cookies,
    )
    assert r_tkt.status_code == 200
    tkt_data = r_tkt.json()
    assert tkt_data["underWarranty"] is True

    # Try creating ticket for Sunita's serial -> 404
    r_tkt_bad = client.post(
        "/api/portal/tickets",
        json={"serial": "INV-OF5-TEST002", "issue": "Attempting to ticket someone else's product"},
        cookies=cookies,
    )
    assert r_tkt_bad.status_code == 404


def test_portal_security_boundaries(client: TestClient):
    with TestSession() as db:
        admin = db.query(User).filter(User.role == Role.ADMIN).first()
        staff_token = make_token(admin)
        acc = db.query(CustomerAccount).first()
        cust_token = make_customer_token(acc)

    # 1. Staff cookie on customer portal -> 401
    r_staff_on_portal = client.get("/api/portal/products", cookies={"customer_token": staff_token})
    assert r_staff_on_portal.status_code == 401

    # 2. Customer cookie on staff API -> 401
    r_cust_on_staff = client.get("/api/leads", cookies={"token": cust_token})
    assert r_cust_on_staff.status_code == 401
