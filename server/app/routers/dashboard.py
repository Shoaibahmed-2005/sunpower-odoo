"""Dashboard counts and the profit-per-job report (JSON + CSV). Owner: A. Everything is computed on request, nothing stored."""
import csv
import io
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import require_perm
from app.db import get_db
from app.models import (
    Dispatch,
    DispatchStatus,
    Invoice,
    InvoiceStatus,
    InvoiceType,
    Job,
    JobStatus,
    Lead,
    LeadStage,
    Quotation,
    QuoteStatus,
    Role,
    SerialUnit,
    Survey,
    SurveyStatus,
    Ticket,
    TicketStatus,
    Tracking,
)
from app.schemas.base import ApiModel

router = APIRouter(prefix="/api", tags=["Dashboard"])

Period = Literal["today", "week", "month"]

# which dashboard groups each role sees (matches what shared/access.json lets them read)
ROLE_GROUPS = {
    Role.ADMIN: {"leads", "surveys", "quotes", "jobs", "dispatches", "tickets", "money"},
    Role.SALES: {"leads", "surveys", "quotes", "jobs", "money"},
    Role.WAREHOUSE: {"jobs", "dispatches"},
    Role.SUPPORT: {"jobs", "tickets", "money"},
    Role.TECHNICIAN: set(),
}


def period_start(period: Period, today: date) -> datetime:
    """today = midnight today · week = Monday of this week · month = the 1st (UTC)."""
    if period == "week":
        start = today - timedelta(days=today.weekday())
    elif period == "month":
        start = today.replace(day=1)
    else:
        start = today
    return datetime.combine(start, time.min, tzinfo=timezone.utc)


def count(db: Session, model, *conditions) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*conditions))


def total(db: Session, column, *conditions) -> int:
    return db.scalar(select(func.coalesce(func.sum(column), 0)).where(*conditions))


def paid_subquery():
    """quotation_id -> Σ PAID invoice amounts, to find quotes still waiting for their first payment."""
    return (select(Invoice.quotation_id, func.sum(Invoice.amount).label("paid"))
            .where(Invoice.status == InvoiceStatus.PAID).group_by(Invoice.quotation_id).subquery())


def build_group(db: Session, group: str, since: datetime, today: date) -> dict:
    if group == "leads":
        return {"new": count(db, Lead, Lead.created_at >= since),
                "toCall": count(db, Lead, Lead.stage.in_([LeadStage.NEW, LeadStage.CONTACTED]))}
    if group == "surveys":
        return {"toApprove": count(db, Survey, Survey.status == SurveyStatus.SUBMITTED)}
    if group == "quotes":
        paid = paid_subquery()
        awaiting = db.scalar(
            select(func.count()).select_from(Quotation).outerjoin(paid, paid.c.quotation_id == Quotation.id)
            .where(Quotation.status.in_([QuoteStatus.DRAFT, QuoteStatus.SENT]), paid.c.paid.is_(None)))
        return {"sent": count(db, Quotation, Quotation.status == QuoteStatus.SENT),
                "awaitingPayment": awaiting}
    if group == "jobs":
        return {"scheduled": count(db, Job, Job.status.in_([JobStatus.SCHEDULED, JobStatus.DISPATCHED])),
                "inProgress": count(db, Job, Job.status == JobStatus.IN_PROGRESS),
                "late": count(db, Job, Job.status != JobStatus.DONE, Job.scheduled_date < today)}
    if group == "dispatches":
        return {"ready": count(db, Dispatch, Dispatch.status == DispatchStatus.READY)}
    if group == "tickets":
        is_open = Ticket.status != TicketStatus.CLOSED
        return {"open": count(db, Ticket, is_open),
                "underWarranty": count(db, Ticket, is_open, Ticket.under_warranty.is_(True)),
                "billable": count(db, Ticket, is_open, Ticket.under_warranty.is_(False))}
    # money: booked = confirmed in the period (net of subsidy), collected = paid in the period, due = all unpaid
    return {"booked": total(db, Quotation.total - Quotation.subsidy,
                            Quotation.status == QuoteStatus.CONFIRMED, Quotation.confirmed_at >= since),
            "collected": total(db, Invoice.amount, Invoice.status == InvoiceStatus.PAID, Invoice.paid_at >= since),
            "due": total(db, Invoice.amount, Invoice.status == InvoiceStatus.DUE)}


@router.get("/dashboard")
def dashboard(period: Period = "today", user=Depends(require_perm("dashboard:read")),
              db: Session = Depends(get_db)):
    """Counts for the home page. Only the groups the caller's role may see are included.
    Perm: dashboard:read. 400 if period isn't today / week / month."""
    today = date.today()
    since = period_start(period, today)
    groups = ROLE_GROUPS.get(user.role, set())
    return {"period": period, **{g: build_group(db, g, since, today) for g in sorted(groups)}}


# ---------- Profit per job (BUILD_PLAN §8.3, with the team's revenue + crew decisions) ----------

class ProfitRow(ApiModel):
    job_id: int
    job_ref: str
    lead_name: str
    finished_at: datetime | None
    revenue: int
    parts_cost: int
    labour_cost: int
    repair_cost: int
    profit: int
    margin_pct: int


def crew_size(crew: str) -> int:
    """Lead technician + every name in the comma-separated crew ("Arjun, Sameer" -> 3)."""
    return 1 + len([name for name in crew.split(",") if name.strip()])


def job_profit(db: Session, job: Job) -> ProfitRow:
    quotation = job.quotation
    # subsidy counts as revenue: the customer pays total − subsidy, the subsidy covers the rest
    invoiced = total(db, Invoice.amount, Invoice.quotation_id == quotation.id, Invoice.type != InvoiceType.REPAIR)
    revenue = invoiced + quotation.subsidy

    dispatch_id = job.dispatch.id if job.dispatch else None
    parts = 0
    for line in quotation.lines:
        if line.product.tracking == Tracking.SERIAL and dispatch_id is not None:
            # the real purchase cost of the exact units that went to this customer
            parts += total(db, SerialUnit.unit_cost, SerialUnit.dispatch_id == dispatch_id,
                           SerialUnit.product_id == line.product_id)
        else:
            parts += line.qty * line.product.cost

    labour = 0
    if job.started_at and job.finished_at:
        hours = (job.finished_at - job.started_at).total_seconds() / 3600
        labour = round(hours * crew_size(job.crew) * job.technician.hourly_rate)

    # free (under-warranty) repairs on this job's units are paid by the company
    repair = 0
    if dispatch_id is not None:
        repair = db.scalar(
            select(func.coalesce(func.sum(Ticket.parts_cost + Ticket.labour_cost), 0))
            .join(SerialUnit, Ticket.serial_unit_id == SerialUnit.id)
            .where(SerialUnit.dispatch_id == dispatch_id, Ticket.under_warranty.is_(True)))

    profit = revenue - parts - labour - repair
    return ProfitRow(job_id=job.id, job_ref=job.ref, lead_name=job.lead.name, finished_at=job.finished_at,
                     revenue=revenue, parts_cost=parts, labour_cost=labour, repair_cost=repair, profit=profit,
                     margin_pct=round(profit / revenue * 100) if revenue else 0)


def profit_rows(db: Session, from_: date | None, to: date | None) -> list[ProfitRow]:
    """Every DONE job, optionally finished between from and to (inclusive dates), newest first."""
    query = select(Job).where(Job.status == JobStatus.DONE).order_by(Job.finished_at.desc())
    if from_ is not None:
        query = query.where(Job.finished_at >= datetime.combine(from_, time.min, tzinfo=timezone.utc))
    if to is not None:
        query = query.where(Job.finished_at < datetime.combine(to + timedelta(days=1), time.min, tzinfo=timezone.utc))
    return [job_profit(db, job) for job in db.scalars(query)]


@router.get("/reports/profit", response_model=list[ProfitRow])
def profit_report(from_: date | None = Query(None, alias="from"), to: date | None = None,
                  user=Depends(require_perm("reports:read")), db: Session = Depends(get_db)):
    """Profit of every finished job. Perm: reports:read (only the Admin's "*" has it). 400 on a bad date."""
    return profit_rows(db, from_, to)


CSV_COLUMNS = ["Job", "Customer", "Finished", "Revenue", "Parts", "Labour", "Free repairs", "Profit", "Margin %"]


@router.get("/reports/profit.csv")
def profit_report_csv(from_: date | None = Query(None, alias="from"), to: date | None = None,
                      user=Depends(require_perm("reports:read")), db: Session = Depends(get_db)):
    """The same rows as /reports/profit, as a spreadsheet download. Perm: reports:read."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(CSV_COLUMNS)
    for r in profit_rows(db, from_, to):
        writer.writerow([r.job_ref, r.lead_name, r.finished_at.date().isoformat() if r.finished_at else "",
                         r.revenue, r.parts_cost, r.labour_cost, r.repair_cost, r.profit, r.margin_pct])
    # utf-8-sig adds a BOM so Excel shows names with Indian characters correctly
    return Response(content=out.getvalue().encode("utf-8-sig"), media_type="text/csv",
                    headers={"Content-Disposition": 'attachment; filename="profit-per-job.csv"'})
