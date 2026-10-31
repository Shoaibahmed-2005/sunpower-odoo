// Owned by A — dispatch form: scan serials (USB scanner = types + Enter), unscan, validate, warranty banner.
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ShieldCheck, X } from "lucide-react";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDate } from "../../lib/format";
import { useAuth } from "../../auth/AuthContext";
import PageHeader from "../../components/PageHeader";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { toast } from "../../components/Toast";

interface DispatchLine {
  productId: number;
  code: string;
  name: string;
  tracking: string;
  qty: number;
  scanned: string[];
}

interface DispatchDetail {
  id: number;
  ref: string;
  status: string;
  lead: { name: string; phone: string; address: string };
  jobId: number;
  jobRef: string;
  lines: DispatchLine[];
  requiredCount: number;
  scannedCount: number;
  canValidate: boolean;
  warranties: { serial: string; productName: string; warrantyUntil: string }[];
}

function errorMessage(err: any): string {
  return err?.response?.data?.error ?? "Something went wrong";
}

export default function DispatchForm() {
  const { id } = useParams<{ id: string }>();
  const dispatchId = Number(id);
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const scanInput = useRef<HTMLInputElement>(null);
  const [serial, setSerial] = useState("");
  const [scanError, setScanError] = useState("");

  const { data: dispatch, isLoading } = useQuery({
    queryKey: qk.dispatch(dispatchId),
    queryFn: () => api.get<DispatchDetail>(`/dispatches/${dispatchId}`).then((r) => r.data),
    refetchInterval: 5000,
  });

  // every action returns the fresh dispatch: put it in the cache, then refresh the lists it affects
  const onChanged = (data: DispatchDetail, keys: (readonly unknown[])[]) => {
    queryClient.setQueryData(qk.dispatch(dispatchId), data);
    keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  };

  const scan = useMutation({
    mutationFn: (value: string) => api.post<DispatchDetail>(`/dispatches/${dispatchId}/scan`, { serial: value }).then((r) => r.data),
    onSuccess: (data, value) => {
      onChanged(data, [qk.dispatches]);
      setSerial("");
      setScanError("");
      toast.success(`${value} scanned`);
      scanInput.current?.focus();
    },
    // shown under the input too, so the warehouse sees why a scan was refused without looking away
    onError: (err) => setScanError(errorMessage(err)),
  });

  const unscan = useMutation({
    mutationFn: (value: string) => api.post<DispatchDetail>(`/dispatches/${dispatchId}/unscan`, { serial: value }).then((r) => r.data),
    onSuccess: (data, value) => {
      onChanged(data, [qk.dispatches]);
      toast.success(`${value} back in stock`);
    },
  });

  const validate = useMutation({
    mutationFn: () => api.post<DispatchDetail>(`/dispatches/${dispatchId}/validate`).then((r) => r.data),
    onSuccess: (data) => {
      onChanged(data, [qk.dispatches, qk.jobs, qk.stock, ["dashboard"]]);
      toast.success("Dispatch validated, warranty started");
    },
  });

  if (isLoading || !dispatch) return <p className="text-muted text-sm">Loading…</p>;

  const isReady = dispatch.status === "READY";
  const canWrite = can("dispatches:write");
  const serialLines = dispatch.lines.filter((l) => l.tracking === "SERIAL");
  const otherLines = dispatch.lines.filter((l) => l.tracking !== "SERIAL");

  const submitScan = () => {
    const value = serial.trim();
    if (value) scan.mutate(value);
  };

  return (
    <div>
      <PageHeader
        title={`Dispatch ${dispatch.ref}`}
        actions={
          <div className="flex items-center gap-3">
            <Badge status={dispatch.status} />
            {isReady && canWrite && (
              <span title={dispatch.canValidate ? "" : `Scan all serials first (${dispatch.scannedCount}/${dispatch.requiredCount})`}>
                <Button disabled={!dispatch.canValidate} loading={validate.isPending} onClick={() => validate.mutate()}>
                  Validate
                </Button>
              </span>
            )}
          </div>
        }
      />

      {dispatch.status === "DONE" && (
        <div className="flex items-start gap-3 rounded-card border border-success bg-[rgba(30,142,90,0.08)] p-sp4 mb-6">
          <ShieldCheck className="w-6 h-6 text-success shrink-0" />
          <div className="w-full">
            <p className="font-semibold text-success">Delivered. Warranty has started.</p>
            <table className="w-full text-sm mt-2">
              <tbody>
                {dispatch.warranties.map((w) => (
                  <tr key={w.serial} className="border-b border-border last:border-0">
                    <td className="py-1.5 font-mono text-[13px]">{w.serial}</td>
                    <td className="py-1.5">{w.productName}</td>
                    <td className="py-1.5 text-right">until {formatDate(w.warrantyUntil)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface border border-border rounded-card p-sp6 mb-6">
        <div>
          <span className="text-xs text-muted">Customer</span>
          <p className="font-medium">{dispatch.lead.name}</p>
          <p className="text-sm text-muted">{dispatch.lead.phone}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Address</span>
          <p className="font-medium">{dispatch.lead.address}</p>
        </div>
        <div>
          <span className="text-xs text-muted">Installation job</span>
          <p>
            <Link to={`/jobs/${dispatch.jobId}`} className="font-mono text-[13px] text-primary underline">{dispatch.jobRef}</Link>
          </p>
        </div>
      </div>

      {isReady && canWrite && (
        <div className="bg-surface border border-border rounded-card p-sp6 mb-6">
          <Field label={`Scan serial (${dispatch.scannedCount}/${dispatch.requiredCount} scanned)`} error={scanError}>
            <div className="flex gap-2">
              <input
                ref={scanInput}
                autoFocus
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitScan()}
                placeholder="Scan or type a serial, then Enter"
                className="flex-1 h-control rounded-sm border border-border bg-surface px-3 font-mono text-sm outline-none focus:border-primary"
              />
              <Button variant="secondary" loading={scan.isPending} disabled={!serial.trim()} onClick={submitScan}>
                Add
              </Button>
            </div>
          </Field>
        </div>
      )}

      <div className="bg-surface border border-border rounded-card p-sp6 mb-6">
        <h3 className="font-heading text-base font-semibold mb-3">Serial-tracked items</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs uppercase border-b border-border">
              <th className="text-left py-2">Item</th>
              <th className="text-left py-2">Scanned serials</th>
              <th className="text-right py-2">Scanned</th>
            </tr>
          </thead>
          <tbody>
            {serialLines.map((line) => (
              <tr key={line.productId} className="border-b border-border align-top">
                <td className="py-2">
                  <p className="font-medium">{line.name}</p>
                  <p className="font-mono text-[12px] text-muted">{line.code}</p>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    {line.scanned.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-sm bg-surface-2 px-2 py-0.5 font-mono text-[12px]">
                        {s}
                        {isReady && canWrite && (
                          <button title="Unscan: put back in stock" onClick={() => unscan.mutate(s)} className="text-muted hover:text-danger">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                </td>
                <td className={`py-2 text-right font-medium ${line.scanned.length === line.qty ? "text-success" : "text-warning"}`}>
                  {line.scanned.length}/{line.qty}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-surface border border-border rounded-card p-sp6">
        <h3 className="font-heading text-base font-semibold mb-3">Other items (counted, not scanned)</h3>
        <table className="w-full text-sm">
          <tbody>
            {otherLines.map((line) => (
              <tr key={line.productId} className="border-b border-border last:border-0">
                <td className="py-2">{line.name}</td>
                <td className="py-2 text-muted text-xs">{line.tracking}</td>
                <td className="py-2 text-right">{line.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
