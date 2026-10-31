# BUILD_PLAN.md — Kiran: Solar Installation Management System

> **For AI coding agents:** read this whole file before writing code. Then build **only the section for your member** (A, B, C or D, see §11). Follow the contracts in §5–§9 exactly: other members are building against them at the same time. Never edit a file owned by another member (§3). If you need a contract or schema change, do not make it yourself: add a line to `CHANGES_NEEDED.md` (`[SCHEMA]`, `[CONTRACT]` or `[DEP]` + what + why) and tell your human. Keep code simple and explainable: every line will be questioned in the technical round.

---

## 1. What we are building

Kiran replaces WhatsApp quotes and paper site registers for **SunPower Solutions**, a rooftop solar company (about 40 installs a month, 15 technicians). One web app takes a customer from the first enquiry to the 20-year warranty. The problem statement's six scenes are the scope:

| # | Scene | Must work |
|---|---|---|
| 1 | Rooftop inquiry | Enquiries from web form / WhatsApp / call in one list; qualifying call (roof area, bill, grid OK); survey by a technician (direction, tilt, cable distance); **no quote until the survey is approved** |
| 2 | Getting the kit right | Quote from a package template; parts list fills automatically; advance or full payment; **no confirm without a payment**; confirm auto-creates the dispatch and the job |
| 3 | Dispatch day | Every inverter, battery and charge controller **scanned by serial**; validate blocked until all scanned; **warranty starts automatically** (2 years inverter/battery/controller, 20 years panels) |
| 4 | On the roof | Technician phone form: start/finish time, system size, photos, **customer signature** |
| 5 | Breakdown | Find customer + serial in seconds; under warranty → ₹0; expired → parts + labour billed automatically; ticket open until the customer confirms |
| 6 | Director's month-end | Profit per job, open repairs, invoices, subsidy paperwork, technician pay; today / week / month |

**Priorities**
- **P0 (works end to end on `main` by 16:00 day 1):** login with 5 roles + role menu; enquiries; survey submit + approve (gate); quotation from package; payment + confirm (gate); dispatch scan + validate (gate) + warranty; job start + finish with signature; ticket lookup + warranty billing + close; dashboard basic counts.
- **Live sync:** P0 uses 5-second polling + instant refresh after your own actions; P1 adds instant push over WebSockets (§9).
- **P1 (after P0 is on main):** WebSocket live push, public enquiry form, invoices page, stock page, profit-per-job table, kanban views, stock adjust, unscan.
- **P2 (day 2 morning):** subsidy tracker, technician pay, crew schedule, receipts (stock purchases), CSV export, notification bell.

**Rule:** nobody starts P1 until every P0 item works on `main`.

---

## 2. Stack (locked; do not change)

| Layer | Choice |
|---|---|
| Backend | Python 3.12, **FastAPI**, **SQLAlchemy 2.0 (sync, `def` endpoints)**, Pydantic v2, PyJWT, bcrypt, python-multipart, uvicorn |
| Database | PostgreSQL via `psycopg[binary]` (fallback SQLite only if Postgres setup takes > 10 min) |
| Migrations | None on day 1: `reset` drops and recreates all tables, then seeds. Alembic optional on day 2 |
| Frontend | React 18 + **TypeScript** (`strict: false`) + Vite + Tailwind + React Router 6 + **TanStack React Query 5** + axios + react-hook-form (optional) + lucide-react icons + recharts (P1) |
| Auth | JWT in an **httpOnly, SameSite=lax cookie** named `token` (never in localStorage, never a Bearer header) |
| Python tooling | **uv** (`pip install uv`), dependencies in `server/pyproject.toml` |
| Ports | API **8000**, web **5173**; Vite proxies `/api` and `/uploads` → `http://localhost:8000` (so no CORS) |

Root `package.json` scripts (A creates in Phase 0):
```json
{
  "scripts": {
    "dev": "concurrently -n api,web \"npm:dev:api\" \"npm:dev:web\"",
    "dev:api": "cd server && uv run uvicorn app.main:app --reload --port 8000",
    "dev:web": "cd client && npm run dev",
    "reset": "cd server && uv run python -m app.seed"
  },
  "devDependencies": { "concurrently": "^9.0.0" }
}
```
`server/.env` (from `.env.example`, never committed):
```
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/kiran
JWT_SECRET=change-me-long-random
```

---

## 3. Repo layout and ownership

Only edit files you own. `main.py` and `App.tsx` are created in Phase 0 with everything pre-registered and then **never edited again**.

```
kiran/
  package.json                      A
  BUILD_PLAN.md  DECISIONS.md  CHANGES_NEEDED.md   all (append only)
  design/inspiration/*.png          D   Pinterest style references (style only, §9.1)
  design/DESIGN.md                  D   palette, radius, shadows, component styles extracted from them
  shared/access.json                B   role → permissions (read by backend AND frontend)
  server/
    pyproject.toml                  A   (all Python deps added in Phase 0)
    .env.example                    A
    app/
      main.py                       A   app, routers pre-included, error handlers, /uploads mount
      config.py                     A   settings from .env
      db.py                         A   engine, SessionLocal, Base, get_db
      models.py                     A ONLY   all SQLAlchemy models (§5)
      seed.py                       A ONLY   drop_all, create_all, seed (§10)
      errors.py                     A   ApiError + handlers (§6)
      schemas/base.py               A   ApiModel with camelCase aliases (§6)
      auth.py                       B   password hashing, JWT, get_current_user, require_perm
      refs.py                       B   next_ref()
      transitions.py                C   status maps + assert_transition()
      routers/auth.py               B
      routers/users.py              B
      routers/leads.py              B   (+ public enquiry)
      routers/surveys.py            B
      routers/quotations.py         C
      routers/invoices.py           C
      routers/inventory.py          A   products, packages, stock, dispatches, serials
      routers/dashboard.py          A   (+ profit report P1)
      routers/jobs.py               D
      routers/tickets.py            D
      routers/uploads.py            D
      services/stock.py             A   scan + validate logic
      tests/                        each member: test_<area>.py
  client/
    public/brand/logo.png, logo-mark.png, ../favicon.png   D   your logo files
    src/styles/tokens.css           D   colour, radius, shadow variables from DESIGN.md
    src/components/Logo.tsx         D   the only way to show the logo
    vite.config.ts                  D
    tailwind.config.js              D
    src/
      main.tsx  App.tsx             D
      api/client.ts                 C   axios instance + error toast
      lib/queryClient.ts            C
      lib/format.ts                 C   formatINR, formatDate, formatDateTime
      lib/queryKeys.ts              C
      auth/AuthContext.tsx          C   (+ useAuth, can(perm))
      components/                   D   Layout, NavMenu, PageHeader, DataTable, StatusBar, Badge,
                                        Field, Button, Toast, SignaturePad, PhoneLayout, Forbidden
      routes/salesRoutes.tsx        B
      routes/quoteRoutes.tsx        C
      routes/inventoryRoutes.tsx    A
      routes/fieldRoutes.tsx        D
      pages/auth/                   C
      pages/sales/  pages/public/   B
      pages/quotes/ pages/accounts/ C
      pages/inventory/ pages/dashboard/  A
      pages/field/  pages/service/  pages/mobile/  D (B owns pages/mobile/SurveyForm.tsx)
```

---

## 4. Roles and access

Five staff roles log in through one login page; the customer never logs in. Only the Director creates users (no public sign-up).

`shared/access.json` (B writes in Phase 0; backend `require_perm` and the frontend menu both read it):
```json
{
  "DIRECTOR":   ["*"],
  "SALES":      ["dashboard:read","leads:read","leads:write","surveys:read","surveys:approve",
                 "quotes:read","quotes:write","invoices:read","invoices:write",
                 "packages:read","stock:read","jobs:read","users:read"],
  "TECHNICIAN": ["jobs:mine","surveys:read","surveys:submit"],
  "WAREHOUSE":  ["dashboard:read","stock:read","stock:write","dispatches:read","dispatches:write",
                 "serials:read","products:read","packages:read","jobs:read"],
  "SUPPORT":    ["dashboard:read","tickets:read","tickets:write","serials:read","jobs:read",
                 "invoices:read","users:read"]
}
```
- Technicians only ever see **their own** surveys and jobs (filter by `technician_id = current_user.id` on the server).
- Landing page after login: Director `/`, Sales `/leads`, Technician `/m`, Warehouse `/dispatches`, Support `/tickets`.
- A forbidden API call returns **403**; a forbidden page shows the `Forbidden` component.

---

## 5. Data model (A writes `models.py` in Phase 0; everyone reviews at 12:55)

Python attributes are `snake_case`; the API exposes `camelCase` (§6). Money is **integer rupees**. Times are timezone-aware UTC; dates are ISO strings in the API.

**Enums** (in `models.py`, imported everywhere):
```
Role:          DIRECTOR SALES TECHNICIAN WAREHOUSE SUPPORT
LeadSource:    WEB WHATSAPP CALL
SystemType:    ON_GRID OFF_GRID
LeadStage:     NEW CONTACTED QUALIFIED SURVEY_SCHEDULED SURVEY_APPROVED QUOTED WON LOST
SurveyStatus:  SCHEDULED SUBMITTED APPROVED REJECTED
Tracking:      SERIAL LOT QTY SERVICE
PackageType:   HARDWARE ON_GRID OFF_GRID SERVICE
QuoteStatus:   DRAFT SENT CONFIRMED CANCELLED
InvoiceType:   ADVANCE BALANCE FULL REPAIR
InvoiceStatus: DUE PAID
JobStatus:     SCHEDULED DISPATCHED IN_PROGRESS DONE
DispatchStatus: READY DONE CANCELLED
SerialStatus:  IN_STOCK PICKED DELIVERED
TicketStatus:  NEW ASSIGNED IN_REPAIR RESOLVED CLOSED
```

**Tables**
| Table | Columns (type, constraints) |
|---|---|
| `users` | id int PK · name str · login_id str **unique** · password_hash str · role Role · hourly_rate int default 0 · active bool default true · created_at |
| `counters` | key str PK (`ENQ`,`SRV`,`SQ`,`JOB`,`SP/OUT`,`TKT`,`INV`) · next int default 1 |
| `leads` | id · ref str **unique** · name · phone str **index** · email str? · address str · kw float · system_type SystemType · monthly_bill int · subsidy_interest bool · source LeadSource · roof_area int? · grid_ok bool? · call_notes text? · stage LeadStage default NEW · lost_reason str? · salesperson_id FK users? · created_at |
| `surveys` | id · ref **unique** · lead_id FK · technician_id FK users · visit_date datetime · direction str? (N, NE, E, SE, S, SW, W, NW) · tilt int? · cable_distance float? · area int? · photos JSON default [] · status SurveyStatus default SCHEDULED · reject_reason str? · approved_by_id FK users? · approved_at? |
| `products` | id · code str **unique** · name · tracking Tracking · warranty_months int · cost int · price int · qty_on_hand int default 0 |
| `packages` | id · code str **unique** (`ON-3`) · name · type PackageType · kw float · subsidy int default 0 |
| `package_lines` | id · package_id FK · product_id FK · qty int |
| `quotations` | id · ref **unique** · lead_id FK · package_id FK · status QuoteStatus default DRAFT · total int · subsidy int · created_at · confirmed_at? |
| `quote_lines` | id · quotation_id FK · product_id FK · qty int · unit_price int (**copied from product price at creation**) |
| `invoices` | id · ref **unique** · lead_id FK · quotation_id FK? · ticket_id FK? · type InvoiceType · amount int · status InvoiceStatus · created_at · paid_at? |
| `jobs` | id · ref **unique** · quotation_id FK **unique** · lead_id FK · technician_id FK users · crew str (names, comma separated) · status JobStatus default SCHEDULED · scheduled_date date · started_at? · finished_at? · size_confirmed float? · signature text? (data URL) · photos JSON default [] |
| `dispatches` | id · ref **unique** · quotation_id FK · job_id FK · status DispatchStatus default READY · delivered_at? |
| `serial_units` | id · serial str **unique** · product_id FK · qty int default 1 (lots > 1) · status SerialStatus default IN_STOCK · unit_cost int · dispatch_id FK? · lead_id FK? · delivered_at? · warranty_until date? |
| `tickets` | id · ref **unique** · serial_unit_id FK? · lead_id FK · issue text · status TicketStatus default NEW · under_warranty bool · technician_id FK users? · parts_cost int default 0 · labour_cost int default 0 · bill_amount int default 0 · created_at · resolved_at? · customer_confirmed_at? |

Day 2 (A adds, after `[SCHEMA]` agreement): `subsidy_applications` (job_id unique, stage NOT_STARTED/APPLIED/DOCS_VERIFIED/NET_METER/INSPECTION/CREDITED, expected_amount, documents JSON, updated_at), `technician_payouts` (technician_id, period_start, period_end, hours, rate, amount, status DUE/PAID, paid_at), `receipts` + `receipt_lines` (vendor, status, product, qty, serials JSON).

**Derived values (never stored)**
- `stock.reserved` = Σ quote_line.qty for quotations CONFIRMED whose dispatch is READY. `free = qty_on_hand − reserved`.
- Serial `under_warranty` = `warranty_until >= today`.
- Panels (`tracking = LOT`) get one `serial_units` row per dispatch line on validate: serial `LOT-<dispatch ref>-<product code>`, qty = line qty, warranty from product (240 months).

---

## 6. Backend conventions (shared code, A writes in Phase 0)

**camelCase API** — every request/response model extends `ApiModel`:
```python
# app/schemas/base.py
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)
```
Routes return Pydantic models (FastAPI serialises by alias). Request bodies accept camelCase.

**Errors** — one format everywhere: `{"error": "Human-readable message", "field": "phone" | null}`
```python
# app/errors.py
class ApiError(Exception):
    def __init__(self, status: int, message: str, field: str | None = None):
        self.status, self.message, self.field = status, message, field
# main.py registers:
#  ApiError -> JSONResponse(status, {"error": message, "field": field})
#  RequestValidationError -> 400 {"error": first error msg, "field": last loc item}
#  HTTPException -> {"error": detail, "field": None}
```
Codes: 400 invalid input · 401 not logged in · 403 wrong role · 404 not found · **409 a gate or a state blocks it** (message says what to do, e.g. "Survey not approved yet").

**DB session**
```python
# app/db.py
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
class Base(DeclarativeBase): pass
def get_db():
    with SessionLocal() as db:
        yield db
```
Write operations that touch several rows run inside `with db.begin():` (one transaction). Never commit halfway through a gate.

**Auth (B)**
```python
# app/auth.py
COOKIE = dict(key="token", httponly=True, samesite="lax", secure=False, max_age=7*24*3600)
def hash_password(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt(12)).decode()
def verify_password(p, h): return bcrypt.checkpw(p.encode(), h.encode())
def make_token(user): return jwt.encode({"sub": str(user.id), "role": user.role.value, "exp": now+7d}, SECRET, "HS256")
def get_current_user(request: Request, db=Depends(get_db)) -> User:  # 401 if missing/invalid/inactive
def require_perm(perm: str):  # returns a dependency; 403 unless role has perm or "*"
```
Usage: `def list_leads(user: User = Depends(require_perm("leads:read")), db: Session = Depends(get_db))`.

**References (B)**
```python
# app/refs.py — atomic, safe under concurrency
PREFIX = {"ENQ": "ENQ", "SRV": "SRV", "SQ": "SQ", "JOB": "JOB", "SP/OUT": "SP/OUT", "TKT": "TKT", "INV": "INV"}
def next_ref(db, key: str) -> str:
    n = db.execute(update(Counter).where(Counter.key == key)
                   .values(next=Counter.next + 1).returning(Counter.next)).scalar_one() - 1
    return f"{PREFIX[key]}/{n:04d}"     # ENQ/0007
```

**Transitions (C)**
```python
# app/transitions.py
TRANSITIONS = {
  "lead":      {"NEW": ["CONTACTED","QUALIFIED","LOST"], "CONTACTED": ["QUALIFIED","LOST"],
                "QUALIFIED": ["SURVEY_SCHEDULED","LOST"], "SURVEY_SCHEDULED": ["SURVEY_APPROVED","QUALIFIED","LOST"],
                "SURVEY_APPROVED": ["QUOTED","LOST"], "QUOTED": ["WON","LOST"]},
  "survey":    {"SCHEDULED": ["SUBMITTED"], "SUBMITTED": ["APPROVED","REJECTED"]},
  "quotation": {"DRAFT": ["SENT","CONFIRMED","CANCELLED"], "SENT": ["CONFIRMED","CANCELLED"]},
  "job":       {"SCHEDULED": ["DISPATCHED"], "DISPATCHED": ["IN_PROGRESS"], "IN_PROGRESS": ["DONE"]},
  "dispatch":  {"READY": ["DONE","CANCELLED"]},
  "ticket":    {"NEW": ["ASSIGNED"], "ASSIGNED": ["IN_REPAIR"], "IN_REPAIR": ["RESOLVED"], "RESOLVED": ["CLOSED"]},
  "invoice":   {"DUE": ["PAID"]},
}
def assert_transition(entity: str, current, target) -> None:  # raises ApiError(409, "Cannot move <entity> from X to Y")
```
Every status change in every router goes through `assert_transition`.

**Uploads (D)** — `POST /api/uploads` (multipart `file`, images only, ≤ 5 MB) saves to `server/uploads/<uuid>.<ext>` and returns `{"url": "/uploads/<file>"}`. `main.py` mounts `StaticFiles` at `/uploads`. Signatures are stored as data URLs in `jobs.signature`, not uploaded.

---

## 7. API contract

Base `/api`. All endpoints need the cookie except auth login and `/public/*`. List endpoints accept `?search=` and `?status=` (or `?stage=`) where it makes sense; day 1 returns all rows (seed is small). JSON below is camelCase exactly as the frontend receives it.

### Auth and users — B
| Method + path | Perm | Request | Response / rules |
|---|---|---|---|
| `POST /auth/login` | public | `{loginId, password}` | 200 `{user:{id,name,loginId,role}}` + sets cookie; 401 `Invalid Login Id or Password` |
| `POST /auth/logout` | any | — | 204, clears cookie |
| `GET /auth/me` | any | — | `{user:{id,name,loginId,role}}` or 401 |
| `GET /users?role=TECHNICIAN` | users:read | — | `[{id,name,role}]` (dropdowns) |
| `POST /users` (P1) | `*` | `{name,loginId,password,role,hourlyRate}` | 201 user |

### Leads and surveys — B
| Method + path | Perm | Request | Response / rules |
|---|---|---|---|
| `GET /leads?search=&stage=` | leads:read | — | `[{id,ref,name,phone,source,kw,systemType,stage,salespersonName,createdAt}]` newest first; search matches ref, name, phone |
| `POST /leads` | leads:write | `{name,phone,address,kw,systemType,monthlyBill,subsidyInterest,source}` | 201 Lead. phone 10 digits, kw 1–5 |
| `GET /leads/:id` | leads:read | — | `{...lead fields, roofArea, gridOk, callNotes, lostReason, surveys:[{id,ref,status,visitDate,technicianName}], quotations:[{id,ref,status,total}], canQuote}` (`canQuote` = an APPROVED survey exists and no active quotation) |
| `POST /leads/:id/log-call` | leads:write | `{roofArea, monthlyBill, gridOk, notes}` | Lead; stage → QUALIFIED if `roofArea > 0 and gridOk`, else CONTACTED |
| `POST /leads/:id/schedule-survey` | leads:write | `{technicianId, visitDate}` | 201 Survey; 409 unless stage QUALIFIED; lead → SURVEY_SCHEDULED |
| `POST /leads/:id/lost` | leads:write | `{reason}` | Lead → LOST |
| `POST /public/enquiries` (P1) | public | `{name,phone,address,kw,systemType,monthlyBill,subsidyInterest}` | 201 `{ref}`; source WEB, stage NEW |
| `GET /surveys?status=` | surveys:read | — | `[{id,ref,leadId,leadName,address,technicianName,visitDate,status}]`; technician sees own only |
| `GET /surveys/:id` | surveys:read | — | `{id,ref,lead:{id,name,phone,address},technicianId,technicianName,visitDate,direction,tilt,cableDistance,area,photos,status,rejectReason}` |
| `PATCH /surveys/:id/submit` | surveys:submit (own) | `{direction, tilt, cableDistance, area, photos:[url]}` | Survey → SUBMITTED. tilt 0–60, cableDistance 1–150, area > 0 |
| `POST /surveys/:id/approve` | surveys:approve | — | Survey → APPROVED; lead → SURVEY_APPROVED |
| `POST /surveys/:id/reject` | surveys:approve | `{reason}` | Survey → REJECTED; lead → QUALIFIED |

### Quotations, payments, invoices — C
| Method + path | Perm | Request | Response / rules |
|---|---|---|---|
| `POST /leads/:id/quotation` | quotes:write | `{packageId}` | 201 Quotation. **409 `Survey not approved yet`** unless lead stage SURVEY_APPROVED. Copies package lines; `unitPrice` = product price; `total` = Σ qty × unitPrice; `subsidy` = package subsidy if lead.subsidyInterest else 0. Lead → QUOTED |
| `GET /quotations?status=` | quotes:read | — | `[{id,ref,leadName,packageCode,total,paid,status,createdAt}]` |
| `GET /quotations/:id` | quotes:read | — | `{id,ref,status,lead:{id,name,phone,address},package:{id,code,name},lines:[{productId,code,name,tracking,qty,unitPrice,lineTotal}],total,subsidy,netPayable,paid,balance,jobId,dispatchId,invoices:[{id,ref,type,amount,status}]}` (`netPayable = total − subsidy`, `paid` = Σ PAID invoices, `balance = netPayable − paid`) |
| `PATCH /quotations/:id` | quotes:write | `{packageId}` | Re-creates lines; **409 if paid > 0** or not DRAFT/SENT |
| `POST /quotations/:id/send` | quotes:write | — | → SENT |
| `POST /quotations/:id/cancel` | quotes:write | — | → CANCELLED; 409 if CONFIRMED |
| `POST /quotations/:id/payments` | quotes:write | `{amount, method}` (UPI/BANK/CASH/CARD) | Quotation detail. 1 ≤ amount ≤ balance. Creates PAID invoice, type FULL if amount == balance and nothing paid before, else ADVANCE |
| `POST /quotations/:id/confirm` | quotes:write | `{scheduledDate, technicianId, crew}` | `{quotation, jobId, dispatchId}`. **409 `Record a payment first`** if paid == 0. One transaction: quotation → CONFIRMED (+confirmedAt); job SCHEDULED; dispatch READY; BALANCE invoice DUE if balance > 0; lead → WON |
| `GET /invoices?status=` (P1) | invoices:read | — | `[{id,ref,leadName,quotationRef,ticketRef,type,amount,status,createdAt}]` |
| `POST /invoices/:id/mark-paid` (P1) | invoices:write | — | → PAID (+paidAt) |

### Inventory, dispatch, dashboard — A
| Method + path | Perm | Request | Response / rules |
|---|---|---|---|
| `GET /products` | products:read | — | `[{id,code,name,tracking,warrantyMonths,cost,price,qtyOnHand}]` |
| `GET /packages` | packages:read | — | `[{id,code,name,type,kw,subsidy,price}]` (`price` = Σ lines × product price) |
| `GET /packages/:id` | packages:read | — | package + `lines:[{productId,code,name,tracking,qty,unitPrice}]` |
| `GET /stock` (P1 page, P0 endpoint) | stock:read | — | `[{productId,code,name,tracking,onHand,reserved,free,cost}]` |
| `POST /stock/adjust` (P1) | stock:write | `{productId, newQty}` | updated row; QTY/LOT products only |
| `GET /dispatches?status=` | dispatches:read | — | `[{id,ref,jobRef,leadName,status,scheduledDate,scannedCount,requiredCount}]` |
| `GET /dispatches/:id` | dispatches:read | — | `{id,ref,status,lead:{name,phone,address},jobId,jobRef,lines:[{productId,code,name,tracking,qty,scanned:[serial]}],requiredCount,scannedCount,canValidate,warranties:[{serial,productName,warrantyUntil}]}` (`requiredCount` = Σ qty of SERIAL lines; `warranties` filled after DONE) |
| `POST /dispatches/:id/scan` | dispatches:write | `{serial}` | dispatch detail. 404 `Unknown serial`; 409 `Wrong product for this dispatch` / `Serial is not in stock` / `Already scanned` / `All units of <product> already scanned`. Sets serial PICKED + dispatch_id |
| `POST /dispatches/:id/unscan` (P1) | dispatches:write | `{serial}` | PICKED → IN_STOCK |
| `POST /dispatches/:id/validate` | dispatches:write | — | dispatch detail with `warranties`. **409 `Scan all serials first (n/m)`**; 409 `Not enough stock for <code>` (see §8.1). Sets serials DELIVERED, creates LOT rows, dispatch DONE, job DISPATCHED |
| `GET /serials?q=` | serials:read | — | `[{serial,productName,status,leadName,deliveredAt,warrantyUntil,underWarranty}]` |
| `GET /dashboard?period=today\|week\|month` | dashboard:read | — | `{period, leads:{new,toCall}, surveys:{toApprove}, quotes:{sent,awaitingPayment}, jobs:{scheduled,inProgress,late}, dispatches:{ready}, tickets:{open,underWarranty,billable}, money:{booked,collected,due}}` (only the groups the caller's role can see) |
| `GET /reports/profit?from=&to=` (P1) | `*` | — | `[{jobId,jobRef,leadName,revenue,partsCost,labourCost,repairCost,profit,marginPct}]` (§8.3) |

### Jobs, tickets, uploads — D
| Method + path | Perm | Request | Response / rules |
|---|---|---|---|
| `GET /jobs?status=` | jobs:read | — | `[{id,ref,leadName,kw,technicianName,crew,scheduledDate,status}]` |
| `GET /jobs/mine` | jobs:mine | — | same, only `technician_id = me`, not DONE first, by date |
| `GET /jobs/:id` | jobs:read or own | — | `{id,ref,status,lead:{name,phone,address},kw,systemType,technicianName,crew,scheduledDate,dispatchStatus,lines:[{name,qty}],serials:[{serial,productName,warrantyUntil}],startedAt,finishedAt,sizeConfirmed,photos,hasSignature}` |
| `POST /jobs/:id/start` | jobs:mine (own) | — | job → IN_PROGRESS + startedAt. **409 `Dispatch not done yet`** unless dispatch DONE |
| `POST /jobs/:id/finish` | jobs:mine (own) | `{signature (data URL), sizeConfirmed, photos:[url]}` | job → DONE + finishedAt. 409 `Start the job first` / `Customer signature required` / `Add at least one photo` |
| `GET /tickets/lookup?q=` | tickets:read | — | `[{serialUnitId,serial,productName,leadId,leadName,phone,address,deliveredAt,warrantyUntil,underWarranty}]` matches serial, phone or name (delivered units only) |
| `GET /tickets?status=` | tickets:read | — | `[{id,ref,leadName,serial,issue,underWarranty,status,technicianName,createdAt}]` |
| `GET /tickets/:id` | tickets:read | — | full ticket + lead + serial + `invoice:{id,ref,amount,status}|null` |
| `POST /tickets` | tickets:write | `{serialUnitId, issue}` | 201 Ticket; `underWarranty` stored = warranty_until ≥ today |
| `POST /tickets/:id/transition` | tickets:write | `{to, technicianId?, partsCost?, labourCost?, customerConfirmed?}` | ASSIGNED needs technicianId. RESOLVED stores costs; if **not** underWarranty creates REPAIR invoice DUE (amount = parts + labour) and sets billAmount; if underWarranty billAmount = 0. CLOSED needs `customerConfirmed: true` (sets customerConfirmedAt) |
| `POST /uploads` | any logged in | multipart `file` | `{url}` |

### Day 2 (P2)
`/subsidy` list + `PATCH /subsidy/:jobId {stage, documents}` (C) · `/payouts?month=` computed from finished jobs' hours × hourly rate + `POST /payouts/:id/pay` (C) · `/schedule?from=&to=` technician × day grid (D) · `/receipts` CRUD + `/receipts/:id/receive {serials:[...]}` (A) · `/reports/profit.csv` (A) · `/notifications` late jobs + low stock (D). (The WebSocket `/api/ws` moved to P1, see §9.)

---

## 8. Business rules that judges will test

### 8.1 Dispatch validate (A) — safe when two people click at once
```python
def validate_dispatch(db, dispatch_id, user):
    with db.begin():
        d = db.get(Dispatch, dispatch_id, with_for_update=True)          # row lock on Postgres
        assert_transition("dispatch", d.status.value, "DONE")
        need = required_serials(db, d); have = picked_serials(db, d)
        if len(have) != need: raise ApiError(409, f"Scan all serials first ({len(have)}/{need})")
        for line in quote_lines(db, d.quotation_id):
            if line.product.tracking == Tracking.SERVICE: continue
            res = db.execute(update(Product)
                    .where(Product.id == line.product_id, Product.qty_on_hand >= line.qty)
                    .values(qty_on_hand=Product.qty_on_hand - line.qty))
            if res.rowcount == 0: raise ApiError(409, f"Not enough stock for {line.product.code}")
        today = date.today()
        for s in have:                                                     # only PICKED → DELIVERED
            n = db.execute(update(SerialUnit).where(SerialUnit.id == s.id, SerialUnit.status == SerialStatus.PICKED)
                    .values(status=SerialStatus.DELIVERED, lead_id=d.job.lead_id, delivered_at=now(),
                            warranty_until=add_months(today, s.product.warranty_months))).rowcount
            if n == 0: raise ApiError(409, f"{s.serial} changed, scan again")
        create_lot_units_for_panels(db, d, today)                          # §5 derived rule
        d.status = DispatchStatus.DONE; d.delivered_at = now()
        d.job.status = JobStatus.DISPATCHED
```
Any exception rolls back everything. Test: two threads validating dispatches that both need the last inverter → exactly one succeeds.

### 8.2 Gates (each owner enforces on the server; the UI only disables the button)
| Gate | Owner | Where |
|---|---|---|
| No quotation unless survey APPROVED | C | `POST /leads/:id/quotation` |
| No confirm without a payment | C | `POST /quotations/:id/confirm` |
| No validate until all serials scanned | A | `POST /dispatches/:id/validate` |
| No job start before dispatch DONE | D | `POST /jobs/:id/start` |
| No job finish without signature + photo | D | `POST /jobs/:id/finish` |
| Ticket closes only after customer confirms | D | `POST /tickets/:id/transition` |
| Role permissions on every route | B (helper) + each owner | `require_perm` |

### 8.3 Profit per job (A, P1) — calculated, never stored
```
revenue    = Σ PAID + DUE invoices of the job's quotation (not REPAIR)
partsCost  = Σ quote_line.qty × product.cost  (SERIAL lines: Σ delivered serial_units.unit_cost instead)
labourCost = hours(finished_at − started_at) × crew_size × technician.hourly_rate   (crew_size = 1 + commas in crew)
repairCost = Σ (parts_cost + labour_cost) of tickets on this job's serials where under_warranty = true
profit     = revenue − partsCost − labourCost − repairCost ; marginPct = round(profit / revenue × 100)
```
Seed includes one job whose free warranty repair makes profit negative (for the demo).

---

## 9. Frontend conventions (D sets up the shell; everyone follows)

**API client (C):** `api` = axios instance, `baseURL: "/api"`, `withCredentials: true`. A response interceptor shows `toast.error(err.response.data.error)` for 4xx/5xx and, on 401, clears the user and redirects to `/login`. Pages never call `fetch` directly.

**Server state:** React Query only. Reads with `useQuery({ queryKey, queryFn })`; writes with `useMutation` and `onSuccess: () => invalidate(...)`. Keys live in `lib/queryKeys.ts` (C):
```ts
export const qk = {
  me: ["me"], dashboard: (p: string) => ["dashboard", p],
  leads: ["leads"], lead: (id: number) => ["lead", id], users: (role?: string) => ["users", role],
  surveys: ["surveys"], survey: (id: number) => ["survey", id],
  packages: ["packages"], quotations: ["quotations"], quotation: (id: number) => ["quotation", id], invoices: ["invoices"],
  stock: ["stock"], dispatches: ["dispatches"], dispatch: (id: number) => ["dispatch", id], serials: (q: string) => ["serials", q],
  jobs: ["jobs"], myJobs: ["jobs", "mine"], job: (id: number) => ["job", id],
  tickets: ["tickets"], ticket: (id: number) => ["ticket", id], lookup: (q: string) => ["lookup", q],
};
```
After these actions also invalidate: confirm → `quotations, quotation(id), leads, dispatches, jobs, dashboard` · validate → `dispatch(id), dispatches, jobs, stock, dashboard` · finish job → `jobs, job(id), dashboard` · ticket transition → `tickets, ticket(id), invoices, dashboard`.

**Live sync across pages and users (two layers):**
1. **P0 (by 16:00), polling.** `lib/queryClient.ts` (C) sets defaults `staleTime: 0`, `refetchOnWindowFocus: true`, and lists plus the dashboard use `refetchInterval: 5000`. Your own actions update every affected page instantly (invalidation above); another user's change appears within about 5 seconds.
2. **P1 (after P0 works, target 15:00–15:30), instant push with FastAPI WebSockets.** The backend (D) runs a tiny broadcaster: `GET /api/ws` (WebSocket; rejects the connection unless the `token` cookie is valid) keeps the open connections; after each successful write transaction, routers call `broadcast(["dispatches","jobs","dashboard"])`, which sends `{"type":"changed","keys":[...]}` to every client. The frontend (D) opens one socket in `Layout`, and on each message calls `queryClient.invalidateQueries({ queryKey: [key] })` for each key; it reconnects every 3 s if dropped. Once it works, raise `refetchInterval` to 30000 as a safety net. Every router owner adds one `broadcast(...)` line after their write endpoints (keys = the query keys in `lib/queryKeys.ts`).

**Routing:** each member exports an array from their route file; `App.tsx` (D) concatenates them inside `<Layout>` and wraps each in `<RequirePerm perm>`:
```ts
export const salesRoutes: AppRoute[] = [
  { path: "/leads", element: <LeadsList />, perm: "leads:read", menu: { group: "Sales", label: "Enquiries" } },
  { path: "/leads/:id", element: <LeadForm />, perm: "leads:read" },
];
```
The menu is built from routes that have `menu` and whose `perm` the user has (`can(perm)` from AuthContext reads `shared/access.json`).

| Route | Page | Owner |
|---|---|---|
| `/login` | Login | C |
| `/enquire` (public, no layout) | Public enquiry form (P1) | B |
| `/` | Dashboard | A |
| `/leads`, `/leads/new`, `/leads/:id` | Enquiry list, new, form | B |
| `/surveys`, `/surveys/:id` | Survey list, detail + approve | B |
| `/quotations`, `/quotations/:id` | Quotation list, form | C |
| `/invoices` | Invoices (P1) | C |
| `/stock` | Stock (P1) | A |
| `/dispatches`, `/dispatches/:id` | Dispatch list, form with scan | A |
| `/serials` | Serial lookup | A |
| `/jobs`, `/jobs/:id` | Installations list, job detail | D |
| `/tickets`, `/tickets/new`, `/tickets/:id` | Tickets | D |
| `/m` | Technician home: my jobs + my surveys (phone layout) | D |
| `/m/jobs/:id` | Installation worksheet: start, size, photos, signature, finish | D |
| `/m/surveys/:id` | Survey form | B |
| `/reports/profit` | Profit per job (P1) | A |

**Shared components (D, Phase 0 — props are a contract):**
```ts
<PageHeader title="Enquiries" actions={<Button onClick={…}>New</Button>} />
<DataTable<T> columns={[{ key: "ref", label: "Reference", render?: (row) => ReactNode, align?: "right" }]}
              rows={T[]} onRowClick={(row) => void} searchPlaceholder="Search…" onSearch={(q) => void}
              kanban?={{ groupBy: "status", groups: ["DRAFT","SENT","CONFIRMED"], card: (row) => ReactNode }} />
<StatusBar steps={["Draft","Sent","Confirmed"]} current="Sent" />
<Badge status="DONE" />                 // colour by meaning: good / warning / danger / neutral
<Field label="Phone" error?>{input}</Field>
<Button variant="primary|secondary|danger" disabled loading onClick />
toast.success("Dispatch validated"); toast.error("…")
<SignaturePad onChange={(dataUrl: string | null) => void} />   // canvas + Clear
<PhoneLayout title="Today">…</PhoneLayout>                     // max-w-md, large text, 48px buttons
<Logo variant="full" size="lg" />                              // §9.1 placement table
<Forbidden />
```
Until D's components land on `main` (by Sync 1), other members may use plain elements and swap later.

**Formatting (C):** `formatINR(195000)` → `₹1,95,000` (Intl `en-IN`, no decimals) · `formatDate` → `31 Oct 2026`. Never show `$`.

**Brand colours (final, from the brand kit — do NOT take colours from the inspiration images):** primary `#13315C` · accent `#F5A524` (never body text) · bg `#F7F7F5` · surface `#FFFFFF` · border `#E4E4E0` · text `#1B1F24` · muted `#5F6670` · success `#1E8E5A` · warning `#D97706` · danger `#D93F3F` · info `#2F6FDE`. Fonts: Poppins (headings), Noto Sans (body), JetBrains Mono (refs and serials). Status colours (success / warning / danger / info) keep the same meaning everywhere. Dark mode: not needed on day 1. The shapes and structure (buttons, cards, inputs, tables, spacing, radius, shadows) come from the inspiration images (§9.1).

### 9.1 Visual design references (inspiration images + logo)

**Where the files live**
```
design/inspiration/        Pinterest screenshots added by D (01-*.png, 02-*.png, …)
client/public/brand/logo.png        full logo (mark + name), transparent background
client/public/brand/logo-mark.png   square mark only (optional; if missing, crop nothing — use logo.png)
client/public/favicon.png           32×32 or 64×64 version of the mark
```

**How agents use the inspiration images**
- Look at every image in `design/inspiration/` before building any UI. Use them **only for structure and shape**: button shape, size, padding and states (hover, pressed, disabled, loading); card / box style (radius, border vs shadow, padding, header layout); input and dropdown style; table and list style (row height, separators, header style); badge / pill shape; spacing density; page layout feel (top bar, page header, filters row); icon size and placement; typography scale and weight.
- **Colours always come from the brand kit (§9), never from the images.** If an image uses, say, purple buttons, keep the button's shape and use our primary colour.
- **Do not copy** their content, text, icons, illustrations, logos or brand names. Our pages, fields and flows come from this plan and the wireframes.
- D extracts the structure **once** in Phase 0 and writes it down; nobody else re-interprets the images:
  1. `client/src/styles/tokens.css`: brand colour variables from §9 (`--primary`, `--primary-foreground`, `--accent`, `--bg`, `--surface`, `--surface-2`, `--border`, `--text`, `--muted`, `--success`, `--warning`, `--danger`, `--info`) plus the shape values taken from the images: `--radius-sm/md/lg`, `--shadow-card`, `--shadow-pop`, `--control-height`, spacing scale.
  2. `tailwind.config.js` maps names to those variables (`bg-primary`, `text-muted`, `rounded-card`, `shadow-card` …).
  3. `design/DESIGN.md` (one page): the brand colours and where each is used; radius, shadows, spacing; button variants (primary, secondary, ghost, danger, disabled, loading); card, input, table, badge and modal styles; which inspiration image each shape choice came from.
  4. The shared components in §9 implement exactly these styles, so every page looks the same.
- Every other member builds UI **only from the shared components and tokens** (§9). No hard-coded hex colours, no one-off button styles. If a page needs a new style, ask D (`[BUG]`/chat) instead of inventing one.
- Keep these regardless of the images: text contrast readable (body text on its background at least 4.5:1), status colours distinct from the accent, technician screens high-contrast with 48 px buttons, money in ₹.

**Logo placement (D builds a `<Logo variant="full|mark" size="sm|md|lg" />` component; others only use it)**
| Where | Variant / size |
|---|---|
| Login page (and sign-up / forgot-password if those pages exist) | full, `lg` (about 160 px wide), centred above the form |
| Public enquiry form `/enquire` | full, `md`, top left |
| App top bar (every logged-in page) | full `sm` (about 28 px tall) on desktop, mark `sm` on narrow screens; links to the role's landing page |
| Technician phone layout header `/m/*` | mark, `sm` |
| Browser tab | `favicon.png` set in `client/index.html`, page title "Kiran" |
| Printed / exported documents (P2) | full, `sm` |
Always `alt="Kiran"`, never stretched (keep aspect ratio with `h-*` + `w-auto`), on a background that keeps it visible. If the logo file is missing, `<Logo>` falls back to the text "Kiran" in the heading font, so nothing breaks while the file is being added.

**UX rules:** a button whose gate isn't met is disabled with a tooltip saying why · every mutation shows a success toast · lists show an empty state · references and serials in mono font · technician screens large and high-contrast (used in sunlight).

---

## 10. Seed data (A, `app/seed.py`; posted in chat after Sync 1)

`python -m app.seed` → drop all tables, create all, insert:
- **Users** (password `sun123` for all): `ravi` Director · `priya`, `karan` Sales · `vikram`, `arjun`, `sameer` Technician (hourly_rate 400) · `deepa` Warehouse · `farhan` Support.
- **Counters** for every key, next = 1 (then advanced by the seeded records).
- **Products** (code · tracking · warranty months · cost · price — sample figures):
  `PNL-545` Solar panel 545 Wp · LOT · 240 · 11500 · 14000 · qty 200
  `INV-OG3` On-grid inverter 3 kW · SERIAL · 24 · 38000 · 46000
  `INV-OG5` On-grid inverter 5 kW · SERIAL · 24 · 52000 · 63000
  `INV-OF5` Off-grid inverter 5 kVA · SERIAL · 24 · 47000 · 58000
  `BAT-150` Battery 150 Ah · SERIAL · 24 · 14500 · 18000
  `CC-60` Charge controller 60 A · SERIAL · 24 · 6800 · 8500
  `MS-KW` Mounting stand set (per kW) · QTY · 0 · 4200 · 5500 · qty 60
  `DB-SET` AC/DC wiring box set · QTY · 0 · 3100 · 4200 · qty 30
  `CAB-DC4` DC cable 4 sq mm (m) · QTY · 0 · 55 · 80 · qty 2000
  `ERT-KIT` Earthing kit · QTY · 0 · 2400 · 3200 · qty 40
  `SVC-INST` Installation (service) · SERVICE · 0 · 0 · 15000
- SERIAL products' `qty_on_hand` = number of their IN_STOCK units.
- **Packages** ON-1…ON-5 (On-Grid) and OFF-1…OFF-5 (Off-Grid), kW = number. Lines: panels `ceil(kW × 1000 / 545)`, inverter (OG3 for ≤ 3 kW, OG5 above; OF5 for off-grid), 1 charge controller, `MS-KW` × kW, 1 `DB-SET`, `CAB-DC4` × 10 per kW, `ERT-KIT` × 3, `SVC-INST` × 1; off-grid adds `BAT-150` × 2 (≤ 3 kW) or × 4. Plus `PANEL-SET` (hardware, 1 kW panels + cable) and `INSTALL` (service only). Subsidy: sample values in the seed (e.g. 30000 per kW up to 2 kW, 78000 for 3 kW and above), editable later.
- **Serial units in stock:** 8 × INV-OG3, 4 × INV-OG5, 3 × INV-OF5, 12 × BAT-150, 10 × CC-60 (serials like `INV-OG3-26A0001`).
- **Demo states:** a NEW web lead; a CONTACTED lead; a lead with a SUBMITTED survey (ready to approve); a lead with an APPROVED survey (ready to quote); a quotation SENT and unpaid; a quotation paid but not confirmed; a CONFIRMED order with a READY dispatch (ON-3, needs 2 serial scans); a job DISPATCHED for vikram (ready to start); one DONE job with finished times and a signature.
- **Ticket demo:** customer Ramesh Kulkarni with delivered `INV-OF5-23C0412` (warranty until a date ~6 months ahead → covered) and customer Sunita Desai with delivered `INV-OG3-22B0077` (warranty ended ~8 months ago → billable). Ramesh's job has a resolved under-warranty ticket with parts_cost large enough to make that job's profit negative.

---

## 11. Work per member

Every member: write your endpoints first (test them in `/docs`), post `[CONTRACT] <endpoint> ready` in the group chat, then build your pages against the real API (no mock data after Sync 2). Add 2–3 pytest tests for your gates (`TestClient`, fresh seeded DB). Add one line per decision you made to `DECISIONS.md`.

### Member A — Data, inventory, dispatch, dashboard (strongest backend)
- **Phase 0 (12:46–13:10):** repo, root `package.json`, `.gitignore` (node_modules, .venv, .env, uploads/*, __pycache__), `server/pyproject.toml` with every Python dep, `config.py`, `db.py`, `errors.py`, `schemas/base.py`, `main.py` with **all routers pre-included** (empty `APIRouter`s for every router file in §3, prefixes `/api/...`) + error handlers + `/uploads` mount, **`models.py` (§5)**, `seed.py` v1 (users, products, packages, serials; demo states can follow by 14:00).
- **P0:** `GET /products`, `/packages`, `/packages/:id`, `/stock`, `/dispatches`, `/dispatches/:id`, `POST /dispatches/:id/scan`, `POST /dispatches/:id/validate` (§8.1), `GET /serials`, `GET /dashboard`. Pages: Dispatch list (DataTable, status filter), **Dispatch form** (lines with "scanned n/m" per product, a scan input that auto-submits on Enter for a USB scanner, list of scanned serials, Validate disabled until complete, green warranty banner after DONE), Serials lookup, Dashboard cards (period toggle).
- **P1:** Stock page with inline adjust, unscan, profit report endpoint + page, kanban for dispatches.
- **P2:** receipts with serial capture, profit CSV, Alembic (optional).
- **Tests:** scan rejects wrong product / duplicate / not in stock; validate refuses until complete; concurrent validate for the last unit; warranty_until = delivery + months.

### Member B — Auth, users, enquiries, surveys
- **Phase 0:** `auth.py` (§6), `refs.py`, `shared/access.json` (§4), `routers/auth.py` login/logout/me working, `GET /users`.
- **P0:** leads endpoints, surveys endpoints (§7). Pages: Enquiry list (search, stage filter, kanban by stage in P1), **New enquiry** (source dropdown WEB/WHATSAPP/CALL), **Enquiry form** (StatusBar of stages, Log call dialog with roof area / bill / grid OK / notes, Schedule survey dialog with technician + date, **Create quotation button disabled with tooltip until `canQuote`** → calls C's `POST /leads/:id/quotation` and navigates to the quotation), Survey list, **Survey detail** with Approve / Reject (reason), **technician Survey form** at `/m/surveys/:id` (direction select, tilt, cable distance, area, photo upload via `/api/uploads`, Submit).
- **P1:** public enquiry form `/enquire`, users admin page for the Director (create user, role, hourly rate).
- **Tests:** 401 without cookie; 403 for wrong role (technician → `/api/leads`); survey approve flips lead stage; technician can't submit someone else's survey.

### Member C — Quotations, payments, invoices, frontend plumbing
- **Phase 0:** `transitions.py` (§6), `client/src/api/client.ts`, `lib/queryClient.ts`, `lib/queryKeys.ts`, `lib/format.ts`, `auth/AuthContext.tsx` (`user`, `login`, `logout`, `can(perm)`, loads `/api/auth/me` on start), **Login page** (redirects to the role's landing page).
- **P0:** quotation + payment + confirm endpoints (§7). Pages: Quotation list, **Quotation form** (package dropdown that re-fills lines while unpaid, lines table, total / subsidy / net payable / paid / balance in ₹, Send, payment input + Record payment, **Confirm disabled until paid** → dialog for scheduled date, technician, crew → shows links to the created dispatch and job), invoice list inside the quotation.
- **P1:** Invoices page with mark-paid.
- **P2:** subsidy tracker (stages + document uploads), technician pay (computed hours × rate, mark paid).
- **Tests:** quotation 409 before survey approval; confirm 409 without payment; confirm creates exactly one job + one dispatch + balance invoice; payment above balance → 400.

### Member D — App shell, field work, service, uploads, final integration (frontend lead)
- **Phase 0:** add the Pinterest images to `design/inspiration/` and the logo to `client/public/brand/`; extract the style into `tokens.css`, `tailwind.config.js` and `design/DESIGN.md` (§9.1); build `<Logo>`. Then `client/` Vite + TS + Tailwind, `vite.config.ts` proxy (`/api`, `/uploads` → 8000), React Router, `App.tsx` importing the 4 route files, `Layout` (top bar with role-filtered menu, user menu, logout), `RequirePerm`, `Forbidden`, all shared components in §9, toasts. Backend: `routers/uploads.py`.
- **P0:** jobs + tickets endpoints (§7). Pages: Installations list + job detail (serials with warranty dates, photos, signature preview), **technician home `/m`** (today's jobs and surveys as large cards), **worksheet `/m/jobs/:id`** (Start → times shown, size confirmed, photo upload, `SignaturePad`, Finish disabled until signed + photo), Tickets list, **New ticket** (live lookup box: type serial / phone / name → result card with a green "Covered until …" or red "Expired …" badge → issue → create), **Ticket form** (StatusBar, assign technician, parts/labour costs, Resolve, "Customer confirmed" checkbox → Close, linked repair invoice if billed).
- **P1:** WebSocket live push first (`/api/ws` + `broadcast()` helper + socket listener in `Layout`, §9), then kanban for jobs and tickets, then a polish pass on all pages (spacing, empty states, consistent badges).
- **P2:** crew schedule grid, notifications bell.
- **Integration (continuous, not only at the end):** D's laptop is the demo machine. At every sync: pull `main`, `npm run reset`, click the happy path in §13, write breaks on the shared list with an owner.
- **Tests:** start 409 before dispatch DONE; finish 409 without signature; expired ticket resolve creates REPAIR invoice; covered one doesn't; close needs customerConfirmed.

---

## 12. Timeline (day 1)

| Time | What | Sync |
|---|---|---|
| 12:46–12:55 | Together: lock this plan, create the repo, add all members + mentor | |
| 12:55–13:10 | Phase 0 per member; A's `models.py` reviewed by all at 12:55 | |
| **13:10 Sync 1** | Everyone pulls `main`, runs `npm run reset && npm run dev`, logs in as each role | nobody continues until it works on all 4 laptops |
| 13:10–13:50 | Endpoints for your slice, tested in `/docs`; post `[CONTRACT]` per endpoint | |
| **13:50 Sync 2** | Each person demos their endpoints (1 min); fix contract mismatches now | merge |
| 13:50–14:45 | Pages against the real APIs | |
| **14:45 Sync 3** | First full run on D's laptop (§13); break list with owners | merge |
| 14:45–15:30 | Break list first, then P1, then input validation everywhere | |
| **15:30 Sync 4** | Feature freeze; bug bash A↔C, B↔D | merge |
| 15:30–16:00 | Bugs only, final seed, rehearse the 3-minute demo, everything on `main` | final merge |
| Day 2 AM | P2, then each member walks a teammate through every line they own | |

Stand-up at each sync: what's merged, what's next, what blocks you (5 minutes; solve problems after, in pairs).

**Git:** trunk-based. Small commits to `main` every 20–30 minutes from your own account; before each push `git pull --rebase origin main` and check the app still starts. Never commit `.env`, `.venv`, `node_modules`, `uploads/`. Chat tags: `[PUSHED] <what> | pull needed: yes/no`, `[CONTRACT]`, `[BLOCKED] need X from Y` (answer within 5 minutes), `[SCHEMA]`, `[DEP]`, `[BUG] <screen> <what> → owner`.

---

## 13. Happy path (integration test + demo script)

1. Sales (`priya`) creates an enquiry (source CALL), logs the call → QUALIFIED; Create quotation is disabled; schedules a survey for `vikram`.
2. Technician (`vikram`) on a phone opens `/m`, fills the survey, uploads a photo, submits.
3. Sales approves → Create quotation enabled → picks ON-3 → lines fill → records ₹50,000 advance → Confirm (date, technician, crew).
4. Warehouse (`deepa`) opens the READY dispatch → Validate disabled → scans 2 serials (a duplicate is refused) → Validate → warranty banner (2 yr inverter/controller, 20 yr panels).
5. Technician opens the job → Start → size, photo, customer signs → Finish.
6. Support (`farhan`) looks up `INV-OG3-22B0077` → Expired → ticket → assign → resolve with costs → repair invoice created → customer confirmed → Closed. Look up `INV-OF5-23C0412` → Covered → resolve → ₹0.
7. Director (`ravi`) dashboard: today / week / month; P1: profit per job with the loss-making job.
8. Log in as `vikram`, open `/leads` → Forbidden; call `/api/leads` → 403.

---

## 14. Definition of done (any feature)

- The API enforces the rule (gate, validation, role) and returns the standard error.
- The UI disables impossible actions with a reason and shows errors as toasts.
- Works on `main` after `npm run reset` with the seeded data.
- Has at least one test for its gate.
- Committed under the owner's name.
- **The owner can explain every line**, including AI-generated code. If you can't explain it, simplify it.

## 15. If behind at 14:45 — cut in this order
1. Kanban views 2. Invoices page 3. Stock page 4. Dashboard down to 4 numbers 5. Public enquiry form 6. Unscan.
**Never cut:** survey gate, payment gate, serial scanning with locked validate, automatic warranty, signature, warranty-based ticket billing, role 403s.

## 16. Code rules for AI agents: write code a human must defend line by line

The team builds with agents now and learns every line afterwards. Evaluators will scroll any file and ask: what does this line do, why is it here, is it secure, what happens on bad input, does anything here do nothing? Write code so those answers are easy.

**Write less**
- Only what this plan asks for. No extra features, endpoints, libraries, abstractions, generic helpers, base classes or config "for later".
- No unused imports, variables, functions, files or commented-out code. Delete leftovers before committing.
- Prefer plain, boring code over clever code: explicit `if` checks, small functions (≤ 40 lines), one router file per area, one component per page. No metaprogramming, no decorators you wrote yourself, no deep nesting.
- Only the libraries in §2. Need another one? `[DEP]` in `CHANGES_NEEDED.md` first.

**Make every rule visible**
- Every gate and validation is written as a guard at the top of the function, each with its own clear error message (`raise ApiError(409, "Survey not approved yet")`).
- A one-line comment above each non-obvious block says **why**, not what: `# lock the row so two warehouse users can't dispatch the same last unit`.
- Every endpoint function starts with a docstring: who can call it, what it changes, which errors it returns.

**Secure by default (check every endpoint)**
- `require_perm(...)` on every route except login and `/public/*`; technicians filtered to their own rows on the server.
- All input goes through a Pydantic model with limits (lengths, ranges, enums, 10-digit phone, positive amounts). Never trust IDs or totals sent by the client: recompute prices and totals on the server.
- Only SQLAlchemy queries (parameterised); never build SQL strings with f-strings.
- Passwords only as bcrypt hashes; never return `password_hash`; JWT only in the httpOnly cookie; secrets only from `.env`.
- Uploads: images only, size limit, random file names, served from `/uploads` only.
- Error responses never include stack traces or SQL.
- Frontend: never use `dangerouslySetInnerHTML`; never store the token; never show buttons the role can't use.

**Handle edge cases (each owner lists theirs in their test file)**
- Not found → 404; wrong state → 409 via `assert_transition`; double click / repeated request → second call refused, not applied twice (e.g. confirm, validate, payment).
- Empty lists, missing optional fields, zero and maximum values, duplicate serials, expired vs today's warranty date (boundary: `warranty_until == today` counts as covered).
- Multi-row changes inside one `with db.begin():` so a failure leaves nothing half-done.
- Frontend: loading, empty and error states on every page; disable the submit button while a mutation is pending.

**Leave a learning trail (the agent writes it, the human learns from it)**
After finishing each file, the agent appends a section to `docs/explain/<member>.md`:
```
### server/app/routers/quotations.py
Purpose: one sentence.
Endpoints / components: name → what it does → who can call it.
Rules enforced: each gate with the line it's on.
Security: what protects this file (perm, validation, server-side recompute).
Edge cases handled: list.
Libraries used here and the exact lines they're used on.
Likely evaluator questions + short answers (3–5).
```
Commit messages say what and why: `quotes: confirm creates job + dispatch in one transaction`.

**After the build, each member learns their files in this order**
1. Read your `docs/explain/<member>.md`, then open each file next to it.
2. For every function: say out loud what it does, why it exists, who can call it, what each guard stops, what happens on bad input.
3. Run your tests; break one rule on purpose (remove a guard) and watch the test fail; put it back.
4. Ask your agent: "Quiz me on <file>: 10 questions an evaluator would ask, one at a time, and grade my answers."
5. Anything you can't explain → simplify it or delete it, then re-test.

## 17. Technical round — what each member must answer
- **Everyone:** the architecture (React SPA → FastAPI → SQLAlchemy → PostgreSQL); how the frontend talks to the backend (axios with the httpOnly cookie, Vite proxy, React Query cache + invalidation); the full happy path naming who built each step; why cookie JWT instead of localStorage or server sessions.
- **A:** models and relations, `with db.begin()` transactions, conditional update vs row lock, serial uniqueness, warranty stored vs computed, profit query.
- **B:** `Depends` chain (`get_db` → `get_current_user` → `require_perm`), 401 vs 403, bcrypt, JWT contents, atomic reference counter.
- **C:** `assert_transition`, why quote lines copy prices, the confirm transaction, React Query `useMutation` + invalidation, axios interceptor.
- **D:** role menu from `access.json`, `useState` / `useEffect` in the shell, signature canvas with pointer events, file upload flow, warranty decision at ticket creation.
