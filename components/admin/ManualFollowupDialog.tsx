"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send, X } from "@/components/admin/ServerIcons";
import styles from "./ManualFollowupDialog.module.css";

type Props = { lead: { id: string; name?: string; phone: string }; onClose: () => void; onActivated: (message: string) => void };

export default function ManualFollowupDialog({ lead, onClose, onActivated }: Props) {
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const activating = useRef(false);
  const [properties, setProperties] = useState<Array<{ id: string; title: string }>>([]);
  const [propertyId, setPropertyId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/limitless/manual-followups", { cache: "no-store", signal: controller.signal }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load properties.");
      if (!controller.signal.aborted) { setProperties(payload.properties || []); setLoadError(""); }
    }).catch(reason => { if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : "Unable to load properties."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); if (!busy) onClose(); }
      if (event.key !== "Tab") return;
      const focusable = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; };
  }, [busy, onClose]);
  async function activate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activating.current || busy || loading || !propertyId || !reason.trim() || !consent) return;
    activating.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/limitless/manual-followups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_id: lead.id, property_id: propertyId, reason, notes, consent_confirmed: consent }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to activate follow-up.");
      if (payload.status !== "active") throw new Error("Activation was not confirmed. Check Follow-up Control before trying again.");
      onActivated(payload.message || "Follow-up activated. The first step is queued now; delivery is not yet confirmed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Activation could not be confirmed. Check Follow-up Control before trying again."); }
    finally { activating.current = false; setBusy(false); }
  }
  if (typeof document === "undefined") return null;
  return createPortal(<div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby="manual-followup-title" aria-describedby="manual-followup-description" className={`admin-panel ${styles.panel}`}>
      <div className="admin-panel-header"><div><h2 id="manual-followup-title">Activate follow-up</h2><p id="manual-followup-description">{lead.name || lead.phone}. Start the follow-up sequence now, with the first step due immediately.</p></div><button ref={close} type="button" disabled={busy} onClick={onClose}><X size={16} />Close</button></div>
      <form onSubmit={activate}>
        {loadError && <div className={styles.error} role="alert"><p>{loadError}</p><button type="button" onClick={() => { setLoading(true); setLoadError(""); setReload(current => current + 1); }}>Retry properties</button></div>}
        {loading && <p role="status">Loading properties…</p>}
        {!loading && !loadError && !properties.length && <p role="status">No properties are available in this workspace.</p>}
        <div className="lead-edit-grid">
          <label className="wide">Property / estate<select value={propertyId} onChange={event => setPropertyId(event.target.value)} disabled={loading || busy || Boolean(loadError)} required><option value="">Select a property</option>{properties.map(property => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <label className="wide">Reason for follow-up<textarea value={reason} onChange={event => setReason(event.target.value)} rows={3} maxLength={2000} placeholder="Why should this lead be followed up?" required disabled={busy} /></label>
          <label className="wide">Additional notes<textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} maxLength={4000} placeholder="Internal context or objections" disabled={busy} /></label>
        </div>
        <label className={styles.consent}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} required /><span>I confirm this customer has agreed to receive WhatsApp follow-ups about this property.</span></label>
        <p className="group-builder-note">This activates the sequence immediately instead of saving a draft. The first message is queued for the follow-up runner. Customer opt-outs remain blocked; activation does not confirm message delivery.</p>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className="group-builder-actions"><button type="submit" disabled={busy || loading || Boolean(loadError) || !propertyId || !reason.trim() || !consent} aria-busy={busy}><Send size={15} />{busy ? "Activating follow-up…" : "Activate follow-up now"}</button><button type="button" className="secondary" onClick={onClose} disabled={busy}>Cancel</button></div>
      </form>
    </section>
  </div>, document.getElementById("dashboard-theme-root") || document.body);
}
