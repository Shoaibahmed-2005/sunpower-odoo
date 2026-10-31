// Owned by C — placeholder stub so the shell compiles.
// C replaces with real AuthContext (user, login, logout, can(perm), loads /api/auth/me on start).
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "../api/client";

// role→permissions loaded from shared/access.json at build time isn't possible
// without the file, so we inline the map here as a fallback until B provides it.
const ACCESS: Record<string, string[]> = {
  DIRECTOR: ["*"],
  SALES: ["dashboard:read","leads:read","leads:write","surveys:read","surveys:approve",
          "quotes:read","quotes:write","invoices:read","invoices:write",
          "packages:read","stock:read","jobs:read","users:read"],
  TECHNICIAN: ["jobs:mine","surveys:read","surveys:submit"],
  WAREHOUSE: ["dashboard:read","stock:read","stock:write","dispatches:read","dispatches:write",
              "serials:read","products:read","packages:read","jobs:read"],
  SUPPORT: ["dashboard:read","tickets:read","tickets:write","serials:read","jobs:read",
            "invoices:read","users:read"],
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

const defaultDevUser: User = {
  id: 1,
  name: "Ravi Sharma",
  loginId: "ravi",
  role: "DIRECTOR",
};

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(defaultDevUser);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/auth/me")
      .then((r) => setUser(r.data.user))
      .catch(() => {
        // Keep default dev user if backend is not started
        setUser(defaultDevUser);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (loginId: string, password: string): Promise<User> => {
    const r = await api.post("/auth/login", { loginId, password });
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
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
  return useContext(AuthContext);
}
