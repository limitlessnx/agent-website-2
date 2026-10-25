"use client";
import { useCallback, useEffect, useState } from "react";

type Notice = { id: string; appointment_id: string; title: string; body: string; status: string; created_at: string };

export default function AppointmentReminderInbox() {
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/appointment-reminder-notifications", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load appointment reminders.");
      setItems(body.notifications || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load appointment reminders.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <section style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 16, padding: 20, marginTop: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div><h2 style={{ margin: 0 }}>Appointment reminders</h2><p style={{ color: "var(--fk-muted, #777)", fontSize: 14 }}>Internal alerts for confirmed appointments. WhatsApp and email delivery are not enabled here.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} style={{ padding: "8px 12px", border: "1px solid var(--fk-border, #ccc)", borderRadius: 8, background: "transparent", color: "inherit" }}>{loading ? "Refreshing…" : "Refresh"}</button>
    </div>
    {error ? <p role="alert">{error}</p> : null}
    {loading ? <p>Loading appointment reminders…</p> : items.length ? <div style={{ display: "grid", gap: 8 }}>
      {items.map(item => <article key={item.id} style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong>{item.title}</strong><span>{item.status}</span></div>
        <p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()} · Appointment {item.appointment_id}</small>
      </article>)}
    </div> : <p>No appointment reminders yet. Confirmed upcoming bookings will appear here once the migration and scheduled task are active.</p>}
  </section>;
}
