import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { toast } from "../../components/Toast";
import { Search, ShieldAlert, CheckCircle, ArrowLeft } from "lucide-react";

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
    queryFn: () =>
      api
        .get<LookupItem[]>("/tickets/lookup", { params: { q: search } })
        .then((r) => r.data),
    enabled: search.length >= 2,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post("/tickets", { serialUnitId: selected!.serialUnitId, issue }),
    onSuccess: (r) => {
      toast.success("Ticket registered successfully");
      queryClient.invalidateQueries({ queryKey: qk.tickets });
      navigate(`/tickets/${r.data.id}`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to create ticket");
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Create Service Ticket"
        subtitle="Lookup serial number, customer name, or phone to verify 20-year / 2-year warranty"
        breadcrumbs={[
          { label: "Service", href: "/tickets" },
          { label: "New Ticket" },
        ]}
        actions={
          <Button variant="secondary" onClick={() => navigate("/tickets")}>
            Cancel
          </Button>
        }
      />

      {/* Asset Lookup Card */}
      <Card title="Equipment & Warranty Search">
        <Field
          label="Search by Inverter/Battery Serial, Customer Phone, or Name"
          hint="Type at least 2 characters to search delivered units"
        >
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected(null);
              }}
              placeholder="e.g. INV-OG3, 9876543210, Ramesh…"
              className="w-full h-control rounded-sm border border-border bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>
        </Field>

        {isFetching && (
          <p className="text-muted text-xs mt-2 italic">Searching records…</p>
        )}

        {/* Search Results Dropdown List */}
        {results.length > 0 && !selected && (
          <div className="mt-3 border border-border rounded-md divide-y divide-border/70 max-h-64 overflow-y-auto bg-surface shadow-xs">
            {results.map((r) => (
              <button
                key={r.serialUnitId}
                type="button"
                onClick={() => setSelected(r)}
                className="w-full text-left p-3 hover:bg-surface-2 flex items-center justify-between transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">
                      {r.serial}
                    </span>
                    <span className="text-xs text-muted">({r.productName})</span>
                  </div>
                  <p className="text-xs text-text mt-0.5">
                    {r.leadName} • {r.phone}
                  </p>
                </div>
                <Badge
                  status={r.underWarranty ? "Covered" : "Expired"}
                  size="sm"
                />
              </button>
            ))}
          </div>
        )}

        {/* Selected Equipment Card with Warranty Status */}
        {selected && (
          <div className="mt-4 p-4 rounded-md border border-border bg-surface-2/60 space-y-4 animate-in fade-in-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/80">
              <div>
                <span className="font-mono text-base font-semibold text-primary">
                  {selected.serial}
                </span>
                <span className="text-sm text-text ml-2 font-medium">
                  {selected.productName}
                </span>
                <p className="text-xs text-muted mt-1">
                  Customer: <strong>{selected.leadName}</strong> • {selected.phone} • {selected.address}
                </p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <Badge status={selected.underWarranty ? "Covered" : "Expired"} />
                {selected.warrantyUntil && (
                  <p className="text-[11px] text-muted mt-1">
                    {selected.underWarranty ? "Warranty until " : "Expired on "}
                    <strong>{formatDate(selected.warrantyUntil)}</strong>
                  </p>
                )}
              </div>
            </div>

            <Field label="Breakdown / Failure Description" required>
              <textarea
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                rows={3}
                placeholder="Describe failure, error codes on inverter, wiring burns, customer symptoms…"
                className="w-full rounded-sm border border-border bg-surface p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </Field>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => create.mutate()}
                loading={create.isPending}
                disabled={!issue.trim()}
                disabledReason="Enter an issue description to create the ticket"
              >
                Submit Ticket
              </Button>
              <Button
                variant="secondary"
                onClick={() => setSelected(null)}
              >
                Change Equipment
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
