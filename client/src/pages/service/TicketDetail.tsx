import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate, formatDateTime, formatINR } from "../../lib/format";
import RecordPage from "../../components/RecordPage";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Field, { FormSection } from "../../components/Field";
import { toast } from "../../components/Toast";
import { useAuth } from "../../auth/AuthContext";
import { Wrench, User, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
      toast.success("Ticket updated successfully");
      queryClient.invalidateQueries({ queryKey: qk.ticket(Number(id)) });
      queryClient.invalidateQueries({ queryKey: qk.tickets });
      queryClient.invalidateQueries({ queryKey: qk.invoices });
      queryClient.invalidateQueries({ queryKey: qk.dashboard("today") });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Failed to update ticket status");
    },
  });

  if (isLoading || !ticket) {
    return (
      <div className="py-16 text-center text-muted">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm">Loading ticket record…</p>
      </div>
    );
  }

  const statusSteps = ["New", "Assigned", "In Repair", "Resolved", "Closed"];
  const statusMap: Record<string, string> = {
    NEW: "New",
    ASSIGNED: "Assigned",
    IN_REPAIR: "In Repair",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  };

  const summaryFields = [
    { label: "Ticket Ref", value: ticket.ref, isMono: true },
    {
      label: "Status",
      value: <Badge status={ticket.status} />,
    },
    {
      label: "Warranty Status",
      value: (
        <Badge
          status={ticket.underWarranty ? "Covered" : "Expired"}
          size="sm"
        />
      ),
    },
    {
      label: "Assigned Tech",
      value: ticket.technicianName || "Unassigned",
      isBold: true,
    },
    {
      label: "Reported",
      value: formatDate(ticket.createdAt),
    },
    {
      label: "Total Billed",
      value: formatINR(ticket.billAmount || 0),
      align: "right" as const,
      isBold: true,
    },
  ];

  return (
    <RecordPage
      title={`Ticket ${ticket.ref}${ticket.source === "PORTAL" ? " [PORTAL]" : ""}`}
      subtitle={`Customer: ${ticket.leadName}`}
      breadcrumbs={[
        { label: "Service", href: "/tickets" },
        { label: ticket.ref },
      ]}
      actions={
        <Button variant="secondary" onClick={() => navigate("/tickets")}>
          Back to Tickets
        </Button>
      }
      statusSteps={statusSteps}
      currentStatus={statusMap[ticket.status] || "New"}
      summaryFields={summaryFields}
    >
      {/* Customer & Asset Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Customer Details">
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs text-muted block">Customer Name</span>
              <span className="font-semibold text-text">{ticket.leadName}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Contact Phone</span>
              <span className="font-mono text-text">{ticket.leadPhone}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Address</span>
              <span className="text-text">{ticket.leadAddress}</span>
            </div>
          </div>
        </Card>

        <Card title="Equipment & Warranty Status">
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs text-muted block">Reported Serial Unit</span>
              <span className="font-mono font-medium text-primary text-[13px]">
                {ticket.serial || "No specific serial linked"}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted block">Product Model</span>
              <span className="text-text">{ticket.productName || "Solar Equipment"}</span>
            </div>
            <div>
              <span className="text-xs text-muted block">Warranty Coverage</span>
              <div className="mt-1 flex items-center gap-2">
                <Badge status={ticket.underWarranty ? "Covered" : "Expired"} />
                {ticket.warrantyUntil && (
                  <span className="text-xs text-muted">
                    {ticket.underWarranty
                      ? `Valid until ${formatDate(ticket.warrantyUntil)}`
                      : `Expired on ${formatDate(ticket.warrantyUntil)}`}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Breakdown Description */}
      <Card title="Reported Breakdown / Issue" icon={AlertTriangle}>
        <div className="p-3.5 bg-surface-2/60 rounded-md border border-border text-sm text-text whitespace-pre-wrap leading-relaxed">
          {ticket.issue}
        </div>
      </Card>

      {/* Cost & Invoice Summary */}
      {(ticket.partsCost > 0 || ticket.labourCost > 0 || ticket.billAmount > 0 || ticket.invoice) && (
        <Card title="Repair Billing & Invoicing" icon={FileText}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="p-3 bg-surface-2/50 rounded-md border border-border">
              <span className="text-xs text-muted block">Spare Parts Cost</span>
              <span className="text-base font-semibold text-text tabular-nums">
                {formatINR(ticket.partsCost)}
              </span>
            </div>
            <div className="p-3 bg-surface-2/50 rounded-md border border-border">
              <span className="text-xs text-muted block">Technician Labour</span>
              <span className="text-base font-semibold text-text tabular-nums">
                {formatINR(ticket.labourCost)}
              </span>
            </div>
            <div className="p-3 bg-surface-2/50 rounded-md border border-border">
              <span className="text-xs text-muted block">Total Customer Bill</span>
              <span className="text-base font-bold text-text tabular-nums">
                {formatINR(ticket.billAmount)}
              </span>
            </div>
          </div>

          {ticket.invoice && (
            <div className="flex items-center justify-between p-3.5 bg-primary/5 rounded-md border border-primary/20">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <span className="font-mono text-sm font-semibold text-primary">
                    {ticket.invoice.ref}
                  </span>
                  <span className="text-xs text-muted block">Generated Repair Invoice</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm tabular-nums">
                  {formatINR(ticket.invoice.amount)}
                </span>
                <Badge status={ticket.invoice.status} size="sm" />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Ticket Workflow Operations */}
      {can("tickets:write") && (
        <Card title="Workflow Actions & State Transitions" icon={Wrench}>
          {ticket.status === "NEW" && (
            <div className="space-y-4 max-w-md">
              <Field label="Assign Technician for Diagnosis" required>
                <select
                  value={techId}
                  onChange={(e) => setTechId(e.target.value)}
                  className="w-full h-control rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">Select a technician…</option>
                  {techs.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                variant="primary"
                onClick={() =>
                  transition.mutate({
                    to: "ASSIGNED",
                    technicianId: Number(techId),
                  })
                }
                disabled={!techId}
                disabledReason="Please select an active technician to assign"
                loading={transition.isPending}
              >
                Assign Technician
              </Button>
            </div>
          )}

          {ticket.status === "ASSIGNED" && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Technician has been assigned. Mark ticket as In Repair when diagnostic work begins.
              </p>
              <Button
                variant="primary"
                onClick={() => transition.mutate({ to: "IN_REPAIR" })}
                loading={transition.isPending}
              >
                Start Repair
              </Button>
            </div>
          )}

          {ticket.status === "IN_REPAIR" && (
            <div className="space-y-4 max-w-lg">
              <p className="text-sm text-muted">
                Record actual repair expenses before resolving the ticket.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Parts Cost (₹)">
                  <input
                    type="number"
                    min={0}
                    value={partsCost}
                    onChange={(e) => setPartsCost(e.target.value)}
                    placeholder="0"
                    className="w-full h-control rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-primary tabular-nums"
                  />
                </Field>
                <Field label="Labour Cost (₹)">
                  <input
                    type="number"
                    min={0}
                    value={labourCost}
                    onChange={(e) => setLabourCost(e.target.value)}
                    placeholder="0"
                    className="w-full h-control rounded-sm border border-border bg-surface px-3 text-sm outline-none focus:border-primary tabular-nums"
                  />
                </Field>
              </div>

              {!ticket.underWarranty ? (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-md text-xs text-warning leading-relaxed">
                  ⚠️ This asset is <strong>Expired / Out of Warranty</strong>. Resolving this ticket will automatically generate an invoice of{" "}
                  <strong>
                    {formatINR((Number(partsCost) || 0) + (Number(labourCost) || 0))}
                  </strong>{" "}
                  payable by the customer.
                </div>
              ) : (
                <div className="p-3 bg-success/10 border border-success/30 rounded-md text-xs text-success leading-relaxed flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    Asset is <strong>Under Warranty</strong> — ₹0 customer charge.
                  </span>
                </div>
              )}

              <Button
                variant="primary"
                onClick={() =>
                  transition.mutate({
                    to: "RESOLVED",
                    partsCost: Number(partsCost) || 0,
                    labourCost: Number(labourCost) || 0,
                  })
                }
                loading={transition.isPending}
              >
                Resolve Ticket
              </Button>
            </div>
          )}

          {ticket.status === "RESOLVED" && (
            <div className="space-y-4 max-w-md">
              <p className="text-sm text-muted">
                Gate: Ticket closes only after the customer confirms satisfactory resolution of the breakdown.
              </p>
              <label className="flex items-start gap-2.5 p-3 rounded-md border border-border bg-surface-2/40 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-text">
                  Customer has confirmed repair & tested system function
                </span>
              </label>
              <Button
                variant="primary"
                onClick={() =>
                  transition.mutate({ to: "CLOSED", customerConfirmed: true })
                }
                disabled={!confirmed}
                disabledReason="Customer confirmation checkbox is required to close"
                loading={transition.isPending}
              >
                Close Ticket
              </Button>
            </div>
          )}

          {ticket.status === "CLOSED" && (
            <div className="flex items-center gap-2 text-success text-sm font-medium py-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>Ticket was completed and closed on {formatDateTime(ticket.customerConfirmedAt || ticket.resolvedAt || ticket.createdAt)}.</span>
            </div>
          )}
        </Card>
      )}
    </RecordPage>
  );
}
