"use client";

import { useState } from "react";

type Gate = { ready: boolean; checks: Array<{ key: string; ok: boolean; detail: string }>; planName?: string };

export default function VoiceOnboardingPanel({ available, initialGate, canManage }: { available: boolean; initialGate: Gate | null; canManage: boolean }) {
  const [businessPhone, setBusinessPhone] = useState("");
  const [transferNumber, setTransferNumber] = useState("");
  const [gate, setGate] = useState<Gate | null>(initialGate);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/integrations/voice/readiness", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ businessPhone, transferNumber }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Voice setup.");
      setGate(data.gate);
      setNotice("Phone details saved. Fluxknight Super Admin will complete the provider setup and publish the Voice agent.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save Voice setup.");
    } finally {
      setBusy(false);
    }
  }

  if (!available) return <section className="portal-card"><div className="portal-card-head"><div><h2>Voice Calling</h2><p>Locked on the current plan.</p></div><span className="portal-status muted">Business required</span></div><p className="portal-muted">Voice is available when the organisation moves to Business. Basic and Plus remain WhatsApp-only.</p></section>;

  return <section className="portal-card">
    <div className="portal-card-head"><div><h2>Voice Calling</h2><p>Managed setup for the Business Voice agent. No provider passwords or API keys are collected here.</p></div><span className={`portal-status ${gate?.ready ? "good" : "warning"}`}>{gate?.ready ? "Ready" : "Setup in progress"}</span></div>
    <div className="portal-form-grid">
      <div className="portal-field"><label htmlFor="voice-business-phone">Business phone number</label><input id="voice-business-phone" value={businessPhone} disabled={!canManage || busy} onChange={(event) => setBusinessPhone(event.target.value)} placeholder="+2348012345678" /></div>
      <div className="portal-field"><label htmlFor="voice-transfer-number">Human transfer number (optional)</label><input id="voice-transfer-number" value={transferNumber} disabled={!canManage || busy} onChange={(event) => setTransferNumber(event.target.value)} placeholder="+2348098765432" /></div>
      <div><button type="button" disabled={!canManage || busy || !businessPhone} onClick={() => void save()}>{busy ? "Saving..." : "Confirm Voice setup details"}</button></div>
    </div>
    {notice ? <p className="portal-muted" style={{ marginTop: 12 }}>{notice}</p> : null}
    {gate?.checks?.length ? <div className="portal-list" style={{ marginTop: 16 }}>{gate.checks.map((check) => <div className="portal-list-row compact" key={check.key}><div><strong>{check.ok ? "Ready" : "Pending"} · {check.key.replaceAll("_", " ")}</strong><span>{check.detail}</span></div></div>)}</div> : null}
  </section>;
}
