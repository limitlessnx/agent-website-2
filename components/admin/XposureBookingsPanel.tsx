"use client";

import { useCallback, useEffect, useState } from "react";

type Booking = {
  id: string; customer_name: string; customer_phone: string; service_type: string;
  package_name: string | null; requested_start_at: string | null; requested_end_at: string | null;
  amount_minor: number; currency: string; booking_status: string; payment_status: string;
  payment_verified_at: string | null; follow_up_state: string;
};

const money = (minor: number, currency: string) => new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
const label = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

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

  async function markPaymentReceived(booking: Booking) {
    const confirmed = window.confirm(`Confirm that you personally checked the Xposure bank account and verified the funds for ${booking.customer_name}? This only records your manual verification.`);
    if (!confirmed) return;
    setBusyId(booking.id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/xposure/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: booking.id, action: "payment_received" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Payment status could not be updated.");
      setMessage(`Payment Received recorded for ${booking.customer_name}. The booking has not been automatically confirmed.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Payment status could not be updated."); }
    finally { setBusyId(""); }
  }

  return <section style={{ display: "grid", gap: 16 }}>
    <div style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 12, padding: 16 }}><strong>Manual payment workflow</strong><p style={{ marginBottom: 0 }}>Clients send receipts directly to the authorized Xposure handover agent. The agent checks the bank outside Fluxknight, then records Payment Received here. This dashboard does not verify bank transfers.</p></div>
    {error ? <p role="alert" style={{ color: "var(--fk-danger, #b42318)" }}>{error}</p> : null}
    {message ? <p role="status">{message}</p> : null}
    {loading ? <p>Loading studio bookings…</p> : bookings.length === 0 ? <div style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 12, padding: 24 }}><strong>No studio bookings found</strong><p>New bookings will appear here when Maia's booking workflow is connected and the booking migration is released.</p></div> : <div style={{ display: "grid", gap: 12 }}>{bookings.map((booking) => <article key={booking.id} style={{ border: "1px solid var(--fk-border, #ddd)", borderRadius: 12, padding: 16, display: "grid", gap: 8 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h2 style={{ margin: 0, fontSize: 18 }}>{booking.customer_name}</h2><p style={{ margin: "4px 0", color: "var(--fk-muted, #777)" }}>{booking.customer_phone}</p></div><strong>{money(booking.amount_minor, booking.currency)}</strong></div><p style={{ margin: 0 }}>{label(booking.service_type)}{booking.package_name ? ` · ${booking.package_name}` : ""}</p><p style={{ margin: 0 }}>Booking: <strong>{label(booking.booking_status)}</strong> · Payment: <strong>{label(booking.payment_status)}</strong></p><p style={{ margin: 0 }}>Requested: {booking.requested_start_at ? new Date(booking.requested_start_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date/time pending"}</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{!['verified', 'refunded'].includes(booking.payment_status) ? <button type="button" disabled={busyId === booking.id} onClick={() => void markPaymentReceived(booking)}>{busyId === booking.id ? "Saving…" : "Payment Received"}</button> : <span role="status">Payment recorded{booking.payment_verified_at ? ` · ${new Date(booking.payment_verified_at).toLocaleString("en-NG")}` : ""}</span>}</div></article>)}</div>}
  </section>;
}
