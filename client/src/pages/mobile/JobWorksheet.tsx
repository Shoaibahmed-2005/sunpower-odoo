import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDateTime } from "../../lib/format";
import PhonePage from "../../components/PhonePage";
import Card from "../../components/Card";
import SignaturePad from "../../components/SignaturePad";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { toast } from "../../components/Toast";
import { Camera, CheckCircle2, Play, Check, ArrowLeft, AlertCircle } from "lucide-react";

export default function JobWorksheet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [signature, setSignature] = useState<string | null>(null);
  const [sizeConfirmed, setSizeConfirmed] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const { data: job, isLoading } = useQuery({
    queryKey: qk.job(Number(id)),
    queryFn: () => api.get(`/jobs/${id}`).then((r) => r.data),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: qk.jobs });
    queryClient.invalidateQueries({ queryKey: qk.myJobs });
    queryClient.invalidateQueries({ queryKey: qk.job(Number(id)) });
    queryClient.invalidateQueries({ queryKey: qk.dashboard("today") });
  };

  const startJob = useMutation({
    mutationFn: () => api.post(`/jobs/${id}/start`),
    onSuccess: () => {
      toast.success("Job started successfully");
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Cannot start job");
    },
  });

  const finishJob = useMutation({
    mutationFn: () =>
      api.post(`/jobs/${id}/finish`, {
        signature,
        sizeConfirmed: Number(sizeConfirmed),
        photos,
      }),
    onSuccess: () => {
      toast.success("Installation completed!");
      invalidateAll();
      navigate("/m");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error || "Cannot finish job");
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api.post("/uploads", form);
      setPhotos((prev) => [...prev, r.data.url]);
      toast.success("Site photo uploaded");
    } catch {
      toast.error("Photo upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !job) {
    return (
      <PhonePage title="Loading…" subtitle="Technician Worksheet">
        <div className="py-12 text-center text-muted">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading task details…</p>
        </div>
      </PhonePage>
    );
  }

  const isDispatched = job.status === "DISPATCHED";
  const isDispatchDone = job.dispatchStatus === "DONE";
  const canStart = isDispatched && isDispatchDone;
  const isInProgress = job.status === "IN_PROGRESS";
  const isDone = job.status === "DONE";

  const canFinish =
    isInProgress &&
    Boolean(signature) &&
    photos.length > 0 &&
    Boolean(sizeConfirmed && Number(sizeConfirmed) > 0);

  let finishDisabledReason = "";
  if (!sizeConfirmed || Number(sizeConfirmed) <= 0) {
    finishDisabledReason = "Confirm system size in kW";
  } else if (photos.length === 0) {
    finishDisabledReason = "Upload at least one installation photo";
  } else if (!signature) {
    finishDisabledReason = "Customer signature required";
  }

  return (
    <PhonePage
      title={`Job ${job.ref}`}
      subtitle={`${job.leadName} • ${job.kw} kW`}
      headerAction={
        <button
          type="button"
          onClick={() => navigate("/m")}
          className="text-white/80 hover:text-white p-1"
          title="Back to my tasks"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      }
      primaryActionLabel={
        isInProgress
          ? "Complete & Finish Job"
          : isDispatched
          ? "Start Installation"
          : undefined
      }
      primaryActionIcon={isInProgress ? Check : isDispatched ? Play : undefined}
      onPrimaryAction={
        isInProgress
          ? () => finishJob.mutate()
          : isDispatched
          ? () => startJob.mutate()
          : undefined
      }
      primaryActionDisabled={isInProgress ? !canFinish : isDispatched ? !canStart : false}
      primaryActionDisabledReason={
        isInProgress
          ? finishDisabledReason
          : isDispatched && !canStart
          ? "Dispatch must be marked DONE in warehouse before starting"
          : undefined
      }
      primaryActionLoading={isInProgress ? finishJob.isPending : startJob.isPending}
    >
      {/* Status Strip */}
      <div className="flex items-center justify-between gap-2 p-3 bg-surface rounded-card border border-border shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted font-medium">Job Status:</span>
          <Badge status={job.status} size="sm" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <span>Dispatch:</span>
          <Badge status={job.dispatchStatus || "NOT_READY"} size="sm" />
        </div>
      </div>

      {/* Customer Info Card */}
      <Card title="Customer & Site">
        <div className="space-y-1.5 text-sm">
          <p className="font-heading text-base font-bold text-text">
            {job.leadName}
          </p>
          <p className="font-mono text-xs text-muted">{job.leadPhone}</p>
          <p className="text-xs text-text">{job.leadAddress}</p>
          <p className="text-xs font-semibold text-primary mt-1">
            {job.kw} kW • {job.systemType?.replace(/_/g, " ")}
          </p>
        </div>
      </Card>

      {/* Execution Timestamps */}
      {job.startedAt && (
        <Card title="Time Tracking">
          <div className="text-xs space-y-1">
            <p>
              <span className="text-muted">Started:</span>{" "}
              <strong>{formatDateTime(job.startedAt)}</strong>
            </p>
            {job.finishedAt && (
              <p>
                <span className="text-muted">Completed:</span>{" "}
                <strong>{formatDateTime(job.finishedAt)}</strong>
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Dispatch Gate Alert (if DISPATCHED but not DONE) */}
      {isDispatched && !isDispatchDone && (
        <div className="p-3.5 bg-warning/10 border border-warning/30 rounded-card flex items-start gap-2.5 text-xs text-warning leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>Gate Locked:</strong> Warehouse has not completed serial scanning & validate for this dispatch yet. You cannot start the roof installation until materials are validated.
          </div>
        </div>
      )}

      {/* Active Worksheet Controls (when IN_PROGRESS) */}
      {isInProgress && (
        <div className="space-y-4">
          <Card title="1. Confirmed System Capacity">
            <Field
              label="Actual Installed Capacity (kW)"
              required
              hint={`Quote was for ${job.kw} kW`}
            >
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={sizeConfirmed}
                onChange={(e) => setSizeConfirmed(e.target.value)}
                placeholder={`e.g. ${job.kw}`}
                className="w-full h-12 rounded-md border border-border bg-surface px-4 text-base font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </Field>
          </Card>

          <Card title="2. Roof Installation Photos">
            <Field
              label="Upload Site Proof Photos"
              required
              hint="Panels mounted, inverter wiring, earthing rod"
            >
              <div className="space-y-3">
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Roof Photo ${i + 1}`}
                        className="w-full h-20 object-cover rounded-md border border-border shadow-xs"
                      />
                    ))}
                  </div>
                )}
                <label className="flex items-center justify-center gap-2 h-12 px-4 rounded-md border-2 border-dashed border-border hover:border-primary bg-surface text-sm font-semibold text-text cursor-pointer transition-colors">
                  <Camera className="w-5 h-5 text-primary" />
                  <span>{uploading ? "Uploading Photo…" : "Capture / Upload Photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
              </div>
            </Field>
          </Card>

          <Card title="3. Customer Acceptance Signature">
            <Field
              label="Sign on screen below"
              required
              hint="Customer agrees installation is complete and operational"
            >
              <SignaturePad onChange={setSignature} />
            </Field>
          </Card>
        </div>
      )}

      {/* Completed Success Card */}
      {isDone && (
        <Card className="bg-success/10 border-success/30 text-center py-6">
          <div className="w-12 h-12 rounded-full bg-success text-white flex items-center justify-center mx-auto mb-2 shadow-sm">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="font-heading text-lg font-bold text-success">
            Job Completed
          </h3>
          <p className="text-xs text-text mt-1">
            Confirmed Size: <strong>{job.sizeConfirmed} kW</strong> • {job.photos?.length || 0} Photos Recorded
          </p>
          <div className="mt-4 pt-3 border-t border-success/20">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/m")}
              className="w-full"
            >
              Back to My Work
            </Button>
          </div>
        </Card>
      )}
    </PhonePage>
  );
}
