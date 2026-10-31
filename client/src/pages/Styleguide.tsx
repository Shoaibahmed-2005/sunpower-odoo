import React, { useState } from "react";
import PageHeader from "../components/PageHeader";
import Card from "../components/Card";
import Button from "../components/Button";
import Badge from "../components/Badge";
import Field, { FormSection } from "../components/Field";
import StatusBar from "../components/StatusBar";
import DataTable from "../components/DataTable";
import PhoneLayout from "../components/PhoneLayout";
import { toast } from "../components/Toast";
import {
  Sun,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Play,
  Share2,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

export default function Styleguide() {
  const [activeStep, setActiveStep] = useState("In Progress");
  const [loadingBtn, setLoadingBtn] = useState(false);

  const sampleRows = [
    { ref: "JOB/0001", customer: "Ramesh Sharma", kw: 3.0, status: "IN_PROGRESS", city: "Pune" },
    { ref: "JOB/0002", customer: "Sunita Desai", kw: 5.0, status: "DONE", city: "Nashik" },
    { ref: "JOB/0003", customer: "Pooja Hegde", kw: 2.0, status: "SCHEDULED", city: "Mumbai" },
    { ref: "JOB/0004", customer: "Amitabh Verma", kw: 4.5, status: "DISPATCHED", city: "Nagpur" },
  ];

  return (
    <div className="space-y-10 pb-16 max-w-6xl mx-auto">
      <PageHeader
        title="SunPower Design System & Styleguide"
        subtitle="Canonical component inventory and usage examples per BUILD_PLAN.md (§9, §9.1) and DESIGN.md"
        breadcrumbs={[{ label: "Dev Tools" }, { label: "Styleguide" }]}
        actions={
          <Button
            variant="accent"
            icon={Sparkles}
            onClick={() => toast.success("Design tokens active!")}
          >
            Test Global Toast
          </Button>
        }
      />

      {/* 1. Brand Colours & Typography */}
      <Card title="1. Brand Tokens & Typography" icon={Layers}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Colours from §9 brand kit only. Primary Panel Blue (<code>#13315C</code>), Accent Sun Amber (<code>#F5A524</code>).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs font-mono">
            <div className="p-3 rounded-md bg-primary text-white text-center shadow-xs">
              primary<br />#13315C
            </div>
            <div className="p-3 rounded-md bg-accent text-white text-center shadow-xs">
              accent<br />#F5A524
            </div>
            <div className="p-3 rounded-md bg-bg border border-border text-text text-center">
              bg<br />#F7F7F5
            </div>
            <div className="p-3 rounded-md bg-surface border border-border text-text text-center shadow-xs">
              surface<br />#FFFFFF
            </div>
            <div className="p-3 rounded-md bg-surface-2 border border-border text-muted text-center">
              surface-2<br />#F0F0ED
            </div>
            <div className="p-3 rounded-md bg-success text-white text-center shadow-xs">
              success<br />#1E8E5A
            </div>
            <div className="p-3 rounded-md bg-danger text-white text-center shadow-xs">
              danger<br />#D93F3F
            </div>
          </div>

          <div className="pt-3 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-muted block">Poppins (Headings)</span>
              <p className="font-heading text-xl font-bold text-text">Solar Management System</p>
            </div>
            <div>
              <span className="text-xs text-muted block">Noto Sans (Body)</span>
              <p className="font-body text-sm text-text">Clean, functional UI for field technicians and warehouse.</p>
            </div>
            <div>
              <span className="text-xs text-muted block">JetBrains Mono (Refs & Serials)</span>
              <p className="font-mono text-sm font-semibold text-primary">INV-OG3-2026A0012 • ₹1,95,000</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Buttons */}
      <Card title="2. Button Variants & States" icon={Sun}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Outline</Button>
            <Button variant="accent">Sun Amber Accent</Button>
            <Button variant="danger">Danger Action</Button>
            <Button variant="ghost">Ghost Link</Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              loading={loadingBtn}
              onClick={() => {
                setLoadingBtn(true);
                setTimeout(() => setLoadingBtn(false), 1500);
              }}
            >
              {loadingBtn ? "Saving…" : "Click for Loading State"}
            </Button>
            <Button variant="primary" disabled disabledReason="Survey not approved yet">
              Disabled with Tooltip
            </Button>
            <Button variant="secondary" icon={Share2}>
              With Icon
            </Button>
            <Button variant="primary" size="sm">
              Small (32px)
            </Button>
            <Button variant="primary" size="lg">
              Large (48px Phone)
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. Badges */}
      <Card title="3. Badges (Status Pills)" icon={Shield}>
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Mapped by semantic meaning (Success / Warning / Danger / Info / Neutral) with 15% tinted bg.
          </p>
          <div className="flex flex-wrap gap-2.5 items-center">
            <Badge status="DONE" />
            <Badge status="APPROVED" />
            <Badge status="PAID" />
            <Badge status="Covered" />
            <Badge status="IN_PROGRESS" />
            <Badge status="SENT" />
            <Badge status="DUE" />
            <Badge status="REJECTED" />
            <Badge status="CANCELLED" />
            <Badge status="Expired" />
            <Badge status="NEW" />
            <Badge status="SCHEDULED" />
            <Badge status="ASSIGNED" />
            <Badge status="DRAFT" />
            <Badge status="READY" />
            <Badge status="CONTACTED" />
          </div>
        </div>
      </Card>

      {/* 4. StatusBar */}
      <Card title="4. Odoo-Style Stepper Status Bar">
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Chevron style with interactive step clicking for demonstration:
          </p>
          <StatusBar
            steps={["Draft", "Survey Scheduled", "In Progress", "Resolved", "Closed"]}
            current={activeStep}
            onStepClick={(step) => setActiveStep(step)}
          />
          <p className="text-xs text-muted">
            Currently active: <strong className="text-primary">{activeStep}</strong>
          </p>
        </div>
      </Card>

      {/* 5. Forms & Inputs */}
      <Card title="5. Form Fields & Sections">
        <FormSection title="System Information" description="Rooftop sizing and solar connection">
          <Field label="System Capacity (kW)" required hint="Standard range: 1–10 kW">
            <input
              type="number"
              placeholder="e.g. 5.0"
              defaultValue="5.0"
              className="w-full h-control rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </Field>
          <Field label="Grid Connection Type" required>
            <select className="w-full h-control rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-primary">
              <option>On-Grid (Net Metered)</option>
              <option>Off-Grid (Battery Bank)</option>
            </select>
          </Field>
          <Field label="Customer Contact Phone" error="10-digit mobile number required">
            <input
              type="text"
              defaultValue="98765"
              className="w-full h-control rounded-sm border border-danger bg-surface px-3 text-sm outline-none focus:border-danger"
            />
          </Field>
          <Field label="Installation Notes">
            <input
              type="text"
              placeholder="South-facing RCC roof with no shadow"
              className="w-full h-control rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            />
          </Field>
        </FormSection>
      </Card>

      {/* 6. DataTable with Kanban toggle */}
      <Card title="6. DataTable (Toolbar, Search, Filters, Kanban Toggle)">
        <DataTable
          columns={[
            {
              key: "ref",
              label: "Reference",
              render: (r: any) => <span className="font-mono text-[13px]">{r.ref}</span>,
            },
            { key: "customer", label: "Customer Name" },
            {
              key: "kw",
              label: "Capacity",
              align: "right",
              render: (r: any) => `${r.kw} kW`,
            },
            { key: "city", label: "City" },
            {
              key: "status",
              label: "Status",
              render: (r: any) => <Badge status={r.status} />,
            },
          ]}
          rows={sampleRows}
          searchPlaceholder="Search installations…"
          filterChips={[
            { label: "All", value: "ALL" },
            { label: "In Progress", value: "IN_PROGRESS" },
            { label: "Done", value: "DONE" },
          ]}
          onRowClick={(r: any) => toast.success(`Selected ${r.ref}`)}
          kanban={{
            groupBy: "status",
            groups: ["SCHEDULED", "DISPATCHED", "IN_PROGRESS", "DONE"],
            card: (r: any) => (
              <Card className="p-3 bg-surface shadow-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-xs font-semibold text-primary">{r.ref}</span>
                  <Badge status={r.status} size="sm" />
                </div>
                <p className="text-sm font-semibold">{r.customer}</p>
                <p className="text-xs text-muted mt-1">{r.kw} kW • {r.city}</p>
              </Card>
            ),
          }}
        />
      </Card>

      {/* 7. Phone Layout Preview */}
      <Card title="7. Mobile / Sunlight Phone Layout Preview" icon={Wrench}>
        <div className="max-w-sm mx-auto border-2 border-border rounded-xl overflow-hidden shadow-card">
          <PhoneLayout title="Technician Worksheet" subtitle="High contrast sunlight mode">
            <Card className="p-3 bg-surface">
              <span className="font-mono text-xs text-primary font-bold">JOB/0042</span>
              <p className="font-heading text-base font-bold text-text mt-0.5">Sunita Desai</p>
              <p className="text-xs text-muted">5 kW On-Grid • Pune South</p>
            </Card>

            <Button variant="primary" size="lg" className="w-full text-base h-12 shadow-sm">
              Start Roof Installation (48px)
            </Button>
          </PhoneLayout>
        </div>
      </Card>
    </div>
  );
}
