"use client";

import { useEffect, useState } from "react";

export default function AppointmentCapacitySettings() {
  const [capacity, setCapacity] = useState("1");
  const [savedCapacity, setSavedCapacity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/appointment-availability-settings", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load capacity settings.");
        if (active) {
          const value = String(body.maxConcurrentAppointments ?? 1);
          setCapacity(value); setSavedCapacity(value);
        }
      })
      .catch((error) => { if (active) { setLoadFailed(true); setFailed(true); setMessage(error instanceof Error ? error.message : "Unable to load settings."); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  async function save() {
    const value = Number(capacity);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      setFailed(true); setMessage("Enter a whole number from 1 to 100."); return;
    }
    setSaving(true); setMessage(""); setFailed(false);
    try {
      const response = await fetch("/api/admin/appointment-availability-settings", {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxConcurrentAppointments: value }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save capacity.");
      setCapacity(String(body.maxConcurrentAppointments)); setSavedCapacity(String(body.maxConcurrentAppointments));
      setMessage(`Saved. Up to ${body.maxConcurrentAppointments} appointments can overlap when calendar rules allow.`);
    } catch (error) { setFailed(true); setMessage(error instanceof Error ? error.message : "Unable to save capacity."); }
    finally { setSaving(false); }
  }

  return <section className="admin-panel" id="appointment-capacity" aria-busy={loading || saving}>
    <div className="admin-panel-header"><div><h2>Appointment Capacity</h2><p>Set how many tenant appointments may overlap in the same time window. External calendar meetings still block availability.</p></div></div>
    <div className="admin-list-row settings-control-row">
      <div><label htmlFor="appointment-capacity-value"><strong>Maximum simultaneous appointments</strong></label><span id="appointment-capacity-hint">Default is 1. Choose 2 or more only if the business can serve multiple clients at once.</span></div>
      <div className="settings-control-actions">
        <input id="appointment-capacity-value" aria-describedby="appointment-capacity-hint appointment-capacity-feedback" aria-invalid={failed || undefined} type="number" min={1} max={100} step={1} value={capacity} disabled={loading || saving || loadFailed} onChange={event => setCapacity(event.target.value)} />
        <button type="button" className="admin-button primary-button" onClick={save} disabled={loading || saving || loadFailed}>{saving ? "Saving…" : "Save capacity"}</button>
        <button type="button" className="admin-button secondary" disabled={loading || saving || loadFailed || capacity === savedCapacity} onClick={() => { setCapacity(savedCapacity); setMessage(""); setFailed(false); }}>Reset changes</button>
      </div>
    </div>
    <div id="appointment-capacity-feedback">{message && <p role={failed ? "alert" : "status"} className={failed ? "settings-feedback-error" : "settings-feedback-success"}>{message}</p>}</div>
    {loadFailed && <button type="button" className="admin-button secondary" onClick={() => { setLoading(true); setLoadFailed(false); setMessage(""); setFailed(false); setAttempt(value => value + 1); }}>Retry loading capacity</button>}
  </section>;
}
