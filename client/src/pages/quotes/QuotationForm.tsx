/**
 * Quotation Detail and Form page.
 * Owner: C (BUILD_PLAN §7, §8.2, §11).
 *
 * Enforces:
 * - Package switch recalculates lines while unpaid.
 * - Confirm order is disabled with a clear tooltip/reason if paid == 0.
 * - Confirm opens scheduling dialog (technician, date, crew) and links to created job + dispatch.
 * - Payment dialog validates amount (1 <= amount <= balance).
 */
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send,
  XCircle,
  CreditCard,
  CheckCircle2,
  Calendar,
  User,
  Truck,
  Wrench,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatINR, formatDate, formatDateTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusBar from "../../components/StatusBar";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { toast } from "../../components/Toast";

interface QuoteLine {
  productId: number;
  code: string;
  name: string;
  tracking: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

interface InvoiceItem {
  id: number;
  ref: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt?: string | null;
}

interface QuotationDetailData {
  id: number;
  ref: string;
  status: string;
  lead: {
    id: number;
    name: string;
    phone: string;
    address: string;
  };
  package: {
    id: number;
    code: string;
    name: string;
  };
  lines: QuoteLine[];
  total: number;
  subsidy: number;
  netPayable: number;
  paid: number;
  balance: number;
  jobId?: number | null;
  dispatchId?: number | null;
  invoices: InvoiceItem[];
  createdAt: string;
  confirmedAt?: string | null;
}

interface PackageOption {
  id: number;
  code: string;
  name: string;
}

interface TechUser {
  id: number;
  name: string;
  role: string;
}

const STEPS = ["Draft", "Sent", "Confirmed"];

export default function QuotationForm() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<string>("UPI");

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [schedDate, setSchedDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [techId, setTechId] = useState<number | "">("");
  const [crew, setCrew] = useState<string>("Vikram Rao, Arjun Nair");

  // Fetch quotation details
  const { data: quote, isLoading } = useQuery<QuotationDetailData>({
    queryKey: qk.quotation(Number(id)),
    queryFn: async () => {
      const res = await api.get(`/quotations/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // Fetch packages for package selector
  const { data: packages = [] } = useQuery<PackageOption[]>({
    queryKey: qk.packages,
    queryFn: async () => {
      const res = await api.get("/packages");
      return res.data;
    },
  });

  // Fetch technicians for confirm modal
  const { data: technicians = [] } = useQuery<TechUser[]>({
    queryKey: qk.users("TECHNICIAN"),
    queryFn: async () => {
      const res = await api.get("/users?role=TECHNICIAN");
      return res.data;
    },
  });

  // Mutation: Switch package
  const updatePackageMutation = useMutation({
    mutationFn: async (packageId: number) => {
      const res = await api.patch(`/quotations/${id}`, { packageId });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Package updated");
      queryClient.invalidateQueries({ queryKey: qk.quotation(Number(id)) });
      queryClient.invalidateQueries({ queryKey: qk.quotations });
    },
  });

  // Mutation: Send quotation
  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/quotations/${id}/send`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Quotation marked as Sent");
      queryClient.invalidateQueries({ queryKey: qk.quotation(Number(id)) });
      queryClient.invalidateQueries({ queryKey: qk.quotations });
    },
  });

  // Mutation: Cancel quotation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/quotations/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Quotation cancelled");
      queryClient.invalidateQueries({ queryKey: qk.quotation(Number(id)) });
      queryClient.invalidateQueries({ queryKey: qk.quotations });
    },
  });

  // Mutation: Record payment
  const paymentMutation = useMutation({
    mutationFn: async ({ amount, method }: { amount: number; method: string }) => {
      const res = await api.post(`/quotations/${id}/payments`, { amount, method });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      setShowPaymentModal(false);
      queryClient.invalidateQueries({ queryKey: qk.quotation(Number(id)) });
      queryClient.invalidateQueries({ queryKey: qk.quotations });
      queryClient.invalidateQueries({ queryKey: qk.invoices });
    },
  });

  // Mutation: Confirm order
  const confirmMutation = useMutation({
    mutationFn: async (payload: { scheduledDate: string; technicianId: number; crew: string }) => {
      const res = await api.post(`/quotations/${id}/confirm`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Order confirmed! Job and dispatch created.");
      setShowConfirmModal(false);
      // Invalidate related keys per §9
      queryClient.invalidateQueries({ queryKey: qk.quotation(Number(id)) });
      queryClient.invalidateQueries({ queryKey: qk.quotations });
      queryClient.invalidateQueries({ queryKey: qk.leads });
      queryClient.invalidateQueries({ queryKey: qk.dispatches });
      queryClient.invalidateQueries({ queryKey: qk.jobs });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: qk.invoices });
    },
  });

  if (isLoading || !quote) {
    return (
      <div className="py-20 text-center text-muted text-sm">
        Loading quotation details…
      </div>
    );
  }

  const currentStep =
    quote.status === "CONFIRMED"
      ? "Confirmed"
      : quote.status === "SENT"
      ? "Sent"
      : "Draft";

  const canModifyPackage =
    (quote.status === "DRAFT" || quote.status === "SENT") && quote.paid === 0;

  const handleOpenPayment = () => {
    // Default to minimum of 50000 or full balance
    setPayAmount(Math.min(50000, quote.balance));
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      toast.error("Payment amount must be greater than ₹0");
      return;
    }
    if (payAmount > quote.balance) {
      toast.error(`Payment cannot exceed remaining balance of ${formatINR(quote.balance)}`);
      return;
    }
    paymentMutation.mutate({ amount: payAmount, method: payMethod });
  };

  const handleOpenConfirm = () => {
    if (quote.paid === 0) {
      toast.error("Record a payment first");
      return;
    }
    if (technicians.length > 0 && techId === "") {
      setTechId(technicians[0].id);
    }
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!techId) {
      toast.error("Please select a lead technician");
      return;
    }
    if (!schedDate) {
      toast.error("Please select a scheduled installation date");
      return;
    }
    confirmMutation.mutate({
      scheduledDate: schedDate,
      technicianId: Number(techId),
      crew: crew.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Back button and page header */}
      <div>
        <Link
          to="/quotations"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotations
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-semibold text-text">
              Quotation <span className="font-mono text-primary">{quote.ref}</span>
            </h1>
            <Badge status={quote.status} />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {quote.status === "DRAFT" && (
              <Button
                variant="secondary"
                onClick={() => sendMutation.mutate()}
                loading={sendMutation.isPending}
              >
                <Send className="w-4 h-4 mr-1.5" /> Send Quote
              </Button>
            )}

            {quote.balance > 0 && quote.status !== "CANCELLED" && (
              <Button variant="primary" onClick={handleOpenPayment}>
                <CreditCard className="w-4 h-4 mr-1.5" /> Record Payment
              </Button>
            )}

            {quote.status !== "CONFIRMED" && quote.status !== "CANCELLED" && (
              <div className="relative group">
                <Button
                  variant="accent"
                  onClick={handleOpenConfirm}
                  disabled={quote.paid === 0}
                  loading={confirmMutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm Order
                </Button>
                {quote.paid === 0 && (
                  <div className="absolute right-0 bottom-full mb-1 hidden group-hover:flex items-center gap-1 px-2.5 py-1 text-xs bg-text text-white rounded shadow-md whitespace-nowrap z-20">
                    <AlertCircle className="w-3 h-3 text-warning" />
                    Record a payment first
                  </div>
                )}
              </div>
            )}

            {(quote.status === "DRAFT" || quote.status === "SENT") && (
              <Button
                variant="ghost"
                onClick={() => cancelMutation.mutate()}
                loading={cancelMutation.isPending}
                className="text-danger hover:text-danger hover:bg-danger/10"
              >
                <XCircle className="w-4 h-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmed Order Banner */}
      {quote.status === "CONFIRMED" && (
        <div className="bg-success/10 border border-success/30 rounded-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text">
                Order Confirmed on {formatDate(quote.confirmedAt)}
              </p>
              <p className="text-xs text-muted">
                Job scheduled and dispatch ready in warehouse.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {quote.jobId && (
              <Link
                to={`/jobs/${quote.jobId}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline bg-surface px-3 py-1.5 rounded border border-border"
              >
                <Wrench className="w-3.5 h-3.5" /> View Installation Job
              </Link>
            )}
            {quote.dispatchId && (
              <Link
                to={`/dispatches/${quote.dispatchId}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline bg-surface px-3 py-1.5 rounded border border-border"
              >
                <Truck className="w-3.5 h-3.5" /> View Dispatch Order
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Status Progress Bar */}
      {quote.status !== "CANCELLED" ? (
        <div className="bg-surface rounded-card shadow-card border border-border p-5">
          <StatusBar steps={STEPS} current={currentStep} />
        </div>
      ) : (
        <div className="bg-danger/10 border border-danger/20 rounded-card p-4 flex items-center gap-2 text-danger text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          <span>This quotation was cancelled.</span>
        </div>
      )}

      {/* Lead info & Package Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Details */}
        <div className="bg-surface rounded-card shadow-card border border-border p-5">
          <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">
            Customer Information
          </h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted text-xs block">Customer Name</span>
              <span className="font-medium text-text">{quote.lead.name}</span>
            </div>
            <div>
              <span className="text-muted text-xs block">Phone Number</span>
              <span className="font-mono text-text">{quote.lead.phone}</span>
            </div>
            <div>
              <span className="text-muted text-xs block">Site Address</span>
              <span className="text-text">{quote.lead.address}</span>
            </div>
          </div>
        </div>

        {/* Selected Package Details */}
        <div className="bg-surface rounded-card shadow-card border border-border p-5 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
              Solar Package Configuration
            </h2>
            {canModifyPackage ? (
              <span className="text-xs text-muted">
                Select package to re-populate components
              </span>
            ) : (
              <span className="text-xs text-muted">
                Package locked after payment / confirmation
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <select
                value={quote.package.id}
                onChange={(e) => updatePackageMutation.mutate(Number(e.target.value))}
                disabled={!canModifyPackage || updatePackageMutation.isPending}
                className="w-full h-control px-3 rounded-md border border-border bg-surface text-sm text-text focus:outline-none focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.code} — {pkg.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bill of Materials / Quote Lines */}
      <div className="bg-surface rounded-card shadow-card border border-border p-5">
        <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-4">
          Package Components & Pricing
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-muted text-xs uppercase font-semibold">
                <th className="px-3 py-2.5 text-left">Product Code</th>
                <th className="px-3 py-2.5 text-left">Description</th>
                <th className="px-3 py-2.5 text-left">Tracking</th>
                <th className="px-3 py-2.5 text-right">Qty</th>
                <th className="px-3 py-2.5 text-right">Unit Price</th>
                <th className="px-3 py-2.5 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quote.lines.map((line) => (
                <tr key={line.productId} className="hover:bg-surface-2">
                  <td className="px-3 py-2.5 font-mono text-xs font-medium text-primary">
                    {line.code}
                  </td>
                  <td className="px-3 py-2.5 text-text font-medium">{line.name}</td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    <span className="bg-bg px-2 py-0.5 rounded border border-border">
                      {line.tracking}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-medium">
                    {line.qty}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-muted">
                    {formatINR(line.unitPrice)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-text">
                    {formatINR(line.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="mt-6 flex flex-col items-end">
          <div className="w-full sm:w-80 space-y-2 text-sm border-t border-border pt-4">
            <div className="flex justify-between text-muted">
              <span>Gross Package Total:</span>
              <span className="font-mono text-text">{formatINR(quote.total)}</span>
            </div>
            {quote.subsidy > 0 && (
              <div className="flex justify-between text-success">
                <span>Government Subsidy:</span>
                <span className="font-mono">- {formatINR(quote.subsidy)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold text-text border-t border-border pt-2">
              <span>Net Payable:</span>
              <span className="font-mono text-primary">{formatINR(quote.netPayable)}</span>
            </div>
            <div className="flex justify-between text-success font-medium">
              <span>Total Paid:</span>
              <span className="font-mono">{formatINR(quote.paid)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-2">
              <span className={quote.balance > 0 ? "text-warning" : "text-success"}>
                Remaining Balance:
              </span>
              <span
                className={`font-mono ${
                  quote.balance > 0 ? "text-warning" : "text-success"
                }`}
              >
                {formatINR(quote.balance)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Linked Invoices Section */}
      <div className="bg-surface rounded-card shadow-card border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
            Invoices & Payments
          </h2>
          <span className="text-xs text-muted">
            {quote.invoices.length} invoice(s) recorded
          </span>
        </div>

        {quote.invoices.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">
            No invoices generated yet. Record a payment to generate an invoice.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-muted text-xs uppercase font-semibold">
                  <th className="px-3 py-2 text-left">Invoice Ref</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {quote.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-2">
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary">
                      {inv.ref}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <span className="px-2 py-0.5 rounded bg-bg border border-border">
                        {inv.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-text">
                      {formatINR(inv.amount)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge status={inv.status} />
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted text-xs">
                      {formatDateTime(inv.paidAt || inv.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Record Payment */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-card shadow-pop border border-border w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-lg font-heading font-semibold text-text mb-2">
              Record Customer Payment
            </h3>
            <p className="text-xs text-muted mb-4">
              Current balance due: <strong className="text-text">{formatINR(quote.balance)}</strong>
            </p>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <Field label="Payment Amount (₹)">
                <input
                  type="number"
                  min={1}
                  max={quote.balance}
                  value={payAmount || ""}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full h-control px-3 border border-border rounded-md text-sm text-text focus:outline-none focus:border-primary font-mono"
                  required
                  autoFocus
                />
              </Field>

              <Field label="Payment Method">
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full h-control px-3 border border-border rounded-md text-sm text-text focus:outline-none focus:border-primary"
                >
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="BANK">Bank Transfer (NEFT / RTGS / IMPS)</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit / Debit Card</option>
                </select>
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={paymentMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  loading={paymentMutation.isPending}
                >
                  Record {formatINR(payAmount)}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Order & Schedule Job */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-card shadow-pop border border-border w-full max-w-lg p-6 animate-scale-in">
            <h3 className="text-lg font-heading font-semibold text-text mb-2">
              Confirm Order & Schedule Installation
            </h3>
            <p className="text-xs text-muted mb-4">
              Confirming creates the installation worksheet and ready dispatch in warehouse.
            </p>

            <form onSubmit={handleConfirmSubmit} className="space-y-4">
              <Field label="Installation Date">
                <input
                  type="date"
                  value={schedDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full h-control px-3 border border-border rounded-md text-sm text-text focus:outline-none focus:border-primary"
                  required
                />
              </Field>

              <Field label="Lead Technician">
                <select
                  value={techId}
                  onChange={(e) => setTechId(Number(e.target.value))}
                  className="w-full h-control px-3 border border-border rounded-md text-sm text-text focus:outline-none focus:border-primary"
                  required
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (Technician)
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Installation Crew (comma separated)">
                <input
                  type="text"
                  value={crew}
                  onChange={(e) => setCrew(e.target.value)}
                  placeholder="e.g. Vikram Rao, Arjun Nair"
                  className="w-full h-control px-3 border border-border rounded-md text-sm text-text focus:outline-none focus:border-primary"
                  required
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={confirmMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  type="submit"
                  loading={confirmMutation.isPending}
                >
                  Confirm & Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
