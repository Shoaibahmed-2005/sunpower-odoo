import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { usePortal } from "../../portal/PortalContext";
import { portalService } from "../../portal/api";
import { Lock, Phone, ArrowRight, ShieldCheck, UserPlus } from "lucide-react";

export default function CustomerLogin() {
  const navigate = useNavigate();
  const { login } = usePortal();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await portalService.login({ phone, password });
      login(res.data.account);
      navigate("/portal/home");
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Invalid phone number or password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (p: string) => {
    setPhone(p);
    setPassword("sun123");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-3">
          <Logo size="lg" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Customer Portal
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Access your solar equipment, warranty, quotations, and service requests.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Mobile Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="tel"
                  required
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  to="/portal/forgot"
                  className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length !== 10 || !password}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                "Signing In…"
              ) : (
                <>
                  Sign In to Portal <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* New Customer / Sign Up */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2">
            <Link
              to="/portal/signup"
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              New customer? Register with OTP
            </Link>
          </div>

          {/* Demo Logins Box */}
          <div className="mt-6 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Demo Customer Logins (Pass: sun123)
            </p>
            <div className="flex flex-col gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => fillDemo("9822000010")}
                className="text-left px-2 py-1.5 rounded hover:bg-white border border-transparent hover:border-slate-200 text-slate-700 flex justify-between"
              >
                <span>Ramesh Kulkarni (Off-grid, delivered)</span>
                <span className="font-mono text-slate-500">9822000010</span>
              </button>
              <button
                type="button"
                onClick={() => fillDemo("9822000005")}
                className="text-left px-2 py-1.5 rounded hover:bg-white border border-transparent hover:border-slate-200 text-slate-700 flex justify-between"
              >
                <span>Neha Gupta (Sent quote, pay advance)</span>
                <span className="font-mono text-slate-500">9822000005</span>
              </button>
            </div>
          </div>

          {/* Staff Login Link */}
          <div className="mt-4 text-center">
            <Link
              to="/login"
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Are you a SunPower employee? Staff Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

