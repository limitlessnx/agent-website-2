"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
type Category = { id: string; name: string };
type Contact = { id: string; email: string; full_name: string | null; eligible: boolean; reason: string };
type Audience = { total: number; eligible: number; suppressed: number; unverified: number; truncated: boolean; contacts: Contact[] };
export default function GencouvBulkCampaigns() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState<Audience | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [from, setFrom] = useState("info@gencouv.com");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const [settings, categoriesResult] = await Promise.all([
      fetch("/api/dashboard/gencouv/outbound-settings", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/dashboard/gencouv/categories", { cache: "no-store" }).then(r => r.json())
    ]);
    if (settings.error) throw new Error(settings.error);
    setEnabled(settings.enabled === true);
    setCategories(categoriesResult.categories || []);
  }, []);
  useEffect(() => { void refresh().catch(e => setError(String(e))); }, [refresh]);
  async function toggle(next: boolean) {
    setBusy(true); setError(""); setStatus("");
    try {
      const r = await fetch("/api/dashboard/gencouv/outbound-settings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next, confirmed: true })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not save campaign state.");
      setEnabled(data.enabled); setStatus(data.note);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }
  async function preview() {
    setBusy(true); setError(""); setStatus(""); setSelected([]);
    try {
      const r = await fetch("/api/dashboard/gencouv/campaign-audience?category_id=" + encodeURIComponent(category), { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Audience unavailable.");
      setAudience(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Preview failed."); }
    finally { setBusy(false); }
  }
  async function send() {
    setBusy(true); setError(""); setStatus("");
    try {
      const r = await fetch("/api/dashboard/gencouv/bulk-send", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "one_time", category_id: category, contact_ids: selected, from, subject, text: message, confirmed, consent_confirmed: consentConfirmed })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Send failed.");
      setStatus(data.accepted + " emails accepted by Resend. " + data.note);
      setSelected([]); setConfirmed(false); setConsentConfirmed(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Send failed."); }
    finally { setBusy(false); }
  }
  const eligible = audience?.contacts.filter(c => c.eligible) || [];
  return <section className="admin-panel" id="gencouv-bulk-campaigns">
    <div className="admin-panel-header"><div><h2>Outbound email campaigns</h2><p>Automated campaigns are optional. One-time sends are independent of this switch.</p></div><span className={enabled ? "admin-status live" : "admin-status warning"}>{enabled ? "Automation ON" : "Automation OFF"}</span></div>
    <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap",marginBottom:20}}>
      <button type="button" disabled={busy || enabled} onClick={() => void toggle(true)}>Turn automated campaigns ON</button>
      <button type="button" disabled={busy || !enabled} onClick={() => void toggle(false)}>Turn automated campaigns OFF</button>
    </div>
    <div style={{borderTop:"1px solid var(--admin-border)",paddingTop:18,display:"grid",gap:14}}>
      <h3>Send a one-time email to uploaded leads</h3>
      <p>Choose a saved audience, select up to 100 consent-verified contacts, review your email and send once. This does not enroll anyone in a sequence.</p>
      <label className="admin-field">Audience category<select value={category} onChange={e=>{setCategory(e.target.value);setAudience(null);setSelected([]);}}><option value="">All Gencouv contacts</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button type="button" disabled={busy} onClick={() => void preview()}>Preview eligible contacts</button>
      {audience && <>
        <div className="admin-checklist"><span>{audience.eligible} eligible</span><span>{audience.unverified} unverified</span><span>{audience.suppressed} suppressed</span><span>{selected.length}/100 selected</span></div>
        {audience.truncated && <p role="alert">This audience is larger than 500 contacts. Only the first 500 are shown; use categories to narrow the selection.</p>}
        <button type="button" disabled={!eligible.length || busy} onClick={()=>setSelected(eligible.slice(0,100).map(c=>c.id))}>Select first 100 eligible</button>
        <div style={{maxHeight:260,overflowY:"auto",display:"grid",gap:6}}>
          {audience.contacts.map(c=><label key={c.id} style={{display:"flex",gap:8,alignItems:"center",overflowWrap:"anywhere"}}>
            <input type="checkbox" disabled={!c.eligible || (selected.length>=100 && !selected.includes(c.id))} checked={selected.includes(c.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,c.id]:prev.filter(id=>id!==c.id))}/>
            {c.full_name || "Unnamed"} · {c.email} {!c.eligible && "(" + c.reason.replaceAll("_"," ") + ")"}
          </label>)}
        </div>
      </>}
      <p><Link href="/dashboard/gencouv/contacts">Upload a new contact list</Link></p>
      <label className="admin-field">From<select value={from} onChange={e=>setFrom(e.target.value)}><option value="info@gencouv.com">info@gencouv.com</option><option value="support@gencouv.com">support@gencouv.com</option><option value="onboarding@gencouv.com">onboarding@gencouv.com</option></select></label>
      <label className="admin-field">Subject<input maxLength={200} value={subject} onChange={e=>{setSubject(e.target.value);setConfirmed(false);}}/></label>
      <label className="admin-field">Email body<textarea rows={8} maxLength={30000} value={message} onChange={e=>{setMessage(e.target.value);setConfirmed(false);}} placeholder="Hello [Name], ..."/></label>
      <details><summary>Preview email</summary><div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",padding:12}}><strong>{subject || "No subject"}</strong><p>{message.replace(/\\[Name\\]/gi, eligible.find(c=>selected.includes(c.id))?.full_name || "there")}</p></div></details>
      <label style={{display:"flex",gap:8,alignItems:"start"}}><input type="checkbox" checked={consentConfirmed} onChange={e=>setConsentConfirmed(e.target.checked)}/> I confirm these selected contacts previously agreed to Gencouv promotional emails.</label>
      <label style={{display:"flex",gap:8,alignItems:"start"}}><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> I reviewed the audience, subject and content and authorize this one-time send.</label>
      <button type="button" disabled={busy || !selected.length || !confirmed || !consentConfirmed || !subject.trim() || !message.trim()} onClick={()=>void send()}>{busy ? "Processing..." : "Send one-time email to " + selected.length + " recipients"}</button>
      {error && <p role="alert" style={{color:"#fca5a5"}}>{error}</p>}
      {status && <p role="status">{status}</p>}
    </div>
  </section>;
}
