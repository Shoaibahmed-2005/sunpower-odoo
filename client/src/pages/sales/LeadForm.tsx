// Enquiry form: stage bar, qualifying call, schedule survey, the quote gate, mark lost.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, qk, formatDate, formatDateTime, formatINR, toast, useAuth, PageHeader, StatusBar, Badge, Field, Button, inputCls, panelCls } from "./ui";
import { LeadDetail, LeadStage, PackageItem, UserItem, STAGE_LABEL, SOURCE_LABEL, SYSTEM_LABEL, SURVEY_LABEL } from "./types";

type Panel = null | "call" | "survey" | "quote" | "lost";

export default function LeadForm() {
  const { id } = useParams();
  const leadId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState("");

  const { data: lead, isLoading, isError } = useQuery<LeadDetail>({
    queryKey: qk.lead(leadId),
    queryFn: () => api.get(`/leads/${leadId}`).then((r) => r.data),
    enabled: Number.isFinite(leadId),
  });

  // after any change: refresh this enquiry, the list and the dashboard counts
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: qk.lead(leadId) });
    queryClient.invalidateQueries({ queryKey: qk.leads });
    queryClient.invalidateQueries({ queryKey: qk.surveys });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };
  const done = (message: string) => { refresh(); setPanel(null); setError(""); toast.success(message); };

  if (isLoading) return <p className="text-[var(--muted)]">Loading enquiry…</p>;
  if (isError || !lead) return <p className="text-[var(--danger)]">Enquiry not found.</p>;

  const steps = ["NEW", "CONTACTED", "QUALIFIED", "SURVEY_SCHEDULED", "SURVEY_APPROVED", "QUOTED", lead.stage === "LOST" ? "LOST" : "WON"] as LeadStage[];
  const canWrite = can("leads:write");
  const closed = lead.stage === "WON" || lead.stage === "LOST";
  const quoteReason = lead.canQuote ? "" : "Locked until the roof survey is approved";

  return (
    <div className="space-y-5">
      <PageHeader title={`${lead.ref} · ${lead.name}`} />
      <StatusBar steps={steps.map((s) => STAGE_LABEL[s])} current={STAGE_LABEL[lead.stage]} />

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={!["NEW", "CONTACTED"].includes(lead.stage)} onClick={() => setPanel("call")}>Log call</Button>
          <Button variant="secondary" disabled={lead.stage !== "QUALIFIED"} onClick={() => setPanel("survey")}>Schedule survey</Button>
          {/* the server enforces the same gate (409 "Survey not approved yet"); the tooltip says why it's disabled */}
          <span title={quoteReason}>
            <Button variant="primary" disabled={!lead.canQuote || !can("quotes:write")} onClick={() => setPanel("quote")}>Create quotation</Button>
          </span>
          <Button variant="danger" disabled={closed} onClick={() => setPanel("lost")}>Mark lost</Button>
        </div>
      )}
      {!lead.canQuote && !closed && lead.stage !== "QUOTED" && (
        <p className="text-sm text-[var(--warning)]">Create quotation unlocks after a technician submits the roof survey and Sales approves it.</p>
      )}
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {panel === "call" && <CallPanel lead={lead} onDone={done} onCancel={() => setPanel(null)} />}
      {panel === "survey" && <SurveyPanel lead={lead} onDone={done} onCancel={() => setPanel(null)} />}
      {panel === "quote" && <QuotePanel lead={lead} onCancel={() => setPanel(null)}
        onCreated={(quoteId) => { refresh(); toast.success("Quotation created from the package"); navigate(`/quotations/${quoteId}`); }} />}
      {panel === "lost" && <LostPanel lead={lead} onDone={done} onCancel={() => setPanel(null)} />}

      <section className={panelCls}>
        <h2 className="mb-3 font-semibold">Customer</h2>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Item label="Phone" value={<span className="font-mono">{lead.phone}</span>} />
          <Item label="Address" value={lead.address} />
          <Item label="Source" value={SOURCE_LABEL[lead.source]} />
          <Item label="Needs" value={`${lead.kw} kW ${SYSTEM_LABEL[lead.systemType]}`} />
          <Item label="Monthly bill" value={formatINR(lead.monthlyBill)} />
          <Item label="Subsidy interest" value={lead.subsidyInterest ? "Yes" : "No"} />
          <Item label="Salesperson" value={lead.salespersonName ?? "—"} />
          <Item label="Received" value={formatDate(lead.createdAt)} />
        </dl>
      </section>

      <section className={panelCls}>
        <h2 className="mb-3 font-semibold">Qualifying call</h2>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Item label="Shadow-free roof" value={lead.roofArea != null ? `${lead.roofArea} m² (needs about ${lead.kw * 10} m²)` : "—"} />
          <Item label="Grid connection OK" value={lead.gridOk == null ? "—" : lead.gridOk ? "Yes" : "No"} />
          <Item label="Notes" value={lead.callNotes ?? "—"} />
          {lead.lostReason && <Item label="Lost reason" value={lead.lostReason} />}
        </dl>
      </section>

      <section className={panelCls}>
        <h2 className="mb-3 font-semibold">Surveys and quotations</h2>
        {lead.surveys.length === 0 && lead.quotations.length === 0 && <p className="text-[var(--muted)]">None yet.</p>}
        <ul className="space-y-2">
          {lead.surveys.map((s) => (
            <li key={`s${s.id}`} className="flex flex-wrap items-center gap-3">
              <Link className="font-mono underline" to={`/surveys/${s.id}`}>{s.ref}</Link>
              <Badge status={s.status}>{SURVEY_LABEL[s.status]}</Badge>
              <span className="text-[var(--muted)]">{s.technicianName} · {formatDateTime(s.visitDate)}</span>
            </li>
          ))}
          {lead.quotations.map((q) => (
            <li key={`q${q.id}`} className="flex flex-wrap items-center gap-3">
              <Link className="font-mono underline" to={`/quotations/${q.id}`}>{q.ref}</Link>
              <Badge status={q.status}>{q.status}</Badge>
              <span className="text-[var(--muted)]">{formatINR(q.total)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-[var(--border)] py-1">
      <dt className="w-40 shrink-0 text-sm text-[var(--muted)]">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}

interface PanelProps { lead: LeadDetail; onDone: (message: string) => void; onCancel: () => void }

function CallPanel({ lead, onDone, onCancel }: PanelProps) {
  const [roofArea, setRoofArea] = useState(lead.roofArea?.toString() ?? "");
  const [monthlyBill, setMonthlyBill] = useState(lead.monthlyBill.toString());
  const [gridOk, setGridOk] = useState<"" | "yes" | "no">("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () => api.post<LeadDetail>(`/leads/${lead.id}/log-call`, {
      roofArea: Number(roofArea), monthlyBill: Number(monthlyBill), gridOk: gridOk === "yes", notes: notes.trim() || null,
    }).then((r) => r.data),
    onSuccess: (updated) => onDone(updated.stage === "QUALIFIED" ? "Qualified: schedule the roof survey" : "Call logged: not qualified yet"),
  });

  function submit() {
    const found: Record<string, string> = {};
    if (roofArea === "" || Number(roofArea) < 0) found.roofArea = "Enter the shadow-free roof area";
    if (!(Number(monthlyBill) >= 1)) found.monthlyBill = "Enter the monthly bill";
    if (!gridOk) found.gridOk = "Is the grid connection suitable?";
    setErrors(found);
    if (Object.keys(found).length === 0) save.mutate();
  }

  return (
    <section className={panelCls}>
      <h2 className="mb-3 font-semibold">Log qualifying call</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Shadow-free roof (m²)" error={errors.roofArea}>
          <input className={inputCls} type="number" min={0} value={roofArea} onChange={(e) => setRoofArea(e.target.value)} />
        </Field>
        <Field label="Monthly bill (₹)" error={errors.monthlyBill}>
          <input className={inputCls} type="number" min={1} value={monthlyBill} onChange={(e) => setMonthlyBill(e.target.value)} />
        </Field>
        <Field label="Grid connection suitable?" error={errors.gridOk}>
          <select className={inputCls} value={gridOk} onChange={(e) => setGridOk(e.target.value as "" | "yes" | "no")}>
            <option value="">Choose…</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </Field>
      </div>
      <Field label="Notes">
        <textarea className={inputCls} rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <p className="mt-2 text-sm text-[var(--muted)]">Qualifies when the grid is suitable and the roof has about 10 m² per kW ({lead.kw * 10} m² here).</p>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" loading={save.isPending} disabled={save.isPending} onClick={submit}>Save call</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </section>
  );
}

function SurveyPanel({ lead, onDone, onCancel }: PanelProps) {
  const [technicianId, setTechnicianId] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { data: technicians = [] } = useQuery<UserItem[]>({
    queryKey: qk.users("TECHNICIAN"),
    queryFn: () => api.get("/users", { params: { role: "TECHNICIAN" } }).then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: () => api.post(`/leads/${lead.id}/schedule-survey`, { technicianId: Number(technicianId), visitDate }).then((r) => r.data),
    onSuccess: (survey: { ref: string }) => onDone(`Survey ${survey.ref} scheduled`),
  });

  function submit() {
    const found: Record<string, string> = {};
    if (!technicianId) found.technicianId = "Choose a technician";
    if (!visitDate) found.visitDate = "Choose the visit date and time";
    else if (new Date(visitDate).setHours(23, 59) < Date.now()) found.visitDate = "Visit date can't be in the past";
    setErrors(found);
    if (Object.keys(found).length === 0) save.mutate();
  }

  return (
    <section className={panelCls}>
      <h2 className="mb-3 font-semibold">Schedule roof survey</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Technician" error={errors.technicianId}>
          <select className={inputCls} value={technicianId} onChange={(e) => setTechnicianId(e.target.value)}>
            <option value="">Choose…</option>
            {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Visit date and time" error={errors.visitDate}>
          <input className={inputCls} type="datetime-local" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" loading={save.isPending} disabled={save.isPending} onClick={submit}>Schedule</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </section>
  );
}

function QuotePanel({ lead, onCreated, onCancel }: { lead: LeadDetail; onCreated: (quoteId: number) => void; onCancel: () => void }) {
  const { data: packages = [] } = useQuery<PackageItem[]>({
    queryKey: qk.packages,
    queryFn: () => api.get("/packages").then((r) => r.data),
  });
  // suggest the package that matches what the customer asked for, e.g. ON-3 for 3 kW On-Grid
  const suggested = `${lead.systemType === "ON_GRID" ? "ON" : "OFF"}-${lead.kw}`;
  const [packageId, setPackageId] = useState("");
  const chosen = packageId || String(packages.find((p) => p.code === suggested)?.id ?? "");

  const create = useMutation({
    mutationFn: () => api.post(`/leads/${lead.id}/quotation`, { packageId: Number(chosen) }).then((r) => r.data),
    onSuccess: (quote: { id: number }) => onCreated(quote.id),
  });

  return (
    <section className={panelCls}>
      <h2 className="mb-3 font-semibold">Create quotation from a package</h2>
      <Field label="Package">
        <select className={inputCls} value={chosen} onChange={(e) => setPackageId(e.target.value)}>
          <option value="">Choose…</option>
          {packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {formatINR(p.price)}</option>)}
        </select>
      </Field>
      <p className="mt-2 text-sm text-[var(--muted)]">The full parts list and prices fill in automatically on the quotation.</p>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={!chosen || create.isPending} loading={create.isPending} onClick={() => create.mutate()}>Create quotation</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </section>
  );
}

function LostPanel({ lead, onDone, onCancel }: PanelProps) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const save = useMutation({
    mutationFn: () => api.post(`/leads/${lead.id}/lost`, { reason: reason.trim() }).then((r) => r.data),
    onSuccess: () => onDone("Enquiry marked lost"),
  });
  return (
    <section className={panelCls}>
      <h2 className="mb-3 font-semibold">Mark enquiry as lost</h2>
      <Field label="Reason" error={err}>
        <input className={inputCls} maxLength={300} placeholder="Roof shaded by a tower" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="mt-3 flex gap-2">
        <Button variant="danger" loading={save.isPending} disabled={save.isPending}
          onClick={() => { if (reason.trim().length < 3) setErr("Give a short reason"); else save.mutate(); }}>Mark lost</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </section>
  );
}
