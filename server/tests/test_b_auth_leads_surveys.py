"""Member B tests: auth (401/403), enquiry flow, survey gate. Run: cd server && uv run pytest -q tests/test_b_auth_leads_surveys.py

Uses its own in-memory SQLite DB so it never touches the team's Postgres data.
Edge cases covered: no cookie, tampered cookie, wrong role, wrong password, bad phone, honeypot,
failed vs passed qualifying call, schedule before qualifying, technician editing someone else's survey,
double submit, double approve, reject sends the lead back to QUALIFIED.
"""
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth import hash_password
from app.db import Base, get_db
from app.main import app
from app.models import Counter, Role, User

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
        db.add_all([User(name=n, login_id=l, password_hash=pw, role=r) for n, l, r in [
            ("Ravi", "ravi", Role.DIRECTOR), ("Priya", "priya", Role.SALES),
            ("Vikram", "vikram", Role.TECHNICIAN), ("Arjun", "arjun", Role.TECHNICIAN),
            ("Deepa", "deepa", Role.WAREHOUSE)]])
        db.add_all([Counter(key=k, next=1) for k in ["ENQ", "SRV", "SQ", "JOB", "SP/OUT", "TKT", "INV"]])
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


def tech_id(login_id: str) -> int:
    with TestSession() as db:
        return db.query(User).filter_by(login_id=login_id).one().id


LEAD = {"name": "Kunal Desai", "phone": "98989 30417", "address": "A-22 Sahajanand Park, Maninagar",
        "kw": 3, "systemType": "ON_GRID", "monthlyBill": 3100, "subsidyInterest": True, "source": "CALL"}


def new_lead(c: TestClient) -> dict:
    r = c.post("/api/leads", json=LEAD)
    assert r.status_code == 201, r.text
    return r.json()


def qualified_lead_with_survey(sales: TestClient, tech: str = "vikram") -> tuple[int, int]:
    lead = new_lead(sales)
    r = sales.post(f"/api/leads/{lead['id']}/log-call", json={"roofArea": 35, "monthlyBill": 3100, "gridOk": True})
    assert r.json()["stage"] == "QUALIFIED"
    visit = (datetime.now() + timedelta(days=1)).isoformat()
    r = sales.post(f"/api/leads/{lead['id']}/schedule-survey", json={"technicianId": tech_id(tech), "visitDate": visit})
    assert r.status_code == 201, r.text
    return lead["id"], r.json()["id"]


SUBMIT = {"direction": "S", "tilt": 18, "cableDistance": 20, "area": 35, "photos": ["/uploads/a.jpg"]}


# ---------- auth ----------

def test_401_without_cookie():
    r = client_as(None).get("/api/leads")
    assert r.status_code == 401 and r.json()["error"]


def test_401_with_tampered_cookie():
    c = TestClient(app)
    c.cookies.set("token", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.forged")
    assert c.get("/api/auth/me").status_code == 401


def test_login_wrong_password_and_unknown_id_same_message():
    c = TestClient(app)
    a = c.post("/api/auth/login", json={"loginId": "priya", "password": "wrong"})
    b = c.post("/api/auth/login", json={"loginId": "nobody", "password": "wrong"})
    assert a.status_code == b.status_code == 401
    assert a.json()["error"] == b.json()["error"] == "Invalid Login Id or Password"


def test_login_sets_httponly_cookie_and_me_works():
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"loginId": "PRIYA ", "password": PASSWORD})
    assert r.status_code == 200
    assert "httponly" in r.headers["set-cookie"].lower()
    assert "passwordHash" not in r.text
    assert c.get("/api/auth/me").json()["user"]["role"] == "SALES"


def test_403_technician_cannot_read_leads():
    assert client_as("vikram").get("/api/leads").status_code == 403


def test_logout_clears_session():
    c = client_as("priya")
    assert c.post("/api/auth/logout").status_code == 204
    assert c.get("/api/auth/me").status_code == 401


# ---------- enquiries ----------

def test_create_lead_validates_phone_and_kw():
    sales = client_as("priya")
    assert sales.post("/api/leads", json={**LEAD, "phone": "12345"}).status_code == 400
    assert sales.post("/api/leads", json={**LEAD, "kw": 9}).status_code == 400
    lead = new_lead(sales)
    assert lead["ref"] == "ENQ/0001" and lead["phone"] == "9898930417" and lead["stage"] == "NEW"
    assert new_lead(sales)["ref"] == "ENQ/0002"


def test_search_by_phone_and_ref():
    sales = client_as("priya")
    new_lead(sales)
    assert len(sales.get("/api/leads", params={"search": "30417"}).json()) == 1
    assert len(sales.get("/api/leads", params={"search": "ENQ/0001"}).json()) == 1
    assert sales.get("/api/leads", params={"search": "nomatch"}).json() == []


def test_log_call_qualifies_only_with_grid_and_enough_roof():
    sales = client_as("priya")
    lead = new_lead(sales)
    r = sales.post(f"/api/leads/{lead['id']}/log-call", json={"roofArea": 12, "monthlyBill": 3100, "gridOk": True})
    assert r.json()["stage"] == "CONTACTED"            # 3 kW needs about 30 m²
    r = sales.post(f"/api/leads/{lead['id']}/log-call", json={"roofArea": 12, "monthlyBill": 3100, "gridOk": True})
    assert r.status_code == 200 and r.json()["stage"] == "CONTACTED"   # second failed call is fine
    r = sales.post(f"/api/leads/{lead['id']}/log-call", json={"roofArea": 40, "monthlyBill": 3100, "gridOk": True})
    assert r.json()["stage"] == "QUALIFIED"
    r = sales.post(f"/api/leads/{lead['id']}/log-call", json={"roofArea": 40, "monthlyBill": 3100, "gridOk": True})
    assert r.status_code == 409                           # can't re-log once qualified


def test_schedule_survey_requires_qualified_and_a_technician():
    sales = client_as("priya")
    lead = new_lead(sales)
    visit = (datetime.now() + timedelta(days=1)).isoformat()
    r = sales.post(f"/api/leads/{lead['id']}/schedule-survey", json={"technicianId": tech_id("vikram"), "visitDate": visit})
    assert r.status_code == 409
    sales.post(f"/api/leads/{lead['id']}/log-call", json={"roofArea": 35, "monthlyBill": 3100, "gridOk": True})
    r = sales.post(f"/api/leads/{lead['id']}/schedule-survey", json={"technicianId": tech_id("deepa"), "visitDate": visit})
    assert r.status_code == 400 and r.json()["field"] == "technicianId"
    past = (datetime.now() - timedelta(days=2)).isoformat()
    r = sales.post(f"/api/leads/{lead['id']}/schedule-survey", json={"technicianId": tech_id("vikram"), "visitDate": past})
    assert r.status_code == 400


def test_public_enquiry_and_honeypot():
    c = TestClient(app)
    body = {k: v for k, v in LEAD.items() if k != "source"}
    r = c.post("/api/public/enquiries", json=body)
    assert r.status_code == 201 and r.json() == {"ref": "ENQ/0001"}
    assert c.post("/api/public/enquiries", json={**body, "website": "spam.com"}).status_code == 400
    lead = client_as("priya").get("/api/leads").json()[0]
    assert lead["source"] == "WEB" and lead["stage"] == "NEW"


def test_mark_lost_needs_reason_and_blocks_twice():
    sales = client_as("priya")
    lead = new_lead(sales)
    assert sales.post(f"/api/leads/{lead['id']}/lost", json={"reason": ""}).status_code == 400
    assert sales.post(f"/api/leads/{lead['id']}/lost", json={"reason": "Too expensive"}).json()["stage"] == "LOST"
    assert sales.post(f"/api/leads/{lead['id']}/lost", json={"reason": "Again"}).status_code == 409


# ---------- surveys (the quote gate starts here) ----------

def test_survey_flow_unlocks_quote():
    sales = client_as("priya")
    lead_id, survey_id = qualified_lead_with_survey(sales)
    assert sales.get(f"/api/leads/{lead_id}").json()["canQuote"] is False
    tech = client_as("vikram")
    assert len(tech.get("/api/surveys").json()) == 1
    r = tech.patch(f"/api/surveys/{survey_id}/submit", json=SUBMIT)
    assert r.status_code == 200 and r.json()["status"] == "SUBMITTED"
    assert tech.patch(f"/api/surveys/{survey_id}/submit", json=SUBMIT).status_code == 409   # double submit
    assert tech.post(f"/api/surveys/{survey_id}/approve").status_code == 403                # can't approve own
    assert sales.post(f"/api/surveys/{survey_id}/approve").json()["status"] == "APPROVED"
    assert sales.post(f"/api/surveys/{survey_id}/approve").status_code == 409               # double approve
    lead = sales.get(f"/api/leads/{lead_id}").json()
    assert lead["stage"] == "SURVEY_APPROVED" and lead["canQuote"] is True


def test_technician_cannot_see_or_submit_someone_elses_survey():
    sales = client_as("priya")
    _, survey_id = qualified_lead_with_survey(sales, tech="vikram")
    other = client_as("arjun")
    assert other.get("/api/surveys").json() == []
    assert other.get(f"/api/surveys/{survey_id}").status_code == 404
    assert other.patch(f"/api/surveys/{survey_id}/submit", json=SUBMIT).status_code == 404


def test_submit_validates_measurements_and_photo_urls():
    sales = client_as("priya")
    _, survey_id = qualified_lead_with_survey(sales)
    tech = client_as("vikram")
    assert tech.patch(f"/api/surveys/{survey_id}/submit", json={**SUBMIT, "tilt": 75}).status_code == 400
    assert tech.patch(f"/api/surveys/{survey_id}/submit", json={**SUBMIT, "direction": "UP"}).status_code == 400
    bad = {**SUBMIT, "photos": ["javascript:alert(1)"]}
    assert tech.patch(f"/api/surveys/{survey_id}/submit", json=bad).status_code == 400


def test_reject_sends_lead_back_to_qualified():
    sales = client_as("priya")
    lead_id, survey_id = qualified_lead_with_survey(sales)
    client_as("vikram").patch(f"/api/surveys/{survey_id}/submit", json=SUBMIT)
    assert sales.post(f"/api/surveys/{survey_id}/reject", json={"reason": "x"}).status_code == 400
    r = sales.post(f"/api/surveys/{survey_id}/reject", json={"reason": "Roof is shaded by a tower"})
    assert r.json()["status"] == "REJECTED"
    assert sales.get(f"/api/leads/{lead_id}").json()["stage"] == "QUALIFIED"


def test_director_can_create_users_sales_cannot():
    body = {"name": "New Tech", "loginId": "newtech", "password": "longpass1", "role": "TECHNICIAN", "hourlyRate": 400}
    assert client_as("priya").post("/api/users", json=body).status_code == 403
    d = client_as("ravi")
    assert d.post("/api/users", json=body).status_code == 201
    assert d.post("/api/users", json=body).status_code == 409
    techs = d.get("/api/users", params={"role": "TECHNICIAN"}).json()
    assert {u["name"] for u in techs} >= {"Vikram", "New Tech"}
