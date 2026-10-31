// Owned by A — find any unit by serial or customer name, with its warranty state.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";

interface SerialRow {
  serial: string;
  productName: string;
  status: string;
  leadName: string | null;
  deliveredAt: string | null;
  warrantyUntil: string | null;
  underWarranty: boolean;
}

export default function SerialsLookup() {
  const [q, setQ] = useState("");
  const { data: serials = [], isLoading } = useQuery({
    queryKey: qk.serials(q),
    queryFn: () => api.get<SerialRow[]>("/serials", { params: { q } }).then((r) => r.data),
  });

  return (
    <div>
      <PageHeader title="Serial numbers" />
      <DataTable<SerialRow>
        columns={[
          { key: "serial", label: "Serial", render: (r) => <span className="font-mono text-[13px]">{r.serial}</span> },
          { key: "productName", label: "Product" },
          { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
          { key: "leadName", label: "Customer", render: (r) => r.leadName ?? "—" },
          { key: "deliveredAt", label: "Delivered", render: (r) => (r.deliveredAt ? formatDate(r.deliveredAt) : "—") },
          {
            key: "warrantyUntil",
            label: "Warranty",
            render: (r) =>
              r.warrantyUntil ? (
                <span className="flex items-center gap-2">
                  <Badge status={r.underWarranty ? "Covered" : "Expired"} />
                  {formatDate(r.warrantyUntil)}
                </span>
              ) : (
                "—"
              ),
          },
        ]}
        rows={serials}
        searchPlaceholder="Serial or customer name…"
        onSearch={setQ}
        emptyMessage={isLoading ? "Loading…" : "No serial matches"}
      />
    </div>
  );
}
