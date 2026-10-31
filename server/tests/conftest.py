"""Tests never touch your real database.

Before the app is imported, DATABASE_URL is pointed at a throwaway SQLite file, because some tests
re-seed (drop + recreate every table). Set TEST_DATABASE_URL to use a separate Postgres database
instead, which also runs the row-lock concurrency test.
"""
import os
import tempfile

os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or (
    "sqlite:///" + os.path.join(tempfile.gettempdir(), "sunpower_test.db")
)
os.environ.setdefault("JWT_SECRET", "pytest-only-secret-not-used-anywhere-else-0123456789")
