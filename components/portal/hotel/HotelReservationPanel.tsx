"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, ReceiptText } from "lucide-react";
import { HOTEL_STATE_ACTIONS, hotelQuotedTotal, formatHotelMoney, type HotelWorkspaceData, type HotelReservation, type HotelPayment, type HotelPaymentTotal, type HotelBookingEvent } from "@/lib/hotel-booking-contract";
import { Action, Status, dateLabel, hotelRequest, type HotelMutation } from "./HotelUI";
import styles from "./HotelWorkspace.module.css";
export type HotelReservationDetails = { reservation: HotelReservation; payments: HotelPayment[]; paymentTotal: HotelPaymentTotal | null; events: HotelBookingEvent[] };
export function HotelBalance({ booking, total }: { booking: HotelReservation; total: HotelPaymentTotal | null | undefined }) {
  const quoted = hotelQuotedTotal(booking); const verified = BigInt(total?.verified_minor || "0"); const pending = BigInt(total?.pending_minor || "0"); const currency = booking.currency;
  return <div className={styles.balance}>
    <div><span>Room quote</span><strong>{quoted !== null && currency ? formatHotelMoney(quoted, currency) : "Quote incomplete"}</strong></div>
    <div><span>Manually verified</span><strong>{currency ? formatHotelMoney(verified, currency) : "—"}</strong></div>
    <div><span>{quoted !== null && verified > quoted ? "Verified above quote" : "Balance to verify"}</span><strong>{quoted !== null && currency ? formatHotelMoney(verified > quoted ? verified - quoted : quoted - verified, currency) : "—"}</strong></div>
    {pending > BigInt(0) && currency ? <p>Another {formatHotelMoney(pending, currency)} is pending review and has not reduced the balance.</p> : null}
  </div>;
}
export default function HotelReservationPanel({ id, data, busy, mutate, edit, recordPayment, reviewPayment }: { id: string; data: HotelWorkspaceData; busy: boolean; mutate: HotelMutation; edit: (booking: HotelReservation) => void; recordPayment: (booking: HotelReservation) => void; reviewPayment: (booking: HotelReservation, payment: HotelPayment, action: "verify_payment" | "reject_payment" | "void_payment") => void }) {
  const [detail, setDetail] = useState<HotelReservationDetails | null>(null); const [error, setError] = useState(""); const [version, setVersion] = useState(0); const [pendingStatus, setPendingStatus] = useState("");
  useEffect(() => {
    const controller = new AbortController(); let live = true;
    hotelRequest<HotelReservationDetails>(`/api/portal/hotel/workspace?bookingId=${encodeURIComponent(id)}`, { signal: controller.signal }).then(result => { if (live) { setDetail(result); setError(""); } }).catch(error => { if (live) setError(error instanceof Error ? error.message : "Unable to load reservation."); });
    return () => { live = false; controller.abort(); };
  }, [id, version]);
  if (error) return <div className={styles.form}><p className={styles.error} role="alert">{error}</p><Action secondary onClick={() => { setError(""); setVersion(value => value + 1); }}>Reload reservation</Action></div>;
  if (!detail) return <p role="status" className={styles.loading}>Loading reservation…</p>;
  const booking = detail.reservation; const customer = data.customers.find(item => item.id === booking.customer_id); const room = data.rooms.find(item => item.id === booking.room_id);
  async function changeStatus(status: string) {
    if (["cancelled", "expired"].includes(status) && !window.confirm(status === "cancelled" ? "Cancel this reservation? Its room will become available. The booking history will remain." : "Mark this enquiry expired? It will remain in the booking history.")) return;
    setPendingStatus(status);
    try { await mutate({ action: "save_reservation", bookingId: booking.id, revision: booking.revision, status }, "Booking state updated."); setVersion(value => value + 1); }
    catch { /* The shared panel shows the error; retain the current reservation for a deliberate reload. */ }
    finally { setPendingStatus(""); }
  }
  const pendingLabels: Record<string, string> = { quoted: "Saving quote…", confirmed: "Confirming…", checked_in: "Checking in…", checked_out: "Checking out…", cancelled: "Cancelling…", expired: "Expiring…" };
  return <div className={styles.detail}>
    <div className={styles.guestHeading}><div className={styles.avatar}>{(customer?.full_name || "G").slice(0, 1).toUpperCase()}</div><div><h3>{customer?.full_name || "Guest"}</h3><p>{customer?.phone || customer?.email || "No contact details recorded"}</p></div><Status value={booking.status}/></div>
    <dl className={styles.stayDetails}><div><dt>Room</dt><dd>{room?.name || "Not assigned"}</dd></div><div><dt>Guests</dt><dd>{booking.guest_count}</dd></div><div><dt>Arrival</dt><dd>{dateLabel(booking.arrival_date)}</dd></div><div><dt>Departure</dt><dd>{dateLabel(booking.departure_date)}</dd></div></dl>
    {data.canManage ? <div className={styles.bookingActions}>{(HOTEL_STATE_ACTIONS[booking.status] || []).map(action => <Action key={action.status} secondary={action.status !== "confirmed" && action.status !== "checked_in" && action.status !== "checked_out"} danger={action.status === "cancelled"} disabled={busy} aria-busy={pendingStatus === action.status} onClick={() => void changeStatus(action.status)}>{pendingStatus === action.status ? pendingLabels[action.status] : action.label}</Action>)}<button type="button" className={styles.textButton} disabled={busy} onClick={() => edit(booking)}>{["checked_out", "cancelled", "expired"].includes(booking.status) ? "Edit notes" : "Edit stay details"}</button><button type="button" className={styles.textButton} disabled={busy} onClick={() => setVersion(value => value + 1)}>Reload record</button></div> : <p className={styles.hint}>You have read-only access to this reservation.</p>}
    <p className={styles.hint}>Booking changes do not send a guest message.</p>
    {booking.notes ? <section className={styles.note}><h4>Reservation notes</h4><p>{booking.notes}</p></section> : null}
    {data.canViewPayments ? <section className={styles.detailSection}><div className={styles.sectionHeading}><h3><ReceiptText size={17}/> Offline payments</h3>{data.canManagePayments ? <Action secondary disabled={busy || !booking.currency} onClick={() => recordPayment(booking)}>Record payment</Action> : null}</div><HotelBalance booking={booking} total={detail.paymentTotal}/>
      {!booking.currency ? <p className={styles.hint}>Assign a room to establish the quote currency before recording a payment.</p> : null}
      {!detail.payments.length ? <p className={styles.hint}>No offline payment records yet.</p> : <div className={styles.receipts}>{detail.payments.map(payment => <article key={payment.id} className={styles.receipt}><div className={styles.receiptTop}><strong>{formatHotelMoney(payment.amount_minor, payment.currency)}</strong><Status value={payment.status}/></div><p>{payment.method.replaceAll("_", " ")} · {payment.reference || "No reference"}</p>{payment.note ? <p>{payment.note}</p> : null}{payment.review_history?.length ? <details><summary>Review history</summary>{payment.review_history.map((review, index) => <p key={index}><strong>{review.status}</strong> · {new Date(review.at).toLocaleString("en", { timeZone: "UTC" })} UTC{review.note ? ` — ${review.note}` : ""}</p>)}</details> : null}{data.canManagePayments ? <div className={styles.inlineActions}>{payment.status === "pending" ? <><button type="button" className={styles.textButton} disabled={busy} onClick={() => reviewPayment(booking, payment, "verify_payment")}>Review and verify</button><button type="button" className={styles.textButton} disabled={busy} onClick={() => reviewPayment(booking, payment, "reject_payment")}>Reject record</button></> : payment.status === "verified" ? <button type="button" className={styles.textButton} disabled={busy} onClick={() => reviewPayment(booking, payment, "void_payment")}>Void incorrect record</button> : null}</div> : null}</article>)}</div>}
      {detail.payments.length >= 100 ? <p className={styles.hint}>Showing the latest 100 records. The totals include the full ledger.</p> : null}
    </section> : <p className={styles.hint}>Payment records require billing access.</p>}
    <section className={styles.detailSection}><h3>Booking activity</h3><ol className={styles.timeline}>{detail.events.map(event => <li key={event.id}><span className={styles.timelineDot}/><div><strong>{event.event_type.replaceAll("_", " ")}{typeof event.details.status === "string" ? ` · ${event.details.status.replaceAll("_", " ")}` : ""}</strong><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("en", { timeZone: "UTC" })} UTC</time></div></li>)}</ol>{!detail.events.length ? <p className={styles.hint}>Earlier enquiries may not have workspace activity yet.</p> : null}</section>
    <Link href={`/portal/customers/${booking.customer_id}`} className={styles.detailLink}>Open guest timeline <ArrowUpRight size={16}/></Link>
  </div>;
}
