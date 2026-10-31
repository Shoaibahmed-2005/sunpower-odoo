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

interface EnquiryFormData {
  name: string;
  phone: string;
  address: string;
  kw: string;
  systemType: "ON_GRID" | "OFF_GRID";
  monthlyBill: string;
  subsidyInterest: boolean;
  website: string; // Honeypot
}

const INITIAL_FORM: EnquiryFormData = {
  name: "",
  phone: "",
  address: "",
  kw: "3",
  systemType: "ON_GRID",
  monthlyBill: "",
  subsidyInterest: true,
  website: "",
};

export default function EnquiryForm() {
  const [form, setForm] = useState<EnquiryFormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = <K extends keyof EnquiryFormData>(key: K, value: EnquiryFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const enquiryMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: cleanPhone(form.phone) || form.phone.trim(),
        address: form.address.trim(),
        kw: Number(form.kw),
        systemType: form.systemType,
        monthlyBill: Number(form.monthlyBill),
        subsidyInterest: form.subsidyInterest,
        website: form.website, // server rejects if populated by bot
      };
      const res = await api.post<{ ref: string }>("/public/enquiries", payload);
      return res.data;
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateEnquiry(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length === 0) {
      enquiryMutation.mutate();
    }
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
              Thanks, <strong className="text-[var(--text)]">{form.name}</strong>! Your solar assessment request has been registered under:
            </p>

            <div className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--border)] font-mono text-lg font-bold text-[var(--primary)]">
              {ref}
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Our solar engineering team will call you at <strong className="text-[var(--text)] font-mono">{form.phone}</strong> to confirm your site details and schedule a free roof survey.
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
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </Field>

            <Field label="Mobile Number" error={errors.phone}>
              <input
                className={inputCls}
                autoComplete="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number (e.g. 98220 00001)"
                maxLength={15}
                value={form.phone}
                onChange={(e) => setField("phone", e.target.value)}
              />
            </Field>

            <Field label="Installation Address & City" error={errors.address}>
              <input
                className={inputCls}
                autoComplete="street-address"
                maxLength={300}
                placeholder="Building, street, locality, city"
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Required Capacity (kW)" error={errors.kw}>
                <select
                  className={inputCls}
                  value={form.kw}
                  onChange={(e) => setField("kw", e.target.value)}
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
                  value={form.systemType}
                  onChange={(e) => setField("systemType", e.target.value as "ON_GRID" | "OFF_GRID")}
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
                value={form.monthlyBill}
                onChange={(e) => setField("monthlyBill", e.target.value)}
              />
            </Field>

            <label className="flex items-start gap-2.5 pt-1 text-sm text-[var(--text)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.subsidyInterest}
                onChange={(e) => setField("subsidyInterest", e.target.checked)}
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
              value={form.website}
              onChange={(e) => setField("website", e.target.value)}
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
