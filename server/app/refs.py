"""Human-readable references like ENQ/0007 (Member B)."""
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.errors import ApiError
from app.models import Counter

PREFIX = {"ENQ": "ENQ", "SRV": "SRV", "SQ": "SQ", "JOB": "JOB", "SP/OUT": "SP/OUT", "TKT": "TKT", "INV": "INV"}


def next_ref(db: Session, key: str) -> str:
    """Return the next reference for `key` and advance the counter.

    One UPDATE ... RETURNING statement: the database locks the counter row while it increments,
    so two users creating enquiries at the same moment can never get the same number.
    Call it inside the request's transaction: if the request fails, the rollback gives the number back.
    """
    if key not in PREFIX:
        raise ValueError(f"Unknown reference key {key}")
    stmt = update(Counter).where(Counter.key == key).values(next=Counter.next + 1).returning(Counter.next)
    new_next = db.execute(stmt).scalar_one_or_none()
    if new_next is None:  # seed forgot this counter: fail loudly instead of inventing a number
        raise ApiError(500, f"Reference counter {key} is missing, run the seed")
    return f"{PREFIX[key]}/{new_next - 1:04d}"
