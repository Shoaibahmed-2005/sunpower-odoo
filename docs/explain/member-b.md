# Member B: what I built and how to explain it

## The flow I own
New enquiry (web form, call, WhatsApp) → qualifying call → schedule a roof survey → technician submits measurements on the phone → Sales approves → **"Create quotation" unlocks** (C takes over). Plus login, logout, roles and permissions for the whole app.

---

### shared/access.json
Purpose: one file that says which role can do what. The backend (`require_perm`) and the frontend menu both read it, so they can never disagree.
- `"*"` means everything (Admin). Permissions are `area:action`, e.g. `leads:write`.
- Likely questions: *Why one shared file?* Single source of truth. *Is hiding the menu enough?* No, it's UX only; the API returns 403.

### server/app/auth.py
Purpose: password hashing, the JWT cookie, "who is calling", permission checks.
- `hash_password` / `verify_password`: bcrypt cost 12 (slow on purpose, salted, so a leaked DB is hard to crack). A malformed hash returns False instead of crashing.
- `DUMMY_HASH`: when the login id doesn't exist we still run bcrypt, so the response time doesn't reveal which ids exist.
- `make_token`: JWT with `sub` (user id), `role`, `exp` (7 days), signed HS256 with `JWT_SECRET`. **Signed, not encrypted**: readable, but can't be changed without the secret.
- `get_current_user`: reads the `token` cookie → `jwt.decode` with `algorithms=["HS256"]` pinned (blocks the "alg: none" trick) → loads the user from the DB → 401 if missing, tampered, expired or inactive. The role comes from the DB, not the token, so deactivating someone or changing their role applies on the next request.
- `require_perm(perm)`: returns a dependency; 403 if the role lacks the permission.
- Cookie: `httponly` (JavaScript can't read it, so XSS can't steal it), `samesite=lax` (not sent on cross-site POSTs, blocks CSRF), `secure=False` only because the demo is http://localhost.
- Questions: *401 vs 403?* 401 = we don't know who you are; 403 = we know you, you're not allowed. *Why cookie, not localStorage?* XSS can read localStorage. *Why JWT, not server sessions?* Stateless, no session table; trade-off: can't revoke early, softened by the `active` check every request. *Depends chain?* `get_db → get_current_user → require_perm`; FastAPI resolves them in order and reuses the same DB session for the request.

### server/app/refs.py
Purpose: references like `ENQ/0007`.
- One `UPDATE counters SET next = next + 1 WHERE key = ... RETURNING next`. The database locks that row while incrementing, so two users at the same moment can't get the same number. `ref` is also UNIQUE as a backstop.
- It runs inside the request's transaction: if the request fails, the rollback gives the number back.
- Missing counter → clear 500 ("run the seed") instead of a made-up number.

### server/app/routers/auth.py
- `POST /api/auth/login` (public): lower-cases and trims the login id, checks the password, sets the cookie. Always the same message "Invalid Login Id or Password" (no user enumeration). Never returns `password_hash`.
- `POST /api/auth/logout`: deletes the cookie, 204.
- `GET /api/auth/me`: the frontend calls it on start-up to restore the session.

### server/app/routers/users.py
- `GET /api/users?role=TECHNICIAN` (`users:read`): active users for dropdowns; only id, name, role.
- `POST /api/users` (Admin only, via `"*"`): no public sign-up. login id pattern `^[a-z][a-z0-9.]{2,29}$`, password ≥ 8, 409 if the id is taken.

### server/app/routers/leads.py
- **Validation (Pydantic)**: name 2–100, phone cleaned to 10 digits starting 6–9 (`+91` and spaces accepted), address 5–300, kW 1–5, bill 1–10,00,000, enums for source and system type. Bad input → 400 with the field name.
- `GET /api/leads?search=&stage=`: newest first; search on ref, name or phone using `ilike` with a bound parameter (no SQL injection); search text capped at 50 chars.
- `POST /api/leads`: `next_ref("ENQ")`, stage NEW, salesperson = the Sales user who entered it.
- `GET /api/leads/{id}`: lead + surveys + quotations + `canQuote`. `canQuote` = an APPROVED survey exists, no non-cancelled quotation, lead not LOST.
- `POST /api/leads/{id}/log-call`: only NEW or CONTACTED (409 otherwise). **QUALIFIED if grid OK and roof ≥ 10 m² per kW** (3 kW needs ~30 m²), else CONTACTED with the reason saved in the notes. `assert_transition` is skipped when the stage doesn't change (a second failed call).
- `POST /api/leads/{id}/schedule-survey`: 409 unless QUALIFIED; technician must exist, be active and be a TECHNICIAN (400 `technicianId`); visit date not in the past (India date). Creates `SRV/....`, lead → SURVEY_SCHEDULED, one commit.
- `POST /api/leads/{id}/lost`: reason 3–300; 409 if already WON or LOST.
- `POST /api/public/enquiries` (no login): creates a NEW lead with source WEB and returns **only** `{ref}`, so nobody can read data through it. Honeypot field `website`: hidden from people, bots fill it, → 400.
- Every write: lock the lead row (`with_for_update`), guards first, changes, one `db.commit()`, `db.rollback()` on any error.

### server/app/routers/surveys.py
- `GET /api/surveys`: technicians get only their own (filtered on the server).
- `GET /api/surveys/{id}`: someone else's survey looks like **404**, not 403, so a technician can't even discover which ids exist (prevents IDOR probing).
- `PATCH /api/surveys/{id}/submit` (`surveys:submit`, own only): direction is one of 8 compass points, tilt 0–60°, cable 1–150 m, area > 0, max 10 photos, and every photo URL must start with `/uploads/` (blocks `javascript:` links and outside URLs). SCHEDULED → SUBMITTED; a double submit gets 409.
- `POST /api/surveys/{id}/approve` (`surveys:approve`): locks the survey and the lead; survey → APPROVED **and** lead → SURVEY_APPROVED in one commit; records `approved_by_id` and `approved_at` (audit). A technician can't approve (403); a double click gets 409. **This is what unlocks the quote.**
- `POST /api/surveys/{id}/reject`: reason required; survey → REJECTED; lead → QUALIFIED so a new survey can be booked.

### server/tests/test_b_auth_leads_surveys.py (17 tests)
401 without cookie, 401 with a forged cookie, same message for wrong password and unknown id, httpOnly cookie, 403 for a technician on `/api/leads`, logout, phone/kW validation, references ENQ/0001 then ENQ/0002, search, qualify rule, schedule gate, public form + honeypot, mark lost twice, full survey flow unlocking `canQuote`, technician isolation, measurement and photo-URL validation, reject flow, only the Admin creates users.
Demo trick: delete the stage check in `schedule_survey`, run the tests, watch `test_schedule_survey_requires_qualified_and_a_technician` fail, put it back.

### Frontend
- `pages/sales/ui.ts`: the only place I import teammates' code (C's `api`, `qk`, formatters, `useAuth`; D's components). Inputs use D's CSS variables only.
- `pages/sales/types.ts`: API shapes, labels, and `cleanPhone` / `validateEnquiry` with the **same limits as the server**, so most mistakes are caught before the request; the server still checks everything.
- `LeadsList.tsx`: `useQuery` keyed by `[...qk.leads, {search, stage}]`; invalidating `qk.leads` refreshes every filtered variant. Loading, error and empty states.
- `LeadNew.tsx`: form → validate → `useMutation` POST → invalidate lists → toast → open the new enquiry.
- `LeadForm.tsx`: StatusBar; buttons enabled only in the right stage; **Create quotation disabled with a tooltip until `canQuote`**; panels for call, survey, quote (suggests the matching package, e.g. ON-3), lost. Every mutation invalidates the lead, the lists and the dashboard.
- `SurveysList.tsx` / `SurveyDetail.tsx`: defaults to "Submitted" (Sales' to-do list); Approve / Reject with reason.
- `pages/mobile/SurveyForm.tsx`: big inputs for use on a roof; photo upload (images only, ≤ 5 MB checked before upload) via `POST /api/uploads`; Submit disabled while uploading.
- `pages/public/EnquiryForm.tsx`: no login, honeypot field, shows the reference after submit.
- `routes/salesRoutes.tsx`: each route declares its permission; `/surveys` uses `surveys:approve` so technicians stay on their phone screens.

## Five questions I should answer without notes
1. Walk me through what happens when Sales clicks Approve. (lock → two transitions → audit fields → one commit → React Query invalidates the lead → button unlocks)
2. How do you stop a technician editing someone else's survey? (server filter + 404, not the UI)
3. Why is "Create quotation" safe even if someone enables the button in DevTools? (C's endpoint re-checks the approved survey and returns 409)
4. How are passwords stored and checked? (bcrypt, salt, cost 12, dummy hash for unknown ids)
5. What stops two people getting the same ENQ number? (atomic UPDATE … RETURNING inside the transaction + UNIQUE)


---

### WP2: Admin role and user management (`server/app/routers/users.py`, `client/src/pages/admin/UsersPage.tsx`)
Purpose: Implement Admin role across the entire system, and provide full staff user lifecycle management (create, list, assign roles, deactivate/reactivate, password reset).

Endpoints added / updated:
- `GET /api/users` (`users:read`): returns active users list for dropdowns (id, name, role).
- `GET /api/users/all` (`users:write`): returns all staff users (including inactive) with credentials metadata (id, name, loginId, role, hourlyRate, active, createdAt).
- `POST /api/users` (`users:write`): creates a new staff user with bcrypt password hash. Validates login ID pattern `^[a-z][a-z0-9.]{2,29}$`, password min 8 chars, hourly rate 0–10000. 409 if login ID is duplicate.
- `PATCH /api/users/{id}` (`users:write`): updates name, role, hourlyRate, or active status.
  - Guard: row lock (`with_for_update=True`).
  - Guard: 404 if user not found.
  - Guard: at least one active admin required (409 "At least one active admin is required" if deactivating or changing role of the last active admin).
  - Guard: an admin cannot demote or deactivate themself (409 "You cannot change your own role", 409 "You cannot deactivate your own account").
- `POST /api/users/{id}/reset-password` (`users:write`): sets a new password (min 8 chars) hashed with bcrypt. 204 No Content; never returns the hash.

Rules & Security enforced:
- Staff users are never deleted from the database ("remove" = `active=false`). This preserves audit trails, past enquiries, and job history.
- Immediate session termination: `get_current_user` re-validates `user.active` on every request, so deactivated users receive 401 on their very next request without waiting for token expiry.
- Role changes take effect immediately on the next request because `get_current_user` loads the user from the database.
- Self-protection: Admins cannot demote or deactivate their own accounts from the UI or the API.
- Zero-admin prevention: The database count of active admins prevents reducing the number of active admins below 1.

Frontend:
- `client/src/pages/admin/UsersPage.tsx` at route `/admin/users` (permission `users:write`).
- Menu entry: "Settings › Users & Roles" in `Layout.tsx`.
- Displays all users with role badge, hourly rate, and active/inactive status.
- Add User panel for creating staff accounts.
- Per-row actions: change role select, Deactivate / Reactivate button, Reset Password modal.
- Own row actions are disabled with tooltips ("You cannot change your own role", "You cannot deactivate your own account").

Tests:
- `server/tests/test_admin_users.py`: validates 403 for non-admins on all admin endpoints, user creation, duplicate checks, role updates, deactivation (401 on login and existing cookie), reactivation, password reset, self-protection guards, and last active admin protection.
