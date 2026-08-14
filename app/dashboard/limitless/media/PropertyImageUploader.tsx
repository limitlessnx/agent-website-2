"use client";

import { useState } from "react";

type Props = {
  propertyId: string;
  propertyTitle: string;
  existingLink?: string;
};

async function compressImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1800;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.78));
  if (!blob) throw new Error(`Could not compress ${file.name}.`);
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export default function PropertyImageUploader({ propertyId, propertyTitle, existingLink }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload() {
    if (!files.length) {
      setError("Choose at least one image.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("Preparing images…");

    try {
      for (let index = 0; index < files.length; index += 1) {
        setMessage(`Uploading ${index + 1} of ${files.length}…`);
        const compressed = await compressImage(files[index]);
        const body = new FormData();
        body.set("property_id", propertyId);
        body.set("property_title", propertyTitle);
        body.set("property_image", compressed);
        const response = await fetch("/api/admin/property-images", { method: "POST", body });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || `Upload failed with status ${response.status}.`);
      }
      setMessage(`${files.length} image${files.length === 1 ? "" : "s"} uploaded to Supabase successfully.`);
      setFiles([]);
      window.location.reload();
    } catch (cause) {
      setMessage("");
      setError(cause instanceof Error ? cause.message : "Image upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="media-uploader">
      <label className="media-file-control">
        <span>{files.length ? `${files.length} image${files.length === 1 ? "" : "s"} selected` : "Choose property images"}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          onChange={(event) => setFiles(Array.from(event.target.files || []))}
        />
      </label>
      <button type="button" onClick={upload} disabled={busy || !files.length}>
        {busy ? "Uploading…" : existingLink ? "Add images" : "Upload images"}
      </button>
      {message ? <p className="media-upload-success">{message}</p> : null}
      {error ? <p className="media-upload-error">{error}</p> : null}
    </div>
  );
}
