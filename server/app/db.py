"""Database engine, session factory and the FastAPI dependency that hands out a session."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# pool_pre_ping: test a pooled connection before using it, so a restarted Postgres doesn't cause errors
engine = create_engine(settings.database_url, pool_pre_ping=True)
# expire_on_commit=False: objects stay readable after commit (needed to build the response)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """One session per request, always closed at the end (even on error)."""
    with SessionLocal() as db:
        yield db
