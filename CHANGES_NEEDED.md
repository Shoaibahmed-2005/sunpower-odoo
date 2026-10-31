# CHANGES_NEEDED.md — Kiran

> Add a line when you need something from another member. Tags: `[SCHEMA]`, `[CONTRACT]`, `[DEP]`.

- [DEP] D needs A to create: root `package.json` (with concurrently, dev scripts), `server/` scaffold (`pyproject.toml`, `config.py`, `db.py`, `errors.py`, `schemas/base.py`, `main.py` with all routers pre-included, `models.py`, `seed.py`). Without these, D's backend routers (`jobs.py`, `tickets.py`, `uploads.py`) cannot run.
- [DEP] D needs B to create: `shared/access.json` (role→permissions map). Frontend `Layout` menu filtering depends on this file. D will create a placeholder until B provides the real one.
- [DEP] D needs C to create: `client/src/api/client.ts`, `lib/queryClient.ts`, `lib/queryKeys.ts`, `lib/format.ts`, `auth/AuthContext.tsx`. D's pages depend on these. D will create minimal stubs clearly marked as owned by C.
- [DEP] D needs B to create: `client/src/routes/salesRoutes.tsx`. D will create an empty placeholder.
- [DEP] D needs C to create: `client/src/routes/quoteRoutes.tsx`. D will create an empty placeholder.
- [DEP] D needs A to create: `client/src/routes/inventoryRoutes.tsx`. D will create an empty placeholder.
- [CONTRACT] A → B: in `auth.get_current_user`, call `db.commit()` right after loading the user. Reason: loading the user auto-starts a transaction on the request's session, so any later `with db.begin():` in a router (validate, confirm, payment) raises "A transaction is already begun". Committing a read is harmless and `expire_on_commit=False` keeps the user loaded. (Verified with a test script.)
- [DONE] A: Phase 0 scaffold is on main: root `package.json`, `server/pyproject.toml`, `.env.example`, `config.py`, `db.py`, `errors.py`, `schemas/base.py`, `main.py` (all routers registered), `models.py`, `seed.py` v1.
