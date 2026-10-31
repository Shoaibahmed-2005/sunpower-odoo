import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CustomerTicket, DeliveredProduct, portalService } from "../../portal/api";
import { Wrench, ShieldCheck, CheckCircle2, Clock, Plus, AlertCircle, X } from "lucide-react";

export default function CustomerRequests() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const prefillSerial = searchParams.get("serial") || "";

  const [tickets, setTickets] = useState<CustomerTicket[]>([]);
  const [products, setProducts] = useState<DeliveredProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // New ticket modal
  const [ticketModal, setTicketModal] = useState(Boolean(prefillSerial));
  const [serial, setSerial] = useState(prefillSerial);
  const [issue, setIssue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const [tRes, pRes] = await Promise.all([
        portalService.getTickets(),
        portalService.getProducts(),
      ]);
      setTickets(tRes.data);
      setProducts(pRes.data);
      if (!serial && pRes.data.length > 0) {
        setSerial(pRes.data[0].serial);
      }
    } catch (err) {
      console.error("Failed to load requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await portalService.createTicket({ serial, issue });
      setTicketModal(false);
      setIssue("");
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create service request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmResolution = async (ticketId: number) => {
    try {
      await portalService.confirmTicket(ticketId);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to confirm resolution");
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Service Requests</h1>
          <p className="text-sm text-slate-500">
            Track breakdowns, technician visits, warranty repairs, and close completed jobs.
          </p>
        </div>
        <button
          onClick={() => setTicketModal(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Raise Service Ticket
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Wrench className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No service requests raised</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            If an inverter, battery, or solar system component has an issue, raise a ticket here for priority technician service.
          </p>
          <button
            onClick={() => setTicketModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold rounded-lg"
          >
            <Plus className="w-4 h-4" /> Raise First Ticket
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 text-base">{t.ref}</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                      t.status === "CLOSED"
                        ? "bg-slate-100 text-slate-700"
                        : t.status === "RESOLVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : t.status === "IN_REPAIR"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {t.status}
                  </span>
                  {t.underWarranty ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ₹0 Warranty Repair
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      Out of Warranty (₹{t.billAmount.toLocaleString()})
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Raised on {new Date(t.createdAt).toLocaleDateString()}
                </span>
              </div>

              <div>
                <p className="text-sm text-slate-800 font-medium">{t.issue}</p>
                {t.serial && (
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Equipment: {t.productName || "Component"} (S/N: {t.serial})
                  </p>
                )}
              </div>

              {/* Resolution Confirmation Gate */}
              {t.status === "RESOLVED" && !t.customerConfirmedAt && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-emerald-900">
                      Technician marked this repair as resolved
                    </p>
                    <p className="text-xs text-emerald-700">
                      Please verify that your solar equipment is functioning properly, then confirm to close.
                    </p>
                  </div>
                  <button
                    onClick={() => handleConfirmResolution(t.id)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm shrink-0"
                  >
                    ✓ Confirm Resolution
                  </button>
                </div>
              )}

              {t.customerConfirmedAt && (
                <p className="text-xs text-emerald-700 font-medium">
                  ✓ Resolution confirmed by customer on{" "}
                  {new Date(t.customerConfirmedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Ticket Modal */}
      {ticketModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setTicketModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Raise Solar Service Request
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Our support and field technician team will be notified immediately.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-lg text-xs border border-rose-200">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Select Equipment
                </label>
                {products.length > 0 ? (
                  <select
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    required
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.serial}>
                        {p.productName} — {p.serial} ({p.underWarranty ? "Covered" : "Expired"})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter serial number"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    required
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Issue Description
                </label>
                <textarea
                  rows={4}
                  required
                  minLength={10}
                  maxLength={1000}
                  placeholder="Describe the breakdown, error code, or performance issue in detail (min 10 characters)..."
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-slate-400">
                  {issue.length}/1000 characters (min 10)
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTicketModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || issue.length < 10 || !serial}
                  className="px-4 py-2 text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

