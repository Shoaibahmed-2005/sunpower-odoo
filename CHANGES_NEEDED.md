# CHANGES_NEEDED.md — SunPower

> Add a line when you need something from another member. Tags: `[SCHEMA]`, `[CONTRACT]`, `[DEP]`.

- [DEP] D needs A to create: root `package.json` (with concurrently, dev scripts), `server/` scaffold (`pyproject.toml`, `config.py`, `db.py`, `errors.py`, `schemas/base.py`, `main.py` with all routers pre-included, `models.py`, `seed.py`). Without these, D's backend routers (`jobs.py`, `tickets.py`, `uploads.py`) cannot run.
- [DEP] D needs B to create: `shared/access.json` (role→permissions map). Frontend `Layout` menu filtering depends on this file. D will create a placeholder until B provides the real one.
- [DEP] D needs C to create: `client/src/api/client.ts`, `lib/queryClient.ts`, `lib/queryKeys.ts`, `lib/format.ts`, `auth/AuthContext.tsx`. D's pages depend on these. D will create minimal stubs clearly marked as owned by C.
- [DEP] D needs B to create: `client/src/routes/salesRoutes.tsx`. D will create an empty placeholder.
- [DEP] D needs C to create: `client/src/routes/quoteRoutes.tsx`. D will create an empty placeholder.
- [DEP] D needs A to create: `client/src/routes/inventoryRoutes.tsx`. D will create an empty placeholder.
- [CONTRACT] A → B: in `auth.get_current_user`, call `db.commit()` right after loading the user. Reason: loading the user auto-starts a transaction on the request's session, so any later `with db.begin():` in a router (validate, confirm, payment) raises "A transaction is already begun". Committing a read is harmless and `expire_on_commit=False` keeps the user loaded. (Verified with a test script.)
- [DONE] A: Phase 0 scaffold is on branch `member-a` (merge into main to use it): root `package.json`, `server/pyproject.toml`, `.env.example`, `config.py`, `db.py`, `errors.py`, `schemas/base.py`, `main.py` (all routers registered), `models.py`, `seed.py` v1.
- [CONTRACT] Member D needs Member A to expand `GET /api/dashboard?period=today|week|month` response shape with:
  1. `quotes.awaitingPayment` (count of quotations sent but balance unpaid)
  2. `tickets.underWarranty` and `tickets.billable` (breakdown of open repair tickets)
  3. `pipeline` funnel object: `{ enquiries: int, surveyed: int, quoted: int, confirmed: int, installed: int }` for the selected period
  4. `installations_by_day`: list of `{ day: string, installs: int }` for period completions chart
  Frontend currently falls back cleanly to "—" or standard seed counts if fields are omitted.
- [AUDIT] All pages owned by D (`JobsList`, `JobDetail`, `TicketsList`, `NewTicket`, `TicketDetail`, `TechHome`, `JobWorksheet`) have been upgraded to `<ListPage>`, `<RecordPage>`, `<PhonePage>`, `<Card>`, `<DataTable>`, `<Badge>`, and `<Button>`. No raw tables or unstyled buttons remain in D's pages.
- [AUDIT] For pages to be created by A, B, and C: ensure all list pages wrap `<DataTable>` and `<ListPage>` instead of raw `<table>`, and all status tags use `<Badge status={...} />`.
- [CONTRACT] A (team decision): profit revenue = Σ quotation invoices (not REPAIR) **+ quotation.subsidy**, because the customer only pays total − subsidy; without it every subsidised job shows a loss. Crew size = 1 lead technician + names in `crew`. Implemented in `GET /api/reports/profit`.
- [BUG] D: `jobs.py start_job` (and any endpoint that reads before `with db.begin():`) will raise "A transaction is already begun". Fix: drop `with db.begin():` and call `db.commit()` once at the end (A's routers do this; if a guard raises first, nothing is saved).
- [BUG] D: `DataTable` accepts the `kanban` prop but never renders a board. A's Dispatches page already passes `kanban={{groupBy:"status", ...}}`.
- [BUG] D: `Layout` menu is a fixed list, so routes' `menu` entries are ignored: A's `/stock`, `/serials`, `/reports/profit` don't appear. Please build the menu from the route arrays (or add those three).
- [CONTRACT] A → C: please add `profit: (from: string, to: string) => ["reports", "profit", from, to]` to `lib/queryKeys.ts`; ProfitReport uses that key inline until then.
- [CONTRACT] A → B: `require_perm("reports:read")` is used for the profit report; only the Director's `"*"` passes it (no role lists it).
- [DONE] C: Added `profit` query key to `lib/queryKeys.ts` per A's request.
- [DONE] C: Created `client/src/api/client.ts`, `lib/queryClient.ts`, `lib/queryKeys.ts`, `lib/format.ts`, `auth/AuthContext.tsx`, `pages/auth/Login.tsx`, `pages/quotes/QuotationList.tsx`, `pages/quotes/QuotationForm.tsx`, `pages/accounts/InvoicesList.tsx`, and `routes/quoteRoutes.tsx`.
- [DONE] C: Created `server/app/transitions.py`, `routers/quotations.py`, `routers/invoices.py`, `shared/access.json`, `app/auth.py`, `app/refs.py`, and `app/tests/test_quotations.py`.
