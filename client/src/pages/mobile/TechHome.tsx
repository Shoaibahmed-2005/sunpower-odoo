import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import PhoneLayout from "../../components/PhoneLayout";
import Badge from "../../components/Badge";
import { Wrench, ClipboardList } from "lucide-react";

interface JobRow {
  id: number;
  ref: string;
  leadName: string;
  kw: number;
  scheduledDate: string;
  status: string;
}

export default function TechHome() {
  const navigate = useNavigate();

  const { data: jobs = [] } = useQuery({
    queryKey: qk.myJobs,
    queryFn: () => api.get<JobRow[]>("/jobs/mine").then((r) => r.data),
    refetchInterval: 5000,
  });

  const { data: surveys = [] } = useQuery({
    queryKey: qk.surveys,
    queryFn: () => api.get("/surveys").then((r) => r.data),
    refetchInterval: 5000,
  });

  const activeJobs = jobs.filter((j) => j.status !== "DONE");
  const doneJobs = jobs.filter((j) => j.status === "DONE");

  return (
    <PhoneLayout title="My Work">
      {/* Active Jobs */}
      <div className="mb-6">
        <h2 className="font-heading text-lg font-semibold mb-3 flex items-center gap-2">
          <Wrench className="w-5 h-5" /> Jobs
        </h2>
        {activeJobs.length === 0 && (
          <p className="text-muted text-sm">No active jobs today</p>
        )}
        {activeJobs.map((j) => (
          <button
            key={j.id}
            onClick={() => navigate(`/m/jobs/${j.id}`)}
            className="w-full text-left bg-surface border border-border rounded-card p-4 mb-3 hover:shadow-card"
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-[13px] font-medium">{j.ref}</span>
                <p className="text-base font-medium mt-1">{j.leadName}</p>
                <p className="text-sm text-muted">{j.kw} kW · {j.scheduledDate}</p>
              </div>
              <Badge status={j.status} />
            </div>
          </button>
        ))}
      </div>

      {/* My Surveys */}
      {surveys.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-lg font-semibold mb-3 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> Surveys
          </h2>
          {surveys.map((s: any) => (
            <button
              key={s.id}
              onClick={() => navigate(`/m/surveys/${s.id}`)}
              className="w-full text-left bg-surface border border-border rounded-card p-4 mb-3 hover:shadow-card"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-[13px] font-medium">{s.ref}</span>
                  <p className="text-base font-medium mt-1">{s.leadName}</p>
                  <p className="text-sm text-muted">{s.address}</p>
                </div>
                <Badge status={s.status} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Completed Jobs */}
      {doneJobs.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-semibold mb-3 text-muted">Completed</h2>
          {doneJobs.map((j) => (
            <button
              key={j.id}
              onClick={() => navigate(`/m/jobs/${j.id}`)}
              className="w-full text-left bg-surface border border-border rounded-card p-4 mb-3 opacity-60"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-[13px]">{j.ref}</span>
                  <p className="text-sm mt-1">{j.leadName} · {j.kw} kW</p>
                </div>
                <Badge status={j.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </PhoneLayout>
  );
}
