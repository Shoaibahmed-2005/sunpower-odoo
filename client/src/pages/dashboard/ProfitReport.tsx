// Owned by A — Director's profit per finished job: revenue − parts − labour − free warranty repairs.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { formatDate, formatINR } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Field from "../../components/Field";

interface ProfitRow {
  jobId: number;
  jobRef: string;
  leadName: string;
  finishedAt: string | null;
  revenue: number;
  partsCost: number;
  labourCost: number;
  repairCost: number;
  profit: number;
  marginPct: number;
}

const money = (key: keyof ProfitRow, label: string) => ({
  key,
  label,
  align: "right" as const,
  render: (r: ProfitRow) => formatINR(r[key] as number),
});

export default function ProfitReport() {
  const navigate = useNavigate();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["reports", "profit", from, to],
    queryFn: () =>
      api.get<ProfitRow[]>("/reports/profit", { params: { from: from || undefined, to: to || undefined } }).then((r) => r.data),
  });

  const totalRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0);
  const inputClass = "h-control rounded-sm border border-border bg-surface px-3 text-sm";

  return (
    <div>
      <PageHeader
        title="Profit per job"
        actions={
          // a plain link: the browser sends the login cookie and saves the file the server returns
          <a
            href={`/api/reports/profit.csv?${new URLSearchParams({ ...(from && { from }), ...(to && { to }) })}`}
            className="inline-flex items-center rounded-md h-control px-4 text-sm font-medium bg-surface text-primary border border-border hover:brightness-90"
          >
            Download CSV
          </a>
        }
      />
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <Field label="Finished from">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
        </Field>
        <Field label="to">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
        </Field>
        <div className="ml-auto flex gap-6 bg-surface border border-border rounded-card px-sp6 py-sp3">
          <div>
            <span className="text-xs text-muted">Revenue</span>
            <p className="font-heading text-lg font-semibold">{formatINR(totalRevenue)}</p>
          </div>
          <div>
            <span className="text-xs text-muted">Profit</span>
            <p className={`font-heading text-lg font-semibold ${totalProfit < 0 ? "text-danger" : "text-success"}`}>{formatINR(totalProfit)}</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-muted mb-3">
        Revenue = invoices + government subsidy. Labour = hours × (lead + crew) × hourly rate. Repairs = free warranty repairs on this job's units.
      </p>
      <DataTable<ProfitRow>
        columns={[
          { key: "jobRef", label: "Job", render: (r) => <span className="font-mono text-[13px]">{r.jobRef}</span> },
          { key: "leadName", label: "Customer" },
          { key: "finishedAt", label: "Finished", render: (r) => (r.finishedAt ? formatDate(r.finishedAt) : "—") },
          money("revenue", "Revenue"),
          money("partsCost", "Parts"),
          money("labourCost", "Labour"),
          money("repairCost", "Free repairs"),
          {
            key: "profit",
            label: "Profit",
            align: "right",
            render: (r) => <span className={`font-semibold ${r.profit < 0 ? "text-danger" : "text-success"}`}>{formatINR(r.profit)}</span>,
          },
          { key: "marginPct", label: "Margin", align: "right", render: (r) => `${r.marginPct}%` },
        ]}
        rows={rows}
        onRowClick={(r) => navigate(`/jobs/${r.jobId}`)}
        emptyMessage={isLoading ? "Loading…" : "No finished jobs in this period"}
      />
    </div>
  );
}
