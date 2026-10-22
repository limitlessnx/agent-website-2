"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Media = { id: string; storage_path: string; alt_text: string; status: string };
type Item = { id: string; category_id: string; name: string; description: string; status: string; price_minor: number | null; currency: string; duration_minutes: number | null; media: Media[] };
type Category = { id: string; name: string };

function formatPrice(value: number | null, currency: string) {
  if (value === null) return "Price on request";
  return `${currency} ${(value / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export default function CatalogueManager({ initialItems, categories }: { initialItems: Item[]; categories: Category[] }) {
  const router = useRouter();
  const [items] = useState(initialItems);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function post(payload: Record<string, unknown>) {
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/portal/catalogue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Catalogue update failed.");
      setNotice(body.warning || "Catalogue updated.");
      router.refresh();
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Catalogue update failed."); return false; }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>, item: Item) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await post({ id: item.id, categoryId: String(form.get("categoryId") || item.category_id), name: String(form.get("name") || ""), description: String(form.get("description") || ""), status: String(form.get("status") || "draft"), priceMinor: String(form.get("priceMinor") || ""), currency: String(form.get("currency") || "NGN"), durationMinutes: String(form.get("durationMinutes") || "") });
    if (ok) setEditing(null);
  }

  async function addMedia(event: FormEvent<HTMLFormElement>, itemId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await post({ action: "add_media", itemId, mediaUrl: String(form.get("mediaUrl") || ""), mediaAltText: String(form.get("mediaAltText") || "") });
    if (ok) event.currentTarget.reset();
  }

  async function archive(item: Item, restore = false) {
    if (!window.confirm(`${restore ? "Restore" : "Archive"} ${item.name}?`)) return;
    await post({ action: restore ? "restore" : "archive", id: item.id });
  }

  async function removeMedia(mediaId: string) {
    if (!window.confirm("Archive this sample image?")) return;
    await post({ action: "remove_media", mediaId });
  }

  return <section className="exposure-panel exposure-catalogue-manager"><header><div><p className="portal-kicker">Package operations</p><h2>{items.length} catalogue package{items.length === 1 ? "" : "s"}</h2><p>Update packages without deleting booking history. Archived packages remain available to past records.</p></div><button className="portal-button secondary" type="button" onClick={() => router.refresh()} disabled={busy}>Refresh</button></header>
    <div className="exposure-package-list">{items.map((item) => <article className={`exposure-package-card ${item.status === "archived" ? "is-archived" : ""}`} key={item.id}>
      {editing === item.id ? <form className="portal-form-grid" onSubmit={(event) => void save(event, item)}><div className="portal-field"><label>Category</label><select name="categoryId" defaultValue={item.category_id}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div><div className="portal-field"><label>Package name</label><input name="name" defaultValue={item.name} required /></div><div className="portal-field exposure-form-wide"><label>Description</label><textarea name="description" defaultValue={item.description} rows={3} /></div><div className="portal-field"><label>Status</label><select name="status" defaultValue={item.status}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></div><div className="portal-field"><label>Price in minor units</label><input name="priceMinor" type="number" min="0" defaultValue={item.price_minor ?? ""} /></div><div className="portal-field"><label>Currency</label><input name="currency" maxLength={3} defaultValue={item.currency} /></div><div className="portal-field"><label>Duration in minutes</label><input name="durationMinutes" type="number" min="1" defaultValue={item.duration_minutes ?? ""} /></div><div className="exposure-form-actions"><button className="portal-button" type="submit" disabled={busy}>Save changes</button><button className="portal-button secondary" type="button" onClick={() => setEditing(null)} disabled={busy}>Cancel</button></div></form> : <><div className="exposure-package-heading"><div><span className="exposure-package-status">{item.status}</span><h3>{item.name}</h3><p>{item.description || "No package description yet."}</p></div><div className="exposure-package-actions"><button type="button" onClick={() => setEditing(item.id)} disabled={busy}>Edit</button><button type="button" onClick={() => void archive(item, item.status === "archived")} disabled={busy}>{item.status === "archived" ? "Restore" : "Archive"}</button></div></div><div className="exposure-package-meta"><span>{formatPrice(item.price_minor, item.currency)}</span><span>{item.duration_minutes ? `${item.duration_minutes} minutes` : "Duration flexible"}</span><span>{item.media.filter((media) => media.status === "active").length} sample image{item.media.filter((media) => media.status === "active").length === 1 ? "" : "s"}</span></div><div className="exposure-media-list">{item.media.filter((media) => media.status === "active").map((media) => <div key={media.id}><img src={media.storage_path} alt={media.alt_text || item.name} /><button type="button" onClick={() => void removeMedia(media.id)} disabled={busy}>Remove</button></div>)}</div><form className="exposure-media-form" onSubmit={(event) => void addMedia(event, item.id)}><input name="mediaUrl" type="url" required placeholder="Add sample image URL" /><input name="mediaAltText" placeholder="Image description" /><button className="portal-button secondary" type="submit" disabled={busy}>Attach image</button></form></>}
    </article>)}</div>{!items.length ? <p className="exposure-empty">No catalogue packages yet. Add the first package to make the studio catalogue operational.</p> : null}{notice ? <p className="exposure-success" role="status">{notice}</p> : null}{error ? <p className="exposure-error" role="alert">{error}</p> : null}</section>;
}
