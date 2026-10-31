import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import DataTable from "../../components/DataTable";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { toast } from "../../components/Toast";
import { Search } from "lucide-react";

interface LookupItem {
  serialUnitId: number;
  serial: string;
  productName: string;
  leadId: number;
  leadName: string;
  phone: string;
  address: string;
  deliveredAt: string | null;
  warrantyUntil: string | null;
  underWarranty: boolean;
}

export default function NewTicket() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LookupItem | null>(null);
  const [issue, setIssue] = useState("");

  const { data: results = [], isFetching } = useQuery({
    queryKey: qk.lookup(search),
    queryFn: () => api.get<LookupItem[]>("/tickets/lookup", { params: { q: search } }).then((r) => r.data),
    enabled: search.length >= 2,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post("/tickets", { serialUnitId: selected!.serialUnitId, issue }),
    onSuccess: (r) => {
      toast.success("Ticket created");
      queryClient.invalidateQueries({ queryKey: qk.tickets });
      navigate(`/tickets/${r.data.id}`);
    },
  });

  return (
    <div>
      <PageHeader title="New Ticket" />

      {/* Lookup box */}
      <div className="bg-surface border border-border rounded-card p-sp6 mb-6">
        <Field label="Look up serial, phone, or customer name">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
              placeholder="Type serial number, phone, or name…"
              className="w-full h-control rounded-sm border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
        </Field>

        {isFetching && <p className="text-muted text-xs mt-2">Searching…</p>}

        {/* Results */}
        {results.length > 0 && !selected && (
          <div className="mt-3 border border-border rounded-md divide-y divide-border max-h-64 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.serialUnitId}
                onClick={() => setSelected(r)}
                className="w-full text-left p-3 hover:bg-surface-2 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-[13px]">{r.serial}</span>
                  <span className="text-muted text-sm ml-2">{r.productName}</span>
                  <div className="text-sm text-muted">{r.leadName} · {r.phone}</div>
                </div>
                <Badge status={r.underWarranty ? "Covered" : "Expired"} />
              </button>
            ))}
          </div>
        )}

        {/* Selected card */}
        {selected && (
          <div className="mt-4 p-4 bg-surface-2 rounded-md">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-mono text-[13px] font-medium">{selected.serial}</p>
                <p className="text-sm">{selected.productName}</p>
                <p className="text-sm text-muted mt-1">{selected.leadName} · {selected.phone}</p>
                <p className="text-sm text-muted">{selected.address}</p>
              </div>
              <div className="text-right">
                <Badge status={selected.underWarranty ? "Covered" : "Expired"} />
                {selected.warrantyUntil && (
                  <p className="text-xs text-muted mt-1">
                    {selected.underWarranty ? "Covered until" : "Expired"} {formatDate(selected.warrantyUntil)}
                  </p>
                )}
              </div>
            </div>

            <Field label="Issue Description">
              <textarea
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                rows={3}
                className="w-full rounded-sm border border-border bg-surface p-3 text-sm outline-none focus:border-primary"
                placeholder="Describe the issue…"
              />
            </Field>

            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => create.mutate()}
                loading={create.isPending}
                disabled={!issue.trim()}
              >
                Create Ticket
              </Button>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
