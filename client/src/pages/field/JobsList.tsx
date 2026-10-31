import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import ListPage from "../../components/ListPage";
import Badge from "../../components/Badge";
import Card from "../../components/Card";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = searchParams.get("status") || "ALL";

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: qk.jobs,
    queryFn: () => api.get<JobRow[]>("/jobs").then((r) => r.data),
  });

  const filterChips = [
    { label: "All Jobs", value: "ALL" },
    { label: "Scheduled", value: "SCHEDULED" },
    { label: "Dispatched", value: "DISPATCHED" },
    { label: "In Progress", value: "IN_PROGRESS" },
    { label: "Done", value: "DONE" },
  ];

  const handleFilterChange = (val: string) => {
    if (val === "ALL") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", val);
    }
    setSearchParams(searchParams);
  };

  const displayedJobs = useMemo(() => {
    if (activeStatus === "ALL") return jobs;
    return jobs.filter(
      (j) => j.status?.toUpperCase() === activeStatus.toUpperCase()
    );
  }, [jobs, activeStatus]);

  return (
    <ListPage<JobRow>
      title="Installations"
      subtitle="Manage rooftop solar install orders and field crews"
      breadcrumbs={[{ label: "Field Work" }, { label: "Installations" }]}
      columns={[
        {
          key: "ref",
          label: "Reference",
          render: (r) => <span className="font-mono text-[13px]">{r.ref}</span>,
        },
        { key: "leadName", label: "Customer" },
        {
          key: "kw",
          label: "Capacity",
          align: "right",
          render: (r) => <span>{r.kw} kW</span>,
        },
        { key: "technicianName", label: "Lead Technician" },
        { key: "crew", label: "Crew Members" },
        { key: "scheduledDate", label: "Scheduled Date" },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge status={r.status} />,
        },
      ]}
      rows={displayedJobs}
      loading={isLoading}
      filterChips={filterChips}
      activeFilter={activeStatus}
      onFilterChange={handleFilterChange}
      onRowClick={(r) => navigate(`/jobs/${r.id}`)}
      emptyMessage="No installation jobs found"
      kanban={{
        groupBy: "status",
        groups: ["SCHEDULED", "DISPATCHED", "IN_PROGRESS", "DONE"],
        card: (job) => (
          <Card className="p-3.5 hover:border-primary/50 text-left bg-surface shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-mono text-xs font-semibold text-primary">
                {job.ref}
              </span>
              <Badge status={job.status} size="sm" />
            </div>
            <p className="font-heading text-sm font-semibold text-text truncate">
              {job.leadName}
            </p>
            <div className="mt-2 text-xs text-muted flex items-center justify-between">
              <span>{job.kw} kW</span>
              <span>{job.scheduledDate}</span>
            </div>
          </Card>
        ),
      }}
    />
  );
}
