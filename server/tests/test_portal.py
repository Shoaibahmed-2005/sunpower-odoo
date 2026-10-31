"""Customer portal: accounts, scoping, quotations, Razorpay payments, service requests.
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

    # Online payment is tested in test_razorpay_* below
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


# ── Razorpay (gateway mocked: tests never call the real API) ─────────────────
import hashlib
import hmac

from app.config import settings
from app.routers import portal as portal_router

KEY_SECRET = "test_secret_for_signatures"


@pytest.fixture
def rzp(monkeypatch):
    """Fake Razorpay keys + order creation; returns the list of created orders."""
    monkeypatch.setattr(settings, "razorpay_key_id", "rzp_test_dummy")
    monkeypatch.setattr(settings, "razorpay_key_secret", KEY_SECRET)
    created = []

    def fake_order(amount_paise, receipt, notes):
        order = {"id": f"order_test{len(created) + 1}", "amount": amount_paise, "receipt": receipt}
        created.append(order)
        return order

    monkeypatch.setattr(portal_router, "create_razorpay_order", fake_order)
    return created


def _sign(order_id: str, payment_id: str) -> str:
    return hmac.new(KEY_SECRET.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def _login_ramesh(client):
    return client.post("/api/portal/auth/login", json={"phone": "9822000010", "password": "sun123"}).cookies


def test_razorpay_accept_then_pay_advance(client: TestClient, rzp):
    cookies = _login_ramesh(client)
    q = client.get("/api/portal/quotations", cookies=cookies).json()[0]
    assert q["minAdvance"] == 50000  # 25% of 2,00,000 net payable

    # order before accepting -> 409
    assert client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "ADVANCE"}, cookies=cookies).status_code == 409
    # terms not ticked -> 400
    assert client.post(f"/api/portal/quotations/{q['id']}/accept", json={"name": "Ramesh", "agree": False}, cookies=cookies).status_code == 400
    r = client.post(f"/api/portal/quotations/{q['id']}/accept", json={"name": "Ramesh Kulkarni", "agree": True}, cookies=cookies)
    assert r.status_code == 200
    assert client.post(f"/api/portal/quotations/{q['id']}/accept", json={"name": "Ramesh Kulkarni", "agree": True}, cookies=cookies).status_code == 409

    # PART outside advance..balance -> 400; amount is decided by the server
    assert client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "PART", "amount": 100}, cookies=cookies).status_code == 400
    assert client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "PART", "amount": 300000}, cookies=cookies).status_code == 400
    order = client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "ADVANCE", "amount": 1}, cookies=cookies).json()
    assert order["amount"] == 50000 * 100 and order["keyId"] == "rzp_test_dummy"
    assert "secret" not in str(order).lower()

    # bad signature -> 400 and no invoice
    bad = client.post("/api/portal/payments/verify", json={
        "razorpayOrderId": order["orderId"], "razorpayPaymentId": "pay_fake123", "razorpaySignature": "0" * 64,
    }, cookies=cookies)
    assert bad.status_code == 400

    # a fresh order + good signature -> exactly one PAID invoice, even if verify is called twice
    order2 = client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "ADVANCE"}, cookies=cookies).json()
    body = {"razorpayOrderId": order2["orderId"], "razorpayPaymentId": "pay_real456",
            "razorpaySignature": _sign(order2["orderId"], "pay_real456")}
    assert client.post("/api/portal/payments/verify", json=body, cookies=cookies).status_code == 200
    assert client.post("/api/portal/payments/verify", json=body, cookies=cookies).json()["alreadyRecorded"] is True

    with TestSession() as db:
        paid = db.query(Invoice).filter(Invoice.status == InvoiceStatus.PAID).all()
        assert len(paid) == 1
        assert paid[0].amount == 50000 and paid[0].method == "ONLINE" and paid[0].gateway_ref == "pay_real456"

    q_after = client.get("/api/portal/quotations", cookies=cookies).json()[0]
    assert q_after["paid"] == 50000 and q_after["balance"] == 150000


def test_razorpay_rules(client: TestClient, rzp, monkeypatch):
    cookies = _login_ramesh(client)
    q = client.get("/api/portal/quotations", cookies=cookies).json()[0]
    client.post(f"/api/portal/quotations/{q['id']}/accept", json={"name": "Ramesh Kulkarni", "agree": True}, cookies=cookies)

    # another customer can't see or pay Ramesh's quotation -> 404
    with TestSession() as db:
        db.add(CustomerAccount(phone="9822000011", name="Sunita Desai", password_hash=hash_password(PASSWORD)))
        db.commit()
    sunita = client.post("/api/portal/auth/login", json={"phone": "9822000011", "password": "sun123"}).cookies
    assert client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "FULL"}, cookies=sunita).status_code == 404

    # Sunita can't verify Ramesh's order either
    order = client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "FULL"}, cookies=cookies).json()
    assert order["amount"] == 200000 * 100
    body = {"razorpayOrderId": order["orderId"], "razorpayPaymentId": "pay_x12345",
            "razorpaySignature": _sign(order["orderId"], "pay_x12345")}
    assert client.post("/api/portal/payments/verify", json=body, cookies=sunita).status_code == 404

    # DRAFT quotations are never shown to customers
    with TestSession() as db:
        db.query(Quotation).update({Quotation.status: QuoteStatus.DRAFT})
        db.commit()
    assert client.get("/api/portal/quotations", cookies=cookies).json() == []

    # keys missing -> 503
    monkeypatch.setattr(settings, "razorpay_key_secret", "")
    with TestSession() as db:
        db.query(Quotation).update({Quotation.status: QuoteStatus.SENT})
        db.commit()
    assert client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "FULL"}, cookies=cookies).status_code == 503


def test_portal_enquiry_needs_details_and_blocks_duplicates(client: TestClient):
    with TestSession() as db:
        db.add(CustomerAccount(phone="9811111111", name="New Customer", password_hash=hash_password(PASSWORD)))
        db.query(Counter).filter(Counter.key == "ENQ").update({Counter.next: 3})  # fixture already used ENQ/0001-0002
        db.commit()
    cookies = client.post("/api/portal/auth/login", json={"phone": "9811111111", "password": "sun123"}).cookies
    body = {"address": "7 Lake View, Pune", "kw": 3, "systemType": "ON_GRID", "monthlyBill": 3000}
    r = client.post("/api/portal/enquiry", json=body, cookies=cookies)
    assert r.status_code == 200 and r.json()["ref"].startswith("ENQ/")
    assert client.post("/api/portal/enquiry", json=body, cookies=cookies).status_code == 409
    assert client.post("/api/portal/enquiry", json={"monthlyBill": 3000}, cookies=cookies).status_code == 400


def test_balance_after_installation_settles_the_due_invoice(client: TestClient, rzp):
    cookies = _login_ramesh(client)
    q = client.get("/api/portal/quotations", cookies=cookies).json()[0]
    client.post(f"/api/portal/quotations/{q['id']}/accept", json={"name": "Ramesh Kulkarni", "agree": True}, cookies=cookies)
    order = client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "ADVANCE"}, cookies=cookies).json()
    client.post("/api/portal/payments/verify", json={"razorpayOrderId": order["orderId"], "razorpayPaymentId": "pay_adv001",
                "razorpaySignature": _sign(order["orderId"], "pay_adv001")}, cookies=cookies)

    # Sales confirms: quotation CONFIRMED and the rest becomes a BALANCE invoice (DUE), as confirm_quotation does
    with TestSession() as db:
        quote = db.get(Quotation, q["id"])
        quote.status = QuoteStatus.CONFIRMED
        db.add(Invoice(ref="INV/0099", lead_id=quote.lead_id, quotation_id=quote.id, type=InvoiceType.BALANCE,
                       amount=150000, status=InvoiceStatus.DUE))
        db.commit()

    # after booking the only option is the remaining balance, whatever the browser asks for
    order2 = client.post(f"/api/portal/quotations/{q['id']}/order", json={"kind": "ADVANCE"}, cookies=cookies).json()
    assert order2["amount"] == 150000 * 100
    r = client.post("/api/portal/payments/verify", json={"razorpayOrderId": order2["orderId"], "razorpayPaymentId": "pay_bal001",
                    "razorpaySignature": _sign(order2["orderId"], "pay_bal001")}, cookies=cookies)
    assert r.status_code == 200 and r.json()["invoiceRef"] == "INV/0099"

    with TestSession() as db:
        invoices = db.query(Invoice).filter(Invoice.quotation_id == q["id"]).all()
        assert len(invoices) == 2  # advance + the settled balance, no duplicate
        assert all(i.status == InvoiceStatus.PAID for i in invoices)
    assert client.get("/api/portal/quotations", cookies=cookies).json()[0]["balance"] == 0
