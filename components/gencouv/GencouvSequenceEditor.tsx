"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

const templateOptions = [
  { label: "Welcome", alias: "gencouv_welcome" },
  { label: "Complete onboarding", alias: "gencouv_complete_onboarding" },
  { label: "Broker setup", alias: "gencouv_broker_setup" },
  { label: "Support acknowledgement", alias: "gencouv_support_acknowledgement" },
];

type Step = {
  id?: string;
  name: string;
  subject: string;
  preview_text: string;
  text_body: string;
  html_body: string;
  delay_minutes: number;
  resend_template_alias: string;
  is_enabled: boolean;
};

type Sequence = {
  id?: string;
  name: string;
  description: string;
  status: string;
  sender_name: string;
  sender_email: string;
  reply_to_email: string;
  daily_limit: number;
  steps: Step[];
};

const blankStep = (index = 0): Step => ({
  name: `Email ${index + 1}`,
  subject: "",
  preview_text: "",
  text_body: "",
  html_body: "",
  delay_minutes: index === 0 ? 0 : 1440,
  resend_template_alias: "",
  is_enabled: true,
});

const blankSequence: Sequence = {
  name: "Gencouv onboarding sequence",
  description: "Welcome, qualification and onboarding messages sent through Resend.",
  status: "draft",
  sender_name: "Gencouv",
  sender_email: "onboarding@gencouv.com",
  reply_to_email: "support@gencouv.com",
  daily_limit: 10,
  steps: [blankStep(0)],
};

export default function GencouvSequenceEditor() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [draft, setDraft] = useState<Sequence>(blankSequence);
  const [message, setMessage] = useState("Loading email sequences...");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/gencouv/email-sequences", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Unable to load sequences.");
        const loaded = data.sequences || [];
        setSequences(loaded);
        setDraft(loaded[0] || blankSequence);
        setMessage(loaded.length ? "Sequence content is ready to edit." : "Create your first sequence below.");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load sequences."));
  }, []);

  const currentSteps = useMemo(() => draft.steps || [], [draft.steps]);

  const updateStep = (index: number, patch: Partial<Step>) => {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)),
    }));
  };

  const save = () => {
    startTransition(async () => {
      try {
        setMessage("Saving to Supabase and publishing linked Resend templates...");
        const response = await fetch("/api/gencouv/email-sequences", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...draft, sequence_id: draft.id }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Unable to save sequence.");
        const refreshed = await fetch("/api/gencouv/email-sequences", { cache: "no-store" }).then((result) => result.json());
        setSequences(refreshed.sequences || []);
        const saved = (refreshed.sequences || []).find((item: Sequence) => item.id === data.sequence.id) || draft;
        setDraft(saved);
        setMessage("Saved. Linked Resend templates were updated and published.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save sequence.");
      }
    });
  };

  return (
    <section className="admin-panel" id="email-sequence-editor">
      <div className="admin-panel-header">
        <div>
          <h2>Email sequence editor</h2>
          <p>Edit the messages Gencouv sends. Resend remains the sender while Supabase stores the working version and history.</p>
        </div>
        <span className={draft.status === "active" ? "admin-status live" : "admin-status"}>{draft.status}</span>
      </div>

      <details style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>Sequence settings</summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
          {sequences.length ? (
            <label className="admin-field">Saved sequence
              <select value={selectedIndex} onChange={(event) => { const index = Number(event.target.value); setSelectedIndex(index); setDraft(sequences[index]); }}>
                {sequences.map((sequence, index) => <option key={sequence.id || index} value={index}>{sequence.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="admin-field">Sequence name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="admin-field">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="archived">Archived</option></select></label>
          <label className="admin-field">Daily limit<input type="number" min={1} max={500} value={draft.daily_limit} onChange={(event) => setDraft({ ...draft, daily_limit: Number(event.target.value) })} /></label>
          <label className="admin-field">Sender name<input value={draft.sender_name} onChange={(event) => setDraft({ ...draft, sender_name: event.target.value })} /></label>
          <label className="admin-field">Sender email<input type="email" value={draft.sender_email} onChange={(event) => setDraft({ ...draft, sender_email: event.target.value })} /></label>
          <label className="admin-field">Reply-to email<input type="email" value={draft.reply_to_email} onChange={(event) => setDraft({ ...draft, reply_to_email: event.target.value })} /></label>
        </div>
      </details>

      <div style={{ display: "grid", gap: 12 }}>
        {currentSteps.map((step, index) => (
          <details key={step.id || index} open={index === 0} className="admin-panel" style={{ margin: 0 }}>
            <summary style={{ cursor: "pointer", fontWeight: 800 }}>Step {index + 1}: {step.name || "Untitled email"}</summary>
            <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
                <label className="admin-field">Step name<input value={step.name} onChange={(event) => updateStep(index, { name: event.target.value })} /></label>
                <label className="admin-field">Resend template<select value={step.resend_template_alias} onChange={(event) => updateStep(index, { resend_template_alias: event.target.value })}><option value="">Store only, no linked template</option>{templateOptions.map((option) => <option key={option.alias} value={option.alias}>{option.label}</option>)}</select></label>
                <label className="admin-field">Wait before sending (minutes)<input type="number" min={0} value={step.delay_minutes} onChange={(event) => updateStep(index, { delay_minutes: Number(event.target.value) })} /></label>
              </div>
              <label className="admin-field">Subject<input value={step.subject} onChange={(event) => updateStep(index, { subject: event.target.value })} /></label>
              <label className="admin-field">Preview text<input value={step.preview_text} onChange={(event) => updateStep(index, { preview_text: event.target.value })} /></label>
              <label className="admin-field">Email message<textarea rows={10} value={step.text_body} onChange={(event) => updateStep(index, { text_body: event.target.value })} placeholder="Write the complete email message. Message length is not artificially shortened." /></label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" checked={step.is_enabled} onChange={(event) => updateStep(index, { is_enabled: event.target.checked })} /> Enabled</label>
              <button type="button" onClick={() => setDraft((current) => ({ ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) }))} disabled={currentSteps.length === 1}>Remove step</button>
            </div>
          </details>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <button type="button" onClick={() => setDraft((current) => ({ ...current, steps: [...current.steps, blankStep(current.steps.length)] }))}>Add email step</button>
        <button type="button" onClick={() => { setSelectedIndex(sequences.length); setDraft(blankSequence); setMessage("New sequence draft opened."); }}>New sequence</button>
        <button type="button" onClick={save} disabled={isPending}>{isPending ? "Saving..." : "Save and publish"}</button>
      </div>
      <p style={{ color: "var(--admin-text-muted)", marginTop: 14 }}>{message}</p>
    </section>
  );
}
