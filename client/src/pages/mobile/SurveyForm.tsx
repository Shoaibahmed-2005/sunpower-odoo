// Technician survey form on the phone: measured on the roof, submitted for Sales to approve.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api, qk, formatDateTime, toast, PhoneLayout, Field, Button, inputCls } from "../sales/ui";
import { SurveyDetail, DIRECTIONS, SURVEY_LABEL } from "../sales/types";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // same 5 MB limit as the server's /api/uploads

export default function SurveyForm() {
  const surveyId = Number(useParams().id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [direction, setDirection] = useState("");
  const [tilt, setTilt] = useState("");
  const [cableDistance, setCableDistance] = useState("");
  const [area, setArea] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: s, isLoading, isError } = useQuery<SurveyDetail>({
    queryKey: qk.survey(surveyId),
    queryFn: () => api.get(`/surveys/${surveyId}`).then((r) => r.data),
    enabled: Number.isFinite(surveyId),
  });

  const submit = useMutation({
    mutationFn: () => api.patch(`/surveys/${surveyId}/submit`, {
      direction, tilt: Number(tilt), cableDistance: Number(cableDistance), area: Number(area), photos,
    }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.survey(surveyId) });
      queryClient.invalidateQueries({ queryKey: qk.surveys });
      toast.success("Survey submitted for approval");
      navigate("/m");
    },
  });

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErrors((e) => ({ ...e, photos: "Only photos can be added" })); return; }
    if (file.size > MAX_PHOTO_BYTES) { setErrors((e) => ({ ...e, photos: "Photo is larger than 5 MB" })); return; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await api.post<{ url: string }>("/uploads", body);
      setPhotos((p) => [...p, data.url]);
      setErrors((e) => ({ ...e, photos: "" }));
    } finally {
      setUploading(false); // errors are already shown as a toast by the axios interceptor
    }
  }

  function send() {
    const found: Record<string, string> = {};
    if (!direction) found.direction = "Choose the roof direction";
    const t = Number(tilt);
    if (tilt === "" || !(t >= 0 && t <= 60)) found.tilt = "Tilt must be 0 to 60°";
    const c = Number(cableDistance);
    if (!(c >= 1 && c <= 150)) found.cableDistance = "Cable distance must be 1 to 150 m";
    if (!(Number(area) > 0)) found.area = "Enter the shadow-free area";
    if (photos.length === 0) found.photos = "Add at least one roof photo";
    setErrors(found);
    if (Object.values(found).every((m) => !m)) submit.mutate();
  }

  if (isLoading) return <PhoneLayout title="Survey"><p>Loading…</p></PhoneLayout>;
  if (isError || !s) return <PhoneLayout title="Survey"><p>Survey not found.</p></PhoneLayout>;

  return (
    <PhoneLayout title={s.ref}>
      <div className="space-y-4 text-lg">
        <div>
          <p className="font-semibold">{s.lead.name}</p>
          <p className="text-[var(--muted)]">{s.lead.address}</p>
          <a className="underline" href={`tel:${s.lead.phone}`}>Call {s.lead.phone}</a>
          <p className="text-[var(--muted)]">Visit: {formatDateTime(s.visitDate)}</p>
        </div>

        {s.status !== "SCHEDULED" ? (
          <p className="rounded-[var(--radius)] border border-[var(--border)] p-3">
            {SURVEY_LABEL[s.status]}. {s.status === "SUBMITTED" ? "Waiting for Sales to approve." : ""}
          </p>
        ) : (
          <>
            <Field label="Roof direction" error={errors.direction}>
              <select className={`${inputCls} h-12`} value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="">Choose…</option>
                {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Tilt (degrees)" error={errors.tilt}>
              <input className={`${inputCls} h-12`} type="number" inputMode="numeric" min={0} max={60} value={tilt} onChange={(e) => setTilt(e.target.value)} />
            </Field>
            <Field label="Cable distance (m)" error={errors.cableDistance}>
              <input className={`${inputCls} h-12`} type="number" inputMode="decimal" min={1} max={150} value={cableDistance} onChange={(e) => setCableDistance(e.target.value)} />
            </Field>
            <Field label="Shadow-free area (m²)" error={errors.area}>
              <input className={`${inputCls} h-12`} type="number" inputMode="numeric" min={1} value={area} onChange={(e) => setArea(e.target.value)} />
            </Field>
            <Field label={`Roof photos (${photos.length})`} error={errors.photos}>
              <input className="block w-full py-2" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
                disabled={uploading || photos.length >= 10} onChange={(e) => { addPhoto(e.target.files?.[0]); e.target.value = ""; }} />
            </Field>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url) => <img key={url} src={url} alt="Roof" className="h-20 w-full rounded-[var(--radius)] object-cover" />)}
              </div>
            )}
            <Button variant="primary" loading={submit.isPending || uploading} disabled={submit.isPending || uploading} onClick={send}>
              Submit for approval
            </Button>
          </>
        )}
      </div>
    </PhoneLayout>
  );
}
