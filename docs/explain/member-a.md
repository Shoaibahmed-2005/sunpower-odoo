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
Rules enforced: none here. Routers make all their changes, then call `db.commit()` once; if a guard raises first, closing the session rolls everything back.
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
- Enums are `str, Enum`: `role.value == "ADMIN"` and JSON shows the plain name.
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

### server/app/dates.py
Purpose: `add_months(start, months)`, used for warranty end dates by validate and by the seed.
Edge case: 31 Jan + 1 month → 28/29 Feb (day clamped with `calendar.monthrange`). Tested.

### server/app/services/stock.py
Purpose: every stock rule in one place. Functions only change the session and never commit; the router commits once at the end, so a failed guard saves nothing (the session closes and rolls back).
Why not `with db.begin():`? `require_perm` already ran a query on the same session, which auto-started a transaction, so `db.begin()` would raise. "Change everything, then one `db.commit()`" gives the same all-or-nothing result.
Functions:
- `scan_serial` → IN_STOCK → PICKED. Guards in order: dispatch READY · serial exists (404) · not already on this dispatch · product is on this dispatch · unit IN_STOCK · this product isn't complete yet. The final UPDATE has `WHERE status = IN_STOCK`, so if another warehouse user picked the same unit a moment earlier, 0 rows change → 409.
- `unscan_serial` → PICKED → IN_STOCK, only while READY and only for a unit on *this* dispatch (one conditional UPDATE).
- `validate_dispatch` (§8.1) → locks the dispatch row (`with_for_update`), checks n/m scanned, subtracts stock with `WHERE qty_on_hand >= qty` (two dispatches can't both take the last unit), marks serials DELIVERED with `warranty_until`, creates one LOT row per panel line (20-year warranty), dispatch DONE, job DISPATCHED.
- `reserved_by_product` → Σ qty on CONFIRMED quotations whose dispatch is still READY (computed, never stored).
- `adjust_stock` → only QTY/LOT; SERIAL counts must equal their IN_STOCK units, and SERVICE has no stock.
Likely questions:
- Row lock vs conditional update? → The lock stops two validates of the *same* dispatch; the conditional `WHERE` stops two *different* dispatches from overdrawing the same product. Both are needed.
- Why count PICKED units in on-hand? → They're still physically in the warehouse until validate.

### server/app/routers/inventory.py
Endpoints (all `/api`): `GET /products` (products:read) · `GET /packages`, `/packages/{id}` (packages:read; price = Σ qty × current price) · `GET /stock` (stock:read) · `POST /stock/adjust` (stock:write; `newQty` 0–100000 by Pydantic) · `GET /dispatches?status=` (dispatches:read; bad status → 400) · `GET /dispatches/{id}` · `POST /dispatches/{id}/scan | unscan | validate` (dispatches:write) · `GET /serials?q=` (serials:read; matches serial or customer, max 50; `underWarranty = warrantyUntil >= today`, so the last day still counts).
Each write endpoint: service call → `db.commit()` → return the fresh dispatch detail, so the page updates without a second request.
Security: `require_perm` on every route; serials are stripped and length-limited; only SQLAlchemy queries (the `ilike` pattern is a bound parameter, not string-built SQL).

### server/app/routers/dashboard.py
`GET /dashboard?period=today|week|month` (dashboard:read): `ROLE_GROUPS` decides which cards each role gets (warehouse: jobs + dispatches; support: jobs, tickets, money …). Period counts use `created_at` / `confirmed_at` / `paid_at` ≥ start of today / Monday / the 1st. Live counts (to call, late, ready…) ignore the period.
`GET /reports/profit?from=&to=` (reports:read → Admin only): per DONE job, revenue = invoices (not REPAIR) + subsidy · parts = qty × cost, except SERIAL lines use the real `unit_cost` of the delivered units · labour = hours × (1 + crew names) × hourly rate · repairs = parts + labour of under-warranty tickets on this job's units · margin guards against revenue 0.
Seed result: Anil +₹43,050 (23%), Ramesh −₹5,750 (the free ₹58,000 inverter repair).

### server/app/seed.py (demo states)
`Demo` builds records in the shape the endpoints leave them: lead → survey → quote (lines copy price) → invoices → confirm (job + dispatch) → deliver (what validate does) → finish. It writes rows directly and imports no router or service, so `npm run reset` works even when other members' files are missing.
Customers: Meera NEW · Rahul CONTACTED · Kavita survey SUBMITTED · Suresh survey APPROVED · Neha quote SENT unpaid · Imran advance paid, not confirmed · Pooja READY dispatch (2 scans) · Manoj DISPATCHED for vikram today · Anil DONE · Ramesh off-grid, `INV-OF5-23C0412` covered + resolved free repair · Sunita `INV-OG3-22B0077` expired.

### server/app/tests/test_inventory.py
8 tests + 1 PostgreSQL-only race test: scan refusals · validate n/m gate · delivery + warranty dates + stock · unscan · adjust tracking rule · reserved · add_months clamp · profit (crew size, Ramesh loss) · two dispatches racing for the last wiring box → exactly one wins.

### client pages (src/pages/inventory, src/pages/dashboard, routes/inventoryRoutes.tsx)
- `DispatchesList`: status filter, `refetchInterval: 5000`, kanban config passed to DataTable.
- `DispatchForm`: scan box autofocuses and submits on Enter (a USB scanner types the serial and presses Enter), shows the refusal reason under the box, ✕ to unscan, Validate disabled with a tooltip "Scan all serials first (n/m)", green warranty banner after DONE. After each action the returned dispatch goes straight into the React Query cache (`setQueryData`); validate also invalidates jobs, stock and dashboard.
- `StockPage`: Free shown red below 0, amber at 2 or less; a "Counted qty" input only on QTY/LOT rows and only for `stock:write` (`key={onHand}` resets the input when someone else changes the number).
- `SerialsLookup`: live search, Covered / Expired badge.
- `Dashboard`: cards only for the groups the API returned, today / week / month toggle.
- `ProfitReport`: date filter, totals, losses in red, row click opens the job.

## Day 2 (P2)

### server/app/models.py: day-2 tables
- `subsidy_applications` (C uses it): one per job (`job_id` unique), `stage` enum NOT_STARTED → … → CREDITED, `documents` = uploaded URLs, `updated_at` refreshed on every change (`onupdate`).
- `technician_payouts` (C uses it): `rate` is copied from the user, so a later rate change doesn't rewrite old payouts.
- `receipts` + `receipt_lines` (A): a receipt is DRAFT until received. `unit_cost` per line becomes each new serial unit's `unit_cost`, which the profit report uses as the real purchase cost.

### Receipts: services/stock.py + routers/inventory.py
Endpoints: `GET /receipts?status=`, `GET /receipts/{id}` (stock:read) · `POST /receipts` (201), `DELETE /receipts/{id}` (204, DRAFT only), `POST /receipts/{id}/receive {lines:[{lineId, serials:[…]}]}` (stock:write).
- Create: vendor 1–100 characters (spaces-only refused), 1–50 lines, qty 1–10,000, cost optional (empty = the product's usual cost), services refused. Ref `RCV/<id>` comes from the row id, so no new counter is needed.
- Receive (one commit): locks the receipt row (a double click waits, then sees DONE) · each SERIAL line needs exactly `qty` serials · no serial twice in the request · none that already exist · counted lines must have no serials · then new IN_STOCK units are created and `qty_on_hand = qty_on_hand + qty` runs in SQL (so a dispatch validating at the same moment can't overwrite the count) · status DONE.
- The race between "check the serial doesn't exist" and the commit is covered by the unique `serial` column: `IntegrityError` → rollback → 409.
- No edit endpoint: to change a draft, delete it and create it again (less code, the same result for a draft).

### GET /reports/profit.csv
Same rows as `/reports/profit` (shared `profit_rows`), written with Python's `csv` module, sent as `text/csv` with `Content-Disposition: attachment`. UTF-8 with a BOM, so Excel shows names correctly. The page's "Download CSV" is a plain `<a href>`: the browser sends the login cookie itself.

### Pages: ReceiptsList, NewReceipt, ReceiptDetail
New receipt: vendor plus product / qty / cost rows (services aren't offered). Detail: per serial line, a scan box (Enter adds the serial; duplicates and extras are refused in the page, and the server checks again), an `n/qty` counter, ✕ to remove a serial, and Receive disabled with a tooltip until every serial line is complete. Receiving invalidates receipts, stock and the dashboard.

### Not built: Alembic
It's optional in the plan. The schema still changes daily and `npm run reset` recreates it in seconds; adding migrations mid-hackathon means every member has to run them in order. Add it once the schema is frozen.
