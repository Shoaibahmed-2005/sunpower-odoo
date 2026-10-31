# Developer C Learning Trail — Quotations, Payments, Invoices & Frontend Plumbing

## Overview
Developer C is responsible for:
- State machine transition enforcement (`server/app/transitions.py`)
- Quotation lifecycle, package line pricing, and payment confirmation workflows (`server/app/routers/quotations.py`)
- Invoice listing and mark-paid workflows (`server/app/routers/invoices.py`)
- Automated verification tests (`server/app/tests/test_quotations.py`)
- Frontend API client with interceptors and toast notifications (`client/src/api/client.ts`)
- React Query configuration and centralized query keys (`client/src/lib/queryClient.ts`, `client/src/lib/queryKeys.ts`)
- Currency and date formatting utilities (`client/src/lib/format.ts`)
- Authentication context and permission checking (`client/src/auth/AuthContext.tsx`)
- Role-based Login page (`client/src/pages/auth/Login.tsx`)
- Quotation list and form pages (`client/src/pages/quotes/QuotationList.tsx`, `client/src/pages/quotes/QuotationForm.tsx`)
- Invoices billing list (`client/src/pages/accounts/InvoicesList.tsx`)
- Quotations routing configuration (`client/src/routes/quoteRoutes.tsx`)

---

### `server/app/transitions.py`
**Purpose:** Validates and guards state transitions across all entity lifecycles to prevent illegal workflow progressions.
**Components:**
- `TRANSITIONS`: Dictionary mapping entity name to allowed status changes.
- `assert_transition(entity, current, target)`: Checks transition validity and raises `ApiError(409)` if forbidden.
**Rules enforced:**
- Quotations can only transition from `DRAFT` to `SENT`, `CONFIRMED`, or `CANCELLED`, and from `SENT` to `CONFIRMED` or `CANCELLED`.
- Invoices can only transition from `DUE` to `PAID`.
**Security:** Normalizes inputs and denies arbitrary state mutations without explicit configuration.
**Evaluator Q&A:**
1. *Q: Why use a centralized transition map instead of ad-hoc if-checks?*
   *A:* Centralization prevents inconsistent business logic across different routers and provides consistent 409 conflict messages.
2. *Q: What status code is returned on an illegal transition?*
   *A:* HTTP 409 Conflict with a descriptive human-readable error message.

---

### `server/app/routers/quotations.py`
**Purpose:** Handles quotation creation from packages, recalculation, customer payments, and order confirmation.
**Endpoints:**
- `POST /api/leads/{lead_id}/quotation`: Creates draft quotation for an approved survey lead. Caller: `quotes:write`.
- `GET /api/quotations`: Lists quotations with lead name, package code, total, paid, and status. Caller: `quotes:read`.
- `GET /api/quotations/{id}`: Detailed quotation view with component lines, financial breakdown, and linked invoices. Caller: `quotes:read`.
- `PATCH /api/quotations/{id}`: Switches package and recalculates lines while unpaid. Caller: `quotes:write`.
- `POST /api/quotations/{id}/send`: Moves quotation to `SENT`. Caller: `quotes:write`.
- `POST /api/quotations/{id}/cancel`: Cancels quotation (blocked if confirmed). Caller: `quotes:write`.
- `POST /api/quotations/{id}/payments`: Records customer payment (1 <= amount <= balance), creating a PAID invoice. Caller: `quotes:write`.
- `POST /api/quotations/{id}/confirm`: Confirms order once paid > 0, creating Job, Dispatch, and BALANCE invoice in one transaction. Caller: `quotes:write`.

**Rules enforced:**
- Gate: Lead stage must be `SURVEY_APPROVED` to create quote (409 "Survey not approved yet").
- Unit prices are copied directly from `product.price` at quotation creation time, locking in prices.
- Gate: Payment must be between ₹1 and current balance; cannot record payment on cancelled quote.
- Gate: Cannot confirm order if `paid == 0` (409 "Record a payment first").
- Single transaction creates Job (SCHEDULED), Dispatch (READY), BALANCE invoice (if balance > 0), and sets lead to WON.

**Security:**
- Enforces `require_perm("quotes:write")` and `require_perm("quotes:read")`.
- Re-calculates totals and remaining balances server-side from stored invoice records, ignoring any tampered client values.

**Evaluator Q&A:**
1. *Q: Why do quotation lines copy the unit price from the product instead of referencing it?*
   *A:* If product catalog prices change later, existing quotes sent to customers must not change retroactively.
2. *Q: What prevents confirming an order without customer commitment?*
   *A:* The confirm endpoint explicitly checks `paid > 0` and raises 409 "Record a payment first" if no payment was recorded.
3. *Q: How is database atomicity guaranteed during order confirmation?*
   *A:* Confirmation creates the Job, Dispatch, updates Quotation status, generates any remaining balance invoice, and marks the Lead as WON within a single database commit.

---

### `server/app/routers/invoices.py`
**Purpose:** Manages invoice records and payment settlement.
**Endpoints:**
- `GET /api/invoices`: Returns invoice records with customer name, source reference, amount, and status. Caller: `invoices:read`.
- `POST /api/invoices/{id}/mark-paid`: Transitions a DUE invoice to PAID and records `paid_at`. Caller: `invoices:write`.

**Rules enforced:**
- Uses `assert_transition("invoice", inv.status.value, "PAID")` before marking paid.
**Security:** Role-guarded via `require_perm`.

---

### `client/src/auth/AuthContext.tsx` & `client/src/api/client.ts`
**Purpose:** Provides client-side authentication state, cookie-based session management, and unified error notifications.
**Highlights:**
- `api` Axios instance uses `baseURL: "/api"` and `withCredentials: true`.
- Interceptor automatically surfaces API error messages as toasts and redirects to `/login` upon 401 unauthorized responses.
- `can(perm)` inspects role permissions to conditionally render buttons and menu links.

---

### `client/src/pages/quotes/QuotationForm.tsx`
**Purpose:** Interactive quotation workspace for sales staff to manage packages, record payments, and confirm installations.
**Highlights:**
- Dynamic package selector recalculates bill of materials and financials while quotation is unpaid.
- The "Confirm Order" button is disabled with a tooltip whenever `paid == 0`, preventing premature confirmation.
- Confirmation dialog captures installation date, lead technician, and installation crew, automatically presenting deep links to the created Job and Dispatch order upon completion.
