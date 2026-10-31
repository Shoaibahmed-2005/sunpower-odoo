import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate } from "../../lib/format";
import ListPage from "../../components/ListPage";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Card from "../../components/Card";
import { Plus } from "lucide-react";

interface TicketRow {
  id: number;
  ref: string;
  leadName: string;
  serial: string | null;
  issue: string;
  underWarranty: boolean;
  status: string;
  technicianName: string | null;
  source?: string;
  createdAt: string;
}

export default function TicketsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeStatus = searchParams.get("status") || "ALL";

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: qk.tickets,
    queryFn: () => api.get<TicketRow[]>("/tickets").then((r) => r.data),
  });

  const filterChips = [
    { label: "All Tickets", value: "ALL" },
    { label: "New", value: "NEW" },
    { label: "Assigned", value: "ASSIGNED" },
    { label: "In Repair", value: "IN_REPAIR" },
    { label: "Resolved", value: "RESOLVED" },
    { label: "Closed", value: "CLOSED" },
  ];

  const handleFilterChange = (val: string) => {
    if (val === "ALL") {
      searchParams.delete("status");
    } else {
      searchParams.set("status", val);
    }
    setSearchParams(searchParams);
  };

  const displayedTickets = useMemo(() => {
    if (activeStatus === "ALL") return tickets;
    return tickets.filter(
      (t) => t.status?.toUpperCase() === activeStatus.toUpperCase()
    );
  }, [tickets, activeStatus]);

  return (
    <ListPage<TicketRow>
      title="Service Tickets"
      subtitle="Handle post-commissioning customer breakdowns, repairs, and warranty claims"
      breadcrumbs={[{ label: "Service" }, { label: "Tickets" }]}
      actions={
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => navigate("/tickets/new")}
        >
          New Ticket
        </Button>
      }
      columns={[
        {
          key: "ref",
          label: "Reference",
          render: (r) => (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[13px]">{r.ref}</span>
              {r.source === "PORTAL" && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                  PORTAL
                </span>
              )}
            </div>
          ),
        },
        { key: "leadName", label: "Customer" },
        {
          key: "serial",
          label: "Serial Unit",
          render: (r) =>
            r.serial ? (
              <span className="font-mono text-[13px]">{r.serial}</span>
            ) : (
              <span className="text-muted">—</span>
            ),
        },
        {
          key: "issue",
          label: "Issue Description",
          render: (r) => (
            <span className="truncate max-w-[240px] block text-text" title={r.issue}>
              {r.issue}
            </span>
          ),
        },
        {
          key: "underWarranty",
          label: "Warranty",
          render: (r) => (
            <Badge status={r.underWarranty ? "Covered" : "Expired"} size="sm" />
          ),
        },
        {
          key: "status",
          label: "Status",
          render: (r) => <Badge status={r.status} />,
        },
        {
          key: "technicianName",
          label: "Assigned Technician",
          render: (r) => (
            <span>{r.technicianName || <span className="text-muted">—</span>}</span>
          ),
        },
        {
          key: "createdAt",
          label: "Reported Date",
          align: "right",
          render: (r) => <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>,
        },
      ]}
      rows={displayedTickets}
      loading={isLoading}
      filterChips={filterChips}
      activeFilter={activeStatus}
      onFilterChange={handleFilterChange}
      onRowClick={(r) => navigate(`/tickets/${r.id}`)}
      emptyMessage="No service tickets found"
      kanban={{
        groupBy: "status",
        groups: ["NEW", "ASSIGNED", "IN_REPAIR", "RESOLVED", "CLOSED"],
        card: (ticket) => (
          <Card className="p-3.5 hover:border-primary/50 text-left bg-surface shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-mono text-xs font-semibold text-primary">
                {ticket.ref}
              </span>
              <Badge status={ticket.underWarranty ? "Covered" : "Expired"} size="sm" />
            </div>
            <p className="font-heading text-sm font-semibold text-text truncate">
              {ticket.leadName}
            </p>
            <p className="text-xs text-muted line-clamp-2 mt-1">
              {ticket.issue}
            </p>
            <div className="mt-2 text-[11px] text-muted flex items-center justify-between border-t border-border/50 pt-1.5">
              <span>{ticket.serial || "No serial"}</span>
              <Badge status={ticket.status} size="sm" />
            </div>
          </Card>
        ),
      }}
    />
  );
}
