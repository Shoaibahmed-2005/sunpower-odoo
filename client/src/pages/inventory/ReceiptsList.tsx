// Owned by A — goods arriving from vendors.
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { formatDate } from "../../lib/format";
import { useAuth } from "../../auth/AuthContext";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import Button from "../../components/Button";

interface ReceiptRow {
  id: number;
  ref: string;
  vendor: string;
  status: string;
  lineCount: number;
  totalQty: number;
  createdAt: string;
  receivedAt: string | null;
}

export const receiptsKey = ["receipts"];

export default function ReceiptsList() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: receipts = [], isLoading } = useQuery({
    queryKey: receiptsKey,
    queryFn: () => api.get<ReceiptRow[]>("/receipts").then((r) => r.data),
    refetchInterval: 5000,
  });

  return (
    <div>
      <PageHeader
        title="Receipts"
        actions={can("stock:write") && <Button onClick={() => navigate("/receipts/new")}>New receipt</Button>}
      />
      {isLoading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <DataTable<ReceiptRow>
          columns={[
            { key: "ref", label: "Reference", render: (r) => <span className="font-mono text-[13px]">{r.ref}</span> },
            { key: "vendor", label: "Vendor" },
            { key: "lineCount", label: "Lines", align: "right" },
            { key: "totalQty", label: "Units", align: "right" },
            { key: "createdAt", label: "Created", render: (r) => formatDate(r.createdAt) },
            { key: "receivedAt", label: "Received", render: (r) => (r.receivedAt ? formatDate(r.receivedAt) : "—") },
            { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          ]}
          rows={receipts}
          onRowClick={(r) => navigate(`/receipts/${r.id}`)}
          emptyMessage="No receipts yet"
        />
      )}
    </div>
  );
}
