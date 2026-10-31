# Member A — learning trail

### server/app/config.py
Purpose: read `DATABASE_URL` and `JWT_SECRET` from `server/.env` into one `settings` object.
Components: `load_env_file()` copies `KEY=VALUE` lines into `os.environ` (`setdefault`, so real env vars win) → `required()` fails fast with a clear message → `Settings` → `settings`.
Security: secrets only come from `.env`, which `.gitignore` excludes; `.env.example` holds no real secret.
Edge cases handled: missing `.env` (env vars alone still work), blank lines, `#` comments, values containing `=` (`split("=", 1)`).
Libraries: only `os` and `pathlib`.
Likely questions:
- Why not python-dotenv? → It isn't in the locked stack (§2), and the loader is 10 lines.
- What if JWT_SECRET is missing? → The app refuses to start (`RuntimeError`), instead of running with an empty secret.

### server/app/db.py
Purpose: the engine, the session factory, the `Base` every model extends, and `get_db`.
Components: `engine` (`pool_pre_ping` re-checks pooled connections) · `SessionLocal` (`expire_on_commit=False` keeps objects readable after commit, for building responses) · `get_db()` yields one session per request and always closes it.
Rules enforced: none here. Routers group multi-row writes in `with db.begin():`, so either all of it commits or none of it does.
Gotcha (tested): once a session has run any query, `db.begin()` raises "A transaction is already begun". `get_current_user` must `db.commit()` after loading the user (logged in CHANGES_NEEDED for B).
Likely questions:
- Why a generator with `yield`? → FastAPI runs the code after `yield` when the request ends, so the `with` block closes the session even if the route raised.
- Same session for `get_current_user` and the route? → Yes. FastAPI caches a dependency once per request.

### server/app/errors.py
Purpose: every error leaves the API as `{"error": "...", "field": ... | null}`.
Components: `ApiError(status, message, field)` raised by routers · three handlers (our errors, Pydantic validation → 400 with its first message + field name, FastAPI/Starlette HTTP errors such as 404) · `register_error_handlers(app)`.
Security: handlers only return our message, never stack traces or SQL.
Likely questions:
- Why 400 instead of FastAPI's default 422? → One simple rule for the frontend: 400 = fix your input.
- How does the form know which input to highlight? → `field` = the last item of Pydantic's `loc`, e.g. `["body","phone"]` → `"phone"`.

### server/app/schemas/base.py
Purpose: `ApiModel`, the parent of every request/response model.
`alias_generator=to_camel` → JSON uses `qtyOnHand` · `populate_by_name=True` → Python can still pass `qty_on_hand=` · `from_attributes=True` → `Model.model_validate(orm_obj)` works.

### server/app/main.py
Purpose: build the FastAPI app once. Nobody edits it after Phase 0.
Components: error handlers · all 11 routers included as-is (each sets its own prefix: `"/api"` with full paths when they cross areas, e.g. `/leads/{id}/quotation` in quotations.py, or `"/api/jobs"` like D's) · `/uploads` served as static files (folder created if missing).
Likely questions:
- Why no CORS middleware? → Vite proxies `/api` and `/uploads` to port 8000, so the browser only ever sees one origin.

### server/app/models.py
Purpose: every table and enum from BUILD_PLAN §5. Only A edits it.
Key choices:
- Enums are `str, Enum`: `role.value == "DIRECTOR"` and JSON shows the plain name.
- Money is `Integer` rupees: no float rounding errors.
- `serial_units.serial` unique: one physical unit can't be in stock twice or go to two customers.
- `jobs.quotation_id` unique: one confirmed quote creates exactly one job, enforced by the database even if two confirms race.
- `quote_lines.unit_price` is copied at creation: changing a product price later doesn't change a quote already sent.
- `warranty_until` is stored (fixed on delivery day); "under warranty" is computed (`warranty_until >= today`) because it changes every day. `tickets.under_warranty` is stored because the bill decision is made once, when the ticket is opened.
- `Survey` has two FKs to `users` (technician, approved_by), so each `relationship` names its `foreign_keys`.
- `Quotation.lines` uses `cascade="all, delete-orphan"`: C's re-pick-a-package rule can replace the lines safely.
Likely questions:
- Why `DateTime(timezone=True)`? → Store UTC and display local time: no ambiguity around midnight or across servers.
- Why JSON for photos? → A short list of URLs that is always read and written together; a separate table adds joins for no benefit.

### server/app/seed.py
Purpose: `npm run reset` drops all tables, recreates them and inserts demo data (§10). v1 = users, counters, products, packages, serials.
Components: `USERS`, `PRODUCTS`, `SERIAL_STOCK` (plain data) · `subsidy_for()` · `system_lines()` (panels = `ceil(kW × 1000 / 545)`, inverter OG3 ≤ 3 kW / OG5 above / OF5 off-grid, 1 controller, stands × kW, 1 wiring box, cable 10 m per kW, 3 earthing kits, installation; off-grid adds 2 or 4 batteries) · `seed_*` functions · `main()` runs everything in one transaction.
Checked: ON-3 = 6 panels, INV-OG3, CC-60, 3 stands, 30 m cable, subsidy ₹78,000. SERIAL products' `qty_on_hand` equals their in-stock unit count (INV-OG3 = 8).
Likely questions:
- Why hash the password once? → bcrypt at 12 rounds is slow on purpose (~0.25 s); all demo users share `sun123`.
- Why drop/create instead of migrations? → Day 1 schema changes often; reset is instant, and Alembic is optional on day 2.
