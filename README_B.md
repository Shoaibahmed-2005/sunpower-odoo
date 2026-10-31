# Member B files: how to drop them into the repo

Unzip at the repo root. Every file here is owned by Member B in BUILD_PLAN §3, so nothing of A, C or D is overwritten.

```
shared/access.json
server/app/auth.py   server/app/refs.py
server/app/routers/auth.py  users.py  leads.py  surveys.py
server/tests/test_b_auth_leads_surveys.py
client/src/routes/salesRoutes.tsx
client/src/pages/sales/   (ui.ts, types.ts, LeadsList, LeadNew, LeadForm, SurveysList, SurveyDetail)
client/src/pages/mobile/SurveyForm.tsx
client/src/pages/public/EnquiryForm.tsx
docs/explain/member-b.md   (your study notes)
```

## 3-minute integration check
1. **Router prefixes.** My routers set their own prefixes: `/api/auth`, `/api/users`, `/api` (leads + `/public/enquiries`), `/api/surveys`. In A's `main.py` the include lines must have **no extra prefix**: `app.include_router(leads.router)`. If A added `prefix=...` there, remove it (or tell A).
2. **Config name.** `auth.py` reads `settings.jwt_secret` from `app/config.py`. If A named it differently, change that one line.
3. **Frontend imports.** All imports from C and D go through `client/src/pages/sales/ui.ts`. If a name or path differs in your repo (e.g. D exported `Button` as default), fix it in that file only.
4. **Public form.** D mounts `publicSalesRoutes` (`/enquire`) outside `<Layout>` and without `<RequirePerm>`.
5. Run: `cd server && uv run pytest -q tests/test_b_auth_leads_surveys.py` → 17 passed. (Needs `pytest` and `httpx` in `pyproject.toml`; if missing, `[DEP]` to A.)

## Tested here
- 17/17 backend tests pass against stand-ins for A's `models.py`, `db.py`, `errors.py`, `schemas/base.py`, `main.py` and C's `transitions.py`, written exactly to BUILD_PLAN §5–§6.
- Frontend type-checks with `tsc` (no unused code) against stand-ins for C's and D's modules written to §9.
- Not tested: the real Postgres DB and the real teammate files. Run the tests and click the happy path after Sync.

## Messages to post in the group chat
- `[CONTRACT] B: /api/auth/*, /api/users, /api/leads/*, /api/public/enquiries, /api/surveys/* ready, see docs/explain/member-b.md`
- **To A:** seed phone numbers as plain 10 digits (`9825011223`, no spaces) so search by phone matches what the API stores. If `config.today()` uses `ZoneInfo("Asia/Kolkata")`, it crashes on Windows without the `tzdata` package; use `timezone(timedelta(hours=5, minutes=30))` instead.
- **To D:** `/surveys` and `/surveys/:id` use perm `surveys:approve`; `/m/surveys/:id` uses `surveys:submit`; mount `publicSalesRoutes` outside the layout. Survey photos must be URLs from `/api/uploads` (`/uploads/...`).
- **To C:** "Create quotation" on the enquiry calls `POST /leads/:id/quotation {packageId}` and navigates to `/quotations/<returned id>`.
- **DECISIONS.md line:** `B: lead qualifies when grid is OK and roof ≥ 10 m² per kW (stricter than "roof > 0"), reason saved in call notes.`
