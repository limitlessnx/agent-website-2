import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCanonicalCustomer } from "@/lib/canonical-customer";
import { isCalendarDate, parseHotelAmount, stayNights, type HotelWorkspaceData, type HotelReservation } from "@/lib/hotel-booking-contract";
import { HOTEL_BOOKING_STATES } from "@/lib/hotel-communication-policy";

export class HotelWorkspaceError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function hotelUuid(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HotelWorkspaceError(`${label} is required.`);
  return value;
}
function text(value: unknown, max: number, label: string, required = false) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length > max || required && !result) throw new HotelWorkspaceError(`${label} must contain ${required ? "1 to " : "up to "}${max} characters.`);
  return result;
}
function integer(value: unknown, max: number, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) throw new HotelWorkspaceError(`${label} must be between 1 and ${max}.`);
  return value;
}
function fingerprint(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function has(object: Record<string, unknown>, key: string) { return Object.prototype.hasOwnProperty.call(object, key); }
function amount(value: unknown, currency: string, allowZero = false) {
  try { return parseHotelAmount(value, currency, allowZero); }
  catch (error) { throw new HotelWorkspaceError(error instanceof Error ? error.message : "Enter a valid amount."); }
}
function date(value: unknown, label: string) {
  if (value === "" || value === null) return null;
  if (!isCalendarDate(value)) throw new HotelWorkspaceError(`${label} must be a valid calendar date.`);
  return value;
}
function databaseError(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "23P01") throw new HotelWorkspaceError("This room is already reserved for the selected dates.", 409);
  if (error.code === "P0001") throw new HotelWorkspaceError(error.message || "The booking changed. Refresh and try again.", 409);
  if (["23505", "23503", "23514", "40001", "40P01"].includes(error.code || "")) throw new HotelWorkspaceError("This change conflicts with an existing record or booking rule. Refresh and check the details.", 409);
  throw new HotelWorkspaceError("The hotel workspace is temporarily unavailable.", 503);
}
async function reservation(organizationId: string, bookingId: string) {
  const result = await createAdminClient().from("hotel_booking_enquiries").select("*").eq("organization_id", organizationId).eq("id", bookingId).maybeSingle();
  databaseError(result.error);
  if (!result.data) throw new HotelWorkspaceError("Reservation not found in this hotel.", 404);
  return result.data as HotelReservation;
}

export async function loadHotelWorkspace(organizationId: string, options: { arrival: string; departure: string; guests: number; canViewPayments: boolean; canManage: boolean; canManagePayments: boolean }): Promise<HotelWorkspaceData> {
  if (!isCalendarDate(options.arrival) || !isCalendarDate(options.departure) || stayNights(options.arrival, options.departure) < 1 || stayNights(options.arrival, options.departure) > 365) throw new HotelWorkspaceError("Choose a stay of 1 to 365 nights.");
  integer(options.guests, 20, "Guest count");
  const admin = createAdminClient();
  const [types, rooms, customers, bookings, availability] = await Promise.all([
    admin.from("hotel_room_types").select("*").eq("organization_id", organizationId).order("name"),
    admin.from("hotel_rooms").select("*").eq("organization_id", organizationId).order("name"),
    admin.from("crm_customers").select("id,full_name,phone,email").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(250),
    admin.from("hotel_booking_enquiries").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(250),
    admin.rpc("hotel_room_availability", { p_organization_id: organizationId, p_arrival: options.arrival, p_departure: options.departure, p_guests: options.guests }),
  ]);
  for (const result of [types, rooms, customers, bookings, availability]) databaseError(result.error);
  const loadedCustomers = customers.data || [];
  const loadedIds = new Set(loadedCustomers.map(row => String(row.id)));
  const missingIds = [...new Set((bookings.data || []).map(row => String(row.customer_id)).filter(id => !loadedIds.has(id)))];
  const additional = missingIds.length ? await admin.from("crm_customers").select("id,full_name,phone,email").eq("organization_id", organizationId).in("id", missingIds) : { data: [], error: null };
  databaseError(additional.error);
  const allCustomers = [...loadedCustomers, ...(additional.data || [])];
  const guests = allCustomers.length ? await admin.from("hotel_guest_profiles").select("customer_id,marketing_consent,service_consent,opted_out,human_handoff").eq("organization_id", organizationId).in("customer_id", allCustomers.map(row => row.id)) : { data: [], error: null };
  databaseError(guests.error);
  const ids = (bookings.data || []).map(row => row.id);
  const totals = options.canViewPayments && ids.length ? await admin.rpc("hotel_booking_payment_totals", { p_organization_id: organizationId, p_booking_ids: ids }) : { data: [], error: null };
  databaseError(totals.error);
  return { roomTypes: types.data || [], rooms: rooms.data || [], customers: allCustomers, guests: guests.data || [], reservations: bookings.data || [], availability: availability.data || [], paymentTotals: totals.data || [], canManage: options.canManage, canManagePayments: options.canManagePayments, canViewPayments: options.canViewPayments } as HotelWorkspaceData;
}
export async function loadHotelReservation(organizationId: string, bookingId: string, canViewPayments: boolean) {
  const booking = await reservation(organizationId, bookingId); const admin = createAdminClient();
  const [events, payments, totals] = await Promise.all([
    admin.from("hotel_booking_events").select("*").eq("organization_id", organizationId).eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(100),
    canViewPayments ? admin.from("hotel_offline_payments").select("*").eq("organization_id", organizationId).eq("booking_id", bookingId).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
    canViewPayments ? admin.rpc("hotel_booking_payment_totals", { p_organization_id: organizationId, p_booking_ids: [bookingId] }) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [events, payments, totals]) databaseError(result.error);
  return { reservation: booking, events: events.data || [], payments: payments.data || [], paymentTotal: totals.data?.[0] || null };
}

export async function mutateHotelWorkspace(organizationId: string, actorId: string, body: Record<string, unknown>) {
  const admin = createAdminClient();
  if (body.action === "create_type") {
    const currency = text(body.currency, 3, "Currency", true).toUpperCase();
    const result = await admin.from("hotel_room_types").insert({ organization_id: organizationId, name: text(body.name, 80, "Room type", true), capacity: integer(body.capacity, 20, "Capacity"), currency, nightly_rate_minor: amount(body.nightlyRate, currency, true) }).select("*").single();
    databaseError(result.error); return { roomType: result.data };
  }
  if (body.action === "create_room") {
    const result = await admin.from("hotel_rooms").insert({ organization_id: organizationId, name: text(body.name, 80, "Room name", true), room_type_id: hotelUuid(body.roomTypeId, "Room type") }).select("*").single();
    databaseError(result.error); return { room: result.data };
  }
  if (body.action === "update_type") {
    const id = hotelUuid(body.typeId, "Room type");
    const current = await admin.from("hotel_room_types").select("currency").eq("organization_id", organizationId).eq("id", id).maybeSingle();
    databaseError(current.error); if (!current.data) throw new HotelWorkspaceError("Room type not found.", 404);
    const expected = typeof body.expectedRateMinor === "string" || typeof body.expectedRateMinor === "number" ? String(body.expectedRateMinor) : "";
    if (!/^\d{1,13}$/.test(expected)) throw new HotelWorkspaceError("Refresh the current room rate before saving.");
    const result = await admin.from("hotel_room_types").update({ name: text(body.name, 80, "Room type", true), nightly_rate_minor: amount(body.nightlyRate, current.data.currency, true) }).eq("organization_id", organizationId).eq("id", id).eq("nightly_rate_minor", Number(expected)).select("*").maybeSingle();
    databaseError(result.error); if (!result.data) throw new HotelWorkspaceError("This room rate changed. Refresh before saving again.", 409); return { roomType: result.data };
  }
  if (body.action === "rename_room") {
    const result = await admin.from("hotel_rooms").update({ name: text(body.name, 80, "Room name", true) }).eq("organization_id", organizationId).eq("id", hotelUuid(body.roomId, "Room")).select("*").maybeSingle();
    databaseError(result.error); if (!result.data) throw new HotelWorkspaceError("Room not found.", 404); return { room: result.data };
  }
  if (body.action === "set_room_active") {
    if (typeof body.active !== "boolean") throw new HotelWorkspaceError("Choose an active state.");
    const result = await admin.from("hotel_rooms").update({ active: body.active }).eq("organization_id", organizationId).eq("id", hotelUuid(body.roomId, "Room")).select("*").maybeSingle();
    databaseError(result.error); if (!result.data) throw new HotelWorkspaceError("Room not found.", 404); return { room: result.data };
  }
  if (body.action === "create_guest") {
    const requestId = hotelUuid(body.requestId, "Request ID");
    const customer = await resolveCanonicalCustomer({ organizationId, fullName: text(body.name, 180, "Guest name", true), phone: text(body.phone, 80, "Phone"), email: text(body.email, 240, "Email"), externalKey: `hotel-guest:${requestId}`, source: "hotel_manager_workspace" });
    // Never overwrite an existing guest's opt-out, handover or consent when identity resolution matches.
    const profile = await admin.from("hotel_guest_profiles").upsert({ organization_id: organizationId, customer_id: customer.customerId, updated_by: actorId, consent_source: "manager_created_unknown" }, { onConflict: "organization_id,customer_id", ignoreDuplicates: true });
    databaseError(profile.error); return { customerId: customer.customerId };
  }
  if (body.action === "save_reservation") {
    const bookingId = body.bookingId ? hotelUuid(body.bookingId, "Reservation") : null;
    const current = bookingId ? await reservation(organizationId, bookingId) : null;
    const values: Record<string, unknown> = { updated_by: actorId };
    if (has(body, "status")) {
      if (!HOTEL_BOOKING_STATES.includes(body.status as typeof HOTEL_BOOKING_STATES[number])) throw new HotelWorkspaceError("Choose a valid booking state.");
      values.status = body.status;
    }
    if (!current && !["enquiry", "quoted", "confirmed"].includes(String(body.status))) throw new HotelWorkspaceError("New reservations must begin as an enquiry, quote or confirmed booking.");
    if (has(body, "arrivalDate")) values.arrival_date = date(body.arrivalDate, "Arrival");
    if (has(body, "departureDate")) values.departure_date = date(body.departureDate, "Departure");
    if (has(body, "guestCount")) values.guest_count = integer(body.guestCount, 20, "Guest count");
    if (has(body, "notes")) values.notes = text(body.notes, 2000, "Notes");
    if (has(body, "roomId")) {
      values.room_id = body.roomId ? hotelUuid(body.roomId, "Room") : null;
      if (values.room_id !== current?.room_id) { values.nightly_rate_minor = null; values.currency = null; }
    }
    if (has(body, "nightlyRate")) {
      const roomId = has(values, "room_id") ? values.room_id : current?.room_id;
      if (!roomId) throw new HotelWorkspaceError("Choose a room before quoting a rate.");
      const room = await admin.from("hotel_rooms").select("room_type_id").eq("organization_id", organizationId).eq("id", roomId).maybeSingle(); databaseError(room.error);
      if (!room.data) throw new HotelWorkspaceError("Room not found in this hotel.", 404);
      const type = await admin.from("hotel_room_types").select("currency").eq("organization_id", organizationId).eq("id", room.data.room_type_id).single(); databaseError(type.error);
      values.nightly_rate_minor = body.nightlyRate === "" || body.nightlyRate === null ? null : amount(body.nightlyRate, type.data!.currency, true);
    }
    if (current) {
      const revision = integer(body.revision, 2147483647, "Current revision");
      const result = await admin.from("hotel_booking_enquiries").update(values).eq("organization_id", organizationId).eq("id", current.id).eq("revision", revision).select("*").maybeSingle();
      databaseError(result.error); if (!result.data) throw new HotelWorkspaceError("This reservation changed. Refresh before saving again.", 409); return { reservation: result.data };
    }
    const customerId = hotelUuid(body.customerId, "Guest"); const requestId = hotelUuid(body.requestId, "Request ID");
    const hash = fingerprint({ customerId, ...values, updated_by: undefined });
    const result = await admin.from("hotel_booking_enquiries").insert({ ...values, organization_id: organizationId, customer_id: customerId, source_request_id: requestId, request_fingerprint: hash }).select("*").single();
    if (result.error?.code === "23505") {
      const existing = await admin.from("hotel_booking_enquiries").select("*").eq("organization_id", organizationId).eq("source_request_id", requestId).maybeSingle(); databaseError(existing.error);
      if (existing.data?.request_fingerprint === hash) return { reservation: existing.data };
    }
    databaseError(result.error); return { reservation: result.data };
  }
  if (body.action === "record_payment") {
    const booking = await reservation(organizationId, hotelUuid(body.bookingId, "Reservation"));
    if (!booking.currency) throw new HotelWorkspaceError("Choose a room and quote currency before recording a payment.");
    if (!["cash", "bank_transfer", "pos", "other"].includes(String(body.method))) throw new HotelWorkspaceError("Choose an offline payment method.");
    const note = text(body.note, 1000, "Payment note", body.method === "other");
    const values = { booking_id: booking.id, customer_id: booking.customer_id, amount_minor: amount(body.amount, booking.currency), currency: booking.currency, method: body.method, reference: text(body.reference, 180, "Reference"), note };
    const requestId = hotelUuid(body.requestId, "Request ID"); const hash = fingerprint(values);
    const result = await admin.from("hotel_offline_payments").insert({ ...values, organization_id: organizationId, recorded_by: actorId, request_id: requestId, request_fingerprint: hash }).select("*").single();
    if (result.error?.code === "23505") {
      const existing = await admin.from("hotel_offline_payments").select("*").eq("organization_id", organizationId).eq("request_id", requestId).maybeSingle(); databaseError(existing.error);
      if (existing.data?.request_fingerprint === hash) return { payment: existing.data };
    }
    databaseError(result.error); return { payment: result.data };
  }
  if (["verify_payment", "reject_payment", "void_payment"].includes(String(body.action))) {
    const action = String(body.action); const next = action === "verify_payment" ? "verified" : action === "reject_payment" ? "rejected" : "voided";
    const note = text(body.note, 1000, "Verification note", next !== "verified");
    const values = { status: next, ...(next === "voided" ? { voided_by: actorId, void_reason: note } : { verified_by: actorId, verification_note: note }) };
    const result = await admin.from("hotel_offline_payments").update(values).eq("organization_id", organizationId).eq("id", hotelUuid(body.paymentId, "Payment record")).eq("status", next === "voided" ? "verified" : "pending").select("*").maybeSingle();
    databaseError(result.error); if (!result.data) throw new HotelWorkspaceError("This payment record changed. Refresh before reviewing it.", 409); return { payment: result.data };
  }
  throw new HotelWorkspaceError("Unknown hotel workspace action.");
}
