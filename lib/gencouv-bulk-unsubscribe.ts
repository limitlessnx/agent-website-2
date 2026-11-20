import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type UnsubscribeIdentity = { organizationId: string; email: string };
const emailPattern = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function key(): string {
  const secret = process.env.GENCOUV_UNSUBSCRIBE_SECRET;
  if (!secret || secret.length < 32) throw new Error("Campaign unsubscribe configuration is incomplete.");
  return secret;
}

export function createGencouvUnsubscribeUrl(identity: UnsubscribeIdentity): string {
  const email = identity.email.trim().toLowerCase();
  if (!uuidPattern.test(identity.organizationId) || !emailPattern.test(email)) {
    throw new Error("Invalid unsubscribe identity.");
  }
  const payload = Buffer.from(JSON.stringify({ o: identity.organizationId, e: email })).toString("base64url");
  const signature = createHmac("sha256", key()).update(payload).digest("base64url");
  return "https://fluxknight.space/api/gencouv/bulk-unsubscribe?token=" +
    encodeURIComponent(payload + "." + signature);
}

export function verifyGencouvUnsubscribeToken(token: string): UnsubscribeIdentity | null {
  if (token.length > 1500) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const actual = Buffer.from(signature, "base64url");
  const expected = createHmac("sha256", key()).update(payload).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded || typeof decoded !== "object") return null;
    const { o, e } = decoded as { o?: unknown; e?: unknown };
    if (typeof o !== "string" || !uuidPattern.test(o) ||
        typeof e !== "string" || !emailPattern.test(e) || e.length > 254) return null;
    return { organizationId: o, email: e };
  } catch { return null; }
}
