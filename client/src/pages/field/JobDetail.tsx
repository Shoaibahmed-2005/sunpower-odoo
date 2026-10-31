import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate, formatDateTime } from "../../lib/format";
import RecordPage from "../../components/RecordPage";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import { FormSection } from "../../components/Field";
import { Wrench, CheckCircle2, User, Calendar, MapPin, Box } from "lucide-react";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: job, isLoading } = useQuery({
    queryKey: qk.job(Number(id)),
    queryFn: () => api.get(`/jobs/${id}`).then((r) => r.data),
  });

  if (isLoading || !job) {
    return (
      <div className="py-16 text-center text-muted">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading job record…</p>
      </div>
    );
  }

  const statusSteps = ["Scheduled", "Dispatched", "In Progress", "Done"];
  const currentStepMap: Record<string, string> = {
    SCHEDULED: "Scheduled",
    DISPATCHED: "Dispatched",
    IN_PROGRESS: "In Progress",
    DONE: "Done",
  };

  const summaryFields = [
    { label: "Job Ref", value: job.ref, isMono: true },
    {
      label: "Status",
      value: <Badge status={job.status} />,
    },
    {
      label: "System Capacity",
      value: `${job.kw} kW (${job.systemType?.replace(/_/g, " ")})`,
      isBold: true,
    },
    {
      label: "Scheduled Date",
      value: formatDate(job.scheduledDate),
    },
    {
      label: "Dispatch Status",
      value: job.dispatchStatus ? <Badge status={job.dispatchStatus} size="sm" /> : "—",
    },
    {
      label: "Confirmed Size",
      value: job.sizeConfirmed ? `${job.sizeConfirmed} kW` : "Pending",
      align: "right" as const,
    },
  ];

  return (
    <RecordPage
      title={`Installation Job ${job.ref}`}
      subtitle={`Customer: ${job.leadName}`}
      breadcrumbs={[
        { label: "Field Work", href: "/jobs" },
        { label: job.ref },
      ]}
      actions={
        <Button variant="secondary" onClick={() => navigate("/jobs")}>
          Back to Jobs
        </Button>
      }
      statusSteps={statusSteps}
      currentStatus={currentStepMap[job.status] || "Scheduled"}
      summaryFields={summaryFields}
    >
      {/* Site & Assignment Info */}
      <Card title="Customer & Site Information" icon={MapPin}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormSection title="Customer Contact" columns={1}>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-muted block">Full Name</span>
                <span className="font-semibold text-text">{job.leadName}</span>
              </div>
              <div>
                <span className="text-xs text-muted block">Phone</span>
                <span className="font-mono text-text">{job.leadPhone}</span>
              </div>
              <div>
                <span className="text-xs text-muted block">Installation Address</span>
                <span className="text-text">{job.leadAddress}</span>
              </div>
            </div>
          </FormSection>

          <FormSection title="Crew & Schedule" columns={1}>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-xs text-muted block">Lead Technician</span>
                <span className="font-semibold text-text">{job.technicianName}</span>
              </div>
              <div>
                <span className="text-xs text-muted block">Crew</span>
                <span className="text-text">{job.crew || "—"}</span>
              </div>
              <div>
                <span className="text-xs text-muted block">Installation Execution</span>
                <span className="text-text">
                  {job.startedAt ? `Started ${formatDateTime(job.startedAt)}` : "Not started yet"}
                  {job.finishedAt ? ` • Finished ${formatDateTime(job.finishedAt)}` : ""}
                </span>
              </div>
            </div>
          </FormSection>
        </div>
      </Card>

      {/* Bill of Materials */}
      <Card title="Required Materials & Lines" icon={Box}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-muted text-xs uppercase font-semibold bg-surface-2/50">
                <th className="py-2.5 px-3">Product Item</th>
                <th className="py-2.5 px-3 text-right">Required Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {(job.lines || []).map((line: any, i: number) => (
                <tr key={i} className="hover:bg-surface-2/30">
                  <td className="py-2.5 px-3 font-medium text-text">{line.name}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold">{line.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Serials & Warranties */}
      {job.serials && job.serials.length > 0 && (
        <Card title="Delivered Serials & Warranty Dates" icon={Wrench}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border text-muted text-xs uppercase font-semibold bg-surface-2/50">
                  <th className="py-2.5 px-3">Serial Number</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Warranty Active Until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {job.serials.map((s: any, idx: number) => (
                  <tr key={idx} className="hover:bg-surface-2/30">
                    <td className="py-2.5 px-3 font-mono text-primary font-medium text-[13px]">
                      {s.serial}
                    </td>
                    <td className="py-2.5 px-3 text-text">{s.productName}</td>
                    <td className="py-2.5 px-3 text-text">
                      {s.warrantyUntil ? formatDate(s.warrantyUntil) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Installation Photos & Customer Signoff */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Installation Photos">
          {job.photos && job.photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {job.photos.map((url: string, i: number) => (
                <img
                  key={i}
                  src={url}
                  alt={`Installation Proof ${i + 1}`}
                  className="rounded-md w-full h-28 object-cover border border-border shadow-xs hover:opacity-90"
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted py-4 text-center">
              No photos uploaded by technician yet.
            </p>
          )}
        </Card>

        <Card title="Customer Sign-off & Verification">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-md bg-surface-2/60 border border-border">
              <span className="text-sm text-muted">Customer Signature</span>
              {job.hasSignature ? (
                <span className="inline-flex items-center gap-1.5 text-success font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4" /> Captured On-site
                </span>
              ) : (
                <span className="text-muted text-xs italic">Awaiting Signature</span>
              )}
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-surface-2/60 border border-border">
              <span className="text-sm text-muted">Installed System Size</span>
              <span className="text-sm font-semibold text-text">
                {job.sizeConfirmed ? `${job.sizeConfirmed} kW` : "Awaiting Confirmation"}
              </span>
            </div>
          </div>
        </Card>
      </div>
    </RecordPage>
  );
}
