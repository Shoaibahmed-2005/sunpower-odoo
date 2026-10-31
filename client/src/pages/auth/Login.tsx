/**
 * SunPower Login page with role-based redirection and demo quick-login pills.
 * Owner: C (BUILD_PLAN §4, §9).
 */
import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import Logo from "../../components/Logo";
import Button from "../../components/Button";
import { toast } from "../../components/Toast";

const landingPages: Record<string, string> = {
  DIRECTOR: "/",
  SALES: "/leads",
  TECHNICIAN: "/m",
  WAREHOUSE: "/dispatches",
  SUPPORT: "/tickets",
};

const DEMO_USERS = [
  { label: "Priya (Sales)", loginId: "priya", role: "SALES" },
  { label: "Ravi (Director)", loginId: "ravi", role: "DIRECTOR" },
  { label: "Vikram (Tech)", loginId: "vikram", role: "TECHNICIAN" },
  { label: "Deepa (Warehouse)", loginId: "deepa", role: "WAREHOUSE" },
  { label: "Farhan (Support)", loginId: "farhan", role: "SUPPORT" },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to landing page
  if (user) {
    const target = landingPages[user.role] || "/";
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId.trim() || !password) {
      toast.error("Please enter login ID and password");
      return;
    }

    setLoading(true);
    try {
      const loggedIn = await login(loginId.trim(), password);
      toast.success(`Welcome back, ${loggedIn.name}!`);
      const target = landingPages[loggedIn.role] || "/";
      navigate(target);
    } catch {
      // Error handled by api response interceptor toast
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (id: string) => {
    setLoginId(id);
    setPassword("sun123");
    setLoading(true);
    try {
      const loggedIn = await login(id, "sun123");
      toast.success(`Signed in as ${loggedIn.name}`);
      const target = landingPages[loggedIn.role] || "/";
      navigate(target);
    } catch {
      // Error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface rounded-card shadow-card border border-border p-8">
        <div className="flex flex-col items-center mb-6">
          <Logo variant="full" size="lg" />
          <h1 className="text-xl font-heading font-semibold text-text mt-4">
            Sign in to SunPower
          </h1>
          <p className="text-sm text-muted mt-1 text-center">
            Solar Installation Management System
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Login ID
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="e.g. priya, ravi, vikram"
              className="w-full px-3 py-2 border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-surface"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-border rounded-md text-text focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-surface"
            />
          </div>

          <Button
            variant="primary"
            loading={loading}
            disabled={loading}
            className="w-full justify-center mt-2"
          >
            Sign In
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border">
          <p className="text-xs font-medium text-muted uppercase tracking-wider text-center mb-3">
            Quick Demo Login (Password: sun123)
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {DEMO_USERS.map((u) => (
              <button
                key={u.loginId}
                type="button"
                onClick={() => handleQuickLogin(u.loginId)}
                className="px-2.5 py-1 text-xs bg-bg hover:bg-border/60 text-text rounded-full border border-border transition-colors font-mono"
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
