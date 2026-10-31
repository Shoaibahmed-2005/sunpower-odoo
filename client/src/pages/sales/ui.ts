// Member B's single adapter to teammates' shared code (BUILD_PLAN §9).
// If a teammate exported something under a different name or path, fix it HERE only.
export { api } from "../../api/client";                         // C: axios instance, baseURL "/api", error toasts
export { qk } from "../../lib/queryKeys";                       // C: React Query keys
export { formatDate, formatDateTime, formatINR } from "../../lib/format"; // C
export { useAuth } from "../../auth/AuthContext";               // C: { user, can(perm) }
export { PageHeader } from "../../components/PageHeader";       // D
export { DataTable } from "../../components/DataTable";         // D
export { StatusBar } from "../../components/StatusBar";         // D
export { Badge } from "../../components/Badge";                 // D
export { Field } from "../../components/Field";                 // D
export { Button } from "../../components/Button";               // D
export { toast } from "../../components/Toast";                 // D
export { PhoneLayout } from "../../components/PhoneLayout";     // D
export { Logo } from "../../components/Logo";                   // D

// Plain inputs styled only with D's tokens (no hard-coded colours, §9.1)
export const inputCls =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-60";
export const panelCls = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]";
