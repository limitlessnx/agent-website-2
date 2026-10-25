"use client";

import { useCallback, useEffect, useState } from "react";

type Booking = {
  id: string; customer_name: string; customer_phone: string; service_type: string;
  package_name: string | null; service_details?: Record<string, unknown>;
  requested_start_at: string | null; requested_end_at: string | null; timezone?: string;
  amount_minor: number; currency: string; booking_status: string; payment_status: string;
  payment_verified_at: string | null; follow_up_state: string;
};

const money = (minor: number, currency: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const closed = (booking: Booking) => ["completed", "cancelled", "expired"].includes(booking.booking_status);

export default function XposureBookingsPanel() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/xposure/bookings", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Bookings could not be loaded.");
      setBookings(Array.isArray(payload.bookings) ? payload.bookings : []);
    } catch (e) { setError(e instanceof Error ? e.message : "Bookings could not be loaded."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function performAction(booking: Booking, action: "payment_received" | "confirm_booking" | "cancel_booking") {
    const prompt = action === "payment_received"
      ? `Confirm that you personally checked the Xposure bank account and verified the funds for ${booking.customer_name}? This only records your manual verification.`
      : action === "confirm_booking"
        ? `Confirm booking for ${booking.customer_name} at the requested date and time? Ensure availability and any custom quote have been checked.`
        : `Cancel the booking for ${booking.customer_name}? This cannot be undone from this screen.`;
    if (!window.confirm(prompt)) return;
    setBusyId(booking.id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/xposure/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: booking.id, action }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Booking could not be updated.");
      setMessage(action === "payment_received"
        ? `Payment Received recorded for ${booking.customer_name}. The booking has not been automatically confirmed.`
        : action === "confirm_booking" ? `Booking confirmed for ${booking.customer_name}.` : `Booking cancelled for ${booking.customer_name}.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Booking could not be updated."); }
    finally { setBusyId(""); }
  }

  return <section style={{ display: "grid", gap: 16 }}>
    <div style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 12, padding: 16 }}><strong>Manual payment workflow</strong><p style={{ marginBottom: 0 }}>Clients send receipts directly to the authorized Xposure handover agent. The agent checks the bank outside Fluxknight, then records Payment Received here. This dashboard does not verify bank transfers.</p></div>
    {error ? <p role="alert" style={{ color: "var(--fk-danger, #b42318)" }}>{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {loading ? <p>Loading studio bookings…</p> : bookings.length === 0 ? <div style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 12, padding: 24 }}><strong>No studio bookings found</strong><p>New bookings will appear here when Maia's booking workflow is connected and the booking migration is released.</p></div> : <div style={{ display: "grid", gap: 12 }}>{bookings.map((booking) => <article key={booking.id} style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 12, padding: 16, display: "grid", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 18 }}>{booking.customer_name}</h2><p style={{ margin: "4px 0", color: "var(--fk-muted, #777)" }}>{booking.customer_phone}</p></div><strong>{money(booking.amount_minor, booking.currency)}</strong></div><p style={{ margin: 0 }}>{label(booking.service_type)}{booking.package_name ? ` · ${booking.package_name}` : ""}</p><p style={{ margin: 0 }}>Booking: <strong>{label(booking.booking_status)}</strong> · Payment: <strong>{label(booking.payment_status)}</strong></p><p style={{ margin: 0 }}>Requested: {booking.requested_start_at ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: booking.timezone || "Africa/Lagos" }).format(new Date(booking.requested_start_at)) : "Date/time pending"}</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {!closed(booking) && !["verified", "refunded"].includes(booking.payment_status) ? <button type="button" disabled={busyId === booking.id} onClick={() => void performAction(booking, "payment_received")}>{busyId === booking.id ? "Saving…" : "Payment Received"}</button> : null}
      {!closed(booking) && booking.payment_status === "verified" && booking.booking_status !== "confirmed" ? <button type="button" disabled={busyId === booking.id || !booking.requested_start_at || !booking.requested_end_at} onClick={() => void performAction(booking, "confirm_booking")}>{busyId === booking.id ? "Saving…" : "Confirm Booking"}</button> : null}
      {!closed(booking) ? <button type="button" disabled={busyId === booking.id} onClick={() => void performAction(booking, "cancel_booking")}>{busyId === booking.id ? "Saving…" : "Cancel Booking"}</button> : null}
      {booking.payment_status === "verified" ? <span role="status">Payment recorded{booking.payment_verified_at ? ` · ${new Date(booking.payment_verified_at).toLocaleString("en-NG")}` : ""}</span> : null}
    </div></article>)}</div>}
  </section>;
}
