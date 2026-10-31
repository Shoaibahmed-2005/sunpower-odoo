/**
 * Authentication and authorization context.
 * Owner: C (BUILD_PLAN §4, §9).
 */
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "../api/client";

const ACCESS: Record<string, string[]> = {
  DIRECTOR: ["*"],
  SALES: [
    "dashboard:read",
    "leads:read",
    "leads:write",
    "surveys:read",
    "surveys:approve",
    "quotes:read",
    "quotes:write",
    "invoices:read",
    "invoices:write",
    "packages:read",
    "stock:read",
    "jobs:read",
    "users:read",
  ],
  TECHNICIAN: ["jobs:mine", "surveys:read", "surveys:submit"],
  WAREHOUSE: [
    "dashboard:read",
    "stock:read",
    "stock:write",
    "dispatches:read",
    "dispatches:write",
    "serials:read",
    "products:read",
    "packages:read",
    "jobs:read",
  ],
  SUPPORT: [
    "dashboard:read",
    "tickets:read",
    "tickets:write",
    "serials:read",
    "jobs:read",
    "invoices:read",
    "users:read",
  ],
};

export interface User {
  id: number;
  name: string;
  loginId: string;
  role: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (loginId: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  can: (perm: string) => boolean;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => {
        const u = r.data.user;
        setUser({
          id: u.id,
          name: u.name,
          loginId: u.loginId || u.login_id,
          role: u.role,
        });
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (loginId: string, password: string): Promise<User> => {
    const r = await api.post("/auth/login", { loginId, password });
    const u = r.data.user;
    const userData: User = {
      id: u.id,
      name: u.name,
      loginId: u.loginId || u.login_id,
      role: u.role,
    };
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // ignore logout network errors
    } finally {
      setUser(null);
    }
  };

  const can = (perm: string): boolean => {
    if (!user) return false;
    const perms = ACCESS[user.role] || [];
    return perms.includes("*") || perms.includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
