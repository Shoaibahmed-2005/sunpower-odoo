import React, { ReactNode } from "react";
import PageHeader from "./PageHeader";
import StatusBar from "./StatusBar";
import Card from "./Card";
import Badge from "./Badge";

export interface SummaryField {
  label: string;
  value: ReactNode;
  isMono?: boolean;
  isBold?: boolean;
  align?: "left" | "right";
}

interface RecordPageProps {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  statusSteps?: string[];
  currentStatus?: string;
  statusBadge?: string;
  summaryFields?: SummaryField[];
  children: ReactNode;
  relatedSections?: ReactNode;
}

export default function RecordPage({
  title,
  subtitle,
  breadcrumbs,
  actions,
  statusSteps,
  currentStatus,
  statusBadge,
  summaryFields,
  children,
  relatedSections,
}: RecordPageProps) {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />

      {/* Workflow Progress Bar */}
      {statusSteps && currentStatus && (
        <StatusBar steps={statusSteps} current={currentStatus} />
      )}

      {/* Key Summary Strip */}
      {summaryFields && summaryFields.length > 0 && (
        <Card className="bg-surface/80 border-border">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60">
            {summaryFields.map((field, idx) => (
              <div key={idx} className={`pt-2 sm:pt-0 ${idx > 0 ? "sm:pl-4" : ""}`}>
                <span className="text-xs text-muted block select-none">
                  {field.label}
                </span>
                <div
                  className={`mt-1 text-sm ${
                    field.isMono ? "font-mono font-medium text-primary" : ""
                  } ${field.isBold ? "font-semibold text-text" : "text-text"} ${
                    field.align === "right" ? "text-right tabular-nums" : ""
                  }`}
                >
                  {field.value ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Main Record Body */}
      <div className="space-y-6">{children}</div>

      {/* Related Tables or Tabs */}
      {relatedSections && <div className="space-y-6 mt-8">{relatedSections}</div>}
    </div>
  );
}
