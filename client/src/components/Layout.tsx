import { Outlet, Link, NavLink, Navigate, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import Logo from "./Logo";
import { ToastContainer } from "./Toast";

const menuItems = [
  { to: "/", label: "Dashboard", perm: "dashboard:read" },
  { to: "/leads", label: "Enquiries", perm: "leads:read" },
  { to: "/surveys", label: "Surveys", perm: "surveys:read" },
  { to: "/quotations", label: "Quotations", perm: "quotes:read" },
  { to: "/dispatches", label: "Dispatches", perm: "dispatches:read" },
  { to: "/jobs", label: "Jobs", perm: "jobs:read" },
  { to: "/tickets", label: "Tickets", perm: "tickets:read" },
  { to: "/m", label: "My Work", perm: "jobs:mine" },
] as const;

const landingPages: Record<string, string> = {
  DIRECTOR: "/",
  SALES: "/leads",
  TECHNICIAN: "/m",
  WAREHOUSE: "/dispatches",
  SUPPORT: "/tickets",
};

export default function Layout() {
  const { user, loading, logout, can } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const landing = landingPages[user.role] ?? "/";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="h-14 bg-primary flex items-center px-6 justify-between">
        {/* Left */}
        <Link to={landing}>
          <Logo variant="full" size="sm" />
        </Link>

        {/* Center */}
        <nav className="flex items-center gap-1">
          {menuItems
            .filter((item) => can(item.perm))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-1 text-sm ${
                    isActive
                      ? "text-white font-semibold border-b-2 border-accent"
                      : "text-primary-fg/70 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-primary-fg/90">{user.name}</span>
          <span className="text-xs bg-primary-fg/20 text-primary-fg rounded px-2 py-0.5 font-medium">
            {user.role}
          </span>
          <button
            onClick={handleLogout}
            className="text-primary-fg/70 hover:text-white"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-sp6">
        <Outlet />
      </div>

      <ToastContainer />
    </div>
  );
}
