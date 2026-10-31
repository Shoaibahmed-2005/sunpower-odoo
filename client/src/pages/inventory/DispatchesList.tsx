// Owned by A — dispatch list with status filter and a kanban board view.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";

export interface DispatchRow {
  id: number;
  ref: string;
  jobRef: string;
  leadName: string;
  status: string;
  scheduledDate: string;
  scannedCount: number;
  requiredCount: number;
}

const STATUSES = ["READY", "DONE", "CANCELLED"];

export default function DispatchesList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const { data: dispatches = [], isLoading } = useQuery({
    queryKey: [...qk.dispatches, status],
    queryFn: () => api.get<DispatchRow[]>("/dispatches", { params: { status: status || undefined } }).then((r) => r.data),
    refetchInterval: 5000,
  });

  return (
    <div>
      <PageHeader
        title="Dispatches"
        actions={
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-control rounded-sm border border-border bg-surface px-3 text-sm"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        }
      />
      {isLoading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <DataTable<DispatchRow>
          columns={[
            { key: "ref", label: "Reference", render: (r) => <span className="font-mono text-[13px]">{r.ref}</span> },
            { key: "jobRef", label: "Job", render: (r) => <span className="font-mono text-[13px]">{r.jobRef}</span> },
            { key: "leadName", label: "Customer" },
            { key: "scheduledDate", label: "Install date", render: (r) => formatDate(r.scheduledDate) },
            { key: "scanned", label: "Scanned", align: "right", render: (r) => `${r.scannedCount}/${r.requiredCount}` },
            { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          ]}
          rows={dispatches}
          onRowClick={(r) => navigate(`/dispatches/${r.id}`)}
          emptyMessage="No dispatches yet. Confirming a quotation creates one."
          kanban={{
            groupBy: "status",
            groups: STATUSES,
            card: (r) => (
              <div>
                <span className="font-mono text-[13px]">{r.ref}</span>
                <p className="font-medium">{r.leadName}</p>
                <p className="text-xs text-muted">Scanned {r.scannedCount}/{r.requiredCount}</p>
              </div>
            ),
          }}
        />
      )}
    </div>
  );
}
