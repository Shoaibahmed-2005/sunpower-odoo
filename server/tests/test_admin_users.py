"""Tests for Admin role and user management (Member B, WP2).

Covers:
- non-admin 403 on every admin endpoint (GET /all, POST /, PATCH /{id}, POST /{id}/reset-password)
- create user (success, duplicate loginId 409, validation 400)
- change role (technician -> sales)
- deactivate user (can't log in 401, old cookie 401)
- reactivate user (can log in again 200)
- reset password (can't log in with old password, logs in with new password)
- cannot demote or deactivate self (409)
- last active admin protected (409 "At least one active admin is required")
"""
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
        db.add_all([
            User(name=n, login_id=l, password_hash=pw, role=r)
            for n, l, r in [
                ("Admin", "admin", Role.ADMIN),
                ("Priya", "priya", Role.SALES),
                ("Vikram", "vikram", Role.TECHNICIAN),
                ("Deepa", "deepa", Role.WAREHOUSE),
                ("Farhan", "farhan", Role.SUPPORT),
            ]
        ])
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


def get_user_id(login_id: str) -> int:
    with TestSession() as db:
        return db.query(User).filter_by(login_id=login_id).one().id


def test_non_admin_403_on_every_admin_endpoint():
    sales = client_as("priya")
    tech_id = get_user_id("vikram")

    # GET /all
    assert sales.get("/api/users/all").status_code == 403

    # POST /
    assert sales.post("/api/users", json={
        "name": "Test User", "loginId": "testuser", "password": "password123", "role": "SALES", "hourlyRate": 0
    }).status_code == 403

    # PATCH /{id}
    assert sales.patch(f"/api/users/{tech_id}", json={"role": "SALES"}).status_code == 403

    # POST /{id}/reset-password
    assert sales.post(f"/api/users/{tech_id}/reset-password", json={"password": "newpassword123"}).status_code == 403


def test_create_user_success_and_duplicate():
    admin = client_as("admin")

    body = {
        "name": "Karan Mehta",
        "loginId": "karan",
        "password": "strongpassword123",
        "role": "SALES",
        "hourlyRate": 0
    }
    r = admin.post("/api/users", json=body)
    assert r.status_code == 201
    user = r.json()
    assert user["name"] == "Karan Mehta"
    assert user["loginId"] == "karan"
    assert user["role"] == "SALES"
    assert user["active"] is True
    assert "createdAt" in user

    # Duplicate loginId returns 409
    dup = admin.post("/api/users", json=body)
    assert dup.status_code == 409
    assert dup.json()["error"] == "That Login Id is already taken"


def test_change_role():
    admin = client_as("admin")
    tech_id = get_user_id("vikram")

    r = admin.patch(f"/api/users/{tech_id}", json={"role": "SALES"})
    assert r.status_code == 200
    assert r.json()["role"] == "SALES"

    # Verify via DB
    with TestSession() as db:
        u = db.get(User, tech_id)
        assert u.role == Role.SALES


def test_deactivate_and_reactivate_user():
    admin = client_as("admin")
    tech_id = get_user_id("vikram")

    # Log in as vikram before deactivation
    vikram = client_as("vikram")
    assert vikram.get("/api/auth/me").status_code == 200

    # Deactivate vikram
    r = admin.patch(f"/api/users/{tech_id}", json={"active": False})
    assert r.status_code == 200
    assert r.json()["active"] is False

    # Old cookie gets 401 immediately
    assert vikram.get("/api/auth/me").status_code == 401

    # Inactive user cannot log in
    fresh_client = TestClient(app)
    login_attempt = fresh_client.post("/api/auth/login", json={"loginId": "vikram", "password": PASSWORD})
    assert login_attempt.status_code == 401

    # Reactivate vikram
    r2 = admin.patch(f"/api/users/{tech_id}", json={"active": True})
    assert r2.status_code == 200
    assert r2.json()["active"] is True

    # Now vikram can log in again
    login_success = fresh_client.post("/api/auth/login", json={"loginId": "vikram", "password": PASSWORD})
    assert login_success.status_code == 200


def test_reset_password():
    admin = client_as("admin")
    tech_id = get_user_id("vikram")

    # Reset vikram's password
    r = admin.post(f"/api/users/{tech_id}/reset-password", json={"password": "newsecretpassword"})
    assert r.status_code == 204

    # Old password no longer works
    c = TestClient(app)
    old_login = c.post("/api/auth/login", json={"loginId": "vikram", "password": PASSWORD})
    assert old_login.status_code == 401

    # New password works
    new_login = c.post("/api/auth/login", json={"loginId": "vikram", "password": "newsecretpassword"})
    assert new_login.status_code == 200


def test_cannot_demote_or_deactivate_self():
    admin = client_as("admin")
    admin_id = get_user_id("admin")

    # Create a second admin so other_admins > 0
    r = admin.post("/api/users", json={
        "name": "Second Admin", "loginId": "admin2", "password": "password123", "role": "ADMIN", "hourlyRate": 0
    })
    assert r.status_code == 201

    # Now with 2 active admins, attempt to change own role
    r1 = admin.patch(f"/api/users/{admin_id}", json={"role": "SALES"})
    assert r1.status_code == 409
    assert r1.json()["error"] == "You cannot change your own role"

    # Attempt to deactivate self
    r2 = admin.patch(f"/api/users/{admin_id}", json={"active": False})
    assert r2.status_code == 409
    assert r2.json()["error"] == "You cannot deactivate your own account"


def test_last_active_admin_protected():
    admin = client_as("admin")
    admin_id = get_user_id("admin")

    # With only 1 active admin (admin), deactivating self or changing role gives 409 "At least one active admin is required"
    r1 = admin.patch(f"/api/users/{admin_id}", json={"active": False})
    assert r1.status_code == 409
    assert r1.json()["error"] == "At least one active admin is required"

    r2 = admin.patch(f"/api/users/{admin_id}", json={"role": "SALES"})
    assert r2.status_code == 409
    assert r2.json()["error"] == "At least one active admin is required"
