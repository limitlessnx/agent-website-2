export type HotelRoomType = { id: string; name: string; capacity: number; nightly_rate_minor: number | string; currency: string };
export type HotelRoom = { id: string; name: string; room_type_id: string; active: boolean };
export type HotelCustomer = { id: string; full_name: string | null; phone: string | null; email: string | null };
export type HotelReservation = {
  id: string; customer_id: string; room_id: string | null; status: string; revision: number;
  arrival_date: string | null; departure_date: string | null; guest_count: number;
  nightly_rate_minor: number | string | null; currency: string | null; notes: string; created_at: string;
};
export type HotelPayment = { id: string; booking_id: string; amount_minor: string | number; currency: string; method: string; reference: string; note: string; status: string; recorded_by: string; verified_by: string | null; verified_at: string | null; verification_note: string; void_reason: string; review_history: Array<{status: string; actor_id: string; note: string; at: string}>; created_at: string };
export type HotelPaymentTotal = { booking_id: string; verified_minor: string; pending_minor: string };
export type HotelGuestProfile = { customer_id: string; marketing_consent: string; service_consent: string; opted_out: boolean; human_handoff: boolean };
export type HotelBookingEvent = { id: string; event_type: string; actor_id: string | null; created_at: string; details: Record<string, unknown> };
export type HotelWorkspaceData = {
  roomTypes: HotelRoomType[]; rooms: HotelRoom[]; customers: HotelCustomer[]; guests: HotelGuestProfile[];
  reservations: HotelReservation[]; paymentTotals: HotelPaymentTotal[];
  availability: Array<{ room_id: string; available: boolean }>;
  canManage: boolean; canManagePayments: boolean; canViewPayments: boolean;
};
export const HOTEL_STATE_ACTIONS: Record<string, Array<{ status: string; label: string }>> = {
  enquiry: [{ status: "quoted", label: "Mark quoted" }, { status: "confirmed", label: "Confirm booking" }, { status: "cancelled", label: "Cancel enquiry" }, { status: "expired", label: "Mark expired" }],
  quoted: [{ status: "confirmed", label: "Confirm booking" }, { status: "cancelled", label: "Cancel enquiry" }, { status: "expired", label: "Mark expired" }],
  confirmed: [{ status: "checked_in", label: "Check in" }, { status: "cancelled", label: "Cancel booking" }],
  checked_in: [{ status: "checked_out", label: "Check out" }],
};
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === value;
}
export function stayNights(arrival: string | null, departure: string | null) {
  if (!isCalendarDate(arrival) || !isCalendarDate(departure)) return 0;
  return (Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`)) / 86400000;
}
export function currencyDigits(currency: string) {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Choose a three-letter currency code.");
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
export function parseHotelAmount(value: unknown, currency: string, allowZero = false) {
  const digits = currencyDigits(currency);
  const match = typeof value === "string" ? value.trim().match(/^(\d+)(?:\.(\d+))?$/) : null;
  if (!match || (match[2]?.length || 0) > digits) throw new Error(`Enter a valid ${currency} amount with up to ${digits} decimal places.`);
  const minor = BigInt(match[1]) * (BigInt(10) ** BigInt(digits)) + BigInt((match[2] || "").padEnd(digits, "0") || "0");
  if (minor < (allowZero ? BigInt(0) : BigInt(1)) || minor > BigInt(1000000000000)) throw new Error("The amount is outside the supported range.");
  return minor.toString();
}
export function hotelAmountInput(minor: number | string | null, currency: string) {
  if (minor === null) return "";
  const digits = currencyDigits(currency); const scale = BigInt(10) ** BigInt(digits); const amount = BigInt(minor);
  return digits ? `${amount / scale}.${(amount % scale).toString().padStart(digits, "0")}` : amount.toString();
}
export function formatHotelMoney(minor: string | number | bigint, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(minor) / 10 ** currencyDigits(currency));
}
export function hotelQuotedTotal(booking: Pick<HotelReservation, "arrival_date" | "departure_date" | "nightly_rate_minor">) {
  const nights = stayNights(booking.arrival_date, booking.departure_date);
  return nights > 0 && booking.nightly_rate_minor !== null ? BigInt(booking.nightly_rate_minor) * BigInt(nights) : null;
}
