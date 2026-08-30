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
      <input name="title" placeholder="Property title" required />
      <input name="price" placeholder="Price" />
      <input name="location_area" placeholder="Area/community" />
      <input name="location_city" placeholder="City/state" />
      <input name="type" placeholder="Type" />
      <select name="status" defaultValue="active"><option value="active">active</option><option value="inactive">inactive</option><option value="sold">sold</option></select>
      <label className="admin-file-field"><span>Property image</span><input name="property_images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" /></label>
      <input name="drive_brochure_link" placeholder="Brochure link" />
      <textarea name="features" placeholder="Title/features" />
      <textarea name="description" placeholder="Brief/description" />
      {error ? <p role="alert" style={{ color: "#f87171", margin: 0 }}>{error}</p> : null}
      {success ? <p role="status" style={{ margin: 0 }}>{success}</p> : null}
      <button type="submit" disabled={saving}>{saving ? "Saving property…" : "Save property"}</button>
    </form>
  );
}
