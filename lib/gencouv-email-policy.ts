export type GencouvContact = { email?: string | null; status?: string | null; metadata?: Record<string, unknown> | null };
export function normalizeGencouvEmail(value: unknown) { return String(value || "").trim().toLowerCase(); }
export function hasGencouvMarketingConsent(contact: GencouvContact) {
  const metadata = contact.metadata || {};
  return metadata.marketing_consent === "granted"
    && Boolean(metadata.consent_source ?? metadata.marketing_consent_source)
    && Boolean(metadata.consent_recorded_at ?? metadata.marketing_consent_verified_at)
    && !["blocked", "archived", "unsubscribed", "bounced", "complained"].includes(String(contact.status || "").toLowerCase());
}
export const GENCOUV_DELIVERY_STATES = ["queued", "submitted", "sent", "delivered", "bounced", "failed", "complained", "unsubscribed", "unknown"] as const;
export function gencouvEmailDisplayStatus(value: string) {
  if (["opened", "clicked", "read"].includes(value)) return "delivered";
  if (value === "suppressed") return "unsubscribed";
  return value;
}
