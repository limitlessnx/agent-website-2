export const HOTEL_SERVICE_RULE_FIELDS = {
  questions_to_ask: "Questions to ask the guest",
  booking_requirements: "Booking requirements",
  restrictions: "Eligibility and restrictions",
  escalation_rules: "When to ask a manager",
  concierge_guidance: "Concierge instructions",
} as const;
export type HotelServiceRules = Partial<Record<keyof typeof HOTEL_SERVICE_RULE_FIELDS, string>>;

/** Service guidance is business data, subordinate to hotel and platform policies. */
export function parseHotelServiceRules(input: unknown): HotelServiceRules {
  if (input === undefined) return {};
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Enter valid service operating instructions.");
  const result: HotelServiceRules = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(HOTEL_SERVICE_RULE_FIELDS, key)) throw new Error("Unknown service instruction field.");
    if (typeof value !== "string" || value.length > 2000) throw new Error("Keep each service instruction within 2,000 characters.");
  }
  // Canonical key order keeps request fingerprints stable across JSON serializers.
  for (const key of Object.keys(HOTEL_SERVICE_RULE_FIELDS) as Array<keyof HotelServiceRules>) {
    const value=(input as Record<string,string>)[key];
    if (value?.trim()) result[key]=value.trim();
  }
  return result;
}
