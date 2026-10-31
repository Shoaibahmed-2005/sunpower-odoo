// New enquiry: Sales types in a call / WhatsApp / walk-in enquiry.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, qk, toast, PageHeader, Field, Button, inputCls } from "./ui";
import { LeadDetail, LeadSource, SystemType, SOURCE_LABEL, cleanPhone, validateEnquiry } from "./types";

const EMPTY = { name: "", phone: "", address: "", kw: "3", systemType: "ON_GRID" as SystemType,
  monthlyBill: "", subsidyInterest: true, source: "CALL" as LeadSource };

export default function LeadNew() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof EMPTY, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const create = useMutation({
    mutationFn: () => api.post<LeadDetail>("/leads", {
      ...form, phone: cleanPhone(form.phone), kw: Number(form.kw), monthlyBill: Number(form.monthlyBill),
    }).then((r) => r.data),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: qk.leads });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Enquiry ${lead.ref} saved`);
      navigate(`/leads/${lead.id}`);
    },
  });

  function submit() {
    const found = validateEnquiry(form);  // same limits as the server, so most mistakes never leave the browser
    setErrors(found);
    if (Object.keys(found).length === 0) create.mutate();
  }

  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="New enquiry" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name" error={errors.name}>
          <input className={inputCls} value={form.name} maxLength={100} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Mobile" error={errors.phone}>
          <input className={inputCls} inputMode="numeric" placeholder="98250 12345" value={form.phone} maxLength={20}
            onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Address" error={errors.address}>
          <input className={inputCls} value={form.address} maxLength={300} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="Source">
          <select className={inputCls} value={form.source} onChange={(e) => set("source", e.target.value)}>
            {(Object.keys(SOURCE_LABEL) as LeadSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="System size (kW)" error={errors.kw}>
          <select className={inputCls} value={form.kw} onChange={(e) => set("kw", e.target.value)}>
            {[1, 2, 3, 4, 5].map((k) => <option key={k} value={k}>{k} kW</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select className={inputCls} value={form.systemType} onChange={(e) => set("systemType", e.target.value)}>
            <option value="ON_GRID">On-Grid</option>
            <option value="OFF_GRID">Off-Grid (battery backup)</option>
          </select>
        </Field>
        <Field label="Monthly electricity bill (₹)" error={errors.monthlyBill}>
          <input className={inputCls} type="number" min={1} value={form.monthlyBill} onChange={(e) => set("monthlyBill", e.target.value)} />
        </Field>
        <Field label="Subsidy">
          <label className="flex items-center gap-2 py-2">
            <input type="checkbox" checked={form.subsidyInterest} onChange={(e) => set("subsidyInterest", e.target.checked)} />
            Interested in the government subsidy
          </label>
        </Field>
      </div>
      <div className="flex gap-3">
        <Button variant="primary" loading={create.isPending} disabled={create.isPending} onClick={submit}>Save enquiry</Button>
        <Button variant="secondary" onClick={() => navigate("/leads")}>Cancel</Button>
      </div>
    </div>
  );
}
