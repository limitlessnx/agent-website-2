"use client";
import { useCallback, useEffect, useState } from "react";

type Category = { id: string; name: string };
type StoredCampaign = { id: string; subject: string; status: string; created_at: string };
type Prepared = { campaign_id: string; queued: number; excluded: number };
const route = "/api/dashboard/gencouv/bulk-campaigns";

export default function GencouvBulkCampaignComposer() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [existing, setExisting] = useState<StoredCampaign[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("info@gencouv.com");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [consent, setConsent] = useState<"no" | "yes">("no");
  const [consentBasis, setConsentBasis] = useState("");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [sendingEnabled, setSendingEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch(route, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setExisting(data.campaigns ?? []);
    setSendingEnabled(data.sending_enabled === true);
  }, []);
  useEffect(() => {
    void refresh();
    void fetch("/api/dashboard/gencouv/categories", { cache: "no-store" })
      .then(r => r.json()).then(data => setCategories(data.categories ?? []))
      .catch(() => setError("Unable to load categories."));
  }, [refresh]);
  function edited() {
    setPrepared(null);
    setConsent("no");
    setFeedback("");
  }
  async function prepare() {
    setBusy(true); setError(""); setFeedback("");
    try {
      const response = await fetch(route, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create", campaign_id: crypto.randomUUID(), category_id: categoryId,
          from, subject, text: body, consent_accepted: consent, consent_basis: consentBasis
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Campaign preparation failed.");
      setPrepared({ campaign_id: data.campaign_id, queued: data.queued, excluded: data.excluded });
      setFeedback(data.note || "Campaign prepared without sending.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare campaign.");
    } finally { setBusy(false); }
  }
  async function sendBatch() {
    if (!prepared || !sendingEnabled) return;
    setBusy(true); setError(""); setFeedback("");
    try {
      const response = await fetch(route, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", campaign_id: prepared.campaign_id })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Campaign sending unavailable.");
      setFeedback(`Reserved ${data.claimed} · Resend accepted ${data.accepted} · Suppressed ${data.suppressed} · Unknown ${data.uncertain} · Remaining queued ${data.remaining ?? "unavailable"}. Accepted is not delivered.`);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Campaign batch failed."); }
    finally { setBusy(false); }
  }
  return <section className="admin-panel" style={{ display: "grid", gap: 14 }}>
    <div className="admin-panel-header">
      <div>
        <h2>Bulk email campaigns</h2>
        <p>Prepare a consent-qualified Gencouv audience and send in controlled Resend batches. No SMS or Brevo. Up to 100 recipients in each batch, subject to remaining daily quota.</p>
      </div>
      <span className="admin-status">{sendingEnabled ? "Resend batch sending enabled" : "Sending disabled until release"}</span>
    </div>
    <label className="admin-field">Audience category
      <select value={categoryId} onChange={e => { setCategoryId(e.target.value); edited(); }}>
        <option value="">All saved Gencouv contacts</option>
        {categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
    <label className="admin-field">From
      <select value={from} onChange={e => { setFrom(e.target.value); edited(); }}>
        <option value="info@gencouv.com">info@gencouv.com</option>
        <option value="support@gencouv.com">support@gencouv.com</option>
        <option value="onboarding@gencouv.com">onboarding@gencouv.com</option>
      </select>
    </label>
    <label className="admin-field">Campaign subject
      <input value={subject} maxLength={200} onChange={e => { setSubject(e.target.value); edited(); }} placeholder="Subject" />
    </label>
    <label className="admin-field">Email content
      <textarea rows={9} maxLength={15000} value={body} onChange={e => { setBody(e.target.value); edited(); }} placeholder="Write your Gencouv email here. An unsubscribe link is added to every email." />
    </label>
    <div style={{ border: "1px solid var(--admin-border)", borderRadius: 10, padding: 12, overflowWrap: "anywhere" }}>
      <strong>Campaign preview</strong>
      <p><strong>From:</strong> {from}</p>
      <p><strong>Subject:</strong> {subject || "No subject yet"}</p>
      <p style={{ whiteSpace: "pre-wrap" }}>{body || "Your email content will appear here."}</p>
      <small>Each email is addressed individually. A signed unsubscribe link and unsubscribe headers are added at send time.</small>
    </div>
    <fieldset style={{ border: "1px solid var(--admin-border)", borderRadius: 10, padding: 12 }}>
      <legend>Consent accepted for these recipients?</legend>
      <label style={{ marginRight: 18 }}><input type="radio" name="gencouv-campaign-consent" checked={consent === "yes"} onChange={() => { setConsent("yes"); setPrepared(null); }} /> Yes, previously obtained</label>
      <label><input type="radio" name="gencouv-campaign-consent" checked={consent === "no"} onChange={() => { setConsent("no"); setPrepared(null); }} /> No</label>
      <p style={{ marginBottom: 6 }}>Yes confirms prior permission. Contacts without recorded consent or on the suppression list are still excluded automatically.</p>
      <label className="admin-field">How consent was obtained
        <input maxLength={300} value={consentBasis} onChange={e => { setConsentBasis(e.target.value); setPrepared(null); }}
          placeholder="e.g. subscription form, date and source" />
      </label>
    </fieldset>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      <button type="button" disabled={busy || consent !== "yes" || consentBasis.trim().length < 8 || !subject.trim() || !body.trim() || !!prepared}
        onClick={() => void prepare()}>{busy ? "Working…" : "Prepare reviewed campaign"}</button>
      <button type="button" disabled={busy || !prepared || !sendingEnabled} onClick={() => void sendBatch()}>
        {busy ? "Working…" : "Send up to 100 with Resend"}
      </button>
    </div>
    {prepared && <p role="status">Campaign reserved: {prepared.queued} contacts with recorded consent, {prepared.excluded} excluded. ID: {prepared.campaign_id}</p>}
    {!sendingEnabled && <p role="status">Campaign preparation is available after database migration; live bulk sending stays disabled until release verification.</p>}
    {existing.length > 0 && <details><summary>Recent campaigns ({existing.length})</summary>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {existing.map(item => <div key={item.id} style={{ overflowWrap: "anywhere" }}>
          <strong>{item.subject}</strong> · {item.status}
          {item.status === "ready" && <button type="button" style={{ marginLeft: 10 }}
            onClick={() => { setPrepared({ campaign_id: item.id, queued: 0, excluded: 0 }); setFeedback("Selected existing campaign."); }}
            disabled={busy}>Resume</button>}
        </div>)}
      </div>
    </details>}
    {error && <p role="alert" style={{ color: "#fca5a5" }}>{error}</p>}
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}
