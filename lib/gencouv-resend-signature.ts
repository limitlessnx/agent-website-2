import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify the exact raw payload; no optional token-only or unsigned fallback. */
export function verifyGencouvResendSignature(raw: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get("svix-id") || "";
  const timestamp = headers.get("svix-timestamp") || "";
  const signature = headers.get("svix-signature") || "";
  if (!secret || !id || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret, "base64");
  if (!key.length) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest();
  return signature.split(/\s+/).some(part => {
    if (!part.startsWith("v1,")) return false;
    const supplied = Buffer.from(part.slice(3), "base64");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}
