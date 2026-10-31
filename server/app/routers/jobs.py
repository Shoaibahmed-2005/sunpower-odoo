"""Jobs endpoints — installation job list, detail, start, finish.
Gates: no start before dispatch DONE; no finish without signature + photo.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator

from app.db import get_db
from app.auth import get_current_user, require_perm, has_perm
from app.errors import ApiError
from app.schemas.base import ApiModel
from app.transitions import assert_transition
from app.models import Job, JobStatus, Dispatch, DispatchStatus, User, Lead, QuoteLine, SerialUnit

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


# ── Response schemas ──────────────────────────────────────────

class JobListItem(ApiModel):
    id: int
    ref: str
    lead_name: str
    kw: float
    technician_name: str
    crew: str
    scheduled_date: str
    status: str


class JobLineOut(ApiModel):
    name: str
    qty: int


class JobSerialOut(ApiModel):
    serial: str
    product_name: str
    warranty_until: str | None


class JobDetail(ApiModel):
    id: int
    ref: str
    status: str
    lead_name: str
    lead_phone: str
    lead_address: str
    kw: float
    system_type: str
    technician_name: str
    crew: str
    scheduled_date: str
    dispatch_status: str | None
    lines: list[JobLineOut]
    serials: list[JobSerialOut]
    started_at: str | None
    finished_at: str | None
    size_confirmed: float | None
    photos: list[str]
    has_signature: bool


# ── Request schemas ───────────────────────────────────────────

class FinishJobRequest(ApiModel):
    signature: str = ""
    size_confirmed: float = Field(default=0, gt=0, le=20)
    photos: list[str] = []

    @field_validator("signature")
    @classmethod
    def validate_signature(cls, v: str) -> str:
        if not v:
            return v
        if not v.startswith("data:image/png;base64,"):
            raise ValueError("Signature must be a base64 PNG data URL (data:image/png;base64,...)")
        if len(v.encode("utf-8")) > 500 * 1024:
            raise ValueError("Signature image must be under 500 KB")
        return v

    @field_validator("photos")
    @classmethod
    def validate_photos(cls, v: list[str]) -> list[str]:
        for u in v:
            if not (u.startswith("/api/images/") or u.startswith("/uploads/")):
                raise ValueError("Photo URL must start with /api/images/ or /uploads/")
        return v


# ── Helpers ───────────────────────────────────────────────────

def _build_detail(db: Session, job: Job) -> JobDetail:
    lead = db.get(Lead, job.lead_id)
    tech = db.get(User, job.technician_id)
    dispatch = db.query(Dispatch).filter(Dispatch.job_id == job.id).first()

    # Quote lines for this job's quotation
    q_lines = (
        db.query(QuoteLine)
        .filter(QuoteLine.quotation_id == job.quotation_id)
        .all()
    )
    lines = []
    for ql in q_lines:
        product = ql.product
        lines.append(JobLineOut(name=product.name, qty=ql.qty))

    # Serials delivered for this dispatch
    serials = []
    if dispatch:
        units = (
            db.query(SerialUnit)
            .filter(SerialUnit.dispatch_id == dispatch.id)
            .all()
        )
        for u in units:
            serials.append(
                JobSerialOut(
                    serial=u.serial,
                    product_name=u.product.name,
                    warranty_until=str(u.warranty_until) if u.warranty_until else None,
                )
            )

    return JobDetail(
        id=job.id,
        ref=job.ref,
        status=job.status.value,
        lead_name=lead.name,
        lead_phone=lead.phone,
        lead_address=lead.address,
        kw=lead.kw,
        system_type=lead.system_type.value,
        technician_name=tech.name,
        crew=job.crew,
        scheduled_date=str(job.scheduled_date),
        dispatch_status=dispatch.status.value if dispatch else None,
        lines=lines,
        serials=serials,
        started_at=job.started_at.isoformat() if job.started_at else None,
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
        size_confirmed=job.size_confirmed,
        photos=job.photos or [],
        has_signature=bool(job.signature),
    )


# ── Routes ────────────────────────────────────────────────────

@router.get("", response_model=list[JobListItem])
def list_jobs(
    status: str | None = None,
    user=Depends(require_perm("jobs:read")),
    db: Session = Depends(get_db),
):
    """List all jobs, optionally filtered by status. Perm: jobs:read."""
    q = db.query(Job, Lead.name, Lead.kw, User.name).join(Lead, Job.lead_id == Lead.id).join(User, Job.technician_id == User.id)
    if status:
        q = q.filter(Job.status == JobStatus(status))
    rows = q.order_by(Job.scheduled_date.desc()).all()
    return [
        JobListItem(
            id=j.id, ref=j.ref, lead_name=ln, kw=kw, technician_name=tn,
            crew=j.crew, scheduled_date=str(j.scheduled_date), status=j.status.value,
        )
        for j, ln, kw, tn in rows
    ]


@router.get("/mine", response_model=list[JobListItem])
def my_jobs(
    user=Depends(require_perm("jobs:mine")),
    db: Session = Depends(get_db),
):
    """Technician's own jobs. Not-DONE first, ordered by date. Perm: jobs:mine."""
    rows = (
        db.query(Job, Lead.name, Lead.kw, User.name)
        .join(Lead, Job.lead_id == Lead.id)
        .join(User, Job.technician_id == User.id)
        .filter(Job.technician_id == user.id)
        .order_by(
            (Job.status == JobStatus.DONE).asc(),
            Job.scheduled_date.desc(),
        )
        .all()
    )
    return [
        JobListItem(
            id=j.id, ref=j.ref, lead_name=ln, kw=kw, technician_name=tn,
            crew=j.crew, scheduled_date=str(j.scheduled_date), status=j.status.value,
        )
        for j, ln, kw, tn in rows
    ]


@router.get("/{job_id}", response_model=JobDetail)
def get_job(
    job_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Job detail with lines, serials, times, signature flag. Perm: jobs:read or own."""
    job = db.get(Job, job_id)
    if not job:
        raise ApiError(404, "Job not found")
    if not has_perm(user, "jobs:read"):
        if not (has_perm(user, "jobs:mine") and job.technician_id == user.id):
            raise ApiError(403, "Not your job")
    if user.role.value == "TECHNICIAN" and job.technician_id != user.id:
        raise ApiError(403, "Not your job")
    return _build_detail(db, job)


@router.post("/{job_id}/start", response_model=JobDetail)
def start_job(
    job_id: int,
    user=Depends(require_perm("jobs:mine")),
    db: Session = Depends(get_db),
):
    """Start a job. Gate: dispatch must be DONE. Perm: jobs:mine (own only)."""
    job = db.get(Job, job_id)
    if not job:
        raise ApiError(404, "Job not found")
    if job.technician_id != user.id:
        raise ApiError(403, "Not your job")

    # Gate: dispatch must be DONE
    dispatch = db.query(Dispatch).filter(Dispatch.job_id == job.id).first()
    if not dispatch or dispatch.status != DispatchStatus.DONE:
        raise ApiError(409, "Dispatch not done yet")

    assert_transition("job", job.status.value, "IN_PROGRESS")
    job.status = JobStatus.IN_PROGRESS
    job.started_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)

    return _build_detail(db, job)


@router.post("/{job_id}/finish", response_model=JobDetail)
def finish_job(
    job_id: int,
    body: FinishJobRequest,
    user=Depends(require_perm("jobs:mine")),
    db: Session = Depends(get_db),
):
    """Finish a job. Gates: must be started, must have signature + photos. Perm: jobs:mine (own only)."""
    job = db.get(Job, job_id)
    if not job:
        raise ApiError(404, "Job not found")
    if job.technician_id != user.id:
        raise ApiError(403, "Not your job")

    # Gate: must be IN_PROGRESS
    if job.status != JobStatus.IN_PROGRESS:
        raise ApiError(409, "Start the job first")

    # Gate: signature required
    if not body.signature:
        raise ApiError(409, "Customer signature required")

    # Gate: at least one photo
    if not body.photos:
        raise ApiError(409, "Add at least one photo")

    assert_transition("job", job.status.value, "DONE")
    job.status = JobStatus.DONE
    job.finished_at = datetime.now(timezone.utc)
    job.signature = body.signature
    job.size_confirmed = body.size_confirmed
    job.photos = body.photos
    db.commit()
    db.refresh(job)

    return _build_detail(db, job)
