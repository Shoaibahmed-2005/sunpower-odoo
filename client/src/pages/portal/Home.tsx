import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePortal } from "../../portal/PortalContext";
import {
  CustomerNotification,
  CustomerOverview,
  errorText,
  portalService,
} from "../../portal/api";
import {
  ShieldCheck,
  Wrench,
  FileText,
  MessageSquare,
  Sun,
  PlusCircle,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

export default function CustomerHome() {
  const { customer } = usePortal();
  const [overview, setOverview] = useState<CustomerOverview | null>(null);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // New enquiry modal state
  const [enquiryModal, setEnquiryModal] = useState(false);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);
  const [enquirySuccess, setEnquirySuccess] = useState<string | null>(null);
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ovRes, notifRes] = await Promise.all([
          portalService.getOverview(),
          portalService.getNotifications(),
        ]);
        setOverview(ovRes.data);
        setNotifications(notifRes.data);
      } catch (err) {
        console.error("Failed to load portal home data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Uncontrolled form: read all values once, on submit. The server re-validates everything.
  const handleEnquirySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const roofArea = Number(data.get("roofArea"));
    setEnquiryError(null);
    setSubmittingEnquiry(true);
    try {
      const res = await portalService.submitEnquiry({
        address: String(data.get("address")).trim(),
        kw: Number(data.get("kw")),
        systemType: String(data.get("systemType")),
        monthlyBill: Number(data.get("monthlyBill")),
        ...(roofArea ? { roofArea } : {}),
      });
      setEnquirySuccess(res.data.message);
      setTimeout(() => {
        setEnquiryModal(false);
        setEnquirySuccess(null);
      }, 2500);
    } catch (err) {
      setEnquiryError(errorText(err, "Failed to submit enquiry"));
    } finally {
      setSubmittingEnquiry(false);
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
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
            <Sun className="w-3.5 h-3.5" /> Rooftop Solar System
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {customer?.name}
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Registered phone: <span className="font-mono text-white">{customer?.phone}</span>
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setEnquiryModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
          >
            <PlusCircle className="w-4 h-4" /> New Solar Enquiry
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <Link
          to="/portal/products"
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Installed Equipment
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {overview?.productsCount || 0}
            </span>
            <span className="text-xs text-emerald-600 font-medium">
              {overview?.underWarrantyCount || 0} Under Warranty
            </span>
          </div>
        </Link>

        <Link
          to="/portal/quotations"
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Invoices Due
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {overview?.pendingInvoicesCount || 0}
            </span>
            <span className="text-xs text-slate-500">Awaiting verification</span>
          </div>
        </Link>

        <Link
          to="/portal/requests"
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Service Requests
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {overview?.openTicketsCount || 0}
            </span>
            <span className="text-xs text-blue-600">Active tickets</span>
          </div>
        </Link>

        <Link
          to="/portal/messages"
          className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Unread Messages
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">
              {overview?.unreadMessagesCount || 0}
            </span>
            <span className="text-xs text-slate-500">From SunPower support</span>
          </div>
        </Link>
      </div>

      {/* Grid: Quick Actions & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Quick Actions
          </h2>
          <div className="flex flex-col gap-2">
            <Link
              to="/portal/requests"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Raise Service Request</p>
                  <p className="text-xs text-slate-500">Report an inverter or battery issue</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              to="/portal/quotations"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">View Quotations & Pay</p>
                  <p className="text-xs text-slate-500">Submit advance or check bill balance</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              to="/portal/messages"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Chat with Support</p>
                  <p className="text-xs text-slate-500">Direct message with engineering team</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Notifications & Recent Activity */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
            Recent System Activity
          </h2>
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No recent activity yet. Your equipment updates will appear here.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div key={n.id} className="py-3 flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-lg bg-slate-100 text-slate-700">
                    {n.type === "QUOTATION" && <FileText className="w-4 h-4 text-emerald-600" />}
                    {n.type === "JOB" && <Sun className="w-4 h-4 text-amber-600" />}
                    {n.type === "TICKET" && <Wrench className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-600">{n.message}</p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(n.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Solar Enquiry Modal */}
      {enquiryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 relative">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              New Solar Installation Enquiry
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Get an estimate for your rooftop solar installation under PM Surya Ghar.
            </p>

            {enquirySuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg text-sm text-center font-medium">
                ✓ {enquirySuccess}
              </div>
            ) : (
              <form onSubmit={handleEnquirySubmit} className="space-y-4">
                {enquiryError && (
                  <p className="p-2 text-xs rounded-lg bg-rose-50 border border-rose-200 text-rose-700">{enquiryError}</p>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Installation Address
                  </label>
                  <input
                    name="address"
                    required
                    minLength={5}
                    maxLength={300}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    System Size Needed (kW)
                  </label>
                  <input
                    name="kw"
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    defaultValue={3}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Monthly Electricity Bill (₹)
                  </label>
                  <input
                    type="number"
                    min={500}
                    step={100}
                    name="monthlyBill"
                    defaultValue={4000}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Available Roof Area (sq. ft.)
                  </label>
                  <input
                    type="number"
                    min={50}
                    name="roofArea"
                    defaultValue={500}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    System Preference
                  </label>
                  <select
                    name="systemType"
                    defaultValue="ON_GRID"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="ON_GRID">On-Grid (Subsidy Eligible)</option>
                    <option value="OFF_GRID">Off-Grid (With Battery Backup)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEnquiryModal(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEnquiry}
                    className="px-4 py-2 text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg disabled:opacity-50"
                  >
                    {submittingEnquiry ? "Submitting…" : "Submit Enquiry"}
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
