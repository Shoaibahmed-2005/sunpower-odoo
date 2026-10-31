# CHANGES_NEEDED.md — Kiran

> Add a line when you need something from another member. Tags: `[SCHEMA]`, `[CONTRACT]`, `[DEP]`.

- [DEP] D needs A to create: root `package.json` (with concurrently, dev scripts), `server/` scaffold (`pyproject.toml`, `config.py`, `db.py`, `errors.py`, `schemas/base.py`, `main.py` with all routers pre-included, `models.py`, `seed.py`). Without these, D's backend routers (`jobs.py`, `tickets.py`, `uploads.py`) cannot run.
- [DEP] D needs B to create: `shared/access.json` (role→permissions map). Frontend `Layout` menu filtering depends on this file. D will create a placeholder until B provides the real one.
- [DEP] D needs C to create: `client/src/api/client.ts`, `lib/queryClient.ts`, `lib/queryKeys.ts`, `lib/format.ts`, `auth/AuthContext.tsx`. D's pages depend on these. D will create minimal stubs clearly marked as owned by C.
- [DEP] D needs B to create: `client/src/routes/salesRoutes.tsx`. D will create an empty placeholder.
- [DEP] D needs C to create: `client/src/routes/quoteRoutes.tsx`. D will create an empty placeholder.
- [DEP] D needs A to create: `client/src/routes/inventoryRoutes.tsx`. D will create an empty placeholder.

- [CONTRACT] Member D needs Member A to expand `GET /api/dashboard?period=today|week|month` response shape with:
  1. `quotes.awaitingPayment` (count of quotations sent but balance unpaid)
  2. `tickets.underWarranty` and `tickets.billable` (breakdown of open repair tickets)
  3. `pipeline` funnel object: `{ enquiries: int, surveyed: int, quoted: int, confirmed: int, installed: int }` for the selected period
  4. `installations_by_day`: list of `{ day: string, installs: int }` for period completions chart
  Frontend currently falls back cleanly to "—" or standard seed counts if fields are omitted.
- [AUDIT] All pages owned by D (`JobsList`, `JobDetail`, `TicketsList`, `NewTicket`, `TicketDetail`, `TechHome`, `JobWorksheet`) have been upgraded to `<ListPage>`, `<RecordPage>`, `<PhonePage>`, `<Card>`, `<DataTable>`, `<Badge>`, and `<Button>`. No raw tables or unstyled buttons remain in D's pages.
- [AUDIT] For pages to be created by A, B, and C: ensure all list pages wrap `<DataTable>` and `<ListPage>` instead of raw `<table>`, and all status tags use `<Badge status={...} />`.
