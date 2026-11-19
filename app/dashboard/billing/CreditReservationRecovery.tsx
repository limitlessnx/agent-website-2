"use client";
import { useState, type FormEvent } from "react";
import styles from "./CreditReservationRecovery.module.css";

type Reservation = { id: string; status: string; reserved_credits: number; action_key: string; created_at: string };
export default function CreditReservationRecovery({ organizationId, reservations, unavailable }: { organizationId: string; reservations: Reservation[]; unavailable: boolean }) {
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [settled, setSettled] = useState<string[]>([]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selected || !confirmed || reason.trim().length < 15) return;
    setBusy(true); setFeedback("");
    try {
      const response = await fetch("/api/admin/billing/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId, reservationId: selected, reason, confirmed }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) { setFeedback(result.error || "Reconciliation could not be verified. Refresh before retrying."); return; }
      setSettled(current => [...current, selected]); setSelected(""); setReason(""); setConfirmed(false);
      setFeedback("Settlement verified. Refresh to see the updated balance and ledger. No provider was replayed.");
    } catch { setFeedback("Connection unavailable. Refresh the reservation before retrying."); }
    finally { setBusy(false); }
  }
  return <section className={`admin-card ${styles.panel}`} aria-labelledby="reservation-recovery-heading">
    <h2 id="reservation-recovery-heading">Reservation recovery</h2>
    <p className="admin-note">Showing up to 20 unresolved reservations, oldest first. Reconcile only completed Web AI work with matching saved result, usage and completion records. Unknown outcomes stay in review; credits are never released by this action.</p>
    {unavailable ? <p role="alert">Reservations could not be loaded. Refresh to retry.</p> : reservations.length ? <>
      <div className="admin-list compact">{reservations.map(row => <div key={row.id}><strong>{row.action_key.replaceAll("_", " ")} · {row.reserved_credits.toLocaleString()} credits</strong>{" "}<span>{row.id} · {settled.includes(row.id) ? "Settlement verified" : row.status.replaceAll("_", " ")} · {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(row.created_at)) + " WAT"}</span></div>)}</div>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <label htmlFor="recovery-reservation">Reservation</label>
        <select id="recovery-reservation" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setConfirmed(false); setFeedback(""); }} required>
          <option value="">Select a reservation</option>
          {reservations.filter(row => !settled.includes(row.id)).map(row => <option key={row.id} value={row.id}>{row.id} · {row.reserved_credits} credits</option>)}
        </select>
        <label htmlFor="recovery-reason">Review reason</label>
        <textarea id="recovery-reason" value={reason} onChange={event => setReason(event.target.value)} minLength={15} maxLength={500} disabled={busy} required />
        <label className={styles.confirmation}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={busy} /> I reviewed this organization and reservation. The server must verify completion evidence before settlement.</label>
        <button className="admin-button" type="submit" disabled={busy || !selected || !confirmed || reason.trim().length < 15} aria-busy={busy}>{busy ? "Reconciling…" : "Reconcile completed work"}</button>
      </form>
    </> : <p>No unresolved reservations in this organization.</p>}
    {feedback ? <p role="status">{feedback}</p> : null}
  </section>;
}
