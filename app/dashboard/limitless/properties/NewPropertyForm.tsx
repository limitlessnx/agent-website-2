"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPropertyForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData(event.currentTarget);
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
      if (missing.length) {
        throw new Error(`Please complete: ${missing.join(", ")}.`);
      }
      const response = await fetch("/api/limitless/properties", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : `Property save failed (${response.status}).`);
      }

      formRef.current?.reset();
      setSuccess("Property saved to catalog.");
      router.refresh();
    } catch (cause) {
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
      <label className="admin-file-field"><span>Property images</span><input name="property_images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple /></label>
      <label className="admin-file-field"><span>Property videos</span><input name="property_images" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v" multiple /></label>
      <input name="drive_brochure_link" placeholder="Brochure link" />
      <textarea name="features" placeholder="Title/features" required aria-required="true" />
      <textarea name="description" placeholder="Brief/description" required aria-required="true" />
      {error ? <p role="alert" style={{ color: "#f87171", margin: 0 }}>{error}</p> : null}
      {success ? <p role="status" style={{ margin: 0 }}>{success}</p> : null}
      <button type="submit" disabled={saving}>{saving ? "Saving property…" : "Save property"}</button>
    </form>
  );
}
