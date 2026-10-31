// record goods on the way from a vendor (stock changes only when received).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import api from "../../api/client";
import { formatINR } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { toast } from "../../components/Toast";
import { receiptsKey } from "./ReceiptsList";

interface Product {
  id: number;
  code: string;
  name: string;
  tracking: string;
  cost: number;
}

interface LineDraft {
  productId: string;
  qty: string;
  unitCost: string; // empty = the product's usual cost
}

const emptyLine: LineDraft = { productId: "", qty: "1", unitCost: "" };
const inputClass = "h-control rounded-sm border border-border bg-surface px-3 text-sm";

export default function NewReceipt() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [vendor, setVendor] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([{ ...emptyLine }]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => api.get<Product[]>("/products").then((r) => r.data),
  });
  // services are labour, never stock
  const stocked = products.filter((p) => p.tracking !== "SERVICE");

  const create = useMutation({
    mutationFn: () =>
      api.post("/receipts", {
        vendor,
        lines: lines.map((l) => ({
          productId: Number(l.productId),
          qty: Number(l.qty),
          unitCost: l.unitCost === "" ? null : Number(l.unitCost),
        })),
      }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: receiptsKey });
      toast.success(`${data.ref} created`);
      navigate(`/receipts/${data.id}`);
    },
  });

  const setLine = (i: number, change: Partial<LineDraft>) =>
    setLines(lines.map((l, j) => (j === i ? { ...l, ...change } : l)));
  const complete = vendor.trim() !== "" && lines.every((l) => l.productId !== "" && Number(l.qty) >= 1);

  return (
    <div>
      <PageHeader title="New receipt" />
      <div className="bg-surface border border-border rounded-card p-sp6 flex flex-col gap-4 max-w-3xl">
        <Field label="Vendor">
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} maxLength={100} className={inputClass} />
        </Field>

        {lines.map((line, i) => {
          const product = stocked.find((p) => String(p.id) === line.productId);
          return (
            <div key={i} className="grid grid-cols-[1fr_6rem_8rem_auto] gap-3 items-end">
              <Field label="Product">
                <select value={line.productId} onChange={(e) => setLine(i, { productId: e.target.value })} className={inputClass}>
                  <option value="">Choose…</option>
                  {stocked.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Qty">
                <input type="number" min={1} value={line.qty} onChange={(e) => setLine(i, { qty: e.target.value })} className={inputClass} />
              </Field>
              <Field label="Unit cost (₹)">
                <input
                  type="number"
                  min={0}
                  value={line.unitCost}
                  placeholder={product ? formatINR(product.cost) : ""}
                  onChange={(e) => setLine(i, { unitCost: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Button variant="ghost" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          );
        })}

        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => setLines([...lines, { ...emptyLine }])}>
            <Plus className="w-4 h-4 mr-1" /> Add line
          </Button>
          <Button disabled={!complete} loading={create.isPending} onClick={() => create.mutate()}>
            Create receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
