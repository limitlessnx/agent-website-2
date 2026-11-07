"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CampaignAiWriter.module.css";

type Props = { endpoint: string; context: Record<string, string>; values: Record<string, string>; labels?: Record<string, string>; disabled?: boolean; onApply: (values: Record<string, string>) => void };

export default function CampaignAiWriter({ endpoint, context, values, labels = {}, disabled = false, onApply }: Props) {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [suggestion, setSuggestion] = useState<{ source: string; variables: Record<string, string> } | null>(null);
  const fingerprint = JSON.stringify({ context, values, brief });
  const latest = useRef(fingerprint);
  useEffect(() => { latest.current = fingerprint; }, [fingerprint]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const visible = suggestion?.source === fingerprint ? suggestion : null;
  const hasText = Object.values(values).some(value => value.trim());

  async function write(mode: "generate" | "improve") {
    if (controller.current || disabled || (!brief.trim() && !hasText)) return;
    const abort = new AbortController(); controller.current = abort;
    const source = fingerprint;
    setBusy(true); setError(""); setNotice(""); setSuggestion(null);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...context, mode, brief, variables: values }), signal: abort.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to prepare a suggestion. Continue editing manually.");
      if (latest.current !== source) { setNotice("Your text changed while AI was writing. Generate a fresh suggestion for your latest text."); return; }
      if (!payload.variables || typeof payload.variables !== "object") throw new Error("The suggestion is incomplete. Your text is unchanged.");
      setSuggestion({ source, variables: payload.variables });
    } catch (reason) { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "AI writing is unavailable. Your text is unchanged."); }
    finally { if (!abort.signal.aborted) setBusy(false); controller.current = null; }
  }

  return <section className={styles.writer} aria-label="AI writing assistant">
    <div className={styles.heading}><strong>Write with AI</strong><span>Draft suggestions · review before applying</span></div>
    <label className={styles.field}>What would you like to say?<textarea value={brief} onChange={event => { setBrief(event.target.value); setNotice(""); }} rows={3} maxLength={4000} disabled={disabled || busy} placeholder="Describe the message, occasion or offer. Include only confirmed details." /></label>
    <div className={styles.actions}><button type="button" disabled={disabled || busy || (!brief.trim() && !hasText)} onClick={() => void write("generate")} aria-busy={busy}>{busy ? "Preparing suggestion…" : "Generate with AI"}</button><button type="button" disabled={disabled || busy || !hasText} onClick={() => void write("improve")}>Improve with AI</button></div>
    <p className={styles.hint}>AI fits your write-up into the editable template fields. Check facts and offers before applying. AI credits apply.</p>
    {visible && <div className={styles.suggestion}><strong>Suggested write-up</strong>
      {Object.entries(visible.variables).map(([key, value]) => <div key={key}><span>{labels[key] || key.replaceAll("_", " ")}</span><p>{value}</p></div>)}
      <div className={styles.actions}><button type="button" disabled={disabled} onClick={() => { onApply(visible.variables); setSuggestion(null); setNotice("Suggestion applied. Review the message preview before sending."); }}>Apply suggestion</button><button type="button" onClick={() => setSuggestion(null)}>Discard suggestion</button></div>
      <p className={styles.hint}>Your original text stays in the editor until you apply this suggestion. Nothing has been sent.</p>
    </div>}
    {busy && <p role="status" className={styles.hint}>Preparing a draft. Your current message is unchanged.</p>}
    {notice && <p role="status" className={styles.hint}>{notice}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}
