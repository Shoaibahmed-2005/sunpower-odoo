// Technician service visit on the phone: start the repair, then resolve it with parts + labour.
// Billing is decided on the server from the warranty stored when the ticket was opened (₹0 if covered).
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate, formatINR } from "../../lib/format";
import PhonePage from "../../components/PhonePage";
import Card from "../../components/Card";
import Badge from "../../components/Badge";
import Field from "../../components/Field";
import { toast } from "../../components/Toast";
import { ArrowLeft, Check, Phone, Play } from "lucide-react";

interface TicketData {
  id: number;
  ref: string;
  status: string;
  issue: string;
  underWarranty: boolean;
  leadName: string;
  leadPhone: string;
  leadAddress: string;
  serial: string | null;
  productName: string | null;
  warrantyUntil: string | null;
  partsCost: number;
  labourCost: number;
  billAmount: number;
  resolvedAt: string | null;
}

const inputCls =
  "w-full h-12 rounded-md border border-border bg-surface px-4 text-base font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

export default function TicketVisit() {
  const { id } = useParams<{ id: string }>();
  const ticketId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [parts, setParts] = useState("");
  const [labour, setLabour] = useState("");

  const { data: t, isLoading } = useQuery({
    queryKey: qk.ticket(ticketId),
    queryFn: () => api.get<TicketData>(`/tickets/${ticketId}`).then((r) => r.data),
    enabled: !!ticketId,
  });

  const move = useMutation({
    mutationFn: (body: { to: "IN_REPAIR" | "RESOLVED"; partsCost?: number; labourCost?: number }) =>
      api.post(`/tickets/${ticketId}/transition`, body).then((r) => r.data),
    onSuccess: (_data, body) => {
      toast.success(body.to === "IN_REPAIR" ? "Repair started" : "Marked resolved. The customer will be asked to confirm");
      queryClient.invalidateQueries({ queryKey: qk.ticket(ticketId) });
      queryClient.invalidateQueries({ queryKey: qk.myTickets });
      queryClient.invalidateQueries({ queryKey: qk.tickets });
      queryClient.invalidateQueries({ queryKey: qk.invoices });
      if (body.to === "RESOLVED") navigate("/m");
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || "Could not update the ticket"),
  });

  if (isLoading || !t) {
    return (
      <PhonePage title="Loading…" subtitle="Service visit">
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </PhonePage>
    );
  }

  const assigned = t.status === "ASSIGNED";
  const inRepair = t.status === "IN_REPAIR";
  const partsNum = Number(parts || 0);
  const labourNum = Number(labour || 0);
  const costsValid = parts !== "" && labour !== "" && partsNum >= 0 && labourNum >= 0;
  const bill = t.underWarranty ? 0 : partsNum + labourNum;

  return (
    <PhonePage
      title={`Service ${t.ref}`}
      subtitle={`${t.leadName}${t.productName ? ` • ${t.productName}` : ""}`}
      headerAction={
        <button type="button" onClick={() => navigate("/m")} className="text-white/80 hover:text-white p-1" title="Back to my tasks">
          <ArrowLeft className="w-5 h-5" />
        </button>
      }
      primaryActionLabel={assigned ? "Start Repair" : inRepair ? "Mark Resolved" : undefined}
      primaryActionIcon={assigned ? Play : inRepair ? Check : undefined}
      onPrimaryAction={
        assigned
          ? () => move.mutate({ to: "IN_REPAIR" })
          : inRepair
          ? () => move.mutate({ to: "RESOLVED", partsCost: partsNum, labourCost: labourNum })
          : undefined
      }
      primaryActionDisabled={inRepair && !costsValid}
      primaryActionDisabledReason={inRepair && !costsValid ? "Enter parts and labour (0 if none)" : undefined}
      primaryActionLoading={move.isPending}
    >
      <div className="flex items-center justify-between gap-2 p-3 bg-surface rounded-card border border-border shadow-xs">
        <Badge status={t.status} size="sm" />
        <Badge status={t.underWarranty ? "Covered" : "Expired"} size="sm" />
      </div>

      <Card title="Customer & Site">
        <div className="space-y-1.5 text-sm">
          <p className="font-heading text-base font-bold text-text">{t.leadName}</p>
          <a href={`tel:${t.leadPhone}`} className="inline-flex items-center gap-1.5 font-mono text-sm text-primary font-semibold">
            <Phone className="w-4 h-4" /> {t.leadPhone}
          </a>
          <p className="text-xs text-text">{t.leadAddress}</p>
        </div>
      </Card>

      <Card title="Reported Problem">
        <p className="text-sm text-text">{t.issue}</p>
        <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted space-y-1">
          <p>
            Unit: <span className="font-mono text-text">{t.serial || "—"}</span>
          </p>
          <p>
            Warranty: {t.underWarranty ? "covered" : "expired"}
            {t.warrantyUntil && <> (until {formatDate(t.warrantyUntil)})</>}
          </p>
        </div>
      </Card>

      {inRepair && (
        <Card title="Repair Costs">
          <div className="space-y-3">
            <Field label="Spare parts (₹)" required hint="0 if no parts were used">
              <input type="number" inputMode="numeric" min={0} value={parts} onChange={(e) => setParts(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Labour (₹)" required hint="0 if no labour charge">
              <input type="number" inputMode="numeric" min={0} value={labour} onChange={(e) => setLabour(e.target.value)} className={inputCls} />
            </Field>
            <p className={`text-sm font-semibold ${t.underWarranty ? "text-success" : "text-text"}`}>
              Customer pays: {formatINR(bill)}
              {t.underWarranty && " (under warranty)"}
            </p>
          </div>
        </Card>
      )}

      {(t.status === "RESOLVED" || t.status === "CLOSED") && (
        <Card title="Result">
          <div className="text-sm space-y-1">
            <p>Parts {formatINR(t.partsCost)} · Labour {formatINR(t.labourCost)}</p>
            <p className="font-semibold">Customer bill: {formatINR(t.billAmount)}</p>
            <p className="text-xs text-muted">
              {t.status === "CLOSED" ? "Closed after the customer confirmed." : "Waiting for the customer to confirm the repair."}
            </p>
          </div>
        </Card>
      )}
    </PhonePage>
  );
}
