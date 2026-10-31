import React from "react";
import { Navigate } from "react-router-dom";
import { usePortal } from "./PortalContext";

export default function PortalGuard({ children }: { children: React.ReactNode }) {
  const { customer, isLoading } = usePortal();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-600">Loading Customer Portal…</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}
