"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type EstateOption = { id: string; name: string; status: string };

export default function NewPropertyForm({ estates, estateError = "" }: { estates: EstateOption[]; estateError?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setProgress(0);
    setError("");
    setSuccess("");

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const requiredFields = [
        ["title", "Property title"],
        ["price", "Price"],
        ["location_area", "Area/community"],
        ["location_city", "City/state"],
        ["type", "Type"],
        ["features", "Title/features"],
        ["description", "Brief/description"],
      ] as const;
      const missing = requiredFields
        .filter(([name]) => !String(formData.get(name) || "").trim())
        .map(([, label]) => label);
      if (missing.length) throw new Error(`Please complete: ${missing.join(", ")}.`);

      const payload = await new Promise<{ ok: boolean; status: number; body: unknown }>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", "/api/limitless/properties");
        request.withCredentials = true;
        request.upload.onprogress = (progressEvent) => {
          if (progressEvent.lengthComputable) {
            setProgress(Math.min(99, Math.round((progressEvent.loaded / progressEvent.total) * 100)));
          }
        };
        request.onload = () => {
          let body: unknown = {};
          try { body = JSON.parse(request.responseText || "{}"); } catch {}
          resolve({ ok: request.status >= 200 && request.status < 300, status: request.status, body });
        };
        request.onerror = () => reject(new Error("Network error while saving the property. Check your connection and retry."));
        request.onabort = () => reject(new Error("Property save was cancelled."));
        request.send(formData);
      });
      if (!payload.ok) {
        const serverError = payload.body && typeof payload.body === "object" && "error" in payload.body && typeof payload.body.error === "string"
          ? payload.body.error
          : `Property save failed (${payload.status}).`;
        throw new Error(serverError);
      }

      setProgress(100);
      setSuccess("Property saved to catalog.");
      formRef.current?.reset();
      router.refresh();
    } catch (cause) {
      setProgress(null);
      setError(cause instanceof Error ? cause.message : "Property could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="admin-form-grid" encType="multipart/form-data">
      <input name="title" placeholder="Property title" required aria-required="true" />
      <input name="price" placeholder="Price" required aria-required="true" />
      <input name="location_area" placeholder="Area/community" required aria-required="true" />
      <input name="location_city" placeholder="City/state" required aria-required="true" />
      <input name="type" placeholder="Type" required aria-required="true" />
      <select name="status" defaultValue="active"><option value="active">active</option><option value="inactive">inactive</option><option value="sold">sold</option></select>
      <label className="admin-file-field"><span>Owning estate (optional)</span><select name="estate_id" defaultValue="" disabled={Boolean(estateError)}><option value="">No estate — assign later</option>{estates.map((estate) => <option key={estate.id} value={estate.id}>{estate.name} · {estate.status}</option>)}</select></label>
      {estateError ? <p role="alert" className="wide">Estate options could not load: {estateError}. You may save this property unassigned and associate it later.</p> : estates.length === 0 ? <p className="wide">No estate exists yet. <Link href="/dashboard/real-estate/estates#new-estate">Create an estate, terms of service and FAQs</Link>.</p> : <p className="wide">This classification lets Maia resolve the exact property to its estate-specific approved terms and FAQs.</p>}
      <label className="admin-file-field"><span>Property images</span><input name="property_images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple /></label>
      <label className="admin-file-field"><span>Property videos</span><input name="property_videos" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" multiple /></label>
      <input name="drive_brochure_link" placeholder="Brochure link" />
      <textarea name="features" placeholder="Title/features" required aria-required="true" />
      <textarea name="description" placeholder="Brief/description" required aria-required="true" />
      {progress !== null && saving ? <div role="status" aria-live="polite"><span>Uploading and saving… {progress}%</span><progress value={progress} max={100} style={{ display: "block", width: "100%" }} /></div> : null}
      {error ? <p role="alert" style={{ color: "#f87171", margin: 0 }}>{error}</p> : null}
      {success ? <p role="status" style={{ margin: 0 }}>{success}</p> : null}
      <button type="submit" disabled={saving}>{saving ? `Uploading and saving… ${progress ?? 0}%` : "Save property"}</button>
    </form>
  );
}
