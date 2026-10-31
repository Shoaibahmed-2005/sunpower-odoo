// Owned by A — stock levels (on hand / reserved / free) with inline adjust for counted goods.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatINR } from "../../lib/format";
import { useAuth } from "../../auth/AuthContext";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Button from "../../components/Button";
import { toast } from "../../components/Toast";

interface StockRow {
  productId: number;
  code: string;
  name: string;
  tracking: string;
  onHand: number;
  reserved: number;
  free: number;
  cost: number;
}

// serial-tracked goods are counted by their scanned units, so only these can be typed in
const ADJUSTABLE = ["QTY", "LOT"];

function AdjustCell({ row }: { row: StockRow }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(row.onHand));
  const adjust = useMutation({
    mutationFn: () => api.post<StockRow>("/stock/adjust", { productId: row.productId, newQty: Number(value) }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk.stock });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`${data.code} set to ${data.onHand}`);
    },
  });
  const changed = value !== String(row.onHand);
  const valid = value !== "" && Number.isInteger(Number(value)) && Number(value) >= 0;

  return (
    <div className="flex items-center justify-end gap-2">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-24 h-control rounded-sm border border-border bg-surface px-2 text-sm text-right"
      />
      <Button variant="secondary" disabled={!changed || !valid} loading={adjust.isPending} onClick={() => adjust.mutate()}>
        Save
      </Button>
    </div>
  );
}

export default function StockPage() {
  const { can } = useAuth();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: qk.stock,
    queryFn: () => api.get<StockRow[]>("/stock").then((r) => r.data),
    refetchInterval: 5000,
  });

  return (
    <div>
      <PageHeader title="Stock" />
      {isLoading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : (
        <DataTable<StockRow>
          columns={[
            { key: "code", label: "Code", render: (r) => <span className="font-mono text-[13px]">{r.code}</span> },
            { key: "name", label: "Product" },
            { key: "tracking", label: "Tracking", render: (r) => <span className="text-xs text-muted">{r.tracking}</span> },
            { key: "onHand", label: "On hand", align: "right" },
            { key: "reserved", label: "Reserved", align: "right" },
            {
              key: "free",
              label: "Free",
              align: "right",
              render: (r) => <span className={`font-medium ${r.free < 0 ? "text-danger" : r.free <= 2 ? "text-warning" : ""}`}>{r.free}</span>,
            },
            { key: "cost", label: "Unit cost", align: "right", render: (r) => formatINR(r.cost) },
            ...(can("stock:write")
              ? [{
                  key: "adjust",
                  label: "Counted qty",
                  align: "right" as const,
                  render: (r: StockRow) => (ADJUSTABLE.includes(r.tracking) ? <AdjustCell key={r.onHand} row={r} /> : <span className="text-xs text-muted">by scan</span>),
                }]
              : []),
          ]}
          rows={rows}
          emptyMessage="No products"
        />
      )}
    </div>
  );
}
