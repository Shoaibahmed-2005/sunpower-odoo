import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import Logo from "../components/Logo";
import { usePortal } from "./PortalContext";
import {
  Home,
  ShieldCheck,
  FileText,
  Wrench,
  MessageSquare,
  LogOut,
  Bell,
  Menu,
  X,
  PhoneCall,
} from "lucide-react";
import { portalService } from "./api";

export default function PortalLayout() {
  const { customer, logout } = usePortal();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [callbackModal, setCallbackModal] = useState(false);
  const [callbackTime, setCallbackTime] = useState("Morning (9 AM - 12 PM)");
  const [callbackNote, setCallbackNote] = useState("");
  const [callbackSuccess, setCallbackSuccess] = useState(false);
  const [callbackSubmitting, setCallbackSubmitting] = useState(false);

  const navItems = [
    { label: "Home", path: "/portal/home", icon: Home },
    { label: "My Products", path: "/portal/products", icon: ShieldCheck },
    { label: "Quotations", path: "/portal/quotations", icon: FileText },
    { label: "Service Requests", path: "/portal/requests", icon: Wrench },
    { label: "Messages", path: "/portal/messages", icon: MessageSquare },
  ];

  const handleCallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCallbackSubmitting(true);
    try {
      await portalService.requestCallback({ preferredTime: callbackTime, note: callbackNote });
      setCallbackSuccess(true);
      setTimeout(() => {
        setCallbackModal(false);
        setCallbackSuccess(false);
        setCallbackNote("");
      }, 2000);
    } catch {
      alert("Failed to submit callback request. Please try again.");
    } finally {
      setCallbackSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-16 md:pb-0">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/portal/home" className="flex items-center">
              <Logo size="md" />
            </Link>
            <span className="hidden sm:inline-block text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              Customer Portal
            </span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCallbackModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              Request Callback
            </button>

            <div className="hidden sm:flex flex-col text-right mr-1">
              <span className="text-sm font-semibold text-slate-800 leading-tight">
                {customer?.name}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {customer?.phoneMasked || customer?.phone}
              </span>
            </div>

            <button
              onClick={logout}
              title="Logout"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
            <div className="pb-2 border-b border-slate-100 mb-2">
              <p className="font-semibold text-slate-900">{customer?.name}</p>
              <p className="text-xs text-slate-500 font-mono">{customer?.phone}</p>
            </div>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setCallbackModal(true);
              }}
              className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white"
            >
              <PhoneCall className="w-4 h-4" />
              Request Callback
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>

      {/* Bottom Bar for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-30 flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-1 text-[11px] font-medium transition-colors ${
                active ? "text-amber-600 font-semibold" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${active ? "stroke-[2.5]" : "stroke-2"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Callback Modal */}
      {callbackModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setCallbackModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-emerald-600" />
              Request a Callback
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Our solar engineering and support team will contact you at{" "}
              <span className="font-semibold text-slate-800">{customer?.phone}</span>.
            </p>

            {callbackSuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg text-sm text-center font-medium">
                ✓ Callback request received! We will call you soon.
              </div>
            ) : (
              <form onSubmit={handleCallbackSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Time Window
                  </label>
                  <select
                    value={callbackTime}
                    onChange={(e) => setCallbackTime(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option>Morning (9 AM - 12 PM)</option>
                    <option>Afternoon (12 PM - 3 PM)</option>
                    <option>Evening (3 PM - 7 PM)</option>
                    <option>Urgent / As soon as possible</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    What can we help you with? (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={callbackNote}
                    onChange={(e) => setCallbackNote(e.target.value)}
                    placeholder="e.g., question about inverter warranty or system upgrade"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCallbackModal(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={callbackSubmitting}
                    className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {callbackSubmitting ? "Submitting..." : "Submit Request"}
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

