import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export function verifyBrevoWebhook(received: string | null, secret = process.env.GENCOUV_BREVO_WEBHOOK_SECRET) {
  if (!secret || secret.length < 32 || !received) return false;
  const expected = createHash("sha256").update(secret).digest();
  const supplied = createHash("sha256").update(received).digest();
  return timingSafeEqual(expected, supplied);
}

const events: Record<string,string> = {
  request:"submitted", requests:"submitted", sent:"submitted", delivered:"delivered",
  hardbounce:"bounced", hardbounces:"bounced",
  softbounce:"delivery_delayed", softbounces:"delivery_delayed", deferred:"delivery_delayed",
  spam:"complained", unsubscribed:"unsubscribed", blocked:"failed",
  invalid:"failed", error:"failed", opened:"opened", uniqueopened:"opened",
  click:"clicked", clicks:"clicked", clicked:"clicked"
};

export function normalizeBrevoEvent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const type = events[String(data.event || "").toLowerCase().replace(/[_-]/g,"")];
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const providerId = typeof data["message-id"] === "string" ? data["message-id"].trim() : "";
  const timestamp = Number(data.ts_event);
  if (!type || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email) || email.length > 254 ||
      !providerId || providerId.length > 512 || /[\r\n]/.test(providerId) ||
      !Number.isFinite(timestamp) || timestamp < 1 || timestamp * 1000 > Date.now() + 300000) return null;
  const occurredAt = new Date(timestamp * 1000).toISOString();
  const eventId = createHash("sha256").update(JSON.stringify([providerId,email,type,occurredAt])).digest("hex");
  return { type, email, providerId, occurredAt, eventId };
}
