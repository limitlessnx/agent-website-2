import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyMetaWebhook(body: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  const supplied = Buffer.from(signature.slice(7), "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
