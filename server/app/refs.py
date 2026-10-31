"""Atomic, concurrency-safe reference numbers (BUILD_PLAN §6). Owner: B."""
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.models import Counter

PREFIX = {
    "ENQ": "ENQ",
    "SRV": "SRV",
    "SQ": "SQ",
    "JOB": "JOB",
    "SP/OUT": "SP/OUT",
    "TKT": "TKT",
    "INV": "INV",
}


def next_ref(db: Session, key: str) -> str:
    """Generate the next sequential reference code, e.g. SQ/0007."""
    prefix = PREFIX.get(key, key)
    try:
        stmt = (
            update(Counter)
            .where(Counter.key == key)
            .values(next=Counter.next + 1)
            .returning(Counter.next)
        )
        res = db.execute(stmt).scalar_one_or_none()
        if res is not None:
            n = res - 1
            return f"{prefix}/{n:04d}"
    except Exception:
        pass

    # Fallback for dialects without RETURNING or when row doesn't exist yet
    counter = db.query(Counter).filter(Counter.key == key).with_for_update().first()
    if not counter:
        counter = Counter(key=key, next=1)
        db.add(counter)
        db.flush()
    n = counter.next
    counter.next += 1
    return f"{prefix}/{n:04d}"
