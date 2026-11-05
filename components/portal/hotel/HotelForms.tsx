"use client";
import { useRef, useState, type FormEvent } from "react";
import { hotelBookingReference, hotelAmountInput, parseHotelAmount, formatHotelMoney, stayNights, type HotelWorkspaceData, type HotelReservation, type HotelCustomer, type HotelGuestProfile, type HotelRoomType, type HotelRoom, type HotelPayment } from "@/lib/hotel-booking-contract";
import { Action, Field, type HotelMutation } from "./HotelUI";
import styles from "./HotelWorkspace.module.css";
type Common = { mutate: HotelMutation; busy: boolean; close: () => void };
const formValue = (form: HTMLFormElement, key: string) => String(new FormData(form).get(key) || "");
export type ReservationDraft = { roomId: string; arrivalDate: string; departureDate: string; nightlyRate: string; guestCount: number; notes: string; status: string };

export function ReservationForm({ data, booking, guestId, roomId, arrival, departure, draft, mutate, busy, saved, addGuest }: Omit<Common, "close"> & { data: HotelWorkspaceData; booking?: HotelReservation; guestId?: string; roomId?: string; arrival: string; departure: string; draft?: ReservationDraft; saved: (id: string) => void; addGuest: (draft: ReservationDraft) => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [selectedRoom, setSelectedRoom] = useState(booking?.room_id || draft?.roomId || roomId || "");
  const [start, setStart] = useState(booking?.arrival_date || draft?.arrivalDate || arrival);
  const [end, setEnd] = useState(booking?.departure_date || draft?.departureDate || departure);
  const [rate, setRate] = useState(draft?.nightlyRate ?? (booking?.currency ? hotelAmountInput(booking.nightly_rate_minor, booking.currency) : ""));
  const [status, setStatus] = useState(booking?.status || draft?.status || "enquiry");
  const closed = Boolean(booking && ["checked_out", "cancelled", "expired"].includes(booking.status));
  const room = data.rooms.find(item => item.id === selectedRoom); const type = data.roomTypes.find(item => item.id === room?.room_type_id);
  const guests = data.customers.filter(customer => data.guests.some(profile => profile.customer_id === customer.id));
  const nights = stayNights(start, end); let quote: string | null = null;
  try { if (type && nights > 0 && nights <= 365) quote = formatHotelMoney(BigInt(rate ? parseHotelAmount(rate, type.currency, true) : type.nightly_rate_minor) * BigInt(nights), type.currency); } catch { /* The server and native form validation report invalid amounts on submit. */ }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const body: Record<string, unknown> = { action: "save_reservation", notes: formValue(form, "notes") };
    if (booking) { body.bookingId = booking.id; body.revision = booking.revision; }
    else { body.customerId = formValue(form, "customerId"); body.requestId = requestId; }
    if (!closed) Object.assign(body, { status, roomId: selectedRoom || null, arrivalDate: start || null, departureDate: end || null, guestCount: Number(formValue(form, "guestCount")), ...(selectedRoom ? { nightlyRate: rate } : {}) });
    try { const result = await mutate<{ reservation: HotelReservation }>(body, booking ? "Reservation updated." : "Reservation created."); saved(result.reservation.id); } catch { /* Error stays in the open panel. */ }
  }
  return <form ref={formRef} onSubmit={submit} className={styles.form}>
    {booking ? <div className={styles.formSummary}><small>GUEST</small><strong>{data.customers.find(item => item.id === booking.customer_id)?.full_name || "Guest"}</strong><span>Reservation {hotelBookingReference(booking)}</span></div> : <Field label="Guest" wide><select name="customerId" required defaultValue={guestId || ""} disabled={busy}><option value="">Choose a hotel guest</option>{guests.map(item => <option value={item.id} key={item.id}>{item.full_name || "Unnamed guest"}{item.phone ? ` · ${item.phone}` : ""}</option>)}</select></Field>}
    {!booking ? <button type="button" className={styles.textButton} disabled={busy} onClick={() => addGuest({ roomId: selectedRoom, arrivalDate: start, departureDate: end, nightlyRate: rate, status, guestCount: Number(formValue(formRef.current!, "guestCount") || 1), notes: formValue(formRef.current!, "notes") })}>+ Add a new guest</button> : null}
    {closed ? <p className={styles.hint}>This reservation is closed. You can add a note; its stay details are retained.</p> : <>
      <div className={styles.formGrid}><Field label="Arrival"><input type="date" name="arrival" required value={start} onChange={event => setStart(event.target.value)} disabled={busy}/></Field><Field label="Departure"><input type="date" name="departure" required min={start || undefined} value={end} onChange={event => setEnd(event.target.value)} disabled={busy}/></Field></div>
      <div className={styles.formGrid}><Field label="Guests"><input name="guestCount" type="number" min={1} max={20} required defaultValue={booking?.guest_count || draft?.guestCount || 1} disabled={busy}/></Field><Field label="Room"><select value={selectedRoom} onChange={event => { setSelectedRoom(event.target.value); setRate(""); }} disabled={busy}><option value="">Assign later</option>{data.rooms.map(item => <option key={item.id} value={item.id} disabled={!item.active && item.id !== selectedRoom}>{item.name} · {data.roomTypes.find(type => type.id === item.room_type_id)?.name}{!item.active ? " (inactive)" : ""}</option>)}</select></Field></div>
      {selectedRoom && type ? <Field label={`Nightly rate (${type.currency})`} hint={`Room type rate: ${formatHotelMoney(type.nightly_rate_minor, type.currency)}. Leave blank to use it.`}><input name="nightlyRate" inputMode="decimal" value={rate} onChange={event => setRate(event.target.value)} placeholder={hotelAmountInput(type.nightly_rate_minor, type.currency)} disabled={busy}/></Field> : null}
      {!booking ? <Field label="Booking state"><select value={status} onChange={event => setStatus(event.target.value)} disabled={busy}><option value="enquiry">Enquiry</option><option value="quoted">Quoted</option><option value="confirmed">Confirmed</option></select></Field> : null}
      <div className={styles.quote}><div><span>Room quote</span><strong>{quote || "Choose a room and valid dates"}</strong></div><small>{nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "Stay dates required"}</small></div>
      <p className={styles.hint}>Enquiries and quotes do not hold a room. Availability is checked when a booking is confirmed.</p>
    </>}
    <Field label="Reservation notes" wide><textarea name="notes" rows={3} maxLength={2000} defaultValue={booking?.notes || draft?.notes || ""} disabled={busy} placeholder="Arrival details or requests the managers should know"/></Field>
    <div className={styles.formFooter}><p>Saving a booking does not send a guest message.</p><Action type="submit" disabled={busy || !booking && !guests.length} aria-busy={busy}>{busy ? "Saving reservation…" : booking ? "Save changes" : status === "confirmed" ? "Confirm reservation" : status === "quoted" ? "Save quote" : "Create enquiry"}</Action></div>
  </form>;
}

export function GuestForm({ customer, profile, mutate, busy, created, close }: Common & { customer?: HotelCustomer; profile?: HotelGuestProfile; created: (id: string) => void }) {
  const [requestId] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    try {
      if (customer) {
        const values = new FormData(form);
        await mutate({ action: "save_guest", customerId: customer.id, marketingConsent: formValue(form, "marketing"), serviceConsent: formValue(form, "service"), optedOut: values.has("optedOut"), humanHandoff: values.has("handoff"), consentSource: formValue(form, "source") || "Hotel manager workspace" }, "Guest preferences saved.", "/api/portal/hotel"); close();
      } else {
        const result = await mutate<{ customerId: string }>({ action: "create_guest", requestId, name: formValue(form, "name"), phone: formValue(form, "phone"), email: formValue(form, "email") }, "Guest saved. Communication consent remains unchanged."); created(result.customerId);
      }
    } catch { /* Error stays in the panel. */ }
  }
  return <form onSubmit={submit} className={styles.form}>{customer ? <>
    <div className={styles.formSummary}><small>GUEST RECORD</small><strong>{customer.full_name || "Unnamed guest"}</strong><span>{customer.phone || customer.email || "No contact details"}</span></div>
    <p className={styles.hint}>Update consent only when the guest has given or withdrawn permission.</p>
    <Field label="Marketing messages"><select name="marketing" defaultValue={profile?.marketing_consent || "unknown"} disabled={busy}><option value="unknown">Not recorded</option><option value="opted_in">Guest has opted in</option><option value="opted_out">Guest has opted out</option></select></Field>
    <Field label="Booking and service messages"><select name="service" defaultValue={profile?.service_consent || "unknown"} disabled={busy}><option value="unknown">Not recorded</option><option value="opted_in">Guest has opted in</option><option value="opted_out">Guest has opted out</option></select></Field>
    <label className={styles.check}><input type="checkbox" name="optedOut" defaultChecked={profile?.opted_out} disabled={busy}/><span><strong>Do not contact</strong><small>Suppress campaigns and automated follow-ups.</small></span></label>
    <label className={styles.check}><input type="checkbox" name="handoff" defaultChecked={profile?.human_handoff} disabled={busy}/><span><strong>A manager is handling this conversation</strong><small>Keep automated guest messages suppressed.</small></span></label>
    <Field label="Consent source or note"><input name="source" maxLength={180} disabled={busy} placeholder="For example, permission recorded at reception"/></Field>
  </> : <><Field label="Guest name"><input name="name" required maxLength={180} autoComplete="name" disabled={busy}/></Field><Field label="Phone"><input name="phone" type="tel" maxLength={80} autoComplete="tel" disabled={busy}/></Field><Field label="Email"><input name="email" type="email" maxLength={240} autoComplete="email" disabled={busy}/></Field><p className={styles.hint}>New guests start with no recorded messaging consent. Matching an existing guest will keep their preferences.</p></>}
    <div className={styles.formFooter}><Action type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving guest…" : customer ? "Save guest preferences" : "Add guest"}</Action></div>
  </form>;
}

export function RoomTypeForm({ type, mutate, busy, close }: Common & { type?: HotelRoomType }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    try { await mutate({ action: type ? "update_type" : "create_type", ...(type ? { typeId: type.id, expectedRateMinor: String(type.nightly_rate_minor) } : { capacity: Number(formValue(form, "capacity")), currency: formValue(form, "currency") }), name: formValue(form, "name"), nightlyRate: formValue(form, "rate") }, type ? "Room type updated. Existing quotes are unchanged." : "Room type added."); close(); } catch { /* Keep the form. */ }
  }
  return <form onSubmit={submit} className={styles.form}><Field label="Room type name"><input name="name" required maxLength={80} defaultValue={type?.name} placeholder="For example, Garden double" disabled={busy}/></Field>
    {type ? <p className={styles.hint}>Capacity: {type.capacity} · Currency: {type.currency}. Create another type for a different capacity or currency.</p> : <div className={styles.formGrid}><Field label="Maximum guests"><input name="capacity" type="number" min={1} max={20} required defaultValue={2} disabled={busy}/></Field><Field label="Currency code" hint="Three letters, for example NGN or USD."><input name="currency" required pattern="[A-Za-z]{3}" maxLength={3} placeholder="NGN" disabled={busy}/></Field></div>}
    <Field label="Default nightly rate"><input name="rate" required inputMode="decimal" defaultValue={type ? hotelAmountInput(type.nightly_rate_minor, type.currency) : ""} placeholder="0.00" disabled={busy}/></Field><p className={styles.hint}>New reservations use this rate. Existing reservation quotes keep their saved rate.</p><div className={styles.formFooter}><Action type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving room type…" : type ? "Save room type" : "Add room type"}</Action></div></form>;
}
export function RoomForm({ room, types, mutate, busy, close }: Common & { room?: HotelRoom; types: HotelRoomType[] }) {
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; try { await mutate({ action: room ? "rename_room" : "create_room", ...(room ? { roomId: room.id } : { roomTypeId: formValue(form, "type") }), name: formValue(form, "name") }, room ? "Room name updated." : "Room added."); close(); } catch { /* Keep the form. */ } }
  return <form onSubmit={submit} className={styles.form}><Field label="Room name or number"><input name="name" required maxLength={80} defaultValue={room?.name} placeholder="For example, 101" disabled={busy}/></Field>{!room ? <Field label="Room type"><select name="type" required defaultValue="" disabled={busy}><option value="">Choose a type</option>{types.map(type => <option key={type.id} value={type.id}>{type.name} · {type.capacity} guests</option>)}</select></Field> : null}<div className={styles.formFooter}><Action type="submit" disabled={busy || !room && !types.length} aria-busy={busy}>{busy ? "Saving room…" : room ? "Save room name" : "Add room"}</Action></div></form>;
}
export function OfflinePaymentForm({ booking, mutate, busy, close }: Common & { booking: HotelReservation }) {
  const [requestId] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; try { await mutate({ action: "record_payment", bookingId: booking.id, requestId, amount: formValue(form, "amount"), method: formValue(form, "method"), reference: formValue(form, "reference"), note: formValue(form, "note") }, "Offline payment recorded. It is awaiting verification."); close(); } catch { /* Keep the form. */ } }
  return <form onSubmit={submit} className={styles.form}><p className={styles.hint}>Record money received outside Fluxknight. It will remain pending until a manager verifies it.</p><Field label={`Amount (${booking.currency || "currency required"})`}><input name="amount" required inputMode="decimal" placeholder="0.00" disabled={busy}/></Field><Field label="Offline method"><select name="method" disabled={busy}><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="pos">POS</option><option value="other">Other</option></select></Field><Field label="Reference"><input name="reference" maxLength={180} disabled={busy} placeholder="Transfer or receipt reference"/></Field><Field label="Receipt note" hint="Required when the method is Other."><textarea name="note" maxLength={1000} rows={3} disabled={busy}/></Field><div className={styles.formFooter}><Action type="submit" disabled={busy || !booking.currency} aria-busy={busy}>{busy ? "Recording payment…" : "Record offline payment"}</Action></div></form>;
}
export function PaymentReviewForm({ payment, action, mutate, busy, close }: Common & { payment: HotelPayment; action: "verify_payment" | "reject_payment" | "void_payment" }) {
  const verb = action === "verify_payment" ? "Verify" : action === "reject_payment" ? "Reject" : "Void";
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const note = formValue(event.currentTarget, "note"); try { await mutate({ action, paymentId: payment.id, note }, `Payment record ${verb === "Verify" ? "verified" : verb === "Reject" ? "rejected" : "voided"}.`); close(); } catch { /* Keep the form. */ } }
  return <form onSubmit={submit} className={styles.form}><div className={styles.formSummary}><small>{payment.method.replaceAll("_", " ").toUpperCase()}</small><strong>{formatHotelMoney(payment.amount_minor, payment.currency)}</strong><span>{payment.reference || "No reference recorded"}</span>{payment.note ? <p>{payment.note}</p> : null}</div><p className={styles.hint}>{verb === "Verify" ? "Confirm that you have checked this payment against your offline records. Only verified amounts reduce the displayed balance." : verb === "Void" ? "Void an incorrectly verified entry. Its original record and review history will remain. This does not issue a refund." : "Reject an incorrect or unconfirmed entry. Its record will remain in the history."}</p><Field label={verb === "Verify" ? "Verification note" : "Reason"}><textarea name="note" rows={3} maxLength={1000} required={verb !== "Verify"} disabled={busy}/></Field><div className={styles.formFooter}><Action type="submit" danger={verb !== "Verify"} disabled={busy} aria-busy={busy}>{busy ? "Saving review…" : `${verb} record`}</Action></div></form>;
}
