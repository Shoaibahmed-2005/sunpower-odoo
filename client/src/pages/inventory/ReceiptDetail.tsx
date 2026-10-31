// Owned by A — receive a receipt: scan each new serial (Enter adds it), then Receive counts everything in.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { X } from "lucide-react";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate, formatINR } from "../../lib/format";
import { useAuth } from "../../auth/AuthContext";
import PageHeader from "../../components/PageHeader";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import { toast } from "../../components/Toast";
import { receiptsKey } from "./ReceiptsList";

interface ReceiptLine {
  id: number;
  productId: number;
  code: string;
  name: string;
  tracking: string;
  qty: number;
  unitCost: number;
  serials: string[];
}

interface Receipt {
  id: number;
  ref: string;
  vendor: string;
  status: string;
  createdAt: string;
  receivedAt: string | null;
  lines: ReceiptLine[];
}

export default function ReceiptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  // serials typed or scanned so far, per receipt line (kept in the page until Receive)
  const [entered, setEntered] = useState<Record<number, string[]>>({});
  const [typing, setTyping] = useState<Record<number, string>>({});

  const { data: receipt, isLoading } = useQuery({
    queryKey: [...receiptsKey, Number(id)],
    queryFn: () => api.get<Receipt>(`/receipts/${id}`).then((r) => r.data),
  });

  const receive = useMutation({
    mutationFn: () =>
      api.post<Receipt>(`/receipts/${id}/receive`, {
        lines: Object.entries(entered).map(([lineId, serials]) => ({ lineId: Number(lineId), serials })),
      }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData([...receiptsKey, Number(id)], data);
      [receiptsKey, qk.stock, ["dashboard"]].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      toast.success(`${data.ref} received, stock updated`);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/receipts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: receiptsKey });
      toast.success("Draft receipt deleted");
      navigate("/receipts");
    },
  });

  if (isLoading || !receipt) return <p className="text-muted text-sm">Loading…</p>;

  const isDraft = receipt.status === "DRAFT" && can("stock:write");
  const serialLines = receipt.lines.filter((l) => l.tracking === "SERIAL");
  const missing = serialLines.filter((l) => (entered[l.id] ?? []).length !== l.qty);

  const addSerial = (line: ReceiptLine) => {
    const value = (typing[line.id] ?? "").trim();
    const list = entered[line.id] ?? [];
    if (!value) return;
    if (list.includes(value)) return toast.error(`${value} is already in the list`);
    if (list.length >= line.qty) return toast.error(`Only ${line.qty} × ${line.code} on this receipt`);
    setEntered({ ...entered, [line.id]: [...list, value] });
    setTyping({ ...typing, [line.id]: "" });
  };

  const dropSerial = (lineId: number, serial: string) =>
    setEntered({ ...entered, [lineId]: (entered[lineId] ?? []).filter((s) => s !== serial) });

  return (
    <div>
      <PageHeader
        title={`Receipt ${receipt.ref}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge status={receipt.status} />
            {isDraft && (
              <>
                <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>Delete draft</Button>
                <span title={missing.length ? `Scan all serials first: ${missing.map((l) => l.code).join(", ")}` : ""}>
                  <Button disabled={missing.length > 0} loading={receive.isPending} onClick={() => receive.mutate()}>
                    Receive
                  </Button>
                </span>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface border border-border rounded-card p-sp6 mb-6">
        <div>
          <span className="text-xs text-muted">Vendor</span>
          <p className="font-medium">{receipt.vendor}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Created</span>
          <p className="font-medium">{formatDate(receipt.createdAt)}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Received</span>
          <p className="font-medium">{receipt.receivedAt ? formatDate(receipt.receivedAt) : "Not yet"}</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-card p-sp6">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs uppercase border-b border-border">
              <th className="text-left py-2">Item</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Unit cost</th>
              <th className="text-left py-2 pl-6">Serials</th>
            </tr>
          </thead>
          <tbody>
            {receipt.lines.map((line) => {
              const list = isDraft ? entered[line.id] ?? [] : line.serials;
              return (
                <tr key={line.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2">
                    <p className="font-medium">{line.name}</p>
                    <p className="font-mono text-[12px] text-muted">{line.code}</p>
                  </td>
                  <td className="py-2 text-right">{line.qty}</td>
                  <td className="py-2 text-right">{formatINR(line.unitCost)}</td>
                  <td className="py-2 pl-6">
                    {line.tracking !== "SERIAL" ? (
                      <span className="text-xs text-muted">counted, no serials</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {isDraft && (
                          <div className="flex items-center gap-2">
                            <input
                              value={typing[line.id] ?? ""}
                              onChange={(e) => setTyping({ ...typing, [line.id]: e.target.value })}
                              onKeyDown={(e) => e.key === "Enter" && addSerial(line)}
                              placeholder="Scan serial, then Enter"
                              className="w-64 h-control rounded-sm border border-border bg-surface px-3 font-mono text-sm outline-none focus:border-primary"
                            />
                            <span className={`font-medium ${list.length === line.qty ? "text-success" : "text-warning"}`}>
                              {list.length}/{line.qty}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {list.map((s) => (
                            <span key={s} className="inline-flex items-center gap-1 rounded-sm bg-surface-2 px-2 py-0.5 font-mono text-[12px]">
                              {s}
                              {isDraft && (
                                <button title="Remove" onClick={() => dropSerial(line.id, s)} className="text-muted hover:text-danger">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
