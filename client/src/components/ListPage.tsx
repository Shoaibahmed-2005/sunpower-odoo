import React, { ReactNode } from "react";
import PageHeader from "./PageHeader";
import DataTable, { DataTableProps } from "./DataTable";

interface ListPageProps<T extends object> extends DataTableProps<T> {
  title: string;
  subtitle?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: ReactNode;
  summaryStats?: ReactNode;
}

export default function ListPage<T extends object>({
  title,
  subtitle,
  breadcrumbs,
  actions,
  summaryStats,
  ...tableProps
}: ListPageProps<T>) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        actions={actions}
      />
      {summaryStats && <div className="mb-4">{summaryStats}</div>}
      <DataTable<T> {...tableProps} />
    </div>
  );
}
