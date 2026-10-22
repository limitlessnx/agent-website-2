"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string };

export default function CatalogueItemForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      categoryId: String(form.get("categoryId") || ""),
      name: String(form.get("name") || ""),
      description: String(form.get("description") || ""),
      status: String(form.get("status") || "draft"),
      priceMinor: String(form.get("priceMinor") || ""),
      currency: String(form.get("currency") || "NGN"),
      durationMinutes: String(form.get("durationMinutes") || ""),
      mediaUrl: String(form.get("mediaUrl") || ""),
      mediaAltText: String(form.get("mediaAltText") || ""),
    };
    try {
      const response = await fetch("/api/portal/catalogue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to save catalogue item.");
      setMessage(body.warning || "Catalogue item saved.");
      event.currentTarget.reset();
      window.setTimeout(() => router.push("/portal/catalogue"), 600);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save catalogue item.");
    } finally { setBusy(false); }
  }

  return <form className="portal-form-grid exposure-catalogue-form" onSubmit={submit}>
    <div className="portal-field"><label htmlFor="categoryId">Category</label><select id="categoryId" name="categoryId" required defaultValue=""><option value="" disabled>Select a category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div>
    <div className="portal-field"><label htmlFor="name">Package name</label><input id="name" name="name" required maxLength={160} placeholder="Signature Portrait Session" /></div>
    <div className="portal-field exposure-form-wide"><label htmlFor="description">Description</label><textarea id="description" name="description" rows={4} maxLength={2000} placeholder="What is included, who it is for, and what the client receives." /></div>
    <div className="portal-field"><label htmlFor="status">Visibility</label><select id="status" name="status" defaultValue="draft"><option value="draft">Draft</option><option value="active">Active</option></select></div>
    <div className="portal-field"><label htmlFor="priceMinor">Price in minor units</label><input id="priceMinor" name="priceMinor" type="number" min="0" step="1" placeholder="15000000" /><small>For NGN, ₦150,000 is entered as 15000000.</small></div>
    <div className="portal-field"><label htmlFor="currency">Currency</label><input id="currency" name="currency" defaultValue="NGN" maxLength={3} /></div>
    <div className="portal-field"><label htmlFor="durationMinutes">Duration in minutes</label><input id="durationMinutes" name="durationMinutes" type="number" min="1" step="1" placeholder="90" /></div>
    <div className="portal-field exposure-form-wide"><label htmlFor="mediaUrl">Sample image URL or storage path</label><input id="mediaUrl" name="mediaUrl" type="url" placeholder="https://… or /manus-storage/…" /><small>Use a project storage path after uploading the final sample media.</small></div>
    <div className="portal-field exposure-form-wide"><label htmlFor="mediaAltText">Sample image description</label><input id="mediaAltText" name="mediaAltText" maxLength={240} placeholder="Portrait session sample with warm studio lighting" /></div>
    <div className="exposure-form-actions"><button className="portal-button" type="submit" disabled={busy || !categories.length}>{busy ? "Saving…" : "Save package"}</button><button className="portal-button secondary" type="button" onClick={() => router.push("/portal/catalogue")} disabled={busy}>Cancel</button></div>
    {message ? <p className="exposure-success" role="status">{message}</p> : null}{error ? <p className="exposure-error" role="alert">{error}</p> : null}
  </form>;
}
