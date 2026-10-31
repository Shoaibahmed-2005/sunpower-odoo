import React, { ReactNode } from "react";
import PageHeader from "./PageHeader";

interface DashboardPageProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  kpiCards?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function DashboardPage({
  title,
  subtitle,
  actions,
  kpiCards,
  children,
  className = "",
}: DashboardPageProps) {
  return (
    <div className={`space-y-6 ${className}`}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={actions}
      />

      {/* Primary KPI Row */}
      {kpiCards && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards}
        </div>
      )}

      {/* Main Grid Content */}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
