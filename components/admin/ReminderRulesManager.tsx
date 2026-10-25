"use client";

import { useCallback, useEffect, useState } from "react";
import ReminderExecutionHistory from "@/components/admin/ReminderExecutionHistory";
import ReminderNotificationInbox from "@/components/admin/ReminderNotificationInbox";


type Rule = {
  id: string; name: string; description: string; trigger_type: "date" | "recurring" | "event";
  event_key: string | null; anchor_field: string | null; schedule_config: Record<string, unknown>;
  channel: "internal" | "whatsapp" | "email"; message_mode: "template" | "ai";
  message_template: string; timezone: string; status: "draft" | "active" | "paused" | "archived";
  created_at: string;
};

const frequencies = [
  ["daily", "Every day"], ["weekly", "Every week"], ["biweekly", "Every two weeks"],
  ["monthly", "Every month"], ["quarterly", "Every quarter"], ["yearly", "Every year"], ["custom", "Custom interval"],
];

export default function ReminderRulesManager({ organizationName }: { organizationName: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState<Rule["trigger_type"]>("recurring");
  const [frequency, setFrequency] = useState("monthly");
  const [interval, setInterval] = useState("3");
  const [specificDate, setSpecificDate] = useState("");
  const [anchorField, setAnchorField] = useState("birthday");
  const [eventKey, setEventKey] = useState("client_added");
  const [channel, setChannel] = useState<Rule["channel"]>("internal");
  const [messageMode, setMessageMode] = useState<Rule["message_mode"]>("template");
  const [message, setMessage] = useState("");
  const [timezone, setTimezone] = useState("Africa/Lagos");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/reminder-rules", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load reminder rules.");
      setRules(body.rules || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load reminder rules."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const schedule_config: Record<string, unknown> = trigger === "recurring"
      ? { frequency, ...(frequency === "custom" ? { interval: Math.max(1, Number(interval) || 1) } : {}) }
      : trigger === "date" ? { ...(specificDate ? { date: specificDate } : {}) } : {};
    try {
      const response = await fetch("/api/admin/reminder-rules", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name, description, trigger_type: trigger, schedule_config,
          anchor_field: trigger === "date" && !specificDate ? anchorField : null,
          event_key: trigger === "event" ? eventKey : null,
          channel, message_mode: messageMode, message_template: message, timezone,
          status: "draft", audience_config: { audience: "selected_by_tenant" },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create reminder rule.");
      setName(""); setDescription(""); setMessage("");
      setNotice("Reminder rule saved as a draft. Activate it only after its delivery workflow is configured.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create reminder rule."); }
    finally { setSaving(false); }
  }

  async function setStatus(rule: Rule, status: Rule["status"]) {
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/reminder-rules", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: rule.id, status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update reminder rule.");
      setNotice("Reminder rule status updated."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update reminder rule."); }
  }

  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 20 }}>
    <section style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 16, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Create a reminder rule</h2>
      <p style={{ color: "var(--fk-muted, #777)", fontSize: 14 }}>Rules are saved as drafts. External delivery stays inactive until the tenant's channel and scheduling workflow are connected.</p>
      <form onSubmit={createRule} style={{ display: "grid", gap: 12 }}>
        <label>Rule name<input required minLength={2} maxLength={140} value={name} onChange={e=>setName(e.target.value)} placeholder="Client birthday wishes" style={inputStyle} /></label>
        <label>Description (optional)<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} style={inputStyle} placeholder="What should this automation do?" /></label>
        <label>Trigger type<select value={trigger} onChange={e=>setTrigger(e.target.value as Rule["trigger_type"])} style={inputStyle}><option value="date">Date-based</option><option value="recurring">Recurring schedule</option><option value="event">When an event happens</option></select></label>
        {trigger === "recurring" ? <><label>Repeat<select value={frequency} onChange={e=>setFrequency(e.target.value)} style={inputStyle}>{frequencies.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>{frequency==="custom" ? <label>Repeat every N days<input type="number" min={1} max={365} value={interval} onChange={e=>setInterval(e.target.value)} style={inputStyle}/></label>:null}</> : null}
        {trigger === "date" ? <><label>Date source<select value={specificDate ? "specific" : "field"} onChange={e=>{if(e.target.value==="specific")setAnchorField("");else {setSpecificDate("");setAnchorField("birthday");}}} style={inputStyle}><option value="field">A date on the client record</option><option value="specific">A specific calendar date</option></select></label>{specificDate ? <label>Specific date<input type="date" required value={specificDate} onChange={e=>setSpecificDate(e.target.value)} style={inputStyle}/></label> : <label>Client date field<input required value={anchorField} onChange={e=>setAnchorField(e.target.value)} placeholder="birthday, wedding_anniversary" style={inputStyle}/></label>}</> : null}
        {trigger === "event" ? <label>Event key<input required value={eventKey} onChange={e=>setEventKey(e.target.value)} placeholder="client_added, appointment_booked" style={inputStyle}/></label>:null}
        <label>Action channel<select value={channel} onChange={e=>setChannel(e.target.value as Rule["channel"])} style={inputStyle}><option value="internal">Internal task / notification</option><option value="whatsapp">WhatsApp message</option><option value="email">Email</option></select></label>
        {channel !== "internal" ? <><label>Message generation<select value={messageMode} onChange={e=>setMessageMode(e.target.value as Rule["message_mode"])} style={inputStyle}><option value="template">Fixed message template</option><option value="ai">Personalized AI message</option></select></label><label>Message template{messageMode==="ai" ? " / guidance" : ""}<textarea required value={message} onChange={e=>setMessage(e.target.value)} rows={4} style={inputStyle} placeholder="Write the approved message or instructions for personalization." /></label></>:null}
        <label>Timezone<input required value={timezone} onChange={e=>setTimezone(e.target.value)} style={inputStyle}/></label>
        <button disabled={saving} type="submit" style={buttonStyle}>{saving ? "Saving…" : "Save draft rule"}</button>
      </form>
    </section>
    <section style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 16, padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Rules for {organizationName}</h2>
      {error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p>:null}
      {notice ? <p role="status">{notice}</p>:null}
      {loading ? <p>Loading reminder rules…</p> : rules.length ? <div style={{ display: "grid", gap: 12 }}>{rules.map(rule=><article key={rule.id} style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "start" }}><strong>{rule.name}</strong><span style={{ fontSize: 12, textTransform: "capitalize" }}>{rule.status}</span></div>
        {rule.description ? <p>{rule.description}</p>:null}
        <p style={{ fontSize: 13, color: "var(--fk-muted, #777)" }}>{rule.trigger_type==="recurring" ? "Repeats: "+String(rule.schedule_config.frequency || "custom") : rule.trigger_type==="date" ? "Date: "+(rule.anchor_field || String(rule.schedule_config.date || "configured")) : "Event: "+(rule.event_key || "configured")} · {rule.channel} · {rule.timezone}</p>
        {rule.status !== "archived" ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button type="button" onClick={()=>void setStatus(rule, rule.status==="paused"?"draft":"paused")} style={secondaryButtonStyle}>{rule.status==="paused"?"Move to draft":"Pause"}</button><button type="button" onClick={()=>void setStatus(rule,"archived")} style={secondaryButtonStyle}>Archive</button></div>:null}
      </article>)}</div> : <p>No reminder rules yet. Create the first one here.</p>}
    </section>
    <ReminderExecutionHistory />
  </div>;
}

const inputStyle: React.CSSProperties = { display: "block", width: "100%", marginTop: 6, padding: "10px 12px", border: "1px solid var(--fk-border, #ccc)", borderRadius: 9, background: "var(--fk-card, #fff)", color: "inherit", font: "inherit", boxSizing: "border-box" };
const buttonStyle: React.CSSProperties = { padding: "11px 14px", border: 0, borderRadius: 9, background: "var(--fk-brand, #6d28d9)", color: "white", fontWeight: 700, cursor: "pointer" };
const secondaryButtonStyle: React.CSSProperties = { padding: "7px 10px", border: "1px solid var(--fk-border, #ccc)", borderRadius: 8, background: "transparent", color: "inherit", cursor: "pointer" };
