export type HotelGuest = {
  organization_id: string; customer_id: string; marketing_consent: string;
  service_consent: string; opted_out: boolean; human_handoff: boolean;
};
export type HotelEnquiry = {
  id: string; organization_id: string; customer_id: string; status: string; revision: number;
  arrival_date?: string | null; departure_date?: string | null;
};
export const HOTEL_BOOKING_STATES = ["enquiry", "quoted", "confirmed", "checked_in", "checked_out", "cancelled", "expired"] as const;
export type HotelFollowupPurpose = "booking_recovery" | "pre_arrival" | "post_stay";
export function isHotelOrganization(org: { metadata?: unknown }) {
  const metadata = (org.metadata || {}) as Record<string, unknown>;
  return ["hotel", "hotels", "hospitality"].includes(String(metadata.industry_slug || metadata.industry || "").toLowerCase());
}
export function hotelContactSuppression(organizationId: string, guest?: HotelGuest | null) {
  if (!guest || guest.organization_id !== organizationId) return "missing_guest";
  if (guest.opted_out) return "opted_out";
  if (guest.human_handoff) return "human_handoff";
  return null;
}
export function hotelCampaignSuppression(organizationId: string, guest: HotelGuest | null, bookings: HotelEnquiry[]) {
  const stop = hotelContactSuppression(organizationId, guest);
  if (stop) return stop;
  if (guest!.marketing_consent !== "opted_in") return "marketing_consent_required";
  if (bookings.some(b => b.organization_id === organizationId && b.customer_id === guest!.customer_id && ["confirmed", "checked_in"].includes(b.status))) return "active_booking";
  return null;
}
export function hotelFollowupSuppression(input: {
  organizationId: string; guest: HotelGuest | null; booking: HotelEnquiry | null;
  customerId: string; bookingRevision: number; purpose: string;
}) {
  const stop = hotelContactSuppression(input.organizationId, input.guest);
  if (stop) return stop;
  if (input.guest!.customer_id !== input.customerId || !input.booking || input.booking.organization_id !== input.organizationId || input.booking.customer_id !== input.customerId) return "booking_scope_mismatch";
  if (input.guest!.service_consent !== "opted_in") return "service_consent_required";
  if (input.booking.revision !== input.bookingRevision) return "booking_changed";
  const allowed: Record<string, string[]> = { booking_recovery: ["enquiry", "quoted"], pre_arrival: ["confirmed"], post_stay: ["checked_out"] };
  return allowed[input.purpose]?.includes(input.booking.status) ? null : "booking_state_ineligible";
}
export function withinWhatsAppWindow(value?: string | null, now = Date.now()) {
  const timestamp = value ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp < 86400000;
}
