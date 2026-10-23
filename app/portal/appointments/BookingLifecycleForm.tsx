"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; userId: string; email: string | null; role: string };
type Props = { bookingId: string; members: Member[]; initial: { title: string; status: string; startAt: string; endAt: string; location: string; notes: string; depositStatus: string; deliveryStatus: string; assignedPhotographerId: string; shootType: string } };

export default function BookingLifecycleForm({ bookingId, members, initial }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [requestedStatus, setRequestedStatus] = useState(initial.status);
  function toLagosIso(value: string) { if (!value) return ""; const parsed = new Date(`${value}:00+01:00`); return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString(); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      title: String(form.get("title") || initial.title || "Studio session"),
      status: requestedStatus, startAt: toLagosIso(String(form.get("startAt") || "")), endAt: toLagosIso(String(form.get("endAt") || "")) || null,
      location: String(form.get("location") || ""), clientNotes: String(form.get("clientNotes") || ""),
      depositStatus: String(form.get("depositStatus") || ""), deliveryStatus: String(form.get("deliveryStatus") || ""),
      assignedPhotographerId: String(form.get("assignedPhotographerId") || ""), shootType: String(form.get("shootType") || "other"),
    };
    try {
      const response = await fetch(`/api/portal/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to update booking.");
      setMessage(body.warning || "Booking updated."); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update booking."); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm("Permanently delete this booking and its studio metadata? This does not delete the CRM client.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/portal/bookings/${bookingId}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to delete booking.");
      router.push("/portal/appointments"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete booking."); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!window.confirm("Cancel this booking?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/portal/bookings/${bookingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to cancel booking.");
      setRequestedStatus("cancelled"); setMessage(body.warning || "Booking cancelled."); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to cancel booking."); }
    finally { setBusy(false); }
  }

  return <form className="portal-form-grid exposure-booking-form" onSubmit={save}>
    <div className="portal-field"><label>Status</label><select name="status" value={requestedStatus} onChange={(event) => setRequestedStatus(event.target.value)}><option value="requested">Requested</option><option value="confirmed">Confirmed</option><option value="rescheduled">Rescheduled</option><option value="cancelled">Cancelled</option></select></div>
    <div className="portal-field exposure-form-wide"><label>Booking title</label><input name="title" defaultValue={initial.title} required /></div>
    <div className="portal-field"><label>Shoot type</label><select name="shootType" defaultValue={initial.shootType}><option value="portrait">Portrait</option><option value="wedding">Wedding</option><option value="maternity">Maternity</option><option value="birthday">Birthday</option><option value="family">Family</option><option value="creative_set">Creative set</option><option value="other">Other</option></select></div>
    <div className="portal-field"><label>Start</label><input name="startAt" type="datetime-local" defaultValue={initial.startAt} required /></div>
    <div className="portal-field"><label>End</label><input name="endAt" type="datetime-local" defaultValue={initial.endAt} /></div>
    <div className="portal-field"><label>Deposit</label><select name="depositStatus" defaultValue={initial.depositStatus}><option value="not_required">Not required</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option><option value="refunded">Refunded</option><option value="failed">Failed</option></select></div>
    <div className="portal-field"><label>Delivery</label><select name="deliveryStatus" defaultValue={initial.deliveryStatus}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></div>
    <div className="portal-field"><label>Photographer</label><select name="assignedPhotographerId" defaultValue={initial.assignedPhotographerId}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.userId}>{member.email || member.userId} · {member.role}</option>)}</select><small>Only active workspace members can be assigned.</small></div>
    <div className="portal-field"><label>Studio location</label><input name="location" defaultValue={initial.location} /></div>
    <div className="portal-field exposure-form-wide"><label>Client notes</label><textarea name="clientNotes" defaultValue={initial.notes} rows={5} /></div>
    <div className="exposure-form-actions"><button className="portal-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button><button className="portal-button" type="button" onClick={() => { setRequestedStatus("confirmed"); setTimeout(() => document.querySelector<HTMLFormElement>(".exposure-booking-form")?.requestSubmit(), 0); }} disabled={busy || initial.status === "confirmed"}>Confirm booking</button><button className="portal-button secondary" type="button" onClick={() => void cancel()} disabled={busy || initial.status === "cancelled"}>Cancel booking</button><button className="portal-button secondary" type="button" onClick={() => void remove()} disabled={busy}>Delete booking</button></div>
    {message ? <p className="exposure-success" role="status">{message}</p> : null}{error ? <p className="exposure-error" role="alert">{error}</p> : null}
  </form>;
}
