import crypto from "node:crypto";

const FLW_API = "https://api.flutterwave.com/v3";

export function getFlutterwaveSecret() {
  const secret = process.env.FLW_SECRET_KEY?.trim();
  if (!secret) throw new Error("Flutterwave server credentials are not configured.");
  return secret;
}

export async function flutterwaveRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${FLW_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getFlutterwaveSecret()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Flutterwave request failed: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload as T;
}

export function isValidFlutterwaveWebhook(rawBody: string, headers: Headers) {
  const secretHash = process.env.FLW_SECRET_HASH?.trim();
  if (!secretHash) return false;

  const verifHash = headers.get("verif-hash");
  if (verifHash && Buffer.byteLength(verifHash) === Buffer.byteLength(secretHash)) {
    if (crypto.timingSafeEqual(Buffer.from(verifHash), Buffer.from(secretHash))) return true;
  }

  const signature = headers.get("flutterwave-signature");
  if (!signature) return false;

  const digest = crypto.createHmac("sha256", secretHash).update(rawBody).digest("base64");
  if (Buffer.byteLength(signature) !== Buffer.byteLength(digest)) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}
