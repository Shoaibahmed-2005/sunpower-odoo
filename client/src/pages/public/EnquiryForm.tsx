// Public enquiry form (Member B, P1): the homeowner asks for a quote. No login.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, Logo, Field, Button, inputCls } from "../sales/ui";
import { cleanPhone, validateEnquiry } from "../sales/types";

const EMPTY = { name: "", phone: "", address: "", kw: "3", systemType: "ON_GRID", monthlyBill: "", subsidyInterest: true, website: "" };

export default function EnquiryForm() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof EMPTY, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  const send = useMutation({
    mutationFn: () => api.post<{ ref: string }>("/public/enquiries", {
      ...form, phone: cleanPhone(form.phone), kw: Number(form.kw), monthlyBill: Number(form.monthlyBill),
    }).then((r) => r.data),
  });

  function submit() {
    const found = validateEnquiry(form);
    setErrors(found);
    if (Object.keys(found).length === 0) send.mutate();
  }

  if (send.isSuccess) {
    return (
      <main className="mx-auto max-w-lg space-y-6 p-6 text-center">
        <div className="flex justify-center pt-4">
          <Logo variant="full" size="md" />
        </div>
        <div className="rounded-card border border-border bg-surface p-6 shadow-card space-y-3">
          <h1 className="text-2xl font-heading font-semibold text-text">
            Thanks! Your enquiry {send.data.ref} has been received
          </h1>
          <p className="text-sm text-muted">
            Your reference number is{" "}
            <span className="font-mono font-bold text-primary text-base">
              {send.data.ref}
            </span>
            . Our team will call you shortly.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-5 p-6">
      <div className="flex justify-center pt-2">
        <Logo variant="full" size="md" />
      </div>
      <div className="text-center pb-2">
        <h1 className="text-2xl font-heading font-semibold text-text">Get a rooftop solar quote</h1>
        <p className="text-sm text-muted mt-1">Fill out the form below to receive a free solar assessment</p>
      </div>

      <Field label="Full name" error={errors.name}>
        <input className={inputCls} autoComplete="name" maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Mobile number" error={errors.phone}>
        <input className={inputCls} autoComplete="tel" inputMode="numeric" placeholder="98250 12345" maxLength={20} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
      </Field>
      <Field label="Address" error={errors.address}>
        <input className={inputCls} autoComplete="street-address" maxLength={300} value={form.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="System size" error={errors.kw}>
        <select className={inputCls} value={form.kw} onChange={(e) => set("kw", e.target.value)}>
          {[1, 2, 3, 4, 5].map((k) => <option key={k} value={k}>{k} kW</option>)}
        </select>
      </Field>
      <Field label="Type">
        <select className={inputCls} value={form.systemType} onChange={(e) => set("systemType", e.target.value)}>
          <option value="ON_GRID">On-Grid (connected to the grid)</option>
          <option value="OFF_GRID">Off-Grid (with battery backup)</option>
        </select>
      </Field>
      <Field label="Monthly electricity bill (₹)" error={errors.monthlyBill}>
        <input className={inputCls} type="number" min={1} value={form.monthlyBill} onChange={(e) => set("monthlyBill", e.target.value)} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-text cursor-pointer">
        <input type="checkbox" checked={form.subsidyInterest} onChange={(e) => set("subsidyInterest", e.target.checked)} className="rounded text-primary focus:ring-primary" />
        I'm interested in the government subsidy
      </label>
      {/* honeypot: invisible to people, bots fill it, the server then rejects the request */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website}
        onChange={(e) => set("website", e.target.value)} style={{ position: "absolute", left: "-10000px" }} />
      <Button variant="primary" loading={send.isPending} disabled={send.isPending} onClick={submit} className="w-full">
        Request quote
      </Button>
      <div className="text-center pt-2"><a href="/portal" className="text-xs text-muted hover:text-text">Already a customer? Go to Customer Portal →</a></div>
    </main>
  );
}
