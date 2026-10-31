import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";

interface JobRow {
  id: number;
  ref: string;
  leadName: string;
  kw: number;
  technicianName: string;
  crew: string;
  scheduledDate: string;
  status: string;
}

export default function JobsList() {
  const navigate = useNavigate();
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: qk.jobs,
    queryFn: () => api.get<JobRow[]>("/jobs").then((r) => r.data),
  });

  return (
    <div>
      <PageHeader title="Installations" />
      {isLoading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <DataTable<JobRow>
          columns={[
            { key: "ref", label: "Reference", render: (r) => <span className="font-mono text-[13px]">{r.ref}</span> },
            { key: "leadName", label: "Customer" },
            { key: "kw", label: "kW", align: "right" },
            { key: "technicianName", label: "Technician" },
            { key: "crew", label: "Crew" },
            { key: "scheduledDate", label: "Date" },
            { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          ]}
          rows={jobs}
          onRowClick={(r) => navigate(`/jobs/${r.id}`)}
          emptyMessage="No installations yet"
        />
      )}
    </div>
  );
}
