// Survey detail (Member B): Sales reviews the technician's measurements and approves or rejects.
// Approving is what unlocks "Create quotation" on the enquiry.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api, qk, formatDateTime, toast, useAuth, PageHeader, StatusBar, Badge, Field, Button, inputCls, panelCls } from "./ui";
import { SurveyDetail as Survey, SURVEY_LABEL } from "./types";

export default function SurveyDetail() {
  const surveyId = Number(useParams().id);
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const { data: s, isLoading, isError } = useQuery<Survey>({
    queryKey: qk.survey(surveyId),
    queryFn: () => api.get(`/surveys/${surveyId}`).then((r) => r.data),
    enabled: Number.isFinite(surveyId),
  });

  const refresh = (leadId: number) => {
    queryClient.invalidateQueries({ queryKey: qk.survey(surveyId) });
    queryClient.invalidateQueries({ queryKey: qk.surveys });
    queryClient.invalidateQueries({ queryKey: qk.lead(leadId) });
    queryClient.invalidateQueries({ queryKey: qk.leads });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const approve = useMutation({
    mutationFn: () => api.post<Survey>(`/surveys/${surveyId}/approve`).then((r) => r.data),
    onSuccess: (updated) => { refresh(updated.lead.id); toast.success("Survey approved: quotation unlocked"); },
  });
  const reject = useMutation({
    mutationFn: () => api.post<Survey>(`/surveys/${surveyId}/reject`, { reason: reason.trim() }).then((r) => r.data),
    onSuccess: (updated) => { refresh(updated.lead.id); setRejecting(false); toast.success("Survey rejected: book a new visit"); },
  });

  if (isLoading) return <p className="text-[var(--muted)]">Loading survey…</p>;
  if (isError || !s) return <p className="text-[var(--danger)]">Survey not found.</p>;

  const canDecide = can("surveys:approve") && s.status === "SUBMITTED";
  const steps = ["Scheduled", "Submitted", s.status === "REJECTED" ? "Rejected" : "Approved"];

  return (
    <div className="space-y-5">
      <PageHeader title={`${s.ref} · ${s.lead.name}`} />
      <StatusBar steps={steps} current={SURVEY_LABEL[s.status]} />

      <div className="flex flex-wrap gap-2">
        <span title={canDecide ? "" : "Only a submitted survey can be approved or rejected"}>
          <Button variant="primary" disabled={!canDecide || approve.isPending} loading={approve.isPending} onClick={() => approve.mutate()}>Approve</Button>
        </span>
        <Button variant="danger" disabled={!canDecide} onClick={() => setRejecting(true)}>Reject</Button>
        <Link className="self-center underline" to={`/leads/${s.lead.id}`}>Open enquiry</Link>
      </div>

      {rejecting && (
        <section className={panelCls}>
          <Field label="Why is it rejected?" error={reasonError}>
            <input className={inputCls} maxLength={300} value={reason} placeholder="Tilt reading looks wrong, re-measure" onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" loading={reject.isPending} disabled={reject.isPending}
              onClick={() => { if (reason.trim().length < 3) setReasonError("Give a short reason"); else reject.mutate(); }}>Reject survey</Button>
            <Button variant="secondary" onClick={() => setRejecting(false)}>Cancel</Button>
          </div>
        </section>
      )}

      <section className={panelCls}>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Row label="Customer" value={`${s.lead.name} · ${s.lead.phone}`} />
          <Row label="Address" value={s.lead.address} />
          <Row label="Technician" value={s.technicianName} />
          <Row label="Visit" value={formatDateTime(s.visitDate)} />
          <Row label="Roof direction" value={s.direction ?? "—"} />
          <Row label="Tilt" value={s.tilt != null ? `${s.tilt}°` : "—"} />
          <Row label="Cable distance" value={s.cableDistance != null ? `${s.cableDistance} m` : "—"} />
          <Row label="Shadow-free area" value={s.area != null ? `${s.area} m²` : "—"} />
          <Row label="Status" value={<Badge status={s.status}>{SURVEY_LABEL[s.status]}</Badge>} />
          {s.rejectReason && <Row label="Reject reason" value={s.rejectReason} />}
        </dl>
      </section>

      <section className={panelCls}>
        <h2 className="mb-3 font-semibold">Roof photos</h2>
        {s.photos.length === 0 ? <p className="text-[var(--muted)]">No photos.</p> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {s.photos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt="Roof survey photo" className="h-32 w-full rounded-[var(--radius)] object-cover" />
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-[var(--border)] py-1">
      <dt className="w-36 shrink-0 text-sm text-[var(--muted)]">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
