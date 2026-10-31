// Owned by A — home dashboard: count cards for the groups this role may see, today / week / month.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatINR } from "../../lib/format";
import { useAuth } from "../../auth/AuthContext";
import PageHeader from "../../components/PageHeader";

type Period = "today" | "week" | "month";
type Group = Record<string, number>;

// card label, where clicking it goes, and whether the number is money; keyed by API group and field
const CARDS: Record<string, { title: string; link: string; fields: Record<string, string>; money?: boolean }> = {
  leads: { title: "Enquiries", link: "/leads", fields: { new: "New in period", toCall: "To call" } },
  surveys: { title: "Surveys", link: "/surveys", fields: { toApprove: "Waiting for approval" } },
  quotes: { title: "Quotations", link: "/quotations", fields: { sent: "Sent", awaitingPayment: "Awaiting first payment" } },
  jobs: { title: "Installations", link: "/jobs", fields: { scheduled: "Scheduled", inProgress: "In progress", late: "Late" } },
  dispatches: { title: "Dispatches", link: "/dispatches", fields: { ready: "Ready to pick" } },
  tickets: { title: "Service tickets", link: "/tickets", fields: { open: "Open", underWarranty: "Under warranty", billable: "Billable" } },
  money: { title: "Money", link: "/invoices", money: true, fields: { booked: "Booked in period", collected: "Collected in period", due: "Due (all time)" } },
};

const PERIODS: Period[] = ["today", "week", "month"];

export default function Dashboard() {
  const { can } = useAuth();
  const [period, setPeriod] = useState<Period>("today");
  const { data, isLoading } = useQuery({
    queryKey: qk.dashboard(period),
    queryFn: () => api.get<Record<string, Group | string>>("/dashboard", { params: { period } }).then((r) => r.data),
    refetchInterval: 5000,
  });

  const groups = Object.keys(CARDS).filter((g) => data && typeof data[g] === "object");

  return (
    <div>
      <PageHeader
        title="Dashboard"
        actions={
          <div className="flex items-center gap-3">
            {can("reports:read") && (
              <Link to="/reports/profit" className="text-sm text-primary underline">Profit per job</Link>
            )}
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 h-8 rounded-sm text-sm capitalize ${p === period ? "bg-primary text-white" : "text-muted hover:text-text"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        }
      />
      {isLoading || !data ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((g) => {
            const card = CARDS[g];
            const values = data[g] as Group;
            return (
              <Link key={g} to={card.link} className="block bg-surface border border-border rounded-card shadow-card p-sp6 hover:border-primary">
                <h3 className="font-heading text-base font-semibold mb-3">{card.title}</h3>
                <div className="flex flex-col gap-2">
                  {Object.entries(card.fields).map(([field, label]) => (
                    <div key={field} className="flex items-baseline justify-between">
                      <span className="text-sm text-muted">{label}</span>
                      <span className={`font-heading text-xl font-semibold ${field === "late" && values[field] > 0 ? "text-danger" : ""}`}>
                        {card.money ? formatINR(values[field]) : values[field]}
                      </span>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
