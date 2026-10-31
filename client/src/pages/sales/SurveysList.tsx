// Surveys list: Sales sees every survey and filters to "Submitted" to approve them.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, qk, formatDateTime, PageHeader, DataTable, Badge, inputCls } from "./ui";
import { SurveyListItem, SurveyStatus, SURVEY_LABEL } from "./types";

export default function SurveysList() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SurveyStatus | "">("SUBMITTED");
  const [search, setSearch] = useState("");

  const { data = [], isLoading, isError } = useQuery<SurveyListItem[]>({
    queryKey: [...qk.surveys, { status }],
    queryFn: () => api.get("/surveys", { params: { status: status || undefined } }).then((r) => r.data),
  });
  const q = search.trim().toLowerCase();
  const rows = q ? data.filter((s) => `${s.ref} ${s.leadName} ${s.technicianName}`.toLowerCase().includes(q)) : data;

  const columns = [
    { key: "ref", label: "Reference", render: (r: SurveyListItem) => <span className="font-mono">{r.ref}</span> },
    { key: "leadName", label: "Customer" },
    { key: "address", label: "Address" },
    { key: "technicianName", label: "Technician" },
    { key: "visitDate", label: "Visit", render: (r: SurveyListItem) => formatDateTime(r.visitDate) },
    { key: "status", label: "Status", render: (r: SurveyListItem) => <Badge status={r.status}>{SURVEY_LABEL[r.status]}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Surveys" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-[var(--muted)]" htmlFor="survey-status">Status</label>
        <select id="survey-status" className={`${inputCls} w-auto`} value={status} onChange={(e) => setStatus(e.target.value as SurveyStatus | "")}>
          <option value="">All</option>
          {(Object.keys(SURVEY_LABEL) as SurveyStatus[]).map((s) => <option key={s} value={s}>{SURVEY_LABEL[s]}</option>)}
        </select>
      </div>
      {isError ? <p className="text-[var(--danger)]">Couldn't load surveys.</p>
        : isLoading ? <p className="text-[var(--muted)]">Loading surveys…</p>
        : <DataTable columns={columns} rows={rows} onRowClick={(r: SurveyListItem) => navigate(`/surveys/${r.id}`)}
            searchPlaceholder="Search reference, customer or technician…" onSearch={(v: string) => setSearch(v)} />}
      {!isLoading && !isError && rows.length === 0 && <p className="text-[var(--muted)]">No surveys here.</p>}
    </div>
  );
}
