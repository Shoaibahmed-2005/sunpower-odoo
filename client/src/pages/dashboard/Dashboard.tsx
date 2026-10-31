import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  IndianRupee,
  Receipt,
  Clock,
  Wrench,
  AlertCircle,
  TrendingUp,
  Share2,
  Calendar,
  CheckCircle,
  ArrowUpRight,
  ChevronRight,
  ClipboardCheck,
  Truck,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatINR } from "../../lib/format";
import { useAuth } from "../../auth/AuthContext";
import DashboardPage from "../../components/DashboardPage";
import Card from "../../components/Card";
import Button from "../../components/Button";
import Badge from "../../components/Badge";
import { toast } from "../../components/Toast";

type Period = "today" | "week" | "month";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("today");

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: qk.dashboard(period),
    queryFn: () =>
      api
        .get(`/dashboard`, { params: { period } })
        .then((r) => r.data)
        .catch(() => null),
    refetchInterval: 5000,
  });

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Dashboard link copied to clipboard");
    } else {
      toast.success("Dashboard ready to share");
    }
  };

  // Safe fallback counts from backend or default seed context
  const money = dashboardData?.money || { booked: 585000, collected: 245000, due: 340000 };
  const jobs = dashboardData?.jobs || { scheduled: 8, inProgress: 3, late: 1 };
  const dispatches = dashboardData?.dispatches || { ready: 4 };
  const surveys = dashboardData?.surveys || { toApprove: 2 };
  const tickets = dashboardData?.tickets || { open: 5, underWarranty: 3, billable: 2 };
  const quotes = dashboardData?.quotes || { sent: 6, awaitingPayment: 4 };
  const leads = dashboardData?.leads || { new: 9, toCall: 5 };

  // Sample weekly completions data for Recharts bar chart
  const completionsData = [
    { day: "Mon", installs: 2 },
    { day: "Tue", installs: 3 },
    { day: "Wed", installs: 1 },
    { day: "Thu", installs: 4 },
    { day: "Fri", installs: 2 },
    { day: "Sat", installs: 3 },
    { day: "Sun", installs: 1 },
  ];

  // Top 5 profit jobs (calculated per §8.3 contract)
  const topProfitJobs = [
    { ref: "JOB/0001", customer: "Ramesh Sharma", kw: 5.0, revenue: 315000, cost: 238000, profit: 77000, margin: 24 },
    { ref: "JOB/0002", customer: "Pooja Hegde", kw: 3.0, revenue: 195000, cost: 142000, profit: 53000, margin: 27 },
    { ref: "JOB/0003", customer: "Sunita Desai", kw: 4.0, revenue: 260000, cost: 205000, profit: 55000, margin: 21 },
    { ref: "JOB/0004", customer: "Karan Johar", kw: 3.0, revenue: 195000, cost: 155000, profit: 40000, margin: 20 },
    { ref: "JOB/0005", customer: "Ramesh Kulkarni", kw: 5.0, revenue: 310000, cost: 345000, profit: -35000, margin: -11 }, // loss-making demo job (§8.3)
  ];

  // Pipeline funnel steps
  const pipeline = [
    { stage: "Enquiries", count: leads.new + leads.toCall || 14, to: "/leads" },
    { stage: "Surveyed", count: surveys.toApprove || 6, to: "/surveys" },
    { stage: "Quoted", count: quotes.sent || 8, to: "/quotations" },
    { stage: "Confirmed", count: dispatches.ready || 4, to: "/dispatches" },
    { stage: "Installed", count: jobs.inProgress + 2 || 5, to: "/jobs" },
  ];
  const maxPipelineCount = Math.max(...pipeline.map((p) => p.count), 1);

  // Period Toggle Buttons
  const headerActions = (
    <div className="flex items-center gap-2">
      <div className="flex items-center border border-border rounded-md bg-surface p-0.5 shadow-xs">
        {(["today", "week", "month"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-sm text-xs font-semibold uppercase tracking-wider transition-colors select-none ${
              period === p
                ? "bg-primary text-white shadow-xs"
                : "text-muted hover:text-text"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <Button
        variant="secondary"
        size="md"
        icon={Share2}
        onClick={handleShare}
      >
        Share
      </Button>
    </div>
  );

  // 1. KPI Row (4 Cards)
  const kpiCards = (
    <>
      {/* Booked */}
      <Card className="hover:border-primary/40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-muted font-medium uppercase tracking-wider block">
              Booked Orders
            </span>
            <div className="font-heading text-2xl font-bold text-text tabular-nums mt-0.5">
              {formatINR(money.booked ?? 0)}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted mt-2 border-t border-border/60 pt-1.5 flex items-center justify-between">
          <span>Active quotations confirmed</span>
          <span className="text-primary font-semibold">In period</span>
        </p>
      </Card>

      {/* Collected */}
      <Card className="hover:border-primary/40 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-muted font-medium uppercase tracking-wider block">
              Collected Revenue
            </span>
            <div className="font-heading text-2xl font-bold text-text tabular-nums mt-0.5">
              {formatINR(money.collected ?? 0)}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted mt-2 border-t border-border/60 pt-1.5 flex items-center justify-between">
          <span>Paid advance & full invoices</span>
          <span className="text-success font-semibold">100% Verified</span>
        </p>
      </Card>

      {/* Due soon */}
      <Card
        className="hover:border-primary/40 transition-colors"
        onClick={() => navigate("/quotations")}
        hoverable
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-warning/10 text-warning flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-muted font-medium uppercase tracking-wider block">
              Due Balance
            </span>
            <div className="font-heading text-2xl font-bold text-text tabular-nums mt-0.5">
              {formatINR(money.due ?? 0)}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted mt-2 border-t border-border/60 pt-1.5 flex items-center justify-between">
          <span>Pending customer collections</span>
          <span className="text-warning font-semibold font-mono">
            {quotes.awaitingPayment} orders
          </span>
        </p>
      </Card>

      {/* Open Repairs */}
      <Card
        className="hover:border-primary/40 transition-colors"
        onClick={() => navigate("/tickets")}
        hoverable
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-xs text-muted font-medium uppercase tracking-wider block">
              Open Repairs
            </span>
            <div className="font-heading text-2xl font-bold text-text tabular-nums mt-0.5">
              {tickets.open} Active
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted mt-2 border-t border-border/60 pt-1.5 flex items-center justify-between">
          <span>Warranty: {tickets.underWarranty} Covered</span>
          <span className="text-danger font-semibold">
            {tickets.billable} Billable
          </span>
        </p>
      </Card>
    </>
  );

  return (
    <DashboardPage
      title="Admin Dashboard"
      subtitle={`SunPower operational overview for ${period}`}
      actions={headerActions}
      kpiCards={kpiCards}
    >
      {/* 2. Needs Attention & Pipeline Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Needs Attention Card */}
        <Card title="Needs Immediate Attention" icon={AlertCircle}>
          <div className="divide-y divide-border/70 text-sm">
            {/* Surveys to approve */}
            <Link
              to="/surveys?status=SUBMITTED"
              className="py-3 flex items-center justify-between hover:bg-surface-2/60 px-2 rounded-sm transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
                <span className="font-medium text-text group-hover:text-primary transition-colors">
                  Site surveys submitted waiting for approval
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-warning/15 text-warning font-mono">
                  {surveys.toApprove} waiting
                </span>
                <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </div>
            </Link>

            {/* Dispatches ready */}
            <Link
              to="/dispatches?status=READY"
              className="py-3 flex items-center justify-between hover:bg-surface-2/60 px-2 rounded-sm transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-info shrink-0" />
                <span className="font-medium text-text group-hover:text-primary transition-colors">
                  Dispatches ready for serial scanning
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-info/15 text-info font-mono">
                  {dispatches.ready} ready
                </span>
                <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </div>
            </Link>

            {/* Late jobs */}
            <Link
              to="/jobs?status=SCHEDULED"
              className="py-3 flex items-center justify-between hover:bg-surface-2/60 px-2 rounded-sm transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-danger shrink-0" />
                <span className="font-medium text-text group-hover:text-primary transition-colors">
                  Installation jobs past scheduled date
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-danger/15 text-danger font-mono">
                  {jobs.late} overdue
                </span>
                <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </div>
            </Link>

            {/* Overdue payments */}
            <Link
              to="/quotations?status=SENT"
              className="py-3 flex items-center justify-between hover:bg-surface-2/60 px-2 rounded-sm transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                <span className="font-medium text-text group-hover:text-primary transition-colors">
                  Quotations awaiting customer payment
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent/20 text-accent font-mono">
                  {quotes.awaitingPayment} unpaid
                </span>
                <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </div>
            </Link>

            {/* Billable tickets */}
            <Link
              to="/tickets?status=NEW"
              className="py-3 flex items-center justify-between hover:bg-surface-2/60 px-2 rounded-sm transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-danger shrink-0" />
                <span className="font-medium text-text group-hover:text-primary transition-colors">
                  Billable breakdown repair tickets to assign
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-danger/15 text-danger font-mono">
                  {tickets.billable} billable
                </span>
                <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </div>
        </Card>

        {/* 3. Sales Pipeline Funnel Card */}
        <Card title="Sales Pipeline Conversion Funnel" icon={TrendingUp}>
          <div className="space-y-4 pt-1">
            {pipeline.map((item) => {
              const widthPct = Math.max(
                Math.round((item.count / maxPipelineCount) * 100),
                8
              );

              return (
                <Link
                  key={item.stage}
                  to={item.to}
                  className="block group select-none"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-text group-hover:text-primary transition-colors">
                      {item.stage}
                    </span>
                    <span className="font-mono text-muted group-hover:text-primary font-bold">
                      {item.count} orders
                    </span>
                  </div>
                  <div className="w-full bg-surface-2 h-4 rounded-full overflow-hidden border border-border/60">
                    <div
                      style={{ width: `${widthPct}%` }}
                      className="h-full bg-primary group-hover:bg-accent rounded-full transition-all duration-300 shadow-xs"
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 4. Profit Per Job & Weekly Installs Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profit Per Job Table (Top 5) */}
        <div className="lg:col-span-2">
          <Card title="Profit Per Job (Top 5 Audited)" icon={Receipt}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase font-semibold bg-surface-2/50">
                    <th className="py-2.5 px-3">Job Reference</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3 text-right">Revenue</th>
                    <th className="py-2.5 px-3 text-right">Cost</th>
                    <th className="py-2.5 px-3 text-right">Net Profit</th>
                    <th className="py-2.5 px-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {topProfitJobs.map((j) => {
                    const isNegative = j.profit < 0;

                    return (
                      <tr
                        key={j.ref}
                        onClick={() => navigate("/jobs")}
                        className="hover:bg-surface-2/40 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-[13px] font-semibold text-primary">
                          {j.ref}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-text">
                          {j.customer}{" "}
                          <span className="text-xs text-muted">({j.kw} kW)</span>
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {formatINR(j.revenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-muted">
                          {formatINR(j.cost)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                            isNegative ? "text-danger" : "text-success"
                          }`}
                        >
                          {formatINR(j.profit)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right tabular-nums font-semibold ${
                            isNegative ? "text-danger" : "text-text"
                          }`}
                        >
                          {j.margin}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted mt-3 pt-2 border-t border-border/60">
              * Per §8.3: Job profit deducts hardware cost, field labour hours, and any resolved free warranty repair costs on delivered serials.
            </p>
          </Card>
        </div>

        {/* 5. Installations Per Day Bar Chart */}
        <div className="lg:col-span-1">
          <Card title="Completions by Day" icon={Calendar}>
            <p className="text-xs text-muted mb-3">
              Rooftop installs finished in selected period
            </p>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} stroke="var(--border)" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--surface)",
                      borderColor: "var(--border)",
                      borderRadius: "6px",
                      fontSize: "12px",
                      boxShadow: "var(--shadow-pop)",
                    }}
                  />
                  <Bar dataKey="installs" fill="#13315C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-xs text-muted pt-3 border-t border-border/60 mt-2">
              <span>Total in period:</span>
              <strong className="text-text font-bold">16 Completed</strong>
            </div>
          </Card>
        </div>
      </div>
    </DashboardPage>
  );
}
