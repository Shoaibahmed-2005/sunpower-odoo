// Enquiries list: search by ref / name / phone, filter by stage, click a row to open it.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, qk, formatDate, useAuth, PageHeader, DataTable, Badge, Button, inputCls } from "./ui";
import { LeadListItem, LeadStage, STAGES, STAGE_LABEL, SOURCE_LABEL, SYSTEM_LABEL } from "./types";

export default function LeadsList() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<LeadStage | "">("");

  // the filters are part of the key, so each search is cached separately; invalidating qk.leads refreshes all
  const { data = [], isLoading, isError } = useQuery<LeadListItem[]>({
    queryKey: [...qk.leads, { search, stage }],
    queryFn: () => api.get("/leads", { params: { search: search || undefined, stage: stage || undefined } }).then((r) => r.data),
  });

  const columns = [
    { key: "ref", label: "Reference", render: (r: LeadListItem) => <span className="font-mono">{r.ref}</span> },
    { key: "name", label: "Customer" },
    { key: "phone", label: "Phone", render: (r: LeadListItem) => <span className="font-mono">{r.phone}</span> },
    { key: "source", label: "Source", render: (r: LeadListItem) => SOURCE_LABEL[r.source] },
    { key: "kw", label: "Needs", render: (r: LeadListItem) => `${r.kw} kW ${SYSTEM_LABEL[r.systemType]}` },
    { key: "stage", label: "Stage", render: (r: LeadListItem) => <Badge status={r.stage}>{STAGE_LABEL[r.stage]}</Badge> },
    { key: "salespersonName", label: "Salesperson", render: (r: LeadListItem) => r.salespersonName ?? "—" },
    { key: "createdAt", label: "Received", render: (r: LeadListItem) => formatDate(r.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Enquiries"
        actions={can("leads:write") ? <Button variant="primary" onClick={() => navigate("/leads/new")}>New</Button> : null}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-[var(--muted)]" htmlFor="stage-filter">Stage</label>
        <select id="stage-filter" className={`${inputCls} w-auto`} value={stage} onChange={(e) => setStage(e.target.value as LeadStage | "")}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </div>
      {isError ? (
        <p className="text-[var(--danger)]">Couldn't load enquiries. Check the server and try again.</p>
      ) : isLoading ? (
        <p className="text-[var(--muted)]">Loading enquiries…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={data}
          onRowClick={(row: LeadListItem) => navigate(`/leads/${row.id}`)}
          searchPlaceholder="Search reference, name or phone…"
          onSearch={(q: string) => setSearch(q)}
        />
      )}
      {!isLoading && !isError && data.length === 0 && (
        <p className="text-[var(--muted)]">No enquiries match. New ones from the web form appear here automatically.</p>
      )}
    </div>
  );
}
