"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MusicUploadForm({ brandId }: { brandId: string }) {
  const router = useRouter();
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  async function api(body: unknown) {
    const response = await fetch("/api/social/music-upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({ error: "Upload could not be completed. Please sign in and try again." }));
    if (!response.ok || data.error) throw new Error(data.error || "Upload failed.");
    return data;
  }
  return <form onSubmit={async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("music");
    if (!(file instanceof File) || !file.size) return;
    setBusy(true); setState("Preparing upload…");
    try {
      const type = file.type === "audio/x-wav" ? "audio/wav" : file.type === "audio/x-m4a" ? "audio/mp4" : file.type;
      const prepared = await api({ phase: "prepare", brandId, fileName: file.name, mimeType: type, size: file.size,
        licensed: data.get("licensed") === "yes", makeDefault: data.get("make_default") === "yes" });
      setState("Uploading audio…");
      // Bytes go straight to private Supabase Storage, avoiding Vercel's request-size limit.
      const upload = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "content-type": type, "x-upsert": "false" }, body: file });
      if (!upload.ok) throw new Error("Audio upload failed. Check your connection and try again.");
      setState("Saving track…");
      const saved = await api({ phase: "complete", receipt: prepared.receipt });
      setState(saved.defaultForBrand ? "Track uploaded and set as the default for future Reels." : "Track uploaded. You can select it for a Reel in Review.");
      form.reset(); router.refresh();
    } catch (error) { setState(error instanceof Error ? error.message : "Upload failed. Please try again."); }
    finally { setBusy(false); }
  }} style={{ display: "grid", gap: 14, maxWidth: 620 }}>
    <label>MP3, WAV or M4A · 20 MB maximum<input type="file" name="music" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a" required disabled={busy} /></label>
    <label><input type="checkbox" name="licensed" value="yes" required disabled={busy} /> I own this audio or have permission to use it in published social videos.</label>
    <label><input type="checkbox" name="make_default" value="yes" defaultChecked disabled={busy} /> Use as this brand’s default background track for future Reels.</label>
    <button type="submit" className="admin-btn" disabled={busy}>{busy ? "Uploading…" : "Upload background track"}</button>
    {state ? <p role="status" aria-live="polite">{state}</p> : null}
  </form>;
}
