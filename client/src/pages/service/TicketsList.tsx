import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
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
  createdAt: string;
}

export default function TicketsList() {
  const navigate = useNavigate();
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: qk.tickets,
    queryFn: () => api.get<TicketRow[]>("/tickets").then((r) => r.data),
  });

  return (
    <div>
      <PageHeader
        title="Service Tickets"
        actions={
          <Button onClick={() => navigate("/tickets/new")}>
            <Plus className="w-4 h-4 mr-1" /> New Ticket
          </Button>
        }
      />
      {isLoading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <DataTable<TicketRow>
          columns={[
            { key: "ref", label: "Reference", render: (r) => <span className="font-mono text-[13px]">{r.ref}</span> },
            { key: "leadName", label: "Customer" },
            { key: "serial", label: "Serial", render: (r) => r.serial ? <span className="font-mono text-[13px]">{r.serial}</span> : <span className="text-muted">—</span> },
            { key: "issue", label: "Issue", render: (r) => <span className="truncate max-w-[200px] inline-block">{r.issue}</span> },
            { key: "underWarranty", label: "Warranty", render: (r) => <Badge status={r.underWarranty ? "Covered" : "Expired"} /> },
            { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
            { key: "technicianName", label: "Technician", render: (r) => r.technicianName || <span className="text-muted">—</span> },
          ]}
          rows={tickets}
          onRowClick={(r) => navigate(`/tickets/${r.id}`)}
          emptyMessage="No tickets yet"
        />
      )}
    </div>
  );
}
