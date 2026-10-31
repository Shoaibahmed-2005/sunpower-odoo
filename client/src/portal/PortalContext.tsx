import React, { createContext, useContext, useEffect, useState } from "react";
import { CustomerAccountInfo, portalService } from "./api";

interface PortalContextType {
  customer: CustomerAccountInfo | null;
  isLoading: boolean;
  login: (account: CustomerAccountInfo) => void;
  logout: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
}

const PortalContext = createContext<PortalContextType | undefined>(undefined);

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerAccountInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCustomer = async () => {
    try {
      const res = await portalService.me();
      setCustomer(res.data.account);
    } catch {
      setCustomer(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshCustomer();
  }, []);

  const login = (account: CustomerAccountInfo) => {
    setCustomer(account);
  };

  const logout = async () => {
    try {
      await portalService.logout();
    } catch {
      // ignore
    } finally {
      setCustomer(null);
      window.location.href = "/portal";
    }
  };

  return (
    <PortalContext.Provider
      value={{
        customer,
        isLoading,
        login,
        logout,
        refreshCustomer,
      }}
    >
      {children}
    </PortalContext.Provider>
  );
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error("usePortal must be used within a PortalProvider");
  }
  return ctx;
}

