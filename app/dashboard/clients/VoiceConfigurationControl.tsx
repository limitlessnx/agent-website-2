"use client";

import { useEffect, useState } from "react";

type Configuration = {
  elevenlabs_agent_id?: string;
  elevenlabs_version_id?: string;
  elevenlabs_phone_number_id?: string;
  elevenlabs_webhook_id?: string;
  identity?: string;
  greeting?: string;
  language?: string;
  voice?: string;
  after_hours_response?: string;
  qualification_questions?: string[];
  human_handoff_number?: string;
  voicemail_behavior?: string;
  call_summary_format?: string;
  recording_policy?: string;
  maximum_call_duration_minutes?: number;
};

const empty: Configuration = { language: "en-NG", voice: "nova", recording_policy: "transcription_only", maximum_call_duration_minutes: 30, qualification_questions: [] };

export default function VoiceConfigurationControl({ organizationId }: { organizationId: string }) {
  const [available, setAvailable] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [configuration, setConfiguration] = useState<Configuration>(empty);
  const [questionText, setQuestionText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch(`/api/admin/clients/voice-config?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load Voice configuration.");
        setAvailable(Boolean(result.available));
        setAgentName(String(result.agent?.name || ""));
        setConfiguration({ ...empty, ...(result.configuration || {}) });
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Unable to load Voice configuration."));
  }, [organizationId]);

  function update(key: keyof Configuration, value: string | number) {
    setConfiguration((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/clients/voice-config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, ...configuration, qualification_questions: configuration.qualification_questions || [] }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save Voice configuration.");
      setConfiguration({ ...empty, ...(result.configuration || {}) });
      setMessage(`${agentName || "Voice agent"} configuration saved. Run a fresh test before requesting approval.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save Voice configuration.");
    } finally {
      setBusy(false);
    }
  }

  if (!available) return <div className="admin-list-row compact"><div><strong>Voice configuration unavailable</strong><span>Voice is locked until this organization is on the Business plan or above.</span></div></div>;
  if (!agentName) return <div className="admin-list-row compact"><div><strong>Allocate the Voice Agent first</strong><span>Voice configuration becomes available after the Business Voice allocation is provisioned.</span></div></div>;

  return <div style={{ display: "grid", gap: 14 }}>
    <div className="admin-list-row compact"><div><strong>{agentName}</strong><span>Configure the Voice agent. Provider credentials remain managed by Fluxknight and are never entered here.</span></div><em>Super Admin</em></div>
    <div className="admin-form-grid">
      <label className="admin-field"><span>ElevenLabs Agent ID</span><input className="admin-input" value={configuration.elevenlabs_agent_id || ""} onChange={(event) => update("elevenlabs_agent_id", event.target.value)} placeholder="agent_..." /></label>
      <label className="admin-field"><span>ElevenLabs version ID</span><input className="admin-input" value={configuration.elevenlabs_version_id || ""} onChange={(event) => update("elevenlabs_version_id", event.target.value)} placeholder="version_..." /></label>
      <label className="admin-field"><span>ElevenLabs phone number ID</span><input className="admin-input" value={configuration.elevenlabs_phone_number_id || ""} onChange={(event) => update("elevenlabs_phone_number_id", event.target.value)} placeholder="phone_..." /></label>
      <label className="admin-field"><span>ElevenLabs webhook ID</span><input className="admin-input" value={configuration.elevenlabs_webhook_id || ""} onChange={(event) => update("elevenlabs_webhook_id", event.target.value)} placeholder="webhook_..." /></label>
      <label className="admin-field"><span>Agent identity</span><input className="admin-input" value={configuration.identity || ""} onChange={(event) => update("identity", event.target.value)} placeholder="A calm, professional voice receptionist" /></label>
      <label className="admin-field"><span>Greeting</span><input className="admin-input" value={configuration.greeting || ""} onChange={(event) => update("greeting", event.target.value)} placeholder="Hello, thank you for calling..." /></label>
      <label className="admin-field"><span>Language</span><select className="admin-input" value={configuration.language || "en-NG"} onChange={(event) => update("language", event.target.value)}><option value="en-NG">English (Nigeria)</option><option value="en-GB">English (UK)</option><option value="en-US">English (US)</option><option value="en">English (International)</option></select></label>
      <label className="admin-field"><span>Voice</span><select className="admin-input" value={configuration.voice || "nova"} onChange={(event) => update("voice", event.target.value)}><option value="nova">Nova</option><option value="alloy">Alloy</option><option value="echo">Echo</option><option value="fable">Fable</option><option value="onyx">Onyx</option><option value="shimmer">Shimmer</option></select></label>
      <label className="admin-field"><span>Human handoff number</span><input className="admin-input" value={configuration.human_handoff_number || ""} onChange={(event) => update("human_handoff_number", event.target.value)} placeholder="+2348012345678" /></label>
      <label className="admin-field"><span>Maximum call duration (minutes)</span><input className="admin-input" type="number" min={1} max={180} value={configuration.maximum_call_duration_minutes || 30} onChange={(event) => update("maximum_call_duration_minutes", Number(event.target.value))} /></label>
      <label className="admin-field"><span>Recording policy</span><select className="admin-input" value={configuration.recording_policy || "transcription_only"} onChange={(event) => update("recording_policy", event.target.value)}><option value="disabled">Disabled</option><option value="transcription_only">Transcription only</option><option value="record_and_transcribe">Record and transcribe</option></select></label>
      <label className="admin-field"><span>Voicemail behavior</span><input className="admin-input" value={configuration.voicemail_behavior || ""} onChange={(event) => update("voicemail_behavior", event.target.value)} placeholder="Collect name, number and reason for calling" /></label>
    </div>
    <label className="admin-field"><span>After-hours response</span><textarea className="admin-input" rows={3} value={configuration.after_hours_response || ""} onChange={(event) => update("after_hours_response", event.target.value)} placeholder="Explain when the team is available and offer to collect a callback request." /></label>
    <label className="admin-field"><span>Call summary format</span><textarea className="admin-input" rows={3} value={configuration.call_summary_format || ""} onChange={(event) => update("call_summary_format", event.target.value)} placeholder="Summarize caller, intent, qualification answers, promised follow-up and handoff status." /></label>
    <div className="admin-field"><span>Qualification questions</span><div style={{ display: "flex", gap: 8 }}><input className="admin-input" value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="What service are you interested in?" /><button className="admin-button secondary" type="button" onClick={() => { if (questionText.trim()) { setConfiguration((current) => ({ ...current, qualification_questions: [...(current.qualification_questions || []), questionText.trim()].slice(0, 20) })); setQuestionText(""); } }}>Add</button></div>{configuration.qualification_questions?.map((question, index) => <div className="admin-list-row compact" key={`${question}-${index}`}><span>{index + 1}</span><div><strong>{question}</strong></div><button className="admin-button secondary" type="button" onClick={() => setConfiguration((current) => ({ ...current, qualification_questions: (current.qualification_questions || []).filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button></div>)}</div>
    <div><button className="admin-button" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : "Save Voice configuration"}</button></div>
    {message ? <p className="admin-form-message">{message}</p> : null}
  </div>;
}
