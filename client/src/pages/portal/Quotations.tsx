import React, { useEffect, useState } from "react";
import { CustomerQuotation, portalService } from "../../portal/api";
import { FileText, CheckCircle2, Clock, IndianRupee, QrCode, AlertCircle, X } from "lucide-react";

export default function CustomerQuotations() {
  const [quotations, setQuotations] = useState<CustomerQuotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment modal state
  const [selectedQuote, setSelectedQuote] = useState<CustomerQuotation | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payRef, setPayRef] = useState<string>("");
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);
  const [submittingPay, setSubmittingPay] = useState(false);

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

  const openPayModal = (q: CustomerQuotation) => {
    setSelectedQuote(q);
    setPayAmount(q.balance);
    setPayRef("");
    setPayError(null);
    setPaySuccess(null);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;
    setPayError(null);
    setSubmittingPay(true);

    try {
      await portalService.submitPayment(selectedQuote.id, {
        amount: payAmount,
        reference: payRef,
      });
      setPaySuccess("Payment reference submitted! SunPower accounts team will verify and confirm your order.");
      await fetchQuotes();
      setTimeout(() => {
        setSelectedQuote(null);
      }, 3000);
    } catch (err: any) {
      setPayError(err.response?.data?.detail || "Failed to submit payment");
    } finally {
      setSubmittingPay(false);
    }
  };

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
        <p className="text-sm text-slate-500">
          Review official solar quotations, central subsidy deductions, advance payments, and receipts.
        </p>
      </div>

      {quotations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No active quotations</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            Once your site survey is approved by our technical team, your official solar quotation will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {quotations.map((q) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-base">{q.ref}</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                        q.status === "CONFIRMED"
                          ? "bg-emerald-100 text-emerald-800"
                          : q.status === "SENT"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {q.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Package: {q.packageName}</p>
                </div>

                {q.balance > 0 && q.status !== "CONFIRMED" && (
                  <button
                    onClick={() => openPayModal(q)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
                  >
                    <IndianRupee className="w-4 h-4" /> Pay Advance / Balance
                  </button>
                )}
              </div>

              {/* Financial Breakdown (per V3.2 decision) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-5 bg-slate-50 border-b border-slate-100 text-center">
                <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    System Total
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-800 font-mono">
                    ₹{q.total.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider block">
                    Govt. Subsidy
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-600 font-mono">
                    -₹{q.subsidy.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider block">
                    Net Payable
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-900 font-mono">
                    ₹{q.netPayable.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider block">
                    Amount Paid
                  </span>
                  <span className="text-sm sm:text-base font-bold text-emerald-700 font-mono">
                    ₹{q.paid.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider block">
                    Pending Verification
                  </span>
                  <span className="text-sm sm:text-base font-bold text-amber-600 font-mono">
                    ₹{q.pending.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider block">
                    Due Balance
                  </span>
                  <span className="text-sm sm:text-base font-bold text-rose-600 font-mono">
                    ₹{q.balance.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="p-5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Bill of Materials (Package Components)
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-right">Quantity</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {q.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="py-2 px-3 font-medium text-slate-800">{line.name}</td>
                          <td className="py-2 px-3 text-right text-slate-600">{line.qty}</td>
                          <td className="py-2 px-3 text-right text-slate-600 font-mono">
                            ₹{line.unitPrice.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900 font-mono">
                            ₹{(line.qty * line.unitPrice).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Invoices & Payment Receipts */}
                {q.invoices.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Payment History & Invoices
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.invoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-slate-200 text-xs bg-slate-50"
                        >
                          <div>
                            <span className="font-mono font-bold text-slate-800 mr-2">{inv.ref}</span>
                            <span className="text-slate-500">({inv.type})</span>
                            {inv.reference && (
                              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                Ref: {inv.reference}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-slate-900 block">
                              ₹{inv.amount.toLocaleString()}
                            </span>
                            <span
                              className={`font-semibold inline-block text-[10px] px-2 py-0.5 rounded ${
                                inv.status === "PAID"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setSelectedQuote(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Submit Payment for {selectedQuote.ref}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Pay via UPI, NetBanking, or Bank Transfer, then submit your transaction reference.
            </p>

            {paySuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm text-center font-medium">
                ✓ {paySuccess}
              </div>
            ) : (
              <form onSubmit={handlePaySubmit} className="space-y-4">
                {payError && (
                  <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-xs border border-rose-200">
                    {payError}
                  </div>
                )}

                {/* Bank / UPI Details */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-amber-800 font-semibold">UPI VPA:</span>
                    <span className="font-mono font-bold text-amber-900">sunpower@upi</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-800 font-semibold">Account:</span>
                    <span className="font-mono text-amber-900">SunPower Solutions Pvt Ltd</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-800 font-semibold">Bank / IFSC:</span>
                    <span className="font-mono text-amber-900">HDFC Bank / HDFC0001234</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Payment Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedQuote.balance}
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Max allowed: ₹{selectedQuote.balance.toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    UPI / Bank UTR / Reference ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-1234567890 or UTR..."
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Enter the 6-40 character reference from your payment receipt
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedQuote(null)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPay || !payRef.trim() || payAmount <= 0}
                    className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {submittingPay ? "Submitting…" : "Confirm & Submit"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
