import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate, formatDateTime, formatINR } from "../../lib/format";
import PageHeader from "../../components/PageHeader";
import StatusBar from "../../components/StatusBar";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { toast } from "../../components/Toast";
import { useAuth } from "../../auth/AuthContext";

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [techId, setTechId] = useState("");
  const [partsCost, setPartsCost] = useState("");
  const [labourCost, setLabourCost] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: qk.ticket(Number(id)),
    queryFn: () => api.get(`/tickets/${id}`).then((r) => r.data),
  });

  const { data: techs = [] } = useQuery({
    queryKey: qk.users("TECHNICIAN"),
    queryFn: () => api.get("/users", { params: { role: "TECHNICIAN" } }).then((r) => r.data),
    enabled: can("users:read"),
  });

  const transition = useMutation({
    mutationFn: (body: any) => api.post(`/tickets/${id}/transition`, body),
    onSuccess: () => {
      toast.success("Ticket updated");
      queryClient.invalidateQueries({ queryKey: qk.ticket(Number(id)) });
      queryClient.invalidateQueries({ queryKey: qk.tickets });
      queryClient.invalidateQueries({ queryKey: qk.invoices });
      queryClient.invalidateQueries({ queryKey: qk.dashboard("today") });
    },
  });

  if (isLoading || !ticket) return <p className="text-muted text-sm p-4">Loading…</p>;

  const statusSteps = ["New", "Assigned", "In Repair", "Resolved", "Closed"];
  const statusMap: Record<string, string> = {
    NEW: "New", ASSIGNED: "Assigned", IN_REPAIR: "In Repair", RESOLVED: "Resolved", CLOSED: "Closed",
  };

  return (
    <div>
      <PageHeader title={`Ticket ${ticket.ref}`} />
      <StatusBar steps={statusSteps} current={statusMap[ticket.status] || "New"} />

      {/* Info card */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-surface border border-border rounded-card p-sp6 mb-6">
        <div>
          <span className="text-xs text-muted">Customer</span>
          <p className="font-medium">{ticket.leadName}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Phone</span>
          <p className="font-medium">{ticket.leadPhone}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Address</span>
          <p className="font-medium">{ticket.leadAddress}</p>
        </div>
        {ticket.serial && (
          <div>
            <span className="text-xs text-muted">Serial</span>
            <p className="font-mono text-[13px] font-medium">{ticket.serial}</p>
          </div>
        )}
        {ticket.productName && (
          <div>
            <span className="text-xs text-muted">Product</span>
            <p className="font-medium">{ticket.productName}</p>
          </div>
        )}
        <div>
          <span className="text-xs text-muted">Warranty</span>
          <div className="mt-1">
            <Badge status={ticket.underWarranty ? "Covered" : "Expired"} />
            {ticket.warrantyUntil && (
              <span className="text-xs text-muted ml-2">
                {ticket.underWarranty ? `until ${formatDate(ticket.warrantyUntil)}` : formatDate(ticket.warrantyUntil)}
              </span>
            )}
          </div>
        </div>
        {ticket.technicianName && (
          <div>
            <span className="text-xs text-muted">Technician</span>
            <p className="font-medium">{ticket.technicianName}</p>
          </div>
        )}
        <div>
          <span className="text-xs text-muted">Created</span>
          <p className="font-medium">{formatDateTime(ticket.createdAt)}</p>
        </div>
      </div>

      {/* Issue */}
      <div className="bg-surface border border-border rounded-card p-sp6 mb-6">
        <h3 className="font-heading text-base font-semibold mb-2">Issue</h3>
        <p className="text-sm">{ticket.issue}</p>
      </div>

      {/* Costs (after resolve) */}
      {(ticket.partsCost > 0 || ticket.labourCost > 0 || ticket.billAmount > 0) && (
        <div className="bg-surface border border-border rounded-card p-sp6 mb-6">
          <h3 className="font-heading text-base font-semibold mb-3">Costs</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted">Parts</span>
              <p className="font-medium">{formatINR(ticket.partsCost)}</p>
            </div>
            <div>
              <span className="text-muted">Labour</span>
              <p className="font-medium">{formatINR(ticket.labourCost)}</p>
            </div>
            <div>
              <span className="text-muted">Bill Amount</span>
              <p className="font-medium">{formatINR(ticket.billAmount)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Invoice */}
      {ticket.invoice && (
        <div className="bg-surface border border-border rounded-card p-sp6 mb-6">
          <h3 className="font-heading text-base font-semibold mb-2">Repair Invoice</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-mono text-[13px]">{ticket.invoice.ref}</span>
            <span>{formatINR(ticket.invoice.amount)}</span>
            <Badge status={ticket.invoice.status} />
          </div>
        </div>
      )}

      {/* Actions */}
      {can("tickets:write") && (
        <div className="bg-surface border border-border rounded-card p-sp6">
          <h3 className="font-heading text-base font-semibold mb-4">Actions</h3>

          {/* Assign */}
          {ticket.status === "NEW" && (
            <div className="flex items-end gap-3">
              <Field label="Assign Technician">
                <select
                  value={techId}
                  onChange={(e) => setTechId(e.target.value)}
                  className="h-control rounded-sm border border-border bg-surface px-3 text-sm outline-none"
                >
                  <option value="">Select…</option>
                  {techs.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
              <Button
                onClick={() => transition.mutate({ to: "ASSIGNED", technicianId: Number(techId) })}
                disabled={!techId}
                loading={transition.isPending}
              >
                Assign
              </Button>
            </div>
          )}

          {/* In Repair */}
          {ticket.status === "ASSIGNED" && (
            <Button
              onClick={() => transition.mutate({ to: "IN_REPAIR" })}
              loading={transition.isPending}
            >
              Start Repair
            </Button>
          )}

          {/* Resolve */}
          {ticket.status === "IN_REPAIR" && (
            <div>
              <div className="flex gap-4 mb-4">
                <Field label="Parts Cost (₹)">
                  <input
                    type="number"
                    min={0}
                    value={partsCost}
                    onChange={(e) => setPartsCost(e.target.value)}
                    className="h-control w-32 rounded-sm border border-border bg-surface px-3 text-sm outline-none"
                  />
                </Field>
                <Field label="Labour Cost (₹)">
                  <input
                    type="number"
                    min={0}
                    value={labourCost}
                    onChange={(e) => setLabourCost(e.target.value)}
                    className="h-control w-32 rounded-sm border border-border bg-surface px-3 text-sm outline-none"
                  />
                </Field>
              </div>
              {!ticket.underWarranty && (
                <p className="text-sm text-warning mb-3">
                  Not under warranty — a repair invoice will be created for {formatINR((Number(partsCost) || 0) + (Number(labourCost) || 0))}.
                </p>
              )}
              {ticket.underWarranty && (
                <p className="text-sm text-success mb-3">
                  Under warranty — no charge to customer.
                </p>
              )}
              <Button
                onClick={() =>
                  transition.mutate({
                    to: "RESOLVED",
                    partsCost: Number(partsCost) || 0,
                    labourCost: Number(labourCost) || 0,
                  })
                }
                loading={transition.isPending}
              >
                Resolve
              </Button>
            </div>
          )}

          {/* Close */}
          {ticket.status === "RESOLVED" && (
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="w-4 h-4"
                />
                Customer confirmed resolution
              </label>
              <Button
                onClick={() => transition.mutate({ to: "CLOSED", customerConfirmed: true })}
                disabled={!confirmed}
                loading={transition.isPending}
              >
                Close Ticket
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
