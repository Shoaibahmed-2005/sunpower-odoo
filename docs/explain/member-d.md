# Member D — Code Explanation

> Purpose, rules, security, edge cases, libraries, and evaluator Q&A for every file D owns.

---

### design/DESIGN.md
**Purpose:** Single-page design system extracted from the Pinterest inspiration image. Defines colours (from §9 brand kit only), radius/shadows/spacing (from image), and every component style.
**Rules enforced:** Colours never come from images (§9.1). Shapes documented with image source.
**Security:** N/A (static doc).
**Likely evaluator questions:**
- Q: Where do the colours come from? A: §9 brand kit only — never from the inspiration images.
- Q: Where do the border-radius values come from? A: The wireframe image's card/button/input corners.

---

### client/vite.config.ts
**Purpose:** Vite dev server config. Proxies `/api` and `/uploads` to `http://localhost:8000` (line 8-9) so frontend and backend share one origin — no CORS needed.
**Libraries:** `vite` (line 1), `@vitejs/plugin-react` (line 2).

---

### client/tailwind.config.js
**Purpose:** Maps CSS custom properties from `tokens.css` to Tailwind utility classes (`bg-primary`, `text-muted`, `rounded-card`, `shadow-card`).
**Libraries:** `tailwindcss`.

---

### client/src/styles/tokens.css
**Purpose:** CSS custom properties for all brand colours (§9) and shape values (from DESIGN.md). Single source of truth — Tailwind reads these.
**Rules:** Colours are §9 hex values. Radius/shadow/spacing from inspiration image.
**Libraries:** Google Fonts import for Poppins, Noto Sans, JetBrains Mono (line 3).

---

### client/src/components/Logo.tsx
**Purpose:** Shows the brand logo image. Falls back to text "Kiran" if image fails to load (line 19-23). Props: `variant` (full/mark), `size` (sm/md/lg).
**Rules:** Always `alt="Kiran"`, never stretched (`h-*` + `w-auto`). §9.1 placement table.
**Libraries:** React `useState` (line 1).
**Evaluator Q:**
- Q: What happens if the logo file is missing? A: `onError` sets `failed=true`, renders "Kiran" text.

---

### client/src/components/Layout.tsx
**Purpose:** App shell — top bar with logo, role-filtered nav menu, user info, logout. Wraps `<Outlet />`.
**Rules enforced:** Menu filtered by `can(perm)` (line 59-60). Redirects to `/login` if no user (line 39). Landing page per role (line 18-24, §4).
**Security:** Never shows menu items the user can't access.
**Libraries:** `react-router-dom` (NavLink, Outlet, Navigate — line 1), `lucide-react` (LogOut — line 2).
**Evaluator Q:**
- Q: How does the menu know which items to show? A: Each item has a `perm`; `can(perm)` checks the user's role against the access map.
- Q: What if the user isn't logged in? A: `Navigate` to `/login` (line 39).

---

### client/src/components/DataTable.tsx
**Purpose:** Generic table with search, clickable rows, empty state. Props: `columns`, `rows`, `onRowClick`, `onSearch`, `kanban` (P1).
**Rules:** Search bar only if `onSearch` provided. Empty state with Inbox icon. Clickable rows get cursor-pointer.
**Libraries:** `lucide-react` (Search, Inbox — line 2).

---

### client/src/components/SignaturePad.tsx
**Purpose:** Canvas for capturing customer signatures. Uses pointer events for drawing.
**Rules:** Touch-action none (line 81) so mobile doesn't scroll while signing. Outputs `dataURL` on pointer end (line 62). Clear resets canvas and calls `onChange(null)` (line 69).
**Security:** Signature stored as data URL in `jobs.signature`, not uploaded as a file.
**Evaluator Q:**
- Q: Why pointer events instead of mouse events? A: Pointer events work on both touch and mouse (mobile technician use case).
- Q: How is the signature stored? A: As a base64 data URL string in the job record.

---

### client/src/components/StatusBar.tsx
**Purpose:** Horizontal stepper showing workflow progress. Completed steps get green checks, current gets primary dot, future steps are gray.
**Libraries:** `lucide-react` (Check — line 1).

---

### client/src/components/Toast.tsx
**Purpose:** Module-level toast notification system. `toast.success()` / `toast.error()` callable from anywhere.
**Rules:** Max 3 visible, auto-dismiss after 3s, success=green border, error=red border.
**Libraries:** `lucide-react` (CheckCircle, XCircle, X — line 2).

---

### client/src/components/PhoneLayout.tsx
**Purpose:** Mobile-optimized wrapper for `/m/*` technician screens. Max-width md, large text, logo mark in header.

---

### client/src/components/Badge.tsx
**Purpose:** Status pill with colour-by-meaning. Maps statuses to success/warning/danger/info/neutral.
**Rules:** Underscores replaced with spaces (line 27). 15% opacity background.

---

### client/src/components/Button.tsx
**Purpose:** Button with variant (primary/secondary/danger/ghost/accent), disabled, loading states.
**Rules:** Loading shows Loader2 spinner (line 37). Disabled = opacity-50 + not-allowed.
**Libraries:** `lucide-react` (Loader2 — line 1).

---

### client/src/components/Field.tsx / PageHeader.tsx / Forbidden.tsx / RequirePerm.tsx
**Purpose:** Form field wrapper, page title+actions, 403 page, permission gate.

---

### client/src/App.tsx
**Purpose:** Root component. Sets up QueryClientProvider, AuthProvider, BrowserRouter. Concatenates all 4 route arrays. Wraps routes in `<RequirePerm>` if a `perm` is defined.
**Rules:** Login route is outside Layout (line 33). All other routes inside Layout.

---

### server/app/routers/uploads.py
**Purpose:** `POST /api/uploads` — accepts image files ≤5 MB, saves with UUID name, returns `{url}`.
**Rules enforced:** Images only (content-type check, line 23-24). Extension whitelist (line 26-27). Size limit (line 30-31). Random filename (line 34).
**Security:** No path traversal (UUID filename). No user-supplied names stored. Files served from `/uploads` only.
**Libraries:** `uuid` (line 3), `pathlib.Path` (line 4), FastAPI `UploadFile` (line 5).
**Evaluator Q:**
- Q: How do you prevent non-image uploads? A: Check content_type starts with "image/" (line 23) and extension is in whitelist (line 26).
- Q: Why UUID filenames? A: Prevents path traversal and filename collisions.

---

### server/app/routers/jobs.py
**Purpose:** Jobs CRUD + start/finish workflow.
**Endpoints:** `GET /jobs` (jobs:read), `GET /jobs/mine` (jobs:mine, own only), `GET /jobs/:id` (jobs:read or own), `POST /jobs/:id/start` (jobs:mine, own), `POST /jobs/:id/finish` (jobs:mine, own).
**Rules enforced:**
- Start gate: dispatch must be DONE (line 178) → 409 "Dispatch not done yet"
- Finish gate: must be IN_PROGRESS (line 198) → 409 "Start the job first"
- Finish gate: signature required (line 201) → 409 "Customer signature required"
- Finish gate: photos required (line 204) → 409 "Add at least one photo"
- Technician sees only own jobs (line 168-169)
- `assert_transition` validates status flow (lines 180, 206)
- Write operations in `with db.begin():` (lines 181, 207)
**Security:** `require_perm` on every route. Technician filtered server-side.
**Edge cases:** Double-click safe (assert_transition rejects re-transition).
**Libraries:** `datetime` (line 3), FastAPI, SQLAlchemy, Pydantic (lines 4-8), app modules (lines 10-12).

---

### server/app/routers/tickets.py
**Purpose:** Ticket lookup, CRUD, transition workflow (assign → in_repair → resolve → close).
**Endpoints:** `GET /tickets/lookup` (tickets:read), `GET /tickets` (tickets:read), `GET /tickets/:id` (tickets:read), `POST /tickets` (tickets:write), `POST /tickets/:id/transition` (tickets:write).
**Rules enforced:**
- Lookup returns only DELIVERED serials (line 128)
- Warranty: `warranty_until >= today` counts as covered (line 157, boundary correct)
- ASSIGNED needs technicianId (line 191-193) → 400 "Technician is required"
- RESOLVED stores costs; if not under warranty creates REPAIR invoice (line 210-218); if under warranty bill = 0 (line 221)
- CLOSED needs customerConfirmed (line 225) → 409 "Customer confirmation is required"
- All transitions via `assert_transition` (line 185)
- All writes in `with db.begin():` (line 187)
**Security:** `require_perm` on every route. Warranty computed server-side, never trusted from client.
**Edge cases:** Boundary warranty date (today = covered). Double-close rejected by assert_transition.
**Libraries:** `datetime`, `date` (line 3), SQLAlchemy `or_` (line 6), app modules.
**Evaluator Q:**
- Q: How is warranty determined? A: `serial.warranty_until >= date.today()` — computed at ticket creation, stored as boolean.
- Q: What happens when you resolve an expired ticket? A: Creates a REPAIR invoice with DUE status, bill = parts + labour.
- Q: What prevents closing without customer confirmation? A: Guard at line 225 checks `body.customer_confirmed`.

---

### client/src/pages/field/JobsList.tsx + JobDetail.tsx
**Purpose:** Installation list (DataTable with badges) and detail (StatusBar, info grid, materials, serials with warranty dates, photos, signature flag).

---

### client/src/pages/service/TicketsList.tsx + NewTicket.tsx + TicketDetail.tsx
**Purpose:** Ticket list, new ticket with live serial lookup (Covered/Expired badge), ticket detail with StatusBar, transition actions (assign, costs, resolve, customer-confirmed close, repair invoice display).

---

### client/src/pages/mobile/TechHome.tsx
**Purpose:** `/m` — technician's home. Shows active jobs and surveys as large cards, completed jobs below. 5s polling for live updates.

---

### client/src/pages/mobile/JobWorksheet.tsx
**Purpose:** `/m/jobs/:id` — technician worksheet. Start button (disabled until dispatch DONE), size input, photo upload via `/api/uploads`, SignaturePad, Finish button (disabled until signature + photo + size). All buttons are 48px for sunlight use.
**Libraries:** React Query mutation + invalidation (lines 34-47), FormData upload (line 66-68).
**Evaluator Q:**
- Q: What's the photo upload flow? A: User picks file → FormData POST to `/api/uploads` → server saves with UUID → returns URL → stored in local state → sent in finish request.
- Q: How is the signature captured? A: Canvas with pointer events → `toDataURL()` → stored as data URL string in the job record.

---

### server/app/tests/test_member_d.py
**Purpose:** Test plan for D's gates. Placeholder until A's scaffold exists. 6 tests covering start/finish gates, warranty billing, and close confirmation.
