import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate, formatDateTime } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusBar from "../../components/StatusBar";
import Badge from "../../components/Badge";

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: job, isLoading } = useQuery({
    queryKey: qk.job(Number(id)),
    queryFn: () => api.get(`/jobs/${id}`).then((r) => r.data),
  });

  if (isLoading || !job) return <p className="text-muted text-sm p-4">Loading…</p>;

  return (
    <div>
      <PageHeader title={`Job ${job.ref}`} />
      <StatusBar
        steps={["Scheduled", "Dispatched", "In Progress", "Done"]}
        current={
          { SCHEDULED: "Scheduled", DISPATCHED: "Dispatched", IN_PROGRESS: "In Progress", DONE: "Done" }[job.status] || "Scheduled"
        }
      />

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-surface border border-border rounded-card p-sp6 mb-6">
        <div>
          <span className="text-xs text-muted">Customer</span>
          <p className="font-medium">{job.leadName}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Phone</span>
          <p className="font-medium">{job.leadPhone}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Address</span>
          <p className="font-medium">{job.leadAddress}</p>
        </div>
        <div>
          <span className="text-xs text-muted">System</span>
          <p className="font-medium">{job.kw} kW {job.systemType?.replace(/_/g, " ")}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Technician</span>
          <p className="font-medium">{job.technicianName}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Crew</span>
          <p className="font-medium">{job.crew}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Scheduled Date</span>
          <p className="font-medium">{formatDate(job.scheduledDate)}</p>
        </div>
        {job.startedAt && (
          <div>
            <span className="text-xs text-muted">Started</span>
            <p className="font-medium">{formatDateTime(job.startedAt)}</p>
          </div>
        )}
        {job.finishedAt && (
          <div>
            <span className="text-xs text-muted">Finished</span>
            <p className="font-medium">{formatDateTime(job.finishedAt)}</p>
          </div>
        )}
        {job.sizeConfirmed != null && (
          <div>
            <span className="text-xs text-muted">Size Confirmed</span>
            <p className="font-medium">{job.sizeConfirmed} kW</p>
          </div>
        )}
        {job.dispatchStatus && (
          <div>
            <span className="text-xs text-muted">Dispatch</span>
            <Badge status={job.dispatchStatus} />
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="bg-surface border border-border rounded-card p-sp6 mb-6">
        <h3 className="font-heading text-base font-semibold mb-3">Materials</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs uppercase border-b border-border">
              <th className="text-left py-2">Item</th>
              <th className="text-right py-2">Qty</th>
            </tr>
          </thead>
          <tbody>
            {(job.lines || []).map((l: any, i: number) => (
              <tr key={i} className="border-b border-border">
                <td className="py-2">{l.name}</td>
                <td className="py-2 text-right">{l.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Serials with warranty */}
      {job.serials?.length > 0 && (
        <div className="bg-surface border border-border rounded-card p-sp6 mb-6">
          <h3 className="font-heading text-base font-semibold mb-3">Serial Numbers & Warranty</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase border-b border-border">
                <th className="text-left py-2">Serial</th>
                <th className="text-left py-2">Product</th>
                <th className="text-left py-2">Warranty Until</th>
              </tr>
            </thead>
            <tbody>
              {job.serials.map((s: any, i: number) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-2 font-mono text-[13px]">{s.serial}</td>
                  <td className="py-2">{s.productName}</td>
                  <td className="py-2">{s.warrantyUntil ? formatDate(s.warrantyUntil) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Photos */}
      {job.photos?.length > 0 && (
        <div className="bg-surface border border-border rounded-card p-sp6 mb-6">
          <h3 className="font-heading text-base font-semibold mb-3">Photos</h3>
          <div className="grid grid-cols-3 gap-3">
            {job.photos.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Job photo ${i + 1}`} className="rounded-md w-full h-32 object-cover" />
            ))}
          </div>
        </div>
      )}

      {/* Signature */}
      {job.hasSignature && (
        <div className="bg-surface border border-border rounded-card p-sp6">
          <h3 className="font-heading text-base font-semibold mb-3">Customer Signature</h3>
          <p className="text-sm text-success font-medium">✓ Signature captured</p>
        </div>
      )}
    </div>
  );
}
