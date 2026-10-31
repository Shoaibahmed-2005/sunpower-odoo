import React, { useState, useEffect, useRef } from "react";
import { Outlet, Link, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronDown, User as UserIcon, Shield, Wrench } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import Logo from "./Logo";
import { ToastContainer } from "./Toast";

interface SubMenuItem {
  to: string;
  label: string;
  perm: string;
}

interface MenuDropdown {
  title: string;
  items: SubMenuItem[];
}

const MENU_GROUPS: MenuDropdown[] = [
  {
    title: "Sales",
    items: [
      { to: "/leads", label: "Enquiries", perm: "leads:read" },
      { to: "/surveys", label: "Surveys", perm: "surveys:read" },
      { to: "/quotations", label: "Quotations", perm: "quotes:read" },
    ],
  },
  {
    title: "Inventory",
    items: [
      { to: "/dispatches", label: "Dispatches", perm: "dispatches:read" },
      { to: "/stock", label: "Stock", perm: "stock:read" },
      { to: "/serials", label: "Serials", perm: "serials:read" },
    ],
  },
  {
    title: "Field Work",
    items: [
      { to: "/jobs", label: "Jobs", perm: "jobs:read" },
    ],
  },
  {
    title: "Service",
    items: [
      { to: "/tickets", label: "Tickets", perm: "tickets:read" },
    ],
  },
  {
    title: "Accounts",
    items: [
      { to: "/invoices", label: "Invoices", perm: "invoices:read" },
    ],
  },
  {
    title: "Settings",
    items: [
      { to: "/admin/users", label: "Users & Roles", perm: "users:write" },
    ],
  },
];

const landingPages: Record<string, string> = {
  ADMIN: "/",
  SALES: "/leads",
  TECHNICIAN: "/m",
  WAREHOUSE: "/dispatches",
  SUPPORT: "/tickets",
};

export default function Layout() {
  const { user, loading, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or navigation
  useEffect(() => {
    setOpenDropdown(null);
    setUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-muted font-medium">Loading Kiran…</p>
        </div>
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

  // User initials for avatar button
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  // Filter groups where user has permission to at least one child item
  const visibleGroups = MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(item.perm)),
  })).filter((group) => group.items.length > 0);

  // "My Work" is ONLY shown to TECHNICIAN role (even though Admin has "*")
  const isTechnician = user.role === "TECHNICIAN";

  return (
    <div className="min-h-screen bg-bg flex flex-col w-full overflow-x-hidden">
      {/* Top Bar on Panel Blue (#13315C) */}
      <header className="h-14 bg-primary text-white sticky top-0 z-40 shadow-sm shrink-0 w-full">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Left: Brand Logo */}
          <div className="flex items-center gap-6 shrink-0">
            <Link to={landing} className="flex items-center select-none" title="Kiran Solar">
              <Logo variant="full" size="sm" />
            </Link>
          </div>

          {/* Center: Nav links grouped into dropdowns */}
          <nav
            ref={navRef}
            className="flex items-center gap-1 sm:gap-2 flex-1 justify-center max-w-2xl min-w-0"
          >
            {/* Dashboard Link for roles with dashboard:read (not technician) */}
            {can("dashboard:read") && !isTechnician && (
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors relative select-none ${
                    isActive
                      ? "text-white font-semibold after:content-[''] after:absolute after:bottom-[-9px] after:left-3 after:right-3 after:h-0.5 after:bg-accent after:rounded-full"
                      : "text-white/75 hover:text-white"
                  }`
                }
              >
                Dashboard
              </NavLink>
            )}

            {/* Dropdown Groups */}
            {!isTechnician &&
              visibleGroups.map((group) => {
                const isGroupActive = group.items.some(
                  (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
                );
                const isOpen = openDropdown === group.title;

                return (
                  <div key={group.title} className="relative">
                    <button
                      type="button"
                      onClick={() => setOpenDropdown(isOpen ? null : group.title)}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors rounded-sm select-none relative ${
                        isGroupActive
                          ? "text-white font-semibold after:content-[''] after:absolute after:bottom-[-9px] after:left-3 after:right-3 after:h-0.5 after:bg-accent after:rounded-full"
                          : "text-white/75 hover:text-white"
                      }`}
                    >
                      <span>{group.title}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                      <div className="absolute left-0 mt-2.5 w-48 bg-surface rounded-md shadow-pop border border-border py-1 z-50 text-text animate-in fade-in-50 zoom-in-95 duration-100">
                        {group.items.map((item) => (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                              `block px-4 py-2 text-xs md:text-sm transition-colors whitespace-nowrap ${
                                isActive
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-text hover:bg-surface-2"
                              }`
                            }
                          >
                            {item.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* "My Work" — strictly visible to TECHNICIAN role only */}
            {isTechnician && (
              <NavLink
                to="/m"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors relative select-none ${
                    isActive
                      ? "text-white font-semibold after:content-[''] after:absolute after:bottom-[-9px] after:left-3 after:right-3 after:h-0.5 after:bg-accent after:rounded-full"
                      : "text-white/75 hover:text-white"
                  }`
                }
              >
                <Wrench className="w-4 h-4" />
                <span>My Work</span>
              </NavLink>
            )}
          </nav>

          {/* Right: User Avatar Menu Button */}
          <div ref={userMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 p-1 pl-2 rounded-full hover:bg-white/10 transition-colors select-none group"
              title={`${user.name} (${user.role})`}
            >
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-xs font-heading font-semibold shadow-xs">
                {initials}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-white/75 group-hover:text-white transition-transform ${
                  userMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* User Profile & Logout Popover */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface rounded-md shadow-pop border border-border py-2 z-50 text-text">
                <div className="px-4 py-2.5 border-b border-border/80">
                  <p className="text-sm font-semibold text-text truncate">
                    {user.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Shield className="w-3 h-3 text-muted" />
                    <span className="text-xs font-medium text-muted uppercase tracking-wider">
                      {user.role}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 flex items-center gap-2.5 font-medium transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8">
        <Outlet />
      </main>

      {/* Toast Notification Mount */}
      <ToastContainer />
    </div>
  );
}
