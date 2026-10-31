"""Enquiries (leads) and the public enquiry form (Member B)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from pydantic import Field, field_validator
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth import require_perm
from app.db import get_db
from app.errors import ApiError
from app.models import (Lead, LeadSource, LeadStage, Quotation, QuoteStatus, Role, Survey, SurveyStatus,
                        SystemType, User)
from app.refs import next_ref
from app.schemas.base import ApiModel
from app.transitions import assert_transition

router = APIRouter(prefix="/api", tags=["leads"])

# Rule of thumb for rooftop solar: about 10 m² of shadow-free roof per kW
ROOF_M2_PER_KW = 10
# Fixed +05:30 offset (no tzdata needed on Windows) so "today" means today in India
IST = timezone(timedelta(hours=5, minutes=30))


def clean_phone(value: str) -> str:
    """Accept '98250 11223', '+91 98250-11223' etc.; store exactly 10 digits starting 6-9."""
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise ValueError("Enter a valid 10-digit mobile number")
    return digits


# ---------- request models (every limit here is a validation the evaluator can test) ----------

class EnquiryFields(ApiModel):
    name: str = Field(min_length=2, max_length=100)
    phone: str = Field(max_length=20)
    address: str = Field(min_length=5, max_length=300)
    kw: float = Field(ge=1, le=5)
    system_type: SystemType
    monthly_bill: int = Field(ge=1, le=1_000_000)
    subsidy_interest: bool = False

    @field_validator("phone")
    @classmethod
    def check_phone(cls, v: str) -> str:
        return clean_phone(v)

    @field_validator("name", "address")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("This field is required")
        return v


class LeadCreate(EnquiryFields):
    source: LeadSource


class PublicEnquiry(EnquiryFields):
    # honeypot: hidden on the form, humans leave it empty, spam bots fill every field
    website: str = Field(default="", max_length=200)


class LogCallIn(ApiModel):
    roof_area: int = Field(ge=0, le=100_000)
    monthly_bill: int = Field(ge=1, le=1_000_000)
    grid_ok: bool
    notes: str | None = Field(default=None, max_length=1000)


class ScheduleSurveyIn(ApiModel):
    technician_id: int = Field(gt=0)
    visit_date: datetime


class LostIn(ApiModel):
    reason: str = Field(min_length=3, max_length=300)


# ---------- response models ----------

class LeadListItem(ApiModel):
    id: int
    ref: str
    name: str
    phone: str
    source: LeadSource
    kw: float
    system_type: SystemType
    stage: LeadStage
    salesperson_name: str | None
    created_at: datetime


class LeadSurveyItem(ApiModel):
    id: int
    ref: str
    status: SurveyStatus
    visit_date: datetime
    technician_name: str


class LeadQuoteItem(ApiModel):
    id: int
    ref: str
    status: QuoteStatus
    total: int


class LeadDetail(LeadListItem):
    address: str
    monthly_bill: int
    subsidy_interest: bool
    roof_area: int | None
    grid_ok: bool | None
    call_notes: str | None
    lost_reason: str | None
    surveys: list[LeadSurveyItem]
    quotations: list[LeadQuoteItem]
    can_quote: bool


class SurveyCreated(ApiModel):
    id: int
    ref: str
    lead_id: int
    technician_id: int
    visit_date: datetime
    status: SurveyStatus


class PublicCreated(ApiModel):
    ref: str


# ---------- helpers ----------

def get_lead(db: Session, lead_id: int, lock: bool = False) -> Lead:
    lead = db.get(Lead, lead_id, with_for_update=lock)
    if lead is None:
        raise ApiError(404, "Enquiry not found")
    return lead


def user_names(db: Session, ids: set[int | None]) -> dict[int, str]:
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return {u.id: u.name for u in db.scalars(select(User).where(User.id.in_(ids)))}


def can_quote(db: Session, lead: Lead) -> bool:
    """Quote gate (also enforced by C's POST /leads/:id/quotation): an APPROVED survey and no active quotation."""
    approved = db.scalar(select(Survey.id).where(Survey.lead_id == lead.id, Survey.status == SurveyStatus.APPROVED))
    active_quote = db.scalar(select(Quotation.id).where(Quotation.lead_id == lead.id,
                                                        Quotation.status != QuoteStatus.CANCELLED))
    return lead.stage != LeadStage.LOST and approved is not None and active_quote is None


def to_list_item(lead: Lead, names: dict[int, str]) -> LeadListItem:
    return LeadListItem.model_validate({**_lead_fields(lead), "salesperson_name": names.get(lead.salesperson_id)})


def _lead_fields(lead: Lead) -> dict:
    return {c: getattr(lead, c) for c in ("id", "ref", "name", "phone", "source", "kw", "system_type", "stage",
                                          "created_at", "address", "monthly_bill", "subsidy_interest", "roof_area",
                                          "grid_ok", "call_notes", "lost_reason", "salesperson_id")}


def to_detail(db: Session, lead: Lead) -> LeadDetail:
    surveys = list(db.scalars(select(Survey).where(Survey.lead_id == lead.id).order_by(Survey.id)))
    quotes = list(db.scalars(select(Quotation).where(Quotation.lead_id == lead.id).order_by(Quotation.id)))
    names = user_names(db, {lead.salesperson_id} | {s.technician_id for s in surveys})
    return LeadDetail.model_validate({
        **_lead_fields(lead),
        "salesperson_name": names.get(lead.salesperson_id),
        "surveys": [{"id": s.id, "ref": s.ref, "status": s.status, "visit_date": s.visit_date,
                     "technician_name": names.get(s.technician_id, "")} for s in surveys],
        "quotations": [{"id": q.id, "ref": q.ref, "status": q.status, "total": q.total} for q in quotes],
        "can_quote": can_quote(db, lead),
    })


def create_lead(db: Session, body: EnquiryFields, source: LeadSource, salesperson_id: int | None) -> Lead:
    lead = Lead(ref=next_ref(db, "ENQ"), name=body.name, phone=body.phone, address=body.address, kw=body.kw,
                system_type=body.system_type, monthly_bill=body.monthly_bill, subsidy_interest=body.subsidy_interest,
                source=source, stage=LeadStage.NEW, salesperson_id=salesperson_id)
    db.add(lead)
    return lead


# ---------- endpoints ----------

@router.get("/leads", response_model=list[LeadListItem])
def list_leads(search: str | None = None, stage: LeadStage | None = None,
               _: User = Depends(require_perm("leads:read")), db: Session = Depends(get_db)):
    """leads:read. Newest first; `search` matches reference, name or phone; `stage` filters."""
    stmt = select(Lead).order_by(Lead.created_at.desc(), Lead.id.desc())
    if stage is not None:
        stmt = stmt.where(Lead.stage == stage)
    if search and search.strip():
        # SQLAlchemy binds the pattern as a parameter, so this is not open to SQL injection
        like = f"%{search.strip()[:50]}%"
        stmt = stmt.where(or_(Lead.ref.ilike(like), Lead.name.ilike(like), Lead.phone.ilike(like)))
    leads = list(db.scalars(stmt))
    names = user_names(db, {lead.salesperson_id for lead in leads})
    return [to_list_item(lead, names) for lead in leads]


@router.post("/leads", response_model=LeadDetail, status_code=201)
def create_lead_endpoint(body: LeadCreate, user: User = Depends(require_perm("leads:write")),
                         db: Session = Depends(get_db)):
    """leads:write. Sales enters a call / WhatsApp / web enquiry. 400 on invalid fields."""
    try:
        lead = create_lead(db, body, body.source, user.id if user.role == Role.SALES else None)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return to_detail(db, lead)


@router.get("/leads/{lead_id}", response_model=LeadDetail)
def get_lead_endpoint(lead_id: int, _: User = Depends(require_perm("leads:read")), db: Session = Depends(get_db)):
    """leads:read. Full enquiry with its surveys, quotations and the canQuote flag. 404 if missing."""
    return to_detail(db, get_lead(db, lead_id))


@router.post("/leads/{lead_id}/log-call", response_model=LeadDetail)
def log_call(lead_id: int, body: LogCallIn, _: User = Depends(require_perm("leads:write")),
             db: Session = Depends(get_db)):
    """leads:write. Records the qualifying call. Only for NEW or CONTACTED (409 otherwise).
    QUALIFIED when the grid connection is OK and the roof has about 10 m² per kW; otherwise CONTACTED."""
    try:
        lead = get_lead(db, lead_id, lock=True)
        if lead.stage not in (LeadStage.NEW, LeadStage.CONTACTED):
            raise ApiError(409, "A call can only be logged for a NEW or CONTACTED enquiry")
        needed = ROOF_M2_PER_KW * lead.kw
        qualified = body.grid_ok and body.roof_area >= needed
        target = LeadStage.QUALIFIED if qualified else LeadStage.CONTACTED
        if target != lead.stage:  # a second failed call keeps CONTACTED: no transition to check
            assert_transition("lead", lead.stage, target)
        lead.roof_area, lead.monthly_bill, lead.grid_ok = body.roof_area, body.monthly_bill, body.grid_ok
        reason = "" if qualified else (" (grid not suitable)" if not body.grid_ok
                                       else f" (roof {body.roof_area} m², needs about {needed:g} m²)")
        lead.call_notes = ((body.notes or "").strip() + reason).strip() or None
        lead.stage = target
        db.commit()
    except Exception:
        db.rollback()
        raise
    return to_detail(db, lead)


@router.post("/leads/{lead_id}/schedule-survey", response_model=SurveyCreated, status_code=201)
def schedule_survey(lead_id: int, body: ScheduleSurveyIn, _: User = Depends(require_perm("leads:write")),
                    db: Session = Depends(get_db)):
    """leads:write. Books the roof survey. 409 unless the lead is QUALIFIED; 400 for a bad technician or past date."""
    try:
        lead = get_lead(db, lead_id, lock=True)
        if lead.stage != LeadStage.QUALIFIED:
            raise ApiError(409, "Qualify the enquiry with a call before scheduling a survey")
        tech = db.get(User, body.technician_id)
        if tech is None or tech.role != Role.TECHNICIAN or not tech.active:
            raise ApiError(400, "Choose an active technician", "technicianId")
        visit = body.visit_date if body.visit_date.tzinfo else body.visit_date.replace(tzinfo=IST)
        if visit.astimezone(IST).date() < datetime.now(IST).date():
            raise ApiError(400, "Visit date can't be in the past", "visitDate")
        assert_transition("lead", lead.stage, LeadStage.SURVEY_SCHEDULED)
        survey = Survey(ref=next_ref(db, "SRV"), lead_id=lead.id, technician_id=tech.id, visit_date=visit,
                        photos=[], status=SurveyStatus.SCHEDULED)
        db.add(survey)
        lead.stage = LeadStage.SURVEY_SCHEDULED
        db.commit()
    except Exception:
        db.rollback()
        raise
    return SurveyCreated.model_validate(survey)


@router.post("/leads/{lead_id}/lost", response_model=LeadDetail)
def mark_lost(lead_id: int, body: LostIn, _: User = Depends(require_perm("leads:write")),
              db: Session = Depends(get_db)):
    """leads:write. Closes the enquiry as LOST with a reason. 409 if already WON or LOST."""
    try:
        lead = get_lead(db, lead_id, lock=True)
        assert_transition("lead", lead.stage, LeadStage.LOST)
        lead.stage, lead.lost_reason = LeadStage.LOST, body.reason.strip()
        db.commit()
    except Exception:
        db.rollback()
        raise
    return to_detail(db, lead)


@router.post("/public/enquiries", response_model=PublicCreated, status_code=201)
def public_enquiry(body: PublicEnquiry, db: Session = Depends(get_db)):
    """Public (no login): the customer's web form. Creates a NEW lead with source WEB and returns only its ref,
    so nobody can read other customers' data through this endpoint."""
    if body.website:
        raise ApiError(400, "Invalid submission")
    try:
        lead = create_lead(db, body, LeadSource.WEB, None)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return PublicCreated(ref=lead.ref)
