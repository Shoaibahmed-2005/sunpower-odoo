import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import PhonePage from "../../components/PhonePage";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import { Wrench, ClipboardList, CheckCircle2, MapPin, Clock, LifeBuoy } from "lucide-react";

interface ServiceVisit {
  id: number;
  ref: string;
  leadName: string;
  leadAddress: string | null;
  issue: string;
  underWarranty: boolean;
  status: string;
}

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

  // service visits Support assigned to me (only my own; filtered on the server)
  const { data: visits = [] } = useQuery({
    queryKey: qk.myTickets,
    queryFn: () => api.get<ServiceVisit[]>("/tickets/mine").then((r) => r.data),
    refetchInterval: 5000,
  });
  const openVisits = visits.filter((v) => v.status === "ASSIGNED" || v.status === "IN_REPAIR");

  const activeJobs = jobs.filter((j) => j.status !== "DONE");
  const doneJobs = jobs.filter((j) => j.status === "DONE");

  return (
    <PhonePage
      title="My Work"
      subtitle="Today's Field Tasks"
    >
      {/* Active Installations Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-heading text-base font-bold text-text flex items-center gap-2">
            <Wrench className="w-4 h-4 text-primary" />
            <span>Assigned Installations</span>
          </h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {activeJobs.length} Active
          </span>
        </div>

        {activeJobs.length === 0 ? (
          <Card className="text-center py-6 text-muted">
            <p className="text-sm font-medium">No pending installation jobs today.</p>
          </Card>
        ) : (
          activeJobs.map((j) => (
            <Card
              key={j.id}
              onClick={() => navigate(`/m/jobs/${j.id}`)}
              className="p-4 hover:border-primary/50 text-left bg-surface shadow-xs active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-primary">
                  {j.ref}
                </span>
                <Badge status={j.status} size="sm" />
              </div>
              <h3 className="font-heading text-base font-bold text-text truncate">
                {j.leadName}
              </h3>
              <div className="mt-2 text-xs text-muted flex items-center justify-between border-t border-border/60 pt-2">
                <span className="font-semibold text-text">{j.kw} kW System</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {j.scheduledDate}
                </span>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Service Visits Section */}
      {openVisits.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-heading text-base font-bold text-text flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-primary" />
              <span>Service Visits</span>
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning">
              {openVisits.length} Open
            </span>
          </div>
          {openVisits.map((v) => (
            <Card
              key={v.id}
              onClick={() => navigate(`/m/tickets/${v.id}`)}
              className="p-4 hover:border-primary/50 text-left bg-surface shadow-xs active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-primary">{v.ref}</span>
                <Badge status={v.status} size="sm" />
              </div>
              <h3 className="font-heading text-base font-bold text-text truncate">{v.leadName}</h3>
              <p className="text-xs text-muted mt-1 truncate">{v.issue}</p>
              {v.leadAddress && (
                <p className="text-xs text-muted mt-1 flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {v.leadAddress}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Surveys Section */}
      {surveys.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-heading text-base font-bold text-text flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              <span>Assigned Site Surveys</span>
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-border text-muted">
              {surveys.length} Total
            </span>
          </div>

          {surveys.map((s: any) => (
            <Card
              key={s.id}
              onClick={() => navigate(`/m/surveys/${s.id}`)}
              className="p-4 hover:border-primary/50 text-left bg-surface shadow-xs active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-sm font-bold text-primary">
                  {s.ref}
                </span>
                <Badge status={s.status} size="sm" />
              </div>
              <h3 className="font-heading text-base font-bold text-text truncate">
                {s.leadName}
              </h3>
              <p className="text-xs text-muted mt-1 flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                {s.address}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Completed Jobs History */}
      {doneJobs.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border/80">
          <h2 className="font-heading text-xs font-semibold uppercase text-muted tracking-wider px-1">
            Completed Today ({doneJobs.length})
          </h2>
          {doneJobs.map((j) => (
            <Card
              key={j.id}
              onClick={() => navigate(`/m/jobs/${j.id}`)}
              className="p-3 bg-surface/70 border-border/60 opacity-80"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs font-medium text-muted block">
                    {j.ref}
                  </span>
                  <span className="text-sm font-semibold text-text">
                    {j.leadName} • {j.kw} kW
                  </span>
                </div>
                <Badge status={j.status} size="sm" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </PhonePage>
  );
}
