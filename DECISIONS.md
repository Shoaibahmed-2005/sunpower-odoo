# DECISIONS.md — SunPower

> Append-only. Each member adds one line per design decision they made.

- [D] Logo is JPG (not PNG); all references use `.jpg` extension. Original at `_unsorted/`.
- [D] Logo-mark is a center square crop of the full logo (includes sun + text since the sun alone can't be cleanly isolated from the rays).
- [D] Favicon is 64×64 PNG rendered from the logo-mark.
- [D] Single inspiration image (wireframe collage) renamed to `01-sidebar-dashboard-wireframes.jpg`.
- [A] Each router sets its own prefix in its `APIRouter(prefix=...)` and `main.py` adds none (matches D's `prefix="/api/jobs"`). Routers whose paths cross areas use `prefix="/api"` and write full paths (`/leads/{id}/quotation` lives in quotations.py, `/public/enquiries` in leads.py, `/reports/profit` in dashboard.py).
- [A] `config.py` reads `server/.env` with a 10-line loader instead of adding pydantic-settings/python-dotenv (the §2 stack has neither). Real environment variables override `.env`.
- [A] Seed subsidy is on-grid only (₹30,000/kW up to 2 kW, ₹78,000 from 3 kW); off-grid packages get 0, since the rooftop subsidy applies to grid-connected systems.
- [A] Enums are `str, Enum`, so `role.value == "ADMIN"` and Pydantic returns the plain name.
- [A] Receipt receive body is `{lines:[{lineId, serials:[...]}]}` (not a flat `serials` list), because a flat list can't say which line, and so which product, each serial belongs to.
- [A] Receipt refs are `RCV/<id>`, built from the row id, instead of adding a counter key to B's `refs.py`. Draft receipts have no edit endpoint: delete and recreate.
- [A] Receipt status is checked with a guard (`status != DRAFT → 409`), not `assert_transition`, so receiving doesn't depend on C adding a "receipt" entry to `transitions.py`.
- [A] Alembic skipped for now: `npm run reset` stays the schema tool until the schema freezes.
- [C] `assert_transition` normalizes enum or string values before checking the lookup map, raising 409 ApiError.
- [C] Quotations copy product prices at creation into `quote_lines.unit_price` so catalog price changes don't change existing quotes.
- [C] Order confirmation runs atomically in one transaction, creating Job, Dispatch, and BALANCE Invoice (if remaining balance > 0), and advancing lead stage to WON.
- [C] Re-calculates and guards payment amounts strictly on server between ₹1 and current balance, preventing overpayment.
- [C] Renamed product branding throughout app title and fallbacks from Kiran to SunPower.
