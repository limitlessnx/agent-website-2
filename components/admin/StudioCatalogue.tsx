"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  title: string;
  description: string;
  category: string;
  price_amount: number | null;
  currency: string;
  duration_minutes: number | null;
  cover_image_url: string | null;
  status: string;
  created_at: string;
  media_urls?: string[];
};

export default function StudioCatalogue({ initialItems, unavailable }: { initialItems: Item[]; unavailable: boolean }) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Photoshoot");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadingId, setUploadingId] = useState("");
  const [mediaMessage, setMediaMessage] = useState("");
  const router = useRouter();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/studio-catalog", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) { setItems(payload.items || []); return true; }
    setError(payload.error || "Catalogue could not be loaded.");
    return false;
  }, []);

  useEffect(() => { if (unavailable) void refresh(); }, [unavailable, refresh]);

  async function uploadMedia(item: Item, file?: File) {
    if (!file) return;
    setUploadingId(item.id); setError(""); setMediaMessage("");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/admin/studio-catalog/" + encodeURIComponent(item.id) + "/media", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Media upload failed.");
      setItems(current => current.map(entry => entry.id === item.id ? { ...entry, cover_image_url: payload.item.cover_image_url, media_urls: payload.item.media_urls } : entry));
      setMediaMessage("Uploaded " + file.name + " to " + item.title + ".");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Media upload failed.");
    } finally { setUploadingId(""); }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/studio-catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title, description, category,
          price_amount: price === "" ? null : Number(price),
          duration_minutes: duration === "" ? null : Number(duration),
          currency: "NGN",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not save catalogue item.");
      setItems(current => [payload.item, ...current]);
      setTitle(""); setDescription(""); setPrice(""); setDuration("");
      setNotice("Draft saved. Add approved media and review details before publishing.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save catalogue item.");
    } finally { setBusy(false); }
  }

  const inputStyle = {
    width: "100%", padding: "11px 12px", border: "1px solid var(--fk-border, #393342)",
    borderRadius: 9, background: "var(--fk-panel, rgba(255,255,255,.025))",
    color: "inherit", font: "inherit",
  } as const;

  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18, alignItems: "start" }}>
    <section style={{ border: "1px solid var(--fk-border, #393342)", borderRadius: 14, padding: 18 }}>
      <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>Create a service package</h2>
      <p style={{ fontSize: 13, color: "var(--fk-muted, #a9a1b5)", lineHeight: 1.5, margin: "0 0 16px" }}>New items start as drafts. Pricing and duration are optional until the studio confirms them.</p>
      <form onSubmit={createItem} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Package name
          <input required minLength={2} maxLength={140} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Portrait session" style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Category
          <input value={category} onChange={event => setCategory(event.target.value)} maxLength={80} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Description
          <textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={4000} placeholder="What's included in the shoot?" style={inputStyle} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Price (NGN)
            <input inputMode="decimal" type="number" min="0" step="0.01" value={price} onChange={event => setPrice(event.target.value)} placeholder="Not set" style={inputStyle} />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>Duration (mins)
            <input type="number" min="5" max="1440" step="1" value={duration} onChange={event => setDuration(event.target.value)} placeholder="Not set" style={inputStyle} />
          </label>
        </div>
        {error && <p role="alert" style={{ fontSize: 13, color: "#e5a06d", margin: 0 }}>{error}</p>}
        {notice && <p role="status" style={{ fontSize: 13, margin: 0 }}>{notice}</p>}
        <button type="submit" disabled={busy} style={{ padding: "11px 14px", border: 0, borderRadius: 9, background: "var(--fk-accent, #8b5cf6)", color: "white", fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? .7 : 1 }}>
          {busy ? "Saving draft…" : "Save draft"}
        </button>
      </form>
    </section>
    <section>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Studio catalogue</h2>
        <span style={{ fontSize: 12, color: "var(--fk-muted, #a9a1b5)" }}>{items.length} item{items.length === 1 ? "" : "s"}</span>
      </div>
      {mediaMessage && <p role="status" style={{ fontSize: 13, margin: "0 0 10px" }}>{mediaMessage}</p>}
      {error && <p role="alert" style={{ fontSize: 13, color: "#e5a06d", margin: "0 0 10px" }}>{error}</p>}
      {items.length === 0
        ? <div style={{ border: "1px dashed var(--fk-border, #51475d)", borderRadius: 14, padding: 22 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 7px" }}>No packages added yet</h3>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--fk-muted, #a9a1b5)", margin: 0 }}>Create the first draft on the left. Add reference photos or studio videos to each saved package; items remain drafts until reviewed and approved.</p>
          </div>
        : <div style={{ display: "grid", gap: 10 }}>{items.map(item =>
            <article key={item.id} style={{ border: "1px solid var(--fk-border, #393342)", borderRadius: 12, padding: 15, display: "flex", gap: 12 }}>
              {item.cover_image_url
                ? <img src={item.cover_image_url} alt="" style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 8 }} />
                : <div aria-hidden="true" style={{ width: 76, height: 76, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--fk-panel, rgba(255,255,255,.04))", fontSize: 11, color: "var(--fk-muted, #a9a1b5)" }}>No media</div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                  <strong>{item.title}</strong>
                  <span style={{ fontSize: 11, border: "1px solid var(--fk-border, #51475d)", borderRadius: 99, padding: "3px 7px" }}>{item.status}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--fk-muted, #a9a1b5)", margin: "5px 0" }}>
                  {item.category} · {item.price_amount === null ? "Price not set" : new Intl.NumberFormat("en-NG", { style: "currency", currency: item.currency || "NGN", maximumFractionDigits: 2 }).format(item.price_amount)}
                  {item.duration_minutes ? ` · ${item.duration_minutes} min` : ""}
                </p>
                {item.description && <p style={{ fontSize: 13, lineHeight: 1.5, margin: 0 }}>{item.description}</p>}
                <label style={{ display: "inline-grid", gap: 5, marginTop: 10, fontSize: 12, color: "var(--fk-muted, #a9a1b5)" }}>
                  {uploadingId === item.id ? "Uploading media…" : "Add reference photo or studio video"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" disabled={Boolean(uploadingId)} onChange={event => { const file = event.target.files?.[0]; void uploadMedia(item, file); event.currentTarget.value = ""; }} />
                  <span>Images up to 10 MB · Videos up to 100 MB</span>
                </label>
                {item.media_urls?.length ? <p style={{ fontSize: 12, margin: "6px 0 0" }}>{item.media_urls.length} media file{item.media_urls.length === 1 ? "" : "s"} attached</p> : null}
              </div>
            </article>)}</div>}
    </section>
  </div>;
}
