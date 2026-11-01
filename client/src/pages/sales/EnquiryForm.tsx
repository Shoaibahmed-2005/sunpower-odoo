/**
 * Public Solar Rooftop Assessment & Enquiry Form.
 * Allows homeowners to request a site survey and solar quotation (captures leads to WEB source).
 */
import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../api/client";
import Logo from "../../components/Logo";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { cleanPhone, validateEnquiry } from "./types";
import { CheckCircle2, Sun, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

interface EnquiryPayload {
  name: string;
  phone: string;
  address: string;
  kw: number;
  systemType: string;
  monthlyBill: number;
  subsidyInterest: boolean;
  website: string; // honeypot: the server rejects the request if a bot filled it
}

export default function EnquiryForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  // only what the success screen needs; the fields themselves live in the DOM (uncontrolled form)
  const [submitted, setSubmitted] = useState<{ name: string; phone: string } | null>(null);

  const enquiryMutation = useMutation({
    mutationFn: async (payload: EnquiryPayload) => {
      const res = await api.post<{ ref: string }>("/public/enquiries", payload);
      return res.data;
    },
  });

  // Uncontrolled form: no onChange/useState per field, so typing doesn't re-render the page.
  // All values are read once, here, from the submit event. The server validates everything again.
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const get = (key: string) => String(data.get(key) ?? "");
    const values = { name: get("name"), phone: get("phone"), address: get("address"), kw: get("kw"), monthlyBill: get("monthlyBill") };

    const validationErrors = validateEnquiry(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitted({ name: values.name.trim(), phone: values.phone.trim() });
    enquiryMutation.mutate({
      name: values.name.trim(),
      phone: cleanPhone(values.phone) || values.phone.trim(),
      address: values.address.trim(),
      kw: Number(values.kw),
      systemType: get("systemType"),
      monthlyBill: Number(values.monthlyBill),
      subsidyInterest: data.get("subsidyInterest") === "on",
      website: get("website"),
    });
  };

  const inputCls =
    "w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--text)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] disabled:opacity-60";

  // Success view with enquiry reference
  if (enquiryMutation.isSuccess && enquiryMutation.data) {
    const ref = enquiryMutation.data.ref;
    return (
      <main className="min-h-screen bg-[var(--bg)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-md w-full mx-auto space-y-6 text-center">
          <div className="flex justify-center">
            <Logo variant="full" size="lg" />
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-card space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-heading font-bold text-[var(--text)]">
              Enquiry Received!
            </h1>

            <p className="text-sm text-[var(--muted)]">
              Thanks, <strong className="text-[var(--text)]">{submitted?.name}</strong>! Your solar assessment request has been registered under:
            </p>

            <div className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] font-mono text-lg font-bold text-[var(--primary)]">
              {ref}
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Our solar engineering team will call you at <strong className="text-[var(--text)] font-mono">{submitted?.phone}</strong> to confirm your site details and schedule a free roof survey.
            </p>

            <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-2">
              <Link
                to="/portal"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
              >
                Go to Customer Portal <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header & Logo */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Logo variant="full" size="lg" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Sun className="w-3.5 h-3.5 text-amber-500" /> PM Surya Ghar Muft Bijli Yojana Partner
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[var(--text)] tracking-tight">
            Get a Rooftop Solar Quote
          </h1>
          <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
            Save up to 90% on electricity bills with subsidy assistance up to ₹78,000.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 shadow-card">
          {enquiryMutation.isError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              Failed to submit enquiry. Please check your inputs and try again.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Full Name" error={errors.name}>
              <input
                className={inputCls}
                autoComplete="name"
                maxLength={100}
                placeholder="e.g. Rahul Sharma"
                name="name"
              />
            </Field>

            <Field label="Mobile Number" error={errors.phone}>
              <input
                className={inputCls}
                autoComplete="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number (e.g. 98220 00001)"
                maxLength={15}
                name="phone"
              />
            </Field>

            <Field label="Installation Address & City" error={errors.address}>
              <input
                className={inputCls}
                autoComplete="street-address"
                maxLength={300}
                placeholder="Building, street, locality, city"
                name="address"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Required Capacity (kW)" error={errors.kw}>
                <select
                  className={inputCls}
                  name="kw"
                  defaultValue="3"
                >
                  <option value="1">1 kW (Small Home / ~120 units/mo)</option>
                  <option value="2">2 kW (2-3 BHK / ~240 units/mo)</option>
                  <option value="3">3 kW (Standard 3 BHK / ~360 units/mo)</option>
                  <option value="4">4 kW (Large Residence / ~480 units/mo)</option>
                  <option value="5">5 kW (Villa / Commercial / ~600 units/mo)</option>
                </select>
              </Field>

              <Field label="System Preference">
                <select
                  className={inputCls}
                  name="systemType"
                  defaultValue="ON_GRID"
                >
                  <option value="ON_GRID">On-Grid (Govt. Subsidy Eligible)</option>
                  <option value="OFF_GRID">Off-Grid (With Battery Storage)</option>
                </select>
              </Field>
            </div>

            <Field label="Average Monthly Electricity Bill (₹)" error={errors.monthlyBill}>
              <input
                className={inputCls}
                type="number"
                min={1}
                placeholder="e.g. 3500"
                name="monthlyBill"
              />
            </Field>

            <label className="flex items-start gap-2.5 pt-1 text-sm text-[var(--text)] cursor-pointer select-none">
              <input
                type="checkbox"
                name="subsidyInterest"
                defaultChecked
                className="mt-0.5 rounded text-[var(--primary)] focus:ring-[var(--primary)] border-[var(--border)]"
              />
              <span>I am interested in Central Govt. PM Surya Ghar subsidy processing.</span>
            </label>

            {/* Honeypot: hidden from people, bots fill it and get rejected */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="sr-only"
              defaultValue=""
            />

            <Button
              type="submit"
              variant="primary"
              loading={enquiryMutation.isPending}
              disabled={enquiryMutation.isPending}
              className="w-full justify-center py-3 text-base mt-2"
            >
              Request Free Site Assessment
            </Button>
          </form>

          {/* Links Footer */}
          <div className="mt-6 pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--muted)] space-y-2">
            <div>
              Already a customer?{" "}
              <Link to="/portal" className="text-[var(--primary)] font-semibold hover:underline">
                Sign in to Customer Portal →
              </Link>
            </div>
            <div>
              Are you a SunPower employee?{" "}
              <Link to="/login" className="text-[var(--muted)] hover:text-[var(--text)] underline">
                Staff Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

