import React, { useEffect, useState } from "react";
import { CustomerQuotation, errorText, portalService } from "../../portal/api";
import { loadRazorpay } from "../../lib/razorpay";
import { formatDate, formatINR } from "../../lib/format";
import { FileText, CheckCircle2, CalendarCheck, ShieldCheck, X } from "lucide-react";

type PayKind = "ADVANCE" | "FULL" | "PART";

export default function CustomerQuotations() {
  const [quotations, setQuotations] = useState<CustomerQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<CustomerQuotation | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchQuotes = async () => {
    try {
      const res = await portalService.getQuotations();
      setQuotations(res.data);
    } catch (err) {
      console.error("Failed to load quotations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Quotations & Payments</h1>
        <p className="text-sm text-slate-500">Review your quotation, accept it, and pay online to book your installation.</p>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {quotations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No quotations yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Once your site survey is approved, your quotation will appear here.
          </p>
        </div>
      ) : (
        quotations.map((q) => (
          <QuoteCard key={q.id} q={q} onChanged={fetchQuotes} onPay={() => setPaying(q)} />
        ))
      )}

      {paying && (
        <PayModal
          q={paying}
          onClose={() => setPaying(null)}
          onPaid={(msg) => {
            setPaying(null);
            setSuccess(msg);
            fetchQuotes();
          }}
        />
      )}
    </div>
  );
}

function QuoteCard({ q, onChanged, onPay }: { q: CustomerQuotation; onChanged: () => void; onPay: () => void }) {
  const canAccept = q.status === "SENT" && !q.acceptedAt;
  const booked = q.status === "CONFIRMED";
  const canPay = q.balance > 0 && (booked || !!q.acceptedAt);
  const installed = q.job?.status === "DONE";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-900">{q.ref}</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${q.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {q.status === "CONFIRMED" ? "Booked" : q.acceptedAt ? "Accepted" : "Awaiting your acceptance"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Package: {q.packageName}</p>
        </div>
        {canPay && (
          <button onClick={onPay} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl">
            {booked ? `Pay balance ${formatINR(q.balance)}` : "Pay & book"}
          </button>
        )}
      </div>

      {q.status === "CONFIRMED" && q.job && (
        <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 text-sm text-emerald-900 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4" />
          Booking confirmed · installation on <strong>{formatDate(q.job.scheduledDate)}</strong>
          {q.job.technicianName && <> · technician {q.job.technicianName}</>}
        </div>
      )}

      {installed && q.balance > 0 && (
        <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
          Installation complete. Please pay the remaining <strong>{formatINR(q.balance)}</strong>.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-5 bg-slate-50 border-b border-slate-100 text-center">
        <Money label="Total" value={q.total} />
        <Money label="Govt. subsidy" value={-q.subsidy} tone="text-emerald-600" />
        <Money label="Net payable" value={q.netPayable} tone="text-slate-900" strong />
        <Money label="Paid" value={q.paid} tone="text-emerald-700" />
        <Money label="Balance" value={q.balance} tone="text-rose-600" />
      </div>

      <div className="p-5 space-y-4">
        <div className="border border-slate-200 rounded-xl overflow-x-auto text-xs">
          <table className="w-full text-left min-w-[420px]">
            <thead className="bg-slate-100 text-slate-600 font-semibold">
              <tr>
                <th className="py-2 px-3">Item</th>
                <th className="py-2 px-3 text-right">Qty</th>
                <th className="py-2 px-3 text-right">Unit price</th>
                <th className="py-2 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {q.lines.map((line) => (
                <tr key={line.id}>
                  <td className="py-2 px-3 font-medium text-slate-800">{line.name}</td>
                  <td className="py-2 px-3 text-right">{line.qty}</td>
                  <td className="py-2 px-3 text-right font-mono">{formatINR(line.unitPrice)}</td>
                  <td className="py-2 px-3 text-right font-mono font-semibold">{formatINR(line.qty * line.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canAccept && <AcceptForm q={q} onAccepted={onChanged} />}
        {q.acceptedAt && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Accepted by {q.acceptedName} on {formatDate(q.acceptedAt)}
            {q.preferredDate && <> · preferred date {formatDate(q.preferredDate)}</>}
          </p>
        )}

        {q.invoices.length > 0 && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {q.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 text-xs bg-slate-50">
                <div>
                  <span className="font-mono font-bold text-slate-800 mr-2">{inv.ref}</span>
                  <span className="text-slate-500">{inv.type}{inv.method === "ONLINE" ? " · online" : ""}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold block">{formatINR(inv.amount)}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${inv.status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {inv.status === "PAID" ? "Paid" : "Due"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Money({ label, value, tone = "text-slate-800", strong }: { label: string; value: number; tone?: string; strong?: boolean }) {
  return (
    <div className="p-2 bg-white rounded-xl border border-slate-200/80">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">{label}</span>
      <span className={`font-mono ${strong ? "text-base font-bold" : "text-sm font-semibold"} ${tone}`}>
        {value < 0 ? `-${formatINR(-value)}` : formatINR(value)}
      </span>
    </div>
  );
}

function AcceptForm({ q, onAccepted }: { q: CustomerQuotation; onAccepted: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  // Uncontrolled form: values are read once, on submit.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const preferredDate = String(data.get("preferredDate") || "");
    setError(null);
    setSaving(true);
    try {
      await portalService.acceptQuotation(q.id, {
        name: String(data.get("name")).trim(),
        agree: true,
        ...(preferredDate ? { preferredDate } : {}),
      });
      onAccepted();
    } catch (err) {
      setError(errorText(err, "Could not accept the quotation"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-3">
      <h4 className="text-sm font-bold text-slate-900">Accept this quotation</h4>
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-slate-700">
          Your full name
          <input name="name" required minLength={2} maxLength={100} className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </label>
        <label className="text-xs font-semibold text-slate-700">
          Preferred installation date (optional)
          <input name="preferredDate" type="date" min={today} className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs text-slate-700">
        <input name="agree" type="checkbox" required className="mt-0.5" />
        I accept the items and price in {q.ref} and SunPower's installation terms.
      </label>
      <button type="submit" disabled={saving} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
        {saving ? "Accepting…" : "Accept quotation"}
      </button>
    </form>
  );
}

function PayModal({ q, onClose, onPaid }: { q: CustomerQuotation; onClose: () => void; onPaid: (msg: string) => void }) {
  // before booking: advance / full / custom; after booking only the remaining balance can be paid
  const hasAdvance = q.status === "SENT" && q.minAdvance < q.balance;
  const [kind, setKind] = useState<PayKind>(hasAdvance ? "ADVANCE" : "FULL");
  const [custom, setCustom] = useState<number>(q.minAdvance);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = kind === "ADVANCE" ? q.minAdvance : kind === "FULL" ? q.balance : custom;
  const customValid = kind !== "PART" || (custom >= q.minAdvance && custom <= q.balance);

  const pay = async () => {
    setError(null);
    setBusy(true);
    try {
      await loadRazorpay();
      // The server decides the amount; we only say which option was picked.
      const { data: order } = await portalService.createOrder(q.id, kind === "PART" ? { kind, amount: custom } : { kind });
      const rzp = new (window as any).Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        prefill: order.prefill,
        theme: { color: "#13315C" },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const { data } = await portalService.verifyPayment({
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            });
            onPaid(
              `Payment received ${formatINR(order.amount / 100)}${data.invoiceRef ? ` · receipt ${data.invoiceRef}` : ""}.` +
                (q.status === "CONFIRMED" ? " Thank you, your account is settled." : " SunPower will confirm your installation date shortly.")
            );
          } catch (err) {
            setError(errorText(err, "Payment could not be verified"));
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            portalService.markPaymentFailed(order.orderId).catch(() => undefined);
            setBusy(false);
          },
        },
      });
      rzp.on("payment.failed", (resp: any) => {
        setError(resp?.error?.description || "Payment failed. You can try again.");
      });
      rzp.open();
    } catch (err: any) {
      setError(errorText(err, err?.message || "Could not start the payment"));
      setBusy(false);
    }
  };

  const option = (value: PayKind, title: string, sub: string) => (
    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${kind === value ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}>
      <input type="radio" name="kind" checked={kind === value} onChange={() => setKind(value)} />
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{sub}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative space-y-4">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Pay for {q.ref}</h3>
          <p className="text-xs text-slate-500">Balance {formatINR(q.balance)} · secure payment by Razorpay</p>
        </div>
        {!q.onlinePaymentsEnabled ? (
          <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">
            Online payment isn't available right now. Please contact SunPower to pay.
          </p>
        ) : (
          <>
            {error && <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg">{error}</p>}
            <div className="space-y-2">
              {hasAdvance && option("ADVANCE", `Advance ${formatINR(q.minAdvance)}`, "25% now, the rest after installation")}
              {option(
                "FULL",
                q.status === "CONFIRMED" ? `Remaining balance ${formatINR(q.balance)}` : `Full amount ${formatINR(q.balance)}`,
                q.status === "CONFIRMED" ? "Clears everything you owe for this installation" : "Pay everything now"
              )}
              {hasAdvance && option("PART", "Another amount", `Between ${formatINR(q.minAdvance)} and ${formatINR(q.balance)}`)}
              {kind === "PART" && (
                <input
                  type="number"
                  min={q.minAdvance}
                  max={q.balance}
                  value={custom || ""}
                  onChange={(e) => setCustom(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                />
              )}
            </div>
            <button
              onClick={pay}
              disabled={busy || !customValid}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
            >
              {busy ? "Opening Razorpay…" : `Pay ${formatINR(amount)} securely`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
