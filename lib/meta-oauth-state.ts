import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

type MetaOAuthStatePayload = {
  organizationId: string;
  issuedAt: number;
  nonce: string;
};

function stateSecret() {
  return (
    process.env.META_OAUTH_STATE_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.LIMITLESS_ADMIN_PASSWORD ||
    "development-only-change-this-meta-oauth-secret"
  );
}

function sign(payload: string) {
  return createHmac("sha256", stateSecret()).update(payload).digest("base64url");
}

function safeEqual(leftValue: string, rightValue: string) {
  const left = Buffer.from(leftValue);
  const right = Buffer.from(rightValue);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createMetaOAuthState(organizationId: string) {
  const payload: MetaOAuthStatePayload = {
    organizationId,
    issuedAt: Date.now(),
    nonce: randomBytes(24).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyMetaOAuthState(value: string | null) {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as MetaOAuthStatePayload;

    if (!payload.organizationId || !payload.issuedAt || !payload.nonce) return null;
    if (Date.now() - payload.issuedAt > STATE_TTL_MS) return null;
    if (payload.issuedAt - Date.now() > 60_000) return null;

    return payload;
  } catch {
    return null;
  }
}
