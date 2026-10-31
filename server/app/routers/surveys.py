"""Roof surveys: technician submits from the phone, Sales approves or rejects."""
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import require_perm
from app.db import get_db
from app.errors import ApiError
from app.models import Lead, LeadStage, Role, Survey, SurveyStatus, User
from app.schemas.base import ApiModel
from app.transitions import assert_transition

router = APIRouter(prefix="/api/surveys", tags=["surveys"])

Direction = Literal["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


class SubmitIn(ApiModel):
    direction: Direction
    tilt: int = Field(ge=0, le=60)
    cable_distance: float = Field(ge=1, le=150)
    area: int = Field(gt=0, le=100_000)
    photos: list[str] = Field(default_factory=list, max_length=10)

    @field_validator("photos")
    @classmethod
    def only_our_uploads(cls, photos: list[str]) -> list[str]:
        # accept only URLs returned by our own /api/uploads (images in the DB, or old files), never outside links
        for url in photos:
            if not url.startswith(("/api/images/", "/uploads/")) or ".." in url or len(url) > 200:
                raise ValueError("Photos must be uploaded through the app")
        return photos


class RejectIn(ApiModel):
    reason: str = Field(min_length=3, max_length=300)


class SurveyLead(ApiModel):
    id: int
    name: str
    phone: str
    address: str


class SurveyListItem(ApiModel):
    id: int
    ref: str
    lead_id: int
    lead_name: str
    address: str
    technician_name: str
    visit_date: datetime
    status: SurveyStatus


class SurveyDetail(ApiModel):
    id: int
    ref: str
    lead: SurveyLead
    technician_id: int
    technician_name: str
    visit_date: datetime
    direction: str | None
    tilt: int | None
    cable_distance: float | None
    area: int | None
    photos: list[str]
    status: SurveyStatus
    reject_reason: str | None


def load_survey(db: Session, survey_id: int, user: User, lock: bool = False) -> Survey:
    """404 if missing. Technicians only see their own surveys: someone else's looks like 404, not 403,
    so a technician can't even discover which survey ids exist."""
    survey = db.get(Survey, survey_id, with_for_update=lock)
    if survey is None or (user.role == Role.TECHNICIAN and survey.technician_id != user.id):
        raise ApiError(404, "Survey not found")
    return survey


def to_detail(db: Session, survey: Survey) -> SurveyDetail:
    lead = db.get(Lead, survey.lead_id)
    tech = db.get(User, survey.technician_id)
    return SurveyDetail.model_validate({
        "id": survey.id, "ref": survey.ref,
        "lead": {"id": lead.id, "name": lead.name, "phone": lead.phone, "address": lead.address},
        "technician_id": survey.technician_id, "technician_name": tech.name if tech else "",
        "visit_date": survey.visit_date, "direction": survey.direction, "tilt": survey.tilt,
        "cable_distance": survey.cable_distance, "area": survey.area, "photos": survey.photos or [],
        "status": survey.status, "reject_reason": survey.reject_reason,
    })


@router.get("", response_model=list[SurveyListItem])
def list_surveys(status: SurveyStatus | None = None, user: User = Depends(require_perm("surveys:read")),
                 db: Session = Depends(get_db)):
    """surveys:read. Technicians get only their own surveys (filtered on the server)."""
    stmt = (select(Survey, Lead, User)
            .join(Lead, Lead.id == Survey.lead_id)
            .join(User, User.id == Survey.technician_id)
            .order_by(Survey.visit_date.desc(), Survey.id.desc()))
    if status is not None:
        stmt = stmt.where(Survey.status == status)
    if user.role == Role.TECHNICIAN:
        stmt = stmt.where(Survey.technician_id == user.id)
    return [SurveyListItem(id=s.id, ref=s.ref, lead_id=lead.id, lead_name=lead.name, address=lead.address,
                           technician_name=tech.name, visit_date=s.visit_date, status=s.status)
            for s, lead, tech in db.execute(stmt)]


@router.get("/{survey_id}", response_model=SurveyDetail)
def get_survey(survey_id: int, user: User = Depends(require_perm("surveys:read")), db: Session = Depends(get_db)):
    """surveys:read (technicians: own only). 404 if missing."""
    return to_detail(db, load_survey(db, survey_id, user))


@router.patch("/{survey_id}/submit", response_model=SurveyDetail)
def submit_survey(survey_id: int, body: SubmitIn, user: User = Depends(require_perm("surveys:submit")),
                  db: Session = Depends(get_db)):
    """surveys:submit (assigned technician, or Admin). SCHEDULED → SUBMITTED; 409 if already submitted.
    Limits: tilt 0-60°, cable 1-150 m, area > 0, photos only from /api/images or /uploads."""
    try:
        survey = load_survey(db, survey_id, user, lock=True)
        assert_transition("survey", survey.status, SurveyStatus.SUBMITTED)
        survey.direction, survey.tilt = body.direction, body.tilt
        survey.cable_distance, survey.area, survey.photos = body.cable_distance, body.area, body.photos
        survey.status = SurveyStatus.SUBMITTED
        db.commit()
    except Exception:
        db.rollback()
        raise
    return to_detail(db, survey)


@router.post("/{survey_id}/approve", response_model=SurveyDetail)
def approve_survey(survey_id: int, user: User = Depends(require_perm("surveys:approve")),
                   db: Session = Depends(get_db)):
    """surveys:approve (Sales, Admin). SUBMITTED → APPROVED and lead → SURVEY_APPROVED in one transaction.
    This is what unlocks "Create quotation". 409 if not SUBMITTED (also stops a double click)."""
    try:
        # lock the survey row so two quick clicks can't both approve
        survey = load_survey(db, survey_id, user, lock=True)
        lead = db.get(Lead, survey.lead_id, with_for_update=True)
        assert_transition("survey", survey.status, SurveyStatus.APPROVED)
        assert_transition("lead", lead.stage, LeadStage.SURVEY_APPROVED)
        survey.status = SurveyStatus.APPROVED
        survey.approved_by_id, survey.approved_at = user.id, datetime.now(timezone.utc)  # audit: who and when
        lead.stage = LeadStage.SURVEY_APPROVED
        db.commit()
    except Exception:
        db.rollback()
        raise
    return to_detail(db, survey)


@router.post("/{survey_id}/reject", response_model=SurveyDetail)
def reject_survey(survey_id: int, body: RejectIn, user: User = Depends(require_perm("surveys:approve")),
                  db: Session = Depends(get_db)):
    """surveys:approve. SUBMITTED → REJECTED with a reason; lead goes back to QUALIFIED so a new survey can be booked."""
    try:
        survey = load_survey(db, survey_id, user, lock=True)
        lead = db.get(Lead, survey.lead_id, with_for_update=True)
        assert_transition("survey", survey.status, SurveyStatus.REJECTED)
        assert_transition("lead", lead.stage, LeadStage.QUALIFIED)
        survey.status, survey.reject_reason = SurveyStatus.REJECTED, body.reason.strip()
        lead.stage = LeadStage.QUALIFIED
        db.commit()
    except Exception:
        db.rollback()
        raise
    return to_detail(db, survey)
