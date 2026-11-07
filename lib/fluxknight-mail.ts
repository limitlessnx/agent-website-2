/**
 * Fluxknight-only Resend adapter. Never expose the API key to the browser.
 * Resend is account-wide; every read is filtered to allowed Fluxknight addresses.
 */
export const FLUXKNIGHT_SENDERS = ["limitless@fluxknight.space", "info@fluxknight.space"] as const;
export type FluxknightSender = (typeof FLUXKNIGHT_SENDERS)[number];

export function isFluxknightAddress(value: unknown): value is FluxknightSender {
  return typeof value === "string" && FLUXKNIGHT_SENDERS.includes(value.trim().toLowerCase() as FluxknightSender);
}
export function addressMatches(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(addressMatches);
  if (typeof value !== "string") return false;
  return FLUXKNIGHT_SENDERS.some(address => value.toLowerCase().includes(address));
}
export type MailRow = {
  id: string; from: string; to: string[]; subject: string; created_at: string;
  html?: string; text?: string; last_event?: string; message_id?: string;
};
export async function resendApi(path: string, init: RequestInit = {}) {
  const key = process.env.FLUXKNIGHT_RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!key) throw new Error("Resend API key is not configured for the dashboard.");
  const res = await fetch("https://api.resend.com" + path, {
    ...init,
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body && typeof body === "object" && "message" in body ? String(body.message) : "Resend request failed.";
    throw new Error("Resend " + res.status + ": " + detail);
  }
  return body as Record<string, unknown>;
}
export function asMailRows(value: unknown): MailRow[] {
  if (!value || typeof value !== "object" || !("data" in value)) return [];
  const data = (value as {data?:unknown}).data;
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is MailRow => Boolean(row && typeof row.id === "string"))
    .map(row => ({
      id: row.id,
      from: String(row.from || ""),
      to: Array.isArray(row.to) ? row.to.map(String) : [],
      subject: String(row.subject || "(No subject)"),
      created_at: String(row.created_at || ""),
      last_event: typeof row.last_event === "string" ? row.last_event : undefined,
      message_id: typeof row.message_id === "string" ? row.message_id : undefined,
    }));
}
