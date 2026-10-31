// Shared UI helpers for the sales pages.
// If a teammate exported something under a different name or path, fix it HERE only.
import apiDefault from "../../api/client";
import PageHeaderDefault from "../../components/PageHeader";
import DataTableDefault from "../../components/DataTable";
import StatusBarDefault from "../../components/StatusBar";
import BadgeDefault from "../../components/Badge";
import FieldDefault from "../../components/Field";
import ButtonDefault from "../../components/Button";
import PhoneLayoutDefault from "../../components/PhoneLayout";
import LogoDefault from "../../components/Logo";

export const api = apiDefault;
export const PageHeader = PageHeaderDefault;
export const DataTable = DataTableDefault;
export const StatusBar = StatusBarDefault;
export const Badge = BadgeDefault;
export const Field = FieldDefault;
export const Button = ButtonDefault;
export const PhoneLayout = PhoneLayoutDefault;
export const Logo = LogoDefault;

export { qk } from "../../lib/queryKeys";                       // C: React Query keys
export { formatDate, formatDateTime, formatINR } from "../../lib/format"; // C
export { useAuth } from "../../auth/AuthContext";               // C: { user, can(perm) }
export { toast } from "../../components/Toast";                 // D

// Plain inputs styled only with the design tokens (no hard-coded colours)
export const inputCls =
  "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--text)] " +
  "focus:outline-none focus:ring-2 focus:ring-[var(--primary)] disabled:opacity-60";
export const panelCls = "rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]";
