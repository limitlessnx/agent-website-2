"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./gencouv-marketing.css";

type Category = { id: string; name: string };
type Contact = { id: string; full_name: string | null; email: string; company_name: string | null; metadata?: { marketing_consent?: string }; created_at: string };
type Preview = { preview: true; total: number; new_contacts: number; existing_contacts: number; duplicates_in_file: number; invalid: number; sample: Array<{ email: string; full_name: string }> };
const endpoint = "/api/dashboard/gencouv/contact-import";

export default function GencouvContactImport({ compact = false }: { compact?: boolean }) {
  const batchId = useRef<string|null>(null);
  const submissionLock=useRef(false);
  const [history,setHistory]=useState<Array<{id:string;status:string;records_written:number;started_at:string}>>([]);
  const [file, setFile] = useState<File | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [consentSource, setConsentSource] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading,setLoading]=useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
    const [contactResult, categoriesResult] = await Promise.all([
      fetch(endpoint, { cache: "no-store" }),
      fetch("/api/dashboard/gencouv/categories", { cache: "no-store" })
    ]);
    if (!contactResult.ok || !categoriesResult.ok) throw new Error("Unable to load Gencouv contacts and categories.");
    const contactData = await contactResult.json();
    const categoryData = await categoriesResult.json();
    setContacts(contactData.contacts || []);
    setHistory(contactData.history || []);
    if(contactData.history_unavailable)setError("Import history is temporarily unavailable.");
    setCategories(categoryData.categories || []);
    } finally {setLoading(false);}
  }, []);
  useEffect(() => { const timer=setTimeout(()=>void load().catch(e => setError(String(e.message))),0);return()=>clearTimeout(timer); }, [load]);

  async function submit(isPreview: boolean) {
    if (!file || submissionLock.current) return;
    submissionLock.current=true; batchId.current ||= crypto.randomUUID();
    setBusy(true); setError(""); setMessage("");
    const data = new FormData();
    data.set("file", file);
    data.set("batch_id",batchId.current);
    data.set("preview", String(isPreview));
    if (categoryId) data.set("category_id", categoryId);
    data.set("consent_confirmed", String(consentConfirmed));
    data.set("consent_source", consentSource);
    try {
      const response = await fetch(endpoint, { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok && response.status !== 207) throw new Error(result.error || "Import failed.");
      if (isPreview) { setPreview(result); }
      else {
        setMessage(`${result.imported} saved; ${result.already_saved} already existed; ${result.failed} errors. No marketing messages sent.`);
        setPreview(null);
        setFile(null);setConsentConfirmed(false);setConsentSource("");batchId.current=null;
        const input = document.getElementById("gencouv-upload") as HTMLInputElement | null;
        if (input) input.value = "";
        await load();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to import file."); }
    finally { submissionLock.current=false;setBusy(false); }
  }

  return <div className="gencouv-marketing" style={{ display: "grid", gap: 18, maxWidth: 1050, margin: "0 auto" }}>
    <section className="admin-panel" id="gencouv-contact-import">
      <div className="admin-panel-header">
        <div>
          <h2>Upload email contacts</h2>
          <p>Choose a CSV, Excel or TXT file. Preview and save the contacts before selecting campaign recipients. Uploading does not send emails.</p>
        </div>
        <span className="admin-status">No automatic sending</span>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 7 }}>
          <strong>Contact document</strong>
          <input id="gencouv-upload" aria-label="Contact document" disabled={busy} type="file" accept=".csv,.xlsx,.xls,.txt" onChange={e => { setFile(e.target.files?.[0] || null);batchId.current=null;setConsentConfirmed(false);setConsentSource(""); setPreview(null); setMessage(""); }} />
          <small>CSV, Excel, or TXT, maximum 2 MB and 500 rows. Excel/CSV files need an Email column.</small>
        </label>
        <label style={{ display: "grid", gap: 7 }}>
          <strong>Optional category</strong>
          <select value={categoryId} onChange={e => { setCategoryId(e.target.value);batchId.current=null; setPreview(null); }}>
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <small>Categories are created by you. <Link href="/dashboard/gencouv/categories">Manage categories</Link></small>
        </label>
        <label style={{display:"flex",gap:8,alignItems:"start"}}><input type="checkbox" checked={consentConfirmed} onChange={e=>{setConsentConfirmed(e.target.checked);batchId.current=null;setPreview(null);}} /> I confirm all NEW contacts in this upload agreed to receive promotional emails from Gencouv. One answer applies to this entire import.</label>
        {consentConfirmed && <label className="admin-field">Where was consent obtained?<input required value={consentSource} onChange={e=>{setConsentSource(e.target.value);setPreview(null);batchId.current=null;}} placeholder="e.g. event registration opt-in, website form" /></label>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" disabled={!file || busy} onClick={() => void submit(true)}>Preview contacts</button>
          <button type="button" disabled={!file || busy || !preview || (consentConfirmed && !consentSource.trim())} onClick={() => void submit(false)}>Save reviewed contacts</button>
        </div>
      </div>
      {busy&&<p role="status">Processing the reviewed contact document…</p>}
      {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
      {message && <p role="status">{message}</p>}
      {preview && <div style={{ marginTop: 18, borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
        <h3>Import preview</h3>
        <p>{preview.total} unique valid contacts, {preview.new_contacts} new, {preview.existing_contacts} already saved, {preview.duplicates_in_file} duplicates removed, {preview.invalid} invalid.</p>
        <ul>{preview.sample.map(row => <li key={row.email}>{row.full_name ? `${row.full_name} · ` : ""}{row.email}</li>)}</ul>
        <p>{consentConfirmed ? "New contacts will have consent recorded from the stated source. Existing contacts keep their prior consent status." : "Uploaded contacts will be saved with marketing consent unverified."} Saving does not send emails or enroll anyone in an automated campaign.</p>
      </div>}
    </section>
    {compact ? <p><Link href="/dashboard/gencouv/contacts">View saved contacts and import history →</Link></p> : <>
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Saved Gencouv contacts</h2><p>Most recent 100 records, including existing CRM contacts. Imported addresses require consent verification before marketing.</p></div><span className="admin-status">{contacts.length} shown</span></div>
      <button type="button" disabled={busy||loading} onClick={()=>{setError("");void load().catch(()=>setError("Unable to refresh contacts. Please retry."));}}>Refresh contacts</button>
      {loading?<p role="status">Loading saved contacts and categories…</p>:null}
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
        {!loading&&!error&&!contacts.length && <p>No saved contacts yet.</p>}
      </div>
    </section>
    <section className="admin-panel"><h2>Import history</h2>{history.length?history.map(run=><p key={run.id}>{new Date(run.started_at).toLocaleString()} · {run.records_written} saved · {run.status}</p>):<p>No recorded imports.</p>}</section>
    </>}
  </div>;
}
