import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { qk } from "../../lib/queryKeys";
import { formatDateTime } from "../../lib/format";
import PhoneLayout from "../../components/PhoneLayout";
import SignaturePad from "../../components/SignaturePad";
import Badge from "../../components/Badge";
import Button from "../../components/Button";
import Field from "../../components/Field";
import { toast } from "../../components/Toast";
import { Camera } from "lucide-react";

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
      toast.success("Job started");
      invalidateAll();
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
      toast.success("Job completed!");
      invalidateAll();
      navigate("/m");
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
      toast.success("Photo uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !job) return <PhoneLayout title="Loading…"><p className="text-muted">Loading…</p></PhoneLayout>;

  const canStart = job.status === "DISPATCHED" && job.dispatchStatus === "DONE";
  const isInProgress = job.status === "IN_PROGRESS";
  const isDone = job.status === "DONE";
  const canFinish = isInProgress && signature && photos.length > 0 && sizeConfirmed;

  return (
    <PhoneLayout title={`Job ${job.ref}`}>
      {/* Status */}
      <div className="flex items-center gap-2 mb-4">
        <Badge status={job.status} />
        {job.dispatchStatus && <Badge status={`Dispatch: ${job.dispatchStatus}`} />}
      </div>

      {/* Customer info */}
      <div className="bg-surface border border-border rounded-card p-4 mb-4">
        <p className="font-medium text-lg">{job.leadName}</p>
        <p className="text-sm text-muted">{job.leadPhone}</p>
        <p className="text-sm text-muted">{job.leadAddress}</p>
        <p className="text-sm mt-2">{job.kw} kW {job.systemType?.replace(/_/g, " ")}</p>
      </div>

      {/* Times */}
      {job.startedAt && (
        <div className="bg-surface border border-border rounded-card p-4 mb-4">
          <p className="text-sm"><span className="text-muted">Started:</span> {formatDateTime(job.startedAt)}</p>
          {job.finishedAt && (
            <p className="text-sm"><span className="text-muted">Finished:</span> {formatDateTime(job.finishedAt)}</p>
          )}
        </div>
      )}

      {/* Start button */}
      {job.status === "DISPATCHED" && (
        <div className="mb-4">
          <Button
            onClick={() => startJob.mutate()}
            loading={startJob.isPending}
            disabled={!canStart}
            className="w-full h-control-lg text-base"
          >
            {canStart ? "Start Job" : "Waiting for dispatch…"}
          </Button>
          {!canStart && (
            <p className="text-xs text-warning mt-1">Dispatch must be completed first</p>
          )}
        </div>
      )}

      {/* Worksheet — visible when IN_PROGRESS */}
      {isInProgress && (
        <div className="space-y-4">
          {/* Size confirmed */}
          <Field label="System Size Confirmed (kW)">
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={sizeConfirmed}
              onChange={(e) => setSizeConfirmed(e.target.value)}
              className="w-full h-control-lg rounded-sm border border-border bg-surface px-3 text-base outline-none focus:border-primary"
              placeholder="e.g. 3.0"
            />
          </Field>

          {/* Photo upload */}
          <div>
            <p className="text-[13px] font-medium text-muted mb-1.5">Photos</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {photos.map((url, i) => (
                <img key={i} src={url} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-md border border-border" />
              ))}
            </div>
            <label className="inline-flex items-center gap-2 h-control-lg px-4 rounded-md border border-border bg-surface text-sm font-medium cursor-pointer hover:bg-surface-2">
              <Camera className="w-5 h-5" />
              {uploading ? "Uploading…" : "Add Photo"}
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>

          {/* Signature */}
          <div>
            <p className="text-[13px] font-medium text-muted mb-1.5">Customer Signature</p>
            <SignaturePad onChange={setSignature} />
          </div>

          {/* Finish */}
          <Button
            onClick={() => finishJob.mutate()}
            loading={finishJob.isPending}
            disabled={!canFinish}
            className="w-full h-control-lg text-base"
          >
            Finish Job
          </Button>
          {!canFinish && (
            <p className="text-xs text-muted text-center">
              {!sizeConfirmed && "Enter confirmed size. "}
              {photos.length === 0 && "Add at least one photo. "}
              {!signature && "Customer signature required."}
            </p>
          )}
        </div>
      )}

      {/* Done state */}
      {isDone && (
        <div className="bg-success/10 border border-success rounded-card p-4 text-center">
          <p className="text-success font-semibold text-lg">✓ Job Complete</p>
          {job.sizeConfirmed && <p className="text-sm mt-1">Size: {job.sizeConfirmed} kW</p>}
          {job.photos?.length > 0 && <p className="text-sm">{job.photos.length} photos</p>}
          {job.hasSignature && <p className="text-sm">Signature captured</p>}
        </div>
      )}
    </PhoneLayout>
  );
}
