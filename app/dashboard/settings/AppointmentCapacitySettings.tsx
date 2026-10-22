"use client";

import { useEffect, useState } from "react";

export default function AppointmentCapacitySettings() {
  const [capacity, setCapacity] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/appointment-availability-settings", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load capacity settings.");
        if (active) setCapacity(String(body.maxConcurrentAppointments ?? 1));
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : "Unable to load settings."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save() {
    const value = Number(capacity);
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      setMessage("Enter a whole number from 1 to 100.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/appointment-availability-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ maxConcurrentAppointments: value }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save capacity.");
      setMessage(`Saved. Up to ${body.maxConcurrentAppointments} appointments can overlap when calendar rules allow.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save capacity.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-panel" id="appointment-capacity">
      <div className="admin-panel-header">
        <div><h2>Appointment Capacity</h2><p>Set how many tenant appointments may overlap in the same time window. External calendar meetings still block availability.</p></div>
      </div>
      <div className="admin-list-row">
        <div><strong>Maximum simultaneous appointments</strong><span>Default is 1. Choose 2 or more only if the business can serve multiple clients at once.</span></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input aria-label="Maximum simultaneous appointments" type="number" min={1} max={100} step={1} value={capacity} disabled={loading || saving} onChange={(event) => setCapacity(event.target.value)} style={{ width: 90 }} />
          <button type="button" className="admin-button primary-button" onClick={save} disabled={loading || saving}>{saving ? "Saving…" : "Save capacity"}</button>
        </div>
      </div>
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
    </section>
  );
}
