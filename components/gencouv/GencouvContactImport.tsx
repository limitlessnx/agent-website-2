"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Category = { id: string; name: string };
type Contact = { id: string; full_name: string | null; email: string; company_name: string | null; metadata?: { marketing_consent?: string }; created_at: string };
type Preview = { preview: true; total: number; new_contacts: number; existing_contacts: number; duplicates_in_file: number; invalid: number; sample: Array<{ email: string; full_name: string }> };
const endpoint = "/api/dashboard/gencouv/contact-import";

export default function GencouvContactImport() {
  const [file, setFile] = useState<File | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [contactResult, categoriesResult] = await Promise.all([
      fetch(endpoint, { cache: "no-store" }),
      fetch("/api/dashboard/gencouv/categories", { cache: "no-store" })
    ]);
    if (!contactResult.ok || !categoriesResult.ok) throw new Error("Unable to load Gencouv contacts and categories.");
    const contactData = await contactResult.json();
    const categoryData = await categoriesResult.json();
    setContacts(contactData.contacts || []);
    setCategories(categoryData.categories || []);
  }, []);
  useEffect(() => { void load().catch(e => setError(String(e.message))); }, [load]);

  async function submit(isPreview: boolean) {
    if (!file) return;
    setBusy(true); setError(""); setMessage("");
    const data = new FormData();
    data.set("file", file);
    data.set("preview", String(isPreview));
    if (categoryId) data.set("category_id", categoryId);
    try {
      const response = await fetch(endpoint, { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(result.error || "Import failed.");
      if (isPreview) { setPreview(result); }
      else {
        setMessage(`${result.imported} saved; ${result.already_saved} already existed; ${result.failed} errors. No marketing messages sent.`);
        setPreview(null);
        setFile(null);
        const input = document.getElementById("gencouv-upload") as HTMLInputElement | null;
        if (input) input.value = "";
        await load();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to import file."); }
    finally { setBusy(false); }
  }

  return <div style={{ display: "grid", gap: 18, maxWidth: 1050, margin: "0 auto" }}>
    <section className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h2>Upload contact document</h2>
          <p>Import saved contacts into Gencouv CRM, independently of Limitless Realty and other businesses.</p>
        </div>
        <span className="admin-status">No automatic sending</span>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 7 }}>
          <strong>Contact document</strong>
          <input id="gencouv-upload" type="file" accept=".csv,.xlsx,.xls,.txt" onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); setMessage(""); }} />
          <small>CSV, Excel, or TXT, maximum 2 MB and 500 unique contacts. Excel/CSV files need an Email column.</small>
        </label>
        <label style={{ display: "grid", gap: 7 }}>
          <strong>Optional category</strong>
          <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setPreview(null); }}>
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <small>Categories are created by you. <Link href="/dashboard/gencouv/categories">Manage categories</Link></small>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" disabled={!file || busy} onClick={() => void submit(true)}>Preview contacts</button>
          <button type="button" disabled={!file || busy || !preview} onClick={() => void submit(false)}>Save reviewed contacts</button>
        </div>
      </div>
      {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
      {message && <p role="status">{message}</p>}
      {preview && <div style={{ marginTop: 18, borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
        <h3>Import preview</h3>
        <p>{preview.total} unique valid contacts, {preview.new_contacts} new, {preview.existing_contacts} already saved, {preview.duplicates_in_file} duplicates removed, {preview.invalid} invalid.</p>
        <ul>{preview.sample.map(row => <li key={row.email}>{row.full_name ? `${row.full_name} · ` : ""}{row.email}</li>)}</ul>
        <p>Uploaded contacts will be saved with marketing consent unverified. Saving does not enroll them in a campaign.</p>
      </div>}
    </section>
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Saved Gencouv contacts</h2><p>Most recent 100 records, including existing CRM contacts. Imported addresses require consent verification before marketing.</p></div><span className="admin-status">{contacts.length} shown</span></div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse" }}>
          <thead><tr><th align="left">Contact</th><th align="left">Email</th><th align="left">Company</th><th align="left">Marketing consent</th></tr></thead>
          <tbody>{contacts.map(c => <tr key={c.id} style={{ borderTop: "1px solid var(--admin-border)" }}>
            <td style={{ padding: 12 }}>{c.full_name || "Unnamed"}</td>
            <td style={{ padding: 12 }}>{c.email}</td>
            <td style={{ padding: 12 }}>{c.company_name || "—"}</td>
            <td style={{ padding: 12 }}>{c.metadata?.marketing_consent || "Not verified"}</td>
          </tr>)}</tbody>
        </table>
        {!contacts.length && <p>No saved contacts yet.</p>}
      </div>
    </section>
  </div>;
}
