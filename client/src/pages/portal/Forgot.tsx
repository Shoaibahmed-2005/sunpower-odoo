import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { usePortal } from "../../portal/PortalContext";
import { portalService } from "../../portal/api";
import { Phone, Lock, KeyRound, ArrowRight, ArrowLeft } from "lucide-react";

export default function CustomerForgot() {
  const navigate = useNavigate();
  const { refreshCustomer } = usePortal();

  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await portalService.forgotPassword(phone);
      if (res.data.demo_code) {
        setDemoCode(res.data.demo_code);
        setCode(res.data.demo_code);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await portalService.resetPassword({
        phone,
        code,
        newPassword,
      });
      await refreshCustomer();
      navigate("/portal/home");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-3">
          <Logo size="lg" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Reset Password
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Verify your mobile number to set a new password.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
            </div>
          )}

          {demoCode && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <strong>[Demo Mode]</strong> Reset OTP:{" "}
              <span className="font-mono text-sm font-bold">{demoCode}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Registered Mobile Number
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

              <button
                type="submit"
                disabled={loading || phone.length !== 10}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {loading ? "Sending Code…" : <>Send Reset Code <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="flex justify-between items-center text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span>Code sent to: <strong>{phone}</strong></span>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-amber-600 hover:text-amber-700 font-medium"
                >
                  Change
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  6-Digit OTP Code
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono tracking-widest border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  New Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    placeholder="Min 8 chars (letters + numbers)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6 || newPassword.length < 8}
                className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {loading ? "Resetting…" : "Reset & Sign In"}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <Link
              to="/portal"
              className="text-xs text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
